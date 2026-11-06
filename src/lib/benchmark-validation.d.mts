export const MAX_BENCHMARK_TEST_CASES: number;

export type BenchmarkTestCase = {
  id: number;
  input: string;
  expectedOutput: string;
};

export function normalizeBenchmarkTestCases(value: unknown): BenchmarkTestCase[];
