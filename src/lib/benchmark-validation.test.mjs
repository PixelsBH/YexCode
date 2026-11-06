import assert from "node:assert/strict";
import test from "node:test";

import { MAX_BENCHMARK_TEST_CASES, normalizeBenchmarkTestCases } from "./benchmark-validation.mjs";

test("custom stdin/stdout test cases preserve string input and expected output", () => {
  assert.deepEqual(normalizeBenchmarkTestCases([
    { id: 1, input: "3\n1 2 3\n", expectedOutput: "6\n" },
    { id: 2, input: "0\n", expectedOutput: "0" },
  ]), [
    { id: 1, input: "3\n1 2 3\n", expectedOutput: "6\n" },
    { id: 2, input: "0\n", expectedOutput: "0" },
  ]);
});

test("custom benchmark tests require at least one case and enforce the case cap", () => {
  assert.throws(() => normalizeBenchmarkTestCases([]), /at least one/);
  const tooMany = Array.from({ length: MAX_BENCHMARK_TEST_CASES + 1 }, (_, index) => ({ id: index + 1, input: "", expectedOutput: "" }));
  assert.throws(() => normalizeBenchmarkTestCases(tooMany), /at most/);
});

test("custom benchmark tests reject malformed, duplicate, and non-string cases", () => {
  assert.throws(() => normalizeBenchmarkTestCases([null]), /not a valid/);
  assert.throws(() => normalizeBenchmarkTestCases([{ id: 1, input: "", expectedOutput: 1 }]), /string expectedOutput/);
  assert.throws(() => normalizeBenchmarkTestCases([
    { id: 1, input: "", expectedOutput: "a" },
    { id: 1, input: "", expectedOutput: "b" },
  ]), /unique/);
});
