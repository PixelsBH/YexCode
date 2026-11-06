"use client";

import { useEffect, useState } from "react";

type HistoryItem = { _id: string; title: string; problemSlug: string; verdict?: string; status: string; language: string; score?: number; runtimeMs?: number; memoryMb?: number; passedTestCases?: number; totalTestCases?: number; createdAt: string };
type Detail = HistoryItem & { sourceCode: string; failedTestCase?: unknown; errorStage?: string; errorMessage?: string };

export default function SubmissionHistory({ problemSlug }: { problemSlug: string }) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
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
  }, [page, problemSlug]);

  async function openDetail(id: string) {
    setSelected(null); setMessage("Loading submission…");
    const response = await fetch(`/api/users/submissions/${encodeURIComponent(id)}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error || "Could not load submission."); return; }
    setSelected(data); setMessage("");
  }

  return <section className="border-t border-white/10 p-4 text-white">
    <h3 className="mb-3 font-medium">Submission history</h3>
    {message && <p className="py-3 text-sm text-white/50">{message}</p>}
    {items.length > 0 && <div className="space-y-2">{items.map((item) => <button type="button" key={item._id} onClick={() => openDetail(item._id)} className="grid w-full grid-cols-2 gap-2 rounded-lg border border-white/10 bg-white/5 p-3 text-left text-xs hover:bg-white/10 sm:grid-cols-4">
      <span className="font-medium">{item.verdict || item.status}</span><span>{item.language}</span><span>{item.passedTestCases ?? "—"}/{item.totalTestCases ?? "—"} tests</span><span>{new Date(item.createdAt).toLocaleString()}</span>
    </button>)}</div>}
    {items.length > 0 && <div className="mt-3 flex items-center justify-between text-xs text-white/60"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="disabled:opacity-40">Previous</button><span>Page {page} of {totalPages}</span><button disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} className="disabled:opacity-40">Next</button></div>}
    {selected && <div className="mt-4 rounded-lg border border-white/10 p-3"><div className="mb-2 flex justify-between text-sm"><strong>{selected.verdict || selected.status}</strong><button onClick={() => setSelected(null)} aria-label="Close submission details">Close</button></div><p className="mb-2 text-xs text-white/50">{selected.errorStage || "Result"}{selected.errorMessage ? ` · ${selected.errorMessage}` : ""}</p><pre className="max-h-80 overflow-auto rounded bg-black/50 p-3 text-xs">{selected.sourceCode}</pre></div>}
  </section>;
}
