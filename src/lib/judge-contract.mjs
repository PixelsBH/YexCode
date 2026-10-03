const submissionStatuses = new Set(["queued", "running", "finished", "failed"]);
const resultStatuses = new Set([
  "accepted",
  "wrong_answer",
  "compilation_error",
  "runtime_error",
  "time_limit_exceeded",
  "memory_limit_exceeded",
  "output_limit_exceeded",
  "validation_error",
  "infrastructure_error",
]);
const resultStages = {
  wrong_answer: "result_comparison",
  compilation_error: "compilation",
  runtime_error: "test_case_execution",
  time_limit_exceeded: "test_case_execution",
  memory_limit_exceeded: "test_case_execution",
  output_limit_exceeded: "test_case_execution",
  validation_error: "validation",
  infrastructure_error: "infrastructure",
};
const MAX_ERROR_MESSAGE_LENGTH = 8_192;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function normalizeFailedCase(value) {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value) || !Number.isSafeInteger(value.id) || value.id < 1) return null;
  if (value.args !== undefined && !Array.isArray(value.args)) return null;
  for (const key of ["input", "expectedOutput", "actualOutput"]) {
    if (value[key] !== undefined && typeof value[key] !== "string") return null;
  }

  const failedCase = { id: value.id };
  if (value.args !== undefined) failedCase.args = value.args;
  if (Object.hasOwn(value, "expected")) failedCase.expected = value.expected;
  if (value.input !== undefined) failedCase.input = value.input;
  if (value.expectedOutput !== undefined) failedCase.expectedOutput = value.expectedOutput;
  if (value.actualOutput !== undefined) failedCase.actualOutput = value.actualOutput;
  return failedCase;
}

export function normalizeJudgeResult(value) {
  if (!isRecord(value) || typeof value.status !== "string" || !resultStatuses.has(value.status)) return null;
  if (!isNonNegativeInteger(value.passedTestCases) || !isNonNegativeInteger(value.totalTestCases) ||
    value.passedTestCases > value.totalTestCases) return null;

  const normalized = {
    status: value.status,
    passedTestCases: value.passedTestCases,
    totalTestCases: value.totalTestCases,
  };
  if (value.runtimeMs !== undefined) {
    if (!isNonNegativeInteger(value.runtimeMs)) return null;
    normalized.runtimeMs = value.runtimeMs;
  }
  if (value.memoryMb !== undefined) {
    if (typeof value.memoryMb !== "number" || !Number.isFinite(value.memoryMb) || value.memoryMb < 0) return null;
    normalized.memoryMb = value.memoryMb;
  }
  if (value.score !== undefined) {
    if (typeof value.score !== "number" || !Number.isFinite(value.score)) return null;
    normalized.score = value.score;
  }
  if (value.errorMessage !== undefined) {
    if (typeof value.errorMessage !== "string") return null;
    normalized.errorMessage = value.errorMessage.slice(0, MAX_ERROR_MESSAGE_LENGTH);
  }
  if (value.failedTestCase !== undefined) {
    const failedCase = normalizeFailedCase(value.failedTestCase);
    if (!failedCase) return null;
    normalized.failedTestCase = failedCase;
  }
  if (resultStages[value.status]) normalized.errorStage = resultStages[value.status];
  return normalized;
}

export function normalizeSubmissionEnvelope(value, kind) {
  if (!isRecord(value) || !["create", "poll"].includes(kind) ||
    typeof value.status !== "string" || !submissionStatuses.has(value.status)) return null;

  const id = kind === "create" ? value.submissionId ?? value.id : value.id;
  if (typeof id !== "string" || id.length === 0 || id.length > 128) return null;

  let result;
  if (value.result !== undefined && value.result !== null) {
    result = normalizeJudgeResult(value.result);
    if (!result) return null;
  }
  if (value.status === "finished" && !result) return null;

  return {
    [kind === "create" ? "submissionId" : "id"]: id,
    status: value.status,
    ...(result ? { result } : {}),
  };
}

export function normalizeJudgeError(value, requestId) {
  const error = isRecord(value) && isRecord(value.error) ? value.error : null;
  const rawMessage = error?.message ?? (isRecord(value) ? value.message : undefined);
  const message = typeof rawMessage === "string" && rawMessage.trim()
    ? rawMessage.slice(0, MAX_ERROR_MESSAGE_LENGTH)
    : "YexJudge could not process the request.";
  const code = typeof error?.code === "string" && /^[a-z0-9_]{1,64}$/i.test(error.code)
    ? error.code
    : "judge_error";
  return { error: { code, message, requestId } };
}
