import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Problem from "@/models/Problem";
import Submission from "@/models/Submission";
import { getOrSyncUser } from "@/lib/auth-user";
import { checkRateLimit, getClientIp, rateLimitIdentifier, type PolicyName } from "@/lib/rate-limit";
import { ownedSubmissionFilter } from "@/lib/submission-access.mjs";
import { MAX_REQUEST_BYTES, sourceCodeWithinLimit, readBoundedBody } from "@/lib/request-limits.mjs";
import { normalizeBenchmarkTestCases } from "@/lib/benchmark-validation.mjs";
import {
  normalizeJudgeError,
  normalizeSubmissionEnvelope,
} from "@/lib/judge-contract.mjs";


const MAX_TEST_CASES = 500;
const DEFAULT_LIMITS = { timeLimitMs: 1000, memoryLimitMb: 128 };

type Operation = "run" | "submit";
type JsonFunctionTestCase = { id: number; args: unknown[]; expected: unknown };
type JsonClassTestCase = {
  id: number;
  constructorArgs: unknown[];
  operations: Array<{ name: string; args: unknown[] }>;
  expected: unknown[];
};
type JsonStdinTestCase = { id: number; input: string; expectedOutput: string };
type JudgePayload = {
  language: "c" | "cpp" | "python";
  mode: "function" | "class" | "stdin";
  sourceCode: string;
  function?: {
    name: string;
    returnType: string;
    params: Array<{ name: string; type: string }>;
    comparison?: { returnArrayOrder: "unordered" };
  };
  class?: {
    name: string;
    constructor: { params: Array<{ name: string; type: string }> };
    operations: Array<{ name: string; returnType: string; params: Array<{ name: string; type: string }> }>;
  };
  testCases: Array<JsonFunctionTestCase | JsonClassTestCase | JsonStdinTestCase>;
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

function normalizeTestCase(value: unknown, label: string, expectedArgs: number): JsonFunctionTestCase {
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
  if (language !== "cpp" && language !== "python") {
    throw new RequestError("Problem solutions currently support C++ and Python only.", 400);
  }
  if (typeof sourceCode !== "string") {
    throw new RequestError("sourceCode must be a string.", 400);
  }
  if (!sourceCodeWithinLimit(sourceCode)) {
    throw new RequestError("Source code exceeds the 128 KB limit.", 413);
  }

  await dbConnect();
  const problem = await Problem.findOne({ slug }).lean();
  if (!problem) throw new RequestError("Problem not found.", 404);

  const content = problem as unknown as Record<string, unknown>;
  const examplesValue = content.examples;
  if (!Array.isArray(examplesValue) || examplesValue.length === 0) {
    throw new Error("Problem must contain at least one visible example.");
  }
  const hiddenValue = content.hiddenTestCases;
  if (!Array.isArray(hiddenValue)) throw new Error("Problem hidden tests are invalid.");
  const sourceCases = operation === "run" ? examplesValue : [...examplesValue, ...hiddenValue];
  if (sourceCases.length > MAX_TEST_CASES) throw new Error(`Problem has more than ${MAX_TEST_CASES} test cases.`);
  const ids = new Set<number>();
  for (const [index, testCase] of sourceCases.entries()) {
    if (!isRecord(testCase) || !Number.isSafeInteger(testCase.id) || Number(testCase.id) < 1) {
      throw new Error(`Test case ${index + 1} has an invalid ID.`);
    }
    if (ids.has(Number(testCase.id))) throw new Error(`Problem has duplicate test case ID ${testCase.id}.`);
    ids.add(Number(testCase.id));
  }

  const functionValue = content.function;
  if (isRecord(functionValue)) {
    if (typeof functionValue.name !== "string" || typeof functionValue.returnType !== "string" || !Array.isArray(functionValue.params)) {
      throw new Error("Problem is missing valid Function Mode metadata.");
    }
    const params = functionValue.params.map((param, index) => {
      if (!isRecord(param) || typeof param.name !== "string" || typeof param.type !== "string") {
        throw new Error(`Function parameter ${index + 1} is invalid.`);
      }
      return { name: param.name, type: param.type };
    });
    const testCases = sourceCases.map((testCase, index) => normalizeTestCase(testCase, `Test case ${index + 1}`, params.length));
    const comparisonMetadata = functionValue.comparison;
    const comparison = isRecord(comparisonMetadata) && comparisonMetadata.returnArrayOrder === "unordered"
      ? { returnArrayOrder: "unordered" as const }
      : undefined;
    return {
      language,
      mode: "function",
      sourceCode,
      function: { name: functionValue.name, returnType: functionValue.returnType, params, ...(comparison ? { comparison } : {}) },
      testCases,
      limits: normalizeLimits(content.limits),
    };
  }

  const classValue = content.class;
  if (!isRecord(classValue) || typeof classValue.name !== "string" || !isRecord(classValue.constructor) || !Array.isArray(classValue.constructor.params) || !Array.isArray(classValue.operations)) {
    throw new Error("Problem is missing valid Class Mode metadata.");
  }
  const normalizeParams = (value: unknown, label: string) => {
    if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
    return value.map((param, index) => {
      if (!isRecord(param) || typeof param.name !== "string" || typeof param.type !== "string") {
        throw new Error(`${label} parameter ${index + 1} is invalid.`);
      }
      return { name: param.name, type: param.type };
    });
  };
  const constructorParams = normalizeParams(classValue.constructor.params, "Constructor");
  const operations = classValue.operations.map((operationValue, index) => {
    if (!isRecord(operationValue) || typeof operationValue.name !== "string" || typeof operationValue.returnType !== "string") {
      throw new Error(`Class operation ${index + 1} is invalid.`);
    }
    return { name: operationValue.name, returnType: operationValue.returnType, params: normalizeParams(operationValue.params, `Class operation ${operationValue.name}`) };
  });
  const classOperations = new Map(operations.map((operationValue) => [operationValue.name, operationValue]));
  const testCases: JsonClassTestCase[] = sourceCases.map((value, index) => {
    if (!isRecord(value) || !Array.isArray(value.constructorArgs) || !Array.isArray(value.operations) || !Array.isArray(value.expected)) {
      throw new Error(`Class test case ${index + 1} must have constructorArgs, operations, and expected arrays.`);
    }
    if (value.constructorArgs.length !== constructorParams.length || value.operations.length === 0 || value.expected.length !== value.operations.length) {
      throw new Error(`Class test case ${index + 1} does not match its class contract.`);
    }
    const normalizedOperations = value.operations.map((call, callIndex) => {
      if (!isRecord(call) || typeof call.name !== "string" || !Array.isArray(call.args)) {
        throw new Error(`Class test case ${index + 1} operation ${callIndex + 1} is invalid.`);
      }
      const declared = classOperations.get(call.name);
      if (!declared || declared.params.length !== call.args.length) {
        throw new Error(`Class test case ${index + 1} operation ${call.name} does not match class metadata.`);
      }
      return { name: call.name, args: call.args };
    });
    return { id: Number(value.id), constructorArgs: value.constructorArgs, operations: normalizedOperations, expected: value.expected };
  });
  return {
    language,
    mode: "class",
    sourceCode,
    class: { name: classValue.name, constructor: { params: constructorParams }, operations },
    testCases,
    limits: normalizeLimits(content.limits),
  };
}

async function buildBenchmarkPayload(body: unknown): Promise<JudgePayload> {
  if (!isRecord(body)) throw new RequestError("Request body must be a JSON object.", 400);
  const allowedKeys = new Set(["language", "sourceCode", "testCases", "runOnly"]);
  if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
    throw new RequestError("Only language, sourceCode, testCases, and runOnly may be provided.", 400);
  }

  const { language, sourceCode, testCases, runOnly } = body;
  if (runOnly !== undefined && typeof runOnly !== "boolean") {
    throw new RequestError("runOnly must be a boolean.", 400);
  }
  if (language !== "c" && language !== "cpp" && language !== "python") {
    throw new RequestError("Custom stdin/stdout benchmarks support C, C++, and Python.", 400);
  }
  if (typeof sourceCode !== "string") throw new RequestError("sourceCode must be a string.", 400);
  if (!sourceCodeWithinLimit(sourceCode)) {
    throw new RequestError("Source code exceeds the 128 KB limit.", 413);
  }

  let normalizedTestCases;
  try {
    normalizedTestCases = normalizeBenchmarkTestCases(testCases);
    if (runOnly) {
      if (normalizedTestCases.length !== 1) throw new Error("A normal run must contain exactly one input case.");
      normalizedTestCases[0].expectedOutput = `__YEX_RUN_OUTPUT_${randomUUID()}__`;
    }
  } catch (error) {
    throw new RequestError(error instanceof Error ? error.message : "Custom test cases are invalid.", 400);
  }

  return {
    language,
    mode: "stdin",
    sourceCode,
    testCases: normalizedTestCases,
    limits: DEFAULT_LIMITS,
  };
}

