export type ErrorStage =
  | "result_comparison"
  | "compilation"
  | "test_case_execution"
  | "validation"
  | "infrastructure";

export type NormalizedFailedCase = {
  id: number;
  args?: unknown[];
  expected?: unknown;
  input?: string;
  expectedOutput?: string;
  actualOutput?: string;
};

export type NormalizedJudgeResult = {
  status: string;
  passedTestCases: number;
  totalTestCases: number;
  runtimeMs?: number;
  memoryMb?: number;
  score?: number;
  failedTestCase?: NormalizedFailedCase;
  errorStage?: ErrorStage;
  errorMessage?: string;
};

export type NormalizedSubmissionEnvelope = {
  id?: string;
  submissionId?: string;
  status: "queued" | "running" | "finished" | "failed";
  result?: NormalizedJudgeResult;
};

export function normalizeJudgeResult(value: unknown): NormalizedJudgeResult | null;
export function normalizeSubmissionEnvelope(
  value: unknown,
  kind: "create" | "poll"
): NormalizedSubmissionEnvelope | null;
export function normalizeJudgeError(value: unknown, requestId: string): {
  error: { code: string; message: string; requestId: string };
};
