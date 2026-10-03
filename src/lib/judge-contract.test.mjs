import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeJudgeError,
  normalizeJudgeResult,
  normalizeSubmissionEnvelope,
} from "./judge-contract.mjs";

test("judge results preserve optional metrics and derive stable error stages", () => {
  assert.deepEqual(normalizeJudgeResult({
    status: "wrong_answer",
    passedTestCases: 2,
    totalTestCases: 5,
    runtimeMs: 3,
    memoryMb: 1.25,
    failedTestCase: { id: 3, args: [[1, 2]], expected: 3, actualOutput: "2" },
  }), {
    status: "wrong_answer",
    passedTestCases: 2,
    totalTestCases: 5,
    runtimeMs: 3,
    memoryMb: 1.25,
    failedTestCase: { id: 3, args: [[1, 2]], expected: 3, actualOutput: "2" },
    errorStage: "result_comparison",
  });

  assert.equal(normalizeJudgeResult({
    status: "accepted",
    passedTestCases: 1,
    totalTestCases: 1,
    score: 100,
  }).score, 100);
});

test("judge results reject inconsistent counters, statuses, and failure locations", () => {
  assert.equal(normalizeJudgeResult({ status: "accepted", passedTestCases: 2, totalTestCases: 1 }), null);
  assert.equal(normalizeJudgeResult({ status: "unknown", passedTestCases: 0, totalTestCases: 1 }), null);
  assert.equal(normalizeJudgeResult({
    status: "runtime_error",
    passedTestCases: 0,
    totalTestCases: 1,
    failedTestCase: { id: 0 },
  }), null);
});

test("submission envelopes normalize IDs for create and poll responses", () => {
  assert.deepEqual(normalizeSubmissionEnvelope({ submissionId: "judge-1", status: "queued" }, "create"), {
    submissionId: "judge-1",
    status: "queued",
  });
  assert.deepEqual(normalizeSubmissionEnvelope({
    id: "judge-1",
    status: "finished",
    result: { status: "accepted", passedTestCases: 1, totalTestCases: 1 },
  }, "poll"), {
    id: "judge-1",
    status: "finished",
    result: { status: "accepted", passedTestCases: 1, totalTestCases: 1 },
  });
  assert.equal(normalizeSubmissionEnvelope({ id: "judge-1", status: "finished" }, "poll"), null);
});

test("judge API errors receive a bounded, stable error envelope", () => {
  const normalized = normalizeJudgeError({
    error: { code: "validation_error", message: "Invalid test case" },
  }, "request-1");
  assert.deepEqual(normalized, {
    error: { code: "validation_error", message: "Invalid test case", requestId: "request-1" },
  });
  assert.equal(normalizeJudgeError({ error: { message: "x".repeat(9000) } }, "request-2").error.message.length, 8192);
});
