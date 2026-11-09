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
  progress: "solved" | "attempted" | "unattempted" | null;
};

type ProblemListResponse = {
  items: ProblemListItem[];
  authenticated: boolean;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export default function ProblemsTable({ initialData }: { initialData: ProblemListResponse }) {
  const [search, setSearch] = useState("");
  const [progress, setProgress] = useState<"all" | "solved" | "attempted" | "unattempted">("all");
  const [page, setPage] = useState(initialData.page);
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const normalizedSearch = search.trim();

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(initialData.pageSize) });
      if (normalizedSearch) params.set("q", normalizedSearch);
      if (progress !== "all") params.set("progress", progress);

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
  }, [initialData, page, progress, search]);

  return (
    <section className="surface-panel overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-white/10 bg-white/[0.025] p-4 sm:flex-row sm:items-center">
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
            className="control-field w-full px-4 py-2.5 text-sm text-white placeholder:text-white/35"
          />
        </label>
        <label className="sm:w-64">
          <span className="sr-only">Filter problems by your progress</span>
          <select
            value={progress}
            onChange={(event) => {
              setProgress(event.target.value as "all" | "solved" | "attempted" | "unattempted");
              setPage(1);
            }}
            className="control-field w-full px-3 py-2.5 text-sm text-white"
          >
            <option value="all">All problems</option>
            <option value="solved">Solved</option>
            <option value="attempted">Attempted (not solved)</option>
            <option value="unattempted">Unattempted</option>
          </select>
        </label>
      </div>

      <div className="hidden grid-cols-12 border-b border-white/10 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40 sm:grid">
        <div className="col-span-7">Problem</div>
        <div className="col-span-3">Difficulty</div>
        <div className="col-span-2 text-right">Progress</div>
      </div>

      <ul className="surface-striped" aria-busy={loading}>
        {data.items.map((problem) => (
          <li key={problem.slug} className="grid grid-cols-2 gap-y-2.5 border-b border-white/[0.06] px-4 py-4 transition-colors hover:bg-white/[0.035] sm:grid-cols-12 sm:items-center sm:px-5">
            <div className="col-span-2 min-w-0 sm:col-span-7">
              <Link href={`/problems/${problem.slug}`} className="text-sm font-medium text-white transition-colors hover:text-violet-200">
                {problem.title}
              </Link>
            </div>
            <div className="col-span-1 sm:col-span-3">
              <span className={`inline-flex rounded-full border border-current/10 px-2.5 py-1 text-[11px] font-medium ${difficultyColor(problem.difficulty)}`}>
                {problem.difficulty}
              </span>
            </div>
            <div className="col-span-1 text-right text-xs sm:col-span-2">
              {problem.progress === "solved" ? <span className="inline-flex rounded-full bg-emerald-400/10 px-2.5 py-1 text-emerald-300">Solved</span> : problem.progress === "attempted" ? <span className="inline-flex rounded-full bg-amber-300/10 px-2.5 py-1 text-amber-200">Attempted</span> : problem.progress === "unattempted" ? <span className="text-white/40">Not started</span> : <span className="text-white/25">Sign in to track</span>}
            </div>
          </li>
        ))}

        {data.items.length === 0 && (
          <li className="px-5 py-14 text-center"><span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.05] text-lg text-white/40">⌕</span><span className="block text-sm font-medium text-white/70">No problems found</span><span className="mt-1 block text-xs text-white/40">Try a different search or progress filter.</span></li>
        )}
      </ul>

      <div className="flex flex-col gap-3 bg-white/[0.015] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
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
    </section>
  );
}
