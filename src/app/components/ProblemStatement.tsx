import React from "react";

type ProblemStatementProps = {
  slug: string;
};

export default async function ProblemStatement({ slug }: ProblemStatementProps) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/problems/${slug}`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    throw new Error("Failed to fetch problem");
  }

  const problem = await res.json();

  return (
    <div className="p-6 border rounded-lg shadow-md bg-neutral-800 border-white/60">
      <h1 className="text-2xl font-bold mb-2 text-white">{problem.title}</h1>
      <div className="flex gap-4 mb-4">
        <span className="text-white">{problem.category}</span>
        <span className="text-white">{problem.difficulty}</span>
      </div>

      <p className="mb-4 text-white">{problem.description}</p>

      {problem.examples?.length > 0 && (
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

      {problem.constraints?.length > 0 && (
        <div>
          <h2 className="font-semibold mb-2 text-white">Constraints:</h2>
          <ul className="list-disc ml-5 text-white">
            {problem.constraints.map((c: string, i: number) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