function requestIdFor(request: NextRequest): string {
  const requestId = request.headers.get("x-request-id")?.trim();
  return requestId && /^[a-zA-Z0-9_.-]{1,128}$/.test(requestId) ? requestId : randomUUID();
}

function errorResponse(message: string, status: number, requestId: string) {
  const code = status === 400
    ? "validation_error"
    : status === 404
      ? "not_found"
      : status === 413
        ? "request_too_large"
        : status === 502
          ? "judge_unavailable"
          : "yexcode_error";
  return NextResponse.json(
    { error: { code, message: message.slice(0, 8_192), requestId } },
    { status, headers: { "X-Request-ID": requestId, "Cache-Control": "no-store" } }
  );
}

async function rateLimitResponse(
  name: PolicyName,
  identifier: string,
  requestId: string,
  failOpen = false,
) {
  const result = await checkRateLimit(name, identifier);
  if (result.success || (failOpen && result.unavailable)) return null;
  const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
  const status = result.unavailable ? 503 : 429;
  return NextResponse.json(
    { error: {
      code: result.unavailable ? "rate_limiter_unavailable" : "rate_limited",
      message: result.unavailable
        ? "Request protection is temporarily unavailable. Please retry shortly."
        : "Too many requests. Please wait before trying again.",
      requestId,
    } },
    {
      status,
      headers: {
        "X-Request-ID": requestId,
        "Cache-Control": "no-store",
        "Retry-After": String(retryAfter),
        "RateLimit-Limit": String(result.limit),
        "RateLimit-Remaining": String(result.remaining),
        "RateLimit-Reset": String(Math.ceil(result.reset / 1000)),
      },
    }
  );
}

