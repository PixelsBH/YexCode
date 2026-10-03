import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Problem from "@/models/Problem";

const MAX_REQUEST_BYTES = 1024 * 1024;
const MAX_SOURCE_BYTES = 128 * 1024;
const MAX_TEST_CASES = 500;
const DEFAULT_LIMITS = { timeLimitMs: 1000, memoryLimitMb: 128 };

type Operation = "run" | "submit";
type JsonTestCase = { id: number; args: unknown[]; expected: unknown };
type JudgePayload = {
  language: "cpp";
  mode: "function";
  sourceCode: string;
  function: {
    name: string;
    returnType: string;
    params: Array<{ name: string; type: string }>;
    comparison?: { returnArrayOrder: "unordered" };
  };
  testCases: JsonTestCase[];
  limits: { timeLimitMs: number; memoryLimitMb: number };
};

class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeTestCase(value: unknown, label: string, expectedArgs: number): JsonTestCase {
  if (!isRecord(value)) {
    throw new Error(`${label} is not a valid test case.`);
  }

  const { id, args, expected } = value;
  if (!Number.isSafeInteger(id) || Number(id) < 1 || !Array.isArray(args) || !Object.hasOwn(value, "expected")) {
    throw new Error(`${label} must have a positive ID, an args array, and an expected value.`);
  }
  if (args.length !== expectedArgs) {
    throw new Error(`${label} has ${args.length} arguments; expected ${expectedArgs}.`);
  }

  return { id: Number(id), args, expected };
}

function normalizeLimits(value: unknown) {
  if (!isRecord(value)) return DEFAULT_LIMITS;

  const timeLimitMs = Number(value.timeLimitMs);
  const memoryLimitMb = Number(value.memoryLimitMb);
  if (
    !Number.isSafeInteger(timeLimitMs) || timeLimitMs < 1 || timeLimitMs > 30_000 ||
    !Number.isSafeInteger(memoryLimitMb) || memoryLimitMb < 16 || memoryLimitMb > 2048
  ) {
    throw new Error("Problem execution limits are outside the supported range.");
  }
  return { timeLimitMs, memoryLimitMb };
}

async function buildJudgePayload(body: unknown, operation: Operation): Promise<JudgePayload> {
  if (!isRecord(body)) throw new RequestError("Request body must be a JSON object.", 400);

  const allowedKeys = new Set(["slug", "language", "sourceCode"]);
  if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
    throw new RequestError("Only slug, language, and sourceCode may be provided.", 400);
  }

  const { slug, language, sourceCode } = body;
  if (typeof slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100) {
    throw new RequestError("A valid problem slug is required.", 400);
  }
  if (language !== "cpp") {
    throw new RequestError("Function Mode currently supports C++ only.", 400);
  }
  if (typeof sourceCode !== "string") {
    throw new RequestError("sourceCode must be a string.", 400);
  }
  if (Buffer.byteLength(sourceCode, "utf8") > MAX_SOURCE_BYTES) {
    throw new RequestError("Source code exceeds the 128 KB limit.", 413);
  }

  await dbConnect();
  const problem = await Problem.findOne({ slug }).lean();
  if (!problem) throw new RequestError("Problem not found.", 404);

  const content = problem as unknown as Record<string, unknown>;
  const functionValue = content.function;
  if (!isRecord(functionValue) || typeof functionValue.name !== "string" || typeof functionValue.returnType !== "string" || !Array.isArray(functionValue.params)) {
    throw new Error("Problem is missing valid Function Mode metadata.");
  }
  const params = functionValue.params.map((param, index) => {
    if (!isRecord(param) || typeof param.name !== "string" || typeof param.type !== "string") {
      throw new Error(`Function parameter ${index + 1} is invalid.`);
    }
    return { name: param.name, type: param.type };
  });

  const examplesValue = content.examples;
  if (!Array.isArray(examplesValue) || examplesValue.length === 0) {
    throw new Error("Problem must contain at least one visible example.");
  }
  const examples = examplesValue.map((testCase, index) =>
    normalizeTestCase(testCase, `Example ${index + 1}`, params.length)
  );

  const hiddenValue = content.hiddenTestCases;
  if (!Array.isArray(hiddenValue)) throw new Error("Problem hidden tests are invalid.");
  const hiddenTestCases = hiddenValue.map((testCase, index) =>
    normalizeTestCase(testCase, `Hidden test ${index + 1}`, params.length)
  );

  const testCases = operation === "run" ? examples : [...examples, ...hiddenTestCases];
  if (testCases.length > MAX_TEST_CASES) {
    throw new Error(`Problem has more than ${MAX_TEST_CASES} test cases.`);
  }
  const ids = new Set<number>();
  for (const testCase of testCases) {
    if (ids.has(testCase.id)) throw new Error(`Problem has duplicate test case ID ${testCase.id}.`);
    ids.add(testCase.id);
  }

  const paramsMetadata = functionValue.comparison;
  const comparison = isRecord(paramsMetadata) && paramsMetadata.returnArrayOrder === "unordered"
    ? { returnArrayOrder: "unordered" as const }
    : undefined;

  return {
    language: "cpp",
    mode: "function",
    sourceCode,
    function: {
      name: functionValue.name,
      returnType: functionValue.returnType,
      params,
      ...(comparison ? { comparison } : {}),
    },
    testCases,
    limits: normalizeLimits(content.limits),
  };
}

