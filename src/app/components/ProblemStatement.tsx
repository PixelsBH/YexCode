import React from "react";

type Problem = {
  title: string;
  category: string;
  difficulty: string;
  description: string;
  examples?: Array<{ input: string; output: string; explanation?: string }>;
  constraints?: string[];
  testCases?: Array<{ id: number; input: string; expectedOutput: string }>;
  limits?: { timeLimitMs: number; memoryLimitMb: number };
};

type ProblemStatementProps = {
  problem: Problem;
};

export default function ProblemStatement({ problem }: ProblemStatementProps) {
  return (
    <div className="p-6 border rounded-lg shadow-md bg-neutral-800 border-white/60">
      <h1 className="text-2xl font-bold mb-2 text-white">{problem.title}</h1>
      <div className="flex gap-4 mb-4">
        <span className="text-white">{problem.category}</span>
        <span className="text-white">{problem.difficulty}</span>
      </div>

      <p className="mb-4 text-white">{problem.description}</p>

      {problem.examples && problem.examples.length > 0 && (
        <div className="mb-4">
          <h2 className="font-semibold mb-2 text-white">Examples:</h2>
          {problem.examples.map((ex: any, i: number) => (
            <div key={i} className="mb-2 p-2 bg-gray-400 rounded">
              <div>
                <strong>Input:</strong> {ex.input}
              </div>
              <div>
                <strong>Output:</strong> {ex.output}
              </div>
              {ex.explanation && (
                <div>
                  <strong>Explanation:</strong> {ex.explanation}
                </div>
              )}
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