function getJudgeSubmissionsUrl(): string | null {
  const base = process.env.JUDGE_BASE_URL?.trim().replace(/\/$/, "");
  if (!base) return null;
  return base.endsWith("/submissions") ? base : `${base}/submissions`;
}


async function judgeResponse(response: Response, requestId: string, kind: "create" | "poll") {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "X-Request-ID": response.headers.get("x-request-id") || requestId,
  });
  const maxResponseBytes = 256 * 1024;
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > maxResponseBytes) {
    await response.body?.cancel();
    return errorResponse("YexJudge returned an oversized response.", 502, requestId);
  }

  const raw = await readBoundedBody(response.body, maxResponseBytes);
  if (raw === null) return errorResponse("YexJudge returned an oversized response.", 502, requestId);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return errorResponse("YexJudge returned an invalid response.", 502, requestId);
  }

  if (!response.ok) {
    return NextResponse.json(normalizeJudgeError(body, requestId), { status: response.status, headers });
  }

  const normalized = normalizeSubmissionEnvelope(body, kind);
  if (!normalized) return errorResponse("YexJudge returned an invalid submission response.", 502, requestId);
  return NextResponse.json(normalized, { status: response.status, headers });
}

export async function createJudgeSubmission(request: NextRequest, operation: Operation) {
  const requestId = requestIdFor(request);
  const ipIdentifier = rateLimitIdentifier(getClientIp(request));
  const ipPolicy = operation === "run" ? "runCreateIp" : "submitCreateIp";
  const ipLimitResponse = await rateLimitResponse(ipPolicy, ipIdentifier, requestId);
  if (ipLimitResponse) return ipLimitResponse;

  let submitUser: Awaited<ReturnType<typeof getOrSyncUser>> = null;
  if (operation === "submit") {
    try {
      submitUser = await getOrSyncUser();
    } catch {
      return errorResponse("Could not verify your account. Please retry.", 500, requestId);
    }
    if (!submitUser) return errorResponse("Sign in to submit solutions.", 401, requestId);
    const userLimitResponse = await rateLimitResponse(
      "submitCreateUser",
      rateLimitIdentifier(String(submitUser._id)),
      requestId,
    );
    if (userLimitResponse) return userLimitResponse;
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return errorResponse("Request body exceeds the 1 MB limit.", 413, requestId);
  }

  let raw: string | null;
  try {
    raw = await readBoundedBody(request.body, MAX_REQUEST_BYTES);
  } catch {
    return errorResponse("Request body could not be read.", 400, requestId);
  }
  if (raw === null) return errorResponse("Request body exceeds the 1 MB limit.", 413, requestId);

  let body: unknown;
  try {
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

  let savedSubmission: { _id: unknown } | null = null;
  if (operation === "submit" && submitUser) {
    savedSubmission = await Submission.create({
      userId: submitUser._id,
      problemSlug: (body as Record<string, unknown>).slug,
      kind: "submit",
      language: payload.language,
      sourceCode: payload.sourceCode,
      status: "queued",
    });
  }

  const submissionsUrl = getJudgeSubmissionsUrl();
  if (!submissionsUrl) {
    if (savedSubmission) await Submission.updateOne({ _id: savedSubmission._id }, { $set: { status: "failed", verdict: "infrastructure_error", errorStage: "infrastructure", errorMessage: "YexJudge is not configured on the server." } });
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
    const result = await judgeResponse(response, requestId, "create");
    if (savedSubmission) {
      const body = await result.clone().json().catch(() => null) as { submissionId?: string; status?: string; result?: Record<string, unknown>; error?: { message?: string } } | null;
      if (result.ok && body?.submissionId) {
        const state = body.status === "finished" ? "finished" : body.status === "failed" ? "failed" : body.status;
        const update: Record<string, unknown> = { judgeSubmissionId: body.submissionId, status: state };
        if (body.result) Object.assign(update, resultFields(body.result));
        await Submission.updateOne({ _id: savedSubmission._id }, { $set: update });
      } else {
        const message = body?.error?.message || "YexJudge could not process the submission.";
        await Submission.updateOne({ _id: savedSubmission._id }, { $set: { status: "failed", verdict: "infrastructure_error", errorStage: "infrastructure", errorMessage: String(message).slice(0, 8192) } });
      }
    }
    return result;
  } catch {
    if (savedSubmission) await Submission.updateOne({ _id: savedSubmission._id }, { $set: { status: "failed", verdict: "infrastructure_error", errorStage: "infrastructure", errorMessage: "YexJudge is unavailable. Please retry shortly." } });
    return errorResponse("YexJudge is unavailable. Please retry shortly.", 502, requestId);
  }
}

function resultFields(result: Record<string, unknown>) {
  return {
    verdict: result.status,
    ...(typeof result.score === "number" ? { score: result.score } : {}),
    passedTestCases: result.passedTestCases,
    totalTestCases: result.totalTestCases,
    runtimeMs: result.runtimeMs,
    memoryMb: result.memoryMb,
    failedTestCase: result.failedTestCase,
    errorStage: result.errorStage,
    errorMessage: result.errorMessage,
  };
}

export async function createBenchmarkSubmission(request: NextRequest) {
  const requestId = requestIdFor(request);
  const ipLimitResponse = await rateLimitResponse(
    "benchmarkCreateIp",
    rateLimitIdentifier(getClientIp(request)),
    requestId,
  );
  if (ipLimitResponse) return ipLimitResponse;

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return errorResponse("Request body exceeds the 1 MB limit.", 413, requestId);
  }
  let raw: string | null;
  try {
    raw = await readBoundedBody(request.body, MAX_REQUEST_BYTES);
  } catch {
    return errorResponse("Request body could not be read.", 400, requestId);
  }
  if (raw === null) return errorResponse("Request body exceeds the 1 MB limit.", 413, requestId);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return errorResponse("Request body must be valid JSON.", 400, requestId);
  }

  let payload: JudgePayload;
  try {
    payload = await buildBenchmarkPayload(body);
  } catch (error) {
    if (error instanceof RequestError) return errorResponse(error.message, error.status, requestId);
    console.error("Unable to prepare YexJudge benchmark request", { requestId, error });
    return errorResponse("Benchmark problem data is invalid or unavailable.", 500, requestId);
  }

  const submissionsUrl = getJudgeSubmissionsUrl();
  if (!submissionsUrl) return errorResponse("YexJudge is not configured on the server.", 500, requestId);
  try {
    const response = await fetch(submissionsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Request-ID": requestId },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: request.signal,
    });
    return judgeResponse(response, requestId, "create");
  } catch {
    return errorResponse("YexJudge is unavailable. Please retry shortly.", 502, requestId);
  }
}

