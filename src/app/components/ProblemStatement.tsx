import React from "react";

type ProblemExample = {
  args: unknown[];
  expected: unknown;
  explanation?: string;
};

type Problem = {
  title: string;
  difficulty: string;
  description: string;
  topics?: string[];
  companies?: string[];
  examples?: ProblemExample[];
  constraints?: string[];
  limits?: { timeLimitMs: number; memoryLimitMb: number };
};

type ProblemStatementProps = {
  problem: Problem;
};

// Format a value for display
const formatValue = (value: unknown): string => {
  if (typeof value === "string") return `"${value}"`;
  if (Array.isArray(value)) {
    return `[${value.map(formatValue).join(", ")}]`;
  }
  if (typeof value === "object" && value !== null) {
    return JSON.stringify(value);
  }
  return String(value);
};

export default function ProblemStatement({ problem }: ProblemStatementProps) {
  return (
    <div className="p-6 border rounded-lg shadow-md bg-neutral-800 border-white/60">
      <h1 className="text-2xl font-bold mb-2 text-white">{problem.title}</h1>
      <div className="mb-4">
        <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-sm text-white/80">
          {problem.difficulty}
        </span>
      </div>

      <p className="mb-4 text-white">{problem.description}</p>

      {problem.topics && problem.topics.length > 0 && (
        <details className="mb-3 rounded-md border border-white/10 bg-black/20 px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium text-white/70">Topics</summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {problem.topics.map((topic) => (
              <span key={topic} className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/70">
                {topic}
              </span>
            ))}
          </div>
        </details>
      )}

      {problem.companies && problem.companies.length > 0 && (
        <details className="mb-4 rounded-md border border-white/10 bg-black/20 px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium text-white/70">Companies</summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {problem.companies.map((company) => (
              <span key={company} className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/70">
                {company}
              </span>
            ))}
          </div>
        </details>
      )}

      {problem.examples && problem.examples.length > 0 && (
        <div className="mb-4">
          <h2 className="font-semibold mb-4 text-white text-lg">Examples:</h2>
          {problem.examples.map((ex, i) => (
            <div key={i} className="mb-4 p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
              <div className="text-sm font-semibold text-blue-400 mb-3">
                Example {i + 1}:
              </div>

              <div className="space-y-2 text-sm">
                {/* Show args */}
                {ex.args && Array.isArray(ex.args) && (
                  <div className="flex gap-2">
                    <span className="font-semibold text-gray-300">Input:</span>
                    <span className="text-gray-100 font-mono">
                      {ex.args.map(formatValue).join(", ")}
                    </span>
                  </div>
                )}

                {/* Show expected output */}
                <div className="flex gap-2">
                  <span className="font-semibold text-gray-300">Output:</span>
                  <span className="text-gray-100 font-mono">
                    {formatValue(ex.expected)}
                  </span>
                </div>

                {/* Show explanation */}
                {ex.explanation && (
                  <div className="flex gap-2 pt-1">
                    <span className="font-semibold text-gray-300 min-w-max">Explanation:</span>
                    <span className="text-gray-300 italic">{ex.explanation}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {problem.constraints && problem.constraints.length > 0 && (
        <div>
          <h2 className="font-semibold mb-2 text-white">Constraints:</h2>
          <ul className="list-disc ml-5 text-white">
            {problem.constraints.map((c: string, i: number) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {problem.limits && (
        <div className="mt-4">
          <h2 className="font-semibold mb-2 text-white">Limits:</h2>
          <div className="text-white">
            <div>Time limit: {problem.limits.timeLimitMs} ms</div>
            <div>Memory limit: {problem.limits.memoryLimitMb} MB</div>
          </div>
        </div>
      )}
    </div>
  );
}
