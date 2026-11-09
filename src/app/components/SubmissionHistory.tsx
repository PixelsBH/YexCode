"use client";

import { useEffect, useState } from "react";

type HistoryItem = { _id: string; title: string; problemSlug: string; verdict?: string; status: string; language: "cpp" | "python"; score?: number; runtimeMs?: number; memoryMb?: number; passedTestCases?: number; totalTestCases?: number; createdAt: string };
type Detail = HistoryItem & { sourceCode: string; failedTestCase?: unknown; errorStage?: string; errorMessage?: string };

function formatStatus(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function SubmissionHistory({ problemSlug }: { problemSlug: string }) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [selected, setSelected] = useState<Detail | null>(null);
  const [message, setMessage] = useState("Loading history…");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/users/submissions?page=${page}&pageSize=10&problemSlug=${encodeURIComponent(problemSlug)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load history.");
        setItems(data.items); setTotalPages(data.totalPages);
        setMessage(data.items.length ? "" : "No submissions for this problem yet.");
      }).catch((error) => { if (!controller.signal.aborted) setMessage(error.message); });
    return () => controller.abort();
  }, [page, problemSlug, refreshVersion]);

  useEffect(() => {
    const refreshHistory = () => {
      setPage(1);
      setRefreshVersion((version) => version + 1);
    };
    window.addEventListener("yexcode:submission-created", refreshHistory);
    window.addEventListener("yexcode:submission-updated", refreshHistory);
    return () => {
      window.removeEventListener("yexcode:submission-created", refreshHistory);
      window.removeEventListener("yexcode:submission-updated", refreshHistory);
    };
  }, []);

  function copyToEditor(sourceCode: string, language: "cpp" | "python") {
    window.dispatchEvent(new CustomEvent("yexcode:load-source", {
      detail: { sourceCode, language },
    }));
    setMessage("Submitted code copied to the editor.");
  }

  async function openDetail(id: string) {
    setSelected(null); setMessage("Loading submission…");
    const response = await fetch(`/api/users/submissions/${encodeURIComponent(id)}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error || "Could not load submission."); return; }
    setSelected(data); setMessage("");
  }

  return <section className="border-t border-white/10 p-4 text-white sm:p-5">
    <div className="mb-4"><p className="page-eyebrow mb-1">Activity</p><h3 className="text-base font-semibold">Submission history</h3></div>
    {message && <p className="py-3 text-sm text-white/50">{message}</p>}
    {items.length > 0 && <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-[1.1fr_0.8fr_0.8fr_0.8fr_0.8fr_1.4fr] gap-3 border-b border-white/10 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-white/45">
          <span>Status</span><span>Language</span><span>Runtime</span><span>Memory</span><span>Tests</span><span>Submitted</span>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {items.map((item) => <button type="button" key={item._id} onClick={() => openDetail(item._id)} className="grid w-full grid-cols-[1.1fr_0.8fr_0.8fr_0.8fr_0.8fr_1.4fr] items-center gap-3 px-3 py-3 text-left text-xs text-white/75 transition-colors hover:bg-violet-300/[0.04]">
            <span className="font-medium text-white">{formatStatus(item.verdict || item.status)}</span>
            <span>{item.language === "cpp" ? "C++" : "Python"}</span>
            <span>{item.runtimeMs != null ? `${item.runtimeMs} ms` : "—"}</span>
            <span>{item.memoryMb != null ? `${item.memoryMb.toFixed(2)} MB` : "—"}</span>
            <span>{item.passedTestCases != null || item.totalTestCases != null ? `${item.passedTestCases ?? 0}/${item.totalTestCases ?? 0}` : "—"}</span>
            <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
          </button>)}
        </div>
      </div>
    </div>}
    {items.length > 0 && <div className="mt-3 flex items-center justify-between text-xs text-white/60"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-md border border-white/10 px-3 py-1.5 transition hover:bg-white/[0.05] disabled:opacity-40">Previous</button><span>Page {page} of {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-md border border-white/10 px-3 py-1.5 transition hover:bg-white/[0.05] disabled:opacity-40">Next</button></div>}
    {selected && <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-3 sm:p-4"><div className="mb-2 flex items-center justify-between gap-3 text-sm"><strong>{formatStatus(selected.verdict || selected.status)}</strong><div className="flex items-center gap-3"><button type="button" onClick={() => copyToEditor(selected.sourceCode, selected.language)} className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/70 transition hover:border-violet-400/40 hover:bg-violet-400/10 hover:text-white">Copy to editor</button><button onClick={() => setSelected(null)} aria-label="Close submission details" className="text-white/60 hover:text-white">Close</button></div></div><p className="mb-2 text-xs text-white/50">{selected.errorStage || "Result"}{selected.errorMessage ? ` · ${selected.errorMessage}` : ""}</p><pre className="max-h-80 overflow-auto rounded bg-black/50 p-3 text-xs">{selected.sourceCode}</pre></div>}
  </section>;
}
