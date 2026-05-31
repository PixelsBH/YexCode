"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const PAGE_SIZE = 8;

function difficultyColor(difficulty: string) {
  switch (difficulty.toLowerCase()) {
    case "easy":
      return "text-green-400 bg-green-400/10";
    case "medium":
      return "text-yellow-400 bg-yellow-400/10";
    case "hard":
      return "text-red-400 bg-red-400/10";
    default:
      return "text-gray-400 bg-gray-400/10";
  }
}

export default function ProblemsTable({ problems }: { problems: any[] }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return problems.filter((p) =>
      p.title.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, problems]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const visible = filtered.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  return (
    <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden">
      <div className="p-4 border-b border-white/10">
        <input
          type="text"
          placeholder="Search problems..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);}}
          className="
            w-full
            bg-black/50
            border border-white/15
            rounded-md
            px-4 py-2
            text-sm text-white
            placeholder:text-white/40
            focus:outline-none
            focus:ring-1 focus:ring-white/30
          "/>
      </div>

      <div className="grid grid-cols-12 px-5 py-3 text-md font-bold text-white border-b border-white/10">
        <div className="col-span-6">Title</div>
        <div className="col-span-3">Category</div>
        <div className="col-span-3">Difficulty</div>
      </div>

      <ul>
        {visible.map((p) => (
          <li key={p.slug} className="grid grid-cols-12 px-5 py-4 border-b border-white/5 hover:bg-white/5 transition">
            <div className="col-span-6">
              <Link href={`/problems/${p.slug}`} className="text-blue-500 text-sm hover:underline">
                {p.title}
              </Link>
            </div>

            <div className="col-span-3 text-white/70 text-sm">
              {p.category}
            </div>

            <div className="col-span-3">
              <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${difficultyColor(p.difficulty)}`}>
                {p.difficulty}
              </span>
            </div>
          </li>
        ))}

        {visible.length === 0 && (
          <li className="px-5 py-8 text-center text-white/50">
            No problems found
          </li>
        )}
      </ul>

      {totalPages > 1 && (
        <div className="flex justify-between items-center px-5 py-4 border-t border-white/10">
          <span className="text-sm text-white/50">
            Page {page} of {totalPages}
          </span>

          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1 text-sm rounded-md bg-white/10 text-white disabled:opacity-40">
              Prev
            </button>

            <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 text-sm rounded-md bg-white/10 text-white disabled:opacity-40">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
