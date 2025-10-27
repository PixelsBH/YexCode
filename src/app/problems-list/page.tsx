import React from 'react';
import Link from 'next/link';

async function getProblems() {
  const res = await fetch("/api/problems", {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch problems");
  }

  return res.json();
}

export default async function ProblemsListPage() {
  const problems = await getProblems();
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Problems</h1>
      <ul className="space-y-3">
        {problems.map((p: any) => (
          <li key={p.slug} className="flex gap-4 items-center">
            <Link
              href={`/problems/${p.slug}`}
              className="text-blue-600 hover:underline"
            >
              {p.title}
            </Link>
            <span className="text-gray-600">{p.difficulty}</span>
            <span className="text-gray-600">{p.category}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}