function requestIdFor(request: NextRequest): string {
  const requestId = request.headers.get("x-request-id")?.trim();
  return requestId && /^[a-zA-Z0-9_.-]{1,128}$/.test(requestId) ? requestId : randomUUID();
}

function errorResponse(message: string, status: number, requestId: string) {
  return NextResponse.json(
    { error: message, requestId },
    { status, headers: { "X-Request-ID": requestId, "Cache-Control": "no-store" } }
  );
}

function getJudgeSubmissionsUrl(): string | null {
  const base = process.env.JUDGE_BASE_URL?.trim().replace(/\/$/, "");
  if (!base) return null;
  return base.endsWith("/submissions") ? base : `${base}/submissions`;
}

function judgeResponse(response: Response, requestId: string) {
  return response.text().then((body) => {
    const headers = new Headers({
      "Content-Type": response.headers.get("content-type") || "application/json",
      "Cache-Control": "no-store",
      "X-Request-ID": response.headers.get("x-request-id") || requestId,
    });
    return new NextResponse(body, { status: response.status, headers });
  });
}

export async function createJudgeSubmission(request: NextRequest, operation: Operation) {
  const requestId = requestIdFor(request);
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return errorResponse("Request body exceeds the 1 MB limit.", 413, requestId);
  }

  let body: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_REQUEST_BYTES) {
      return errorResponse("Request body exceeds the 1 MB limit.", 413, requestId);
    }
    body = JSON.parse(raw);
  } catch {
    return errorResponse("Request body must be valid JSON.", 400, requestId);
  }

  let payload: JudgePayload;
  try {
    payload = await buildJudgePayload(body, operation);
  } catch (error) {
    if (error instanceof RequestError) return errorResponse(error.message, error.status, requestId);
    console.error("Unable to prepare YexJudge request", { requestId, error });
    return errorResponse("Problem execution data is invalid or unavailable.", 500, requestId);
  }

  const submissionsUrl = getJudgeSubmissionsUrl();
  if (!submissionsUrl) {
    return errorResponse("YexJudge is not configured on the server.", 500, requestId);
  }

  try {
    const response = await fetch(submissionsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Request-ID": requestId },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: request.signal,
    });
    return judgeResponse(response, requestId);
  } catch {
    return errorResponse("YexJudge is unavailable. Please retry shortly.", 502, requestId);
  }
}

export async function getJudgeSubmission(request: NextRequest, id: string) {
  const requestId = requestIdFor(request);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    return errorResponse("Invalid submission ID.", 400, requestId);
  }

  const submissionsUrl = getJudgeSubmissionsUrl();
  if (!submissionsUrl) {
    return errorResponse("YexJudge is not configured on the server.", 500, requestId);
  }

  try {
    const response = await fetch(`${submissionsUrl}/${encodeURIComponent(id)}`, {
      cache: "no-store",
      headers: { "X-Request-ID": requestId },
      signal: request.signal,
    });
    return judgeResponse(response, requestId);
  } catch {
    return errorResponse("YexJudge is unavailable. Please retry shortly.", 502, requestId);
  }
}
