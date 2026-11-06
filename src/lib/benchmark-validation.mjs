export const MAX_BENCHMARK_TEST_CASES = 50;

export function normalizeBenchmarkTestCases(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Provide at least one custom test case.");
  }
  if (value.length > MAX_BENCHMARK_TEST_CASES) {
    throw new Error(`A benchmark can contain at most ${MAX_BENCHMARK_TEST_CASES} test cases.`);
  }

  const ids = new Set();
  return value.map((testCase, index) => {
    const label = `Test case ${index + 1}`;
    if (!testCase || typeof testCase !== "object" || Array.isArray(testCase)) {
      throw new Error(`${label} is not a valid test case.`);
    }
    const { id, input, expectedOutput } = testCase;
    if (!Number.isSafeInteger(id) || id < 1 || typeof input !== "string" || typeof expectedOutput !== "string") {
      throw new Error(`${label} must have a positive ID, string input, and string expectedOutput.`);
    }
    if (ids.has(id)) throw new Error(`Test case IDs must be unique (duplicate ID ${id}).`);
    ids.add(id);
    return { id, input, expectedOutput };
  });
}
