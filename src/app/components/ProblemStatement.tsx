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
  hints?: string[];
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
    <article className="px-5 py-5 sm:px-7 sm:py-7">
      <header className="mb-6 border-b border-white/[0.07] pb-5">
        <p className="page-eyebrow mb-2">Problem</p>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{problem.title}</h1>
        <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-medium ${problem.difficulty === "Easy" ? "border-emerald-300/15 bg-emerald-300/[0.07] text-emerald-200" : problem.difficulty === "Hard" ? "border-rose-300/15 bg-rose-300/[0.07] text-rose-200" : "border-amber-200/15 bg-amber-200/[0.07] text-amber-100"}`}>
          {problem.difficulty}
        </span>
      </header>

      <p className="mb-6 whitespace-pre-line text-sm leading-7 text-white/75">{problem.description}</p>


      {problem.companies && problem.companies.length > 0 && (
        <details className="mb-4 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
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
          <h2 className="mb-3 text-base font-semibold text-white">Examples</h2>
          {problem.examples.map((ex, i) => (
            <div key={i} className="mb-3 rounded-xl border border-white/[0.1] bg-[#1d1d26] p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-violet-200">
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
        <div className="mt-6 rounded-xl border border-white/[0.1] bg-[#1b1b23] p-4">
          <h2 className="mb-2 text-sm font-semibold text-white">Constraints</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-white/65">
            {problem.constraints.map((c: string, i: number) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {problem.limits && (
        <div className="mt-4 rounded-xl border border-white/[0.1] bg-[#1b1b23] p-4">
          <h2 className="mb-2 text-sm font-semibold text-white">Limits</h2>
          <div className="grid gap-2 text-sm text-white/65 sm:grid-cols-2">
            <div>Time limit: <span className="font-mono text-white/85">{problem.limits.timeLimitMs} ms</span></div>
            <div>Memory limit: <span className="font-mono text-white/85">{problem.limits.memoryLimitMb} MB</span></div>
          </div>
        </div>
      )}

      {problem.topics && problem.topics.length > 0 && (
        <details className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-white/70">Reveal topic hints</summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {problem.topics.map((topic) => (
              <span key={topic} className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/70">
                {topic}
              </span>
            ))}
          </div>
        </details>
      )}

      {problem.hints && problem.hints.length > 0 && (
        <details className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-white/70">Hints</summary>
          <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-white/70">
            {problem.hints.map((hint, index) => <li key={index}>{hint}</li>)}
          </ol>
        </details>
      )}
    </article>
  );
}