export async function getJudgeSubmission(request: NextRequest, id: string, operation: Operation | "benchmark" = "run") {
  const requestId = requestIdFor(request);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    return errorResponse("Invalid submission ID.", 400, requestId);
  }

  let ownedSubmission: { _id: unknown } | null = null;
  let pollUser: Awaited<ReturnType<typeof getOrSyncUser>> = null;
  if (operation === "submit") {
    try {
      pollUser = await getOrSyncUser();
    } catch {
      return errorResponse("Could not verify your account. Please retry.", 500, requestId);
    }
    if (!pollUser) return errorResponse("Sign in to view this submission.", 401, requestId);
    ownedSubmission = await Submission.findOne(ownedSubmissionFilter(pollUser._id, { judgeSubmissionId: id })).select("_id").lean() as unknown as { _id: unknown } | null;
    if (!ownedSubmission) return errorResponse("Submission not found.", 404, requestId);
  }

  const ipLimitResponse = await rateLimitResponse(
    "pollIp",
    rateLimitIdentifier(getClientIp(request)),
    requestId,
    true,
  );
  if (ipLimitResponse) return ipLimitResponse;
  if (pollUser) {
    const userLimitResponse = await rateLimitResponse(
      "pollUser",
      rateLimitIdentifier(String(pollUser._id)),
      requestId,
      true,
    );
    if (userLimitResponse) return userLimitResponse;
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
    const result = await judgeResponse(response, requestId, "poll");
    if (ownedSubmission && result.ok) {
      const body = await result.clone().json().catch(() => null) as { status?: string; result?: Record<string, unknown> } | null;
      const update: Record<string, unknown> = { status: body?.status };
      if (body?.result) Object.assign(update, resultFields(body.result));
      await Submission.updateOne({ _id: ownedSubmission._id }, { $set: update });
    }
    return result;
  } catch {
    return errorResponse("YexJudge is unavailable. Please retry shortly.", 502, requestId);
  }
}
