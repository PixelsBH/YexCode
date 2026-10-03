"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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

type ProblemListItem = {
  slug: string;
  title: string;
  difficulty: string;
  topics: string[];
};

type ProblemListResponse = {
  items: ProblemListItem[];
  topics: string[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export default function ProblemsTable({ initialData }: { initialData: ProblemListResponse }) {
  const [search, setSearch] = useState("");
  const [topic, setTopic] = useState("");
  const [page, setPage] = useState(initialData.page);
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const normalizedSearch = search.trim();
    if (!normalizedSearch && !topic && page === initialData.page) {
      setData(initialData);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(initialData.pageSize) });
      if (normalizedSearch) params.set("q", normalizedSearch);
      if (topic) params.set("topic", topic);

      try {
        const response = await fetch(`/api/problems?${params}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(typeof result.error === "string" ? result.error : "Could not load problems.");
        }
        setData(result as ProblemListResponse);
        setPage(result.page);
      } catch (fetchError) {
        if (controller.signal.aborted) return;
        setError(fetchError instanceof Error ? fetchError.message : "Could not load problems.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, normalizedSearch ? 200 : 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [initialData, page, search, topic]);

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl">
      <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row">
        <label className="flex-1">
          <span className="sr-only">Search problems by title</span>
          <input
            type="search"
            placeholder="Search problems..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="w-full rounded-md border border-white/15 bg-black/50 px-4 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-white/30"
          />
        </label>
        <label className="sm:w-64">
          <span className="sr-only">Filter problems by topic</span>
          <select
            value={topic}
            onChange={(event) => {
              setTopic(event.target.value);
              setPage(1);
            }}
            className="w-full rounded-md border border-white/15 bg-black/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/30"
          >
            <option value="">All topics</option>
            {data.topics.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-12 border-b border-white/10 px-5 py-3 text-md font-bold text-white">
        <div className="col-span-8">Title</div>
        <div className="col-span-4">Difficulty</div>
      </div>

      <ul aria-busy={loading}>
        {data.items.map((problem) => (
          <li key={problem.slug} className="grid grid-cols-12 border-b border-white/5 px-5 py-4 transition hover:bg-white/5">
            <div className="col-span-8">
              <Link href={`/problems/${problem.slug}`} className="text-sm text-blue-400 hover:underline">
                {problem.title}
              </Link>
            </div>
            <div className="col-span-4">
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${difficultyColor(problem.difficulty)}`}>
                {problem.difficulty}
              </span>
            </div>
          </li>
        ))}

        {data.items.length === 0 && (
          <li className="px-5 py-8 text-center text-white/50">No problems found</li>
        )}
      </ul>

      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-white/50" aria-live="polite">
          {loading ? "Loading problems…" : `${data.total} problem${data.total === 1 ? "" : "s"} · Page ${data.page} of ${data.totalPages}`}
          {error && <span className="ml-2 text-red-300">{error}</span>}
        </div>
        {data.totalPages > 1 && (
          <nav aria-label="Problem list pages" className="flex gap-2">
            <button
              type="button"
              aria-label="Previous page"
              disabled={loading || page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-md bg-white/10 px-3 py-1 text-sm text-white disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              aria-label="Next page"
              disabled={loading || page >= data.totalPages}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-md bg-white/10 px-3 py-1 text-sm text-white disabled:opacity-40"
            >
              Next
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
