"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = { code: string; language: string; problemTitle?: string };
type KeyStatus = { configured?: boolean; error?: string };

const quickPrompts = [
  { label: "Find bugs", prompt: "Review this code for likely bugs, edge cases, and incorrect assumptions. Explain each issue and suggest a fix." },
  { label: "Optimize", prompt: "Suggest practical ways to improve the time and space complexity of this code. Explain the tradeoffs." },
  { label: "Explain", prompt: "Explain how this code works, step by step, and call out the most important logic." },
  { label: "Test cases", prompt: "Suggest useful test cases for this code, especially edge cases. Do not claim to execute the code." },
];

export default function CodeAssistant({ code, language, problemTitle }: Props) {
  const [open, setOpen] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/profile/groq-key", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as KeyStatus;
        if (controller.signal.aborted) return;
        setConfigured(response.ok && body.configured === true);
      })
      .catch(() => { if (!controller.signal.aborted) setConfigured(false); });
    return () => controller.abort();
  }, []);

  async function copyAnswer() {
    try {
      await navigator.clipboard.writeText(answer);
      setError("");
    } catch {
      setError("Could not copy the answer. Check clipboard permissions and try again.");
    }
  }

  async function ask(question: string) {
    const normalizedQuestion = question.trim();
    if (!normalizedQuestion || busy) return;
    setPrompt(normalizedQuestion);
    setBusy(true);
    setError("");
    setAnswer("");
    try {
      const response = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language, prompt: normalizedQuestion, problemTitle }),
        cache: "no-store",
      });
      const body = await response.json() as { answer?: string; error?: string };
      if (!response.ok || typeof body.answer !== "string") throw new Error(body.error || "Could not get an AI response.");
      setAnswer(body.answer);
    } catch (askError) {
      setError(askError instanceof Error ? askError.message : "Could not get an AI response.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300/20 bg-violet-300/[0.08] px-3 py-1.5 text-xs font-medium text-violet-100 transition hover:border-violet-300/35 hover:bg-violet-300/[0.14] sm:text-sm">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
          <path d="M12 2.5c-.8 4.8-2.7 7.1-8.5 9.5 5.8 2.4 7.7 4.7 8.5 9.5.8-4.8 2.7-7.1 8.5-9.5-5.8-2.4-7.7-4.7-8.5-9.5Z" />
          <path d="M5 2c-.3 1.6-.9 2.2-2.5 3 1.6.8 2.2 1.4 2.5 3 .3-1.6.9-2.2 2.5-3C5.9 4.2 5.3 3.6 5 2Z" />
        </svg>
        Ask AI
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[110] flex justify-end bg-black/35 backdrop-blur-[1px]" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="code-assistant-title" className="surface-panel-raised flex h-full max-h-[100dvh] w-full max-w-[440px] flex-col overflow-hidden rounded-none border-l border-white/10 shadow-2xl shadow-black/40">
          <header className="flex items-start justify-between gap-4 border-b border-white/10 px-4 py-4">
            <div><p className="page-eyebrow mb-1">Code-aware help</p><h2 id="code-assistant-title" className="text-xl font-semibold text-white">YexCode AI assistant</h2><p className="mt-1 text-xs text-white/45">Context: {problemTitle || "Standalone workspace"} · {language}</p></div>
            <button type="button" onClick={() => setOpen(false)} disabled={busy} aria-label="Close AI assistant" className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/65 transition hover:bg-white/[0.06] disabled:opacity-40">Close</button>
          </header>
          <div className="problem-panel-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            <p className="rounded-xl border border-amber-200/10 bg-amber-200/[0.04] px-3 py-2.5 text-xs leading-5 text-amber-100/75">When you ask a question, your current code and prompt are sent to Groq using your API key. YexCode does not store the code or AI conversation.</p>
            {configured === null && <p className="text-sm text-white/45">Checking Groq key…</p>}
            {configured === false && <div className="rounded-xl border border-white/10 bg-black/20 p-4"><p className="text-sm text-white/75">Connect your Groq API key to use code assistance.</p><Link href="/profile#groq-api-key" onClick={() => setOpen(false)} className="mt-3 inline-flex rounded-lg bg-violet-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-400">Set up in Profile</Link></div>}
            {configured && <>
              <div className="flex flex-wrap gap-2">{quickPrompts.map((item) => <button key={item.label} type="button" disabled={busy} onClick={() => void ask(item.prompt)} className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs text-white/70 transition hover:border-violet-300/25 hover:bg-violet-300/[0.08] hover:text-white disabled:opacity-40">{item.label}</button>)}</div>
              <div className="rounded-xl border border-sky-300/20 bg-sky-300/[0.045] p-3.5">
                <label className="block text-xs font-medium text-sky-100/80">Your question
                  <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={2000} rows={4} placeholder="How can I improve the time complexity?" className="mt-2 w-full resize-y rounded-lg border border-sky-200/15 bg-[#10141c] px-3 py-2.5 text-sm leading-6 text-white outline-none transition placeholder:text-white/35 focus:border-sky-200/40 focus:ring-2 focus:ring-sky-300/10" />
                </label>
              </div>
              <div className="flex items-center justify-between gap-3"><span className="text-[11px] text-white/35">{prompt.length}/2000</span><button type="button" onClick={() => void ask(prompt)} disabled={busy || !prompt.trim()} className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-45">{busy ? "Thinking…" : "Ask Groq"}</button></div>
            </>}
            {error && <p role="alert" className="rounded-lg border border-rose-300/15 bg-rose-300/[0.05] px-3 py-2.5 text-sm text-rose-200">{error}</p>}
            {answer && <section aria-labelledby="assistant-answer-title" className="rounded-xl border border-violet-300/20 bg-[#17151f] p-4 shadow-inner shadow-violet-950/20"><div className="mb-3 flex items-center justify-between gap-3"><div><p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-200/55">Groq</p><h3 id="assistant-answer-title" className="text-sm font-semibold text-white">Suggestion</h3></div><button type="button" onClick={() => void copyAnswer()} className="rounded-md border border-white/10 px-2.5 py-1 text-[11px] text-white/60 transition hover:bg-white/[0.06]">Copy</button></div><ReactMarkdown remarkPlugins={[remarkGfm]} components={{
              h1: ({ children }) => <h1 className="mb-3 mt-5 text-lg font-semibold text-white first:mt-0">{children}</h1>,
              h2: ({ children }) => <h2 className="mb-2 mt-5 text-base font-semibold text-white first:mt-0">{children}</h2>,
              h3: ({ children }) => <h3 className="mb-2 mt-4 text-sm font-semibold text-white first:mt-0">{children}</h3>,
              p: ({ children }) => <p className="my-3 break-words text-sm leading-6 text-white/75 first:mt-0 last:mb-0">{children}</p>,
              ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-5 text-sm leading-6 text-white/75">{children}</ul>,
              ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-5 text-sm leading-6 text-white/75">{children}</ol>,
              li: ({ children }) => <li className="pl-1 marker:text-violet-200/60">{children}</li>,
              strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
              blockquote: ({ children }) => <blockquote className="my-3 border-l-2 border-violet-300/40 pl-3 text-sm text-white/60">{children}</blockquote>,
              hr: () => <hr className="my-4 border-white/10" />,
              a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" className="text-sky-200 underline decoration-sky-200/30 underline-offset-2 hover:text-sky-100">{children}</a>,
              pre: ({ children }) => <pre className="my-3 overflow-x-auto rounded-lg border border-white/10 bg-[#0c0c10] p-3 text-xs leading-5 text-emerald-100/85">{children}</pre>,
              code: ({ className, children }) => <code className={`${className ?? ""} rounded bg-white/[0.08] px-1 py-0.5 font-mono text-[0.9em] text-violet-100`}>{children}</code>,
              table: ({ children }) => <div className="my-3 overflow-x-auto"><table className="w-full border-collapse text-left text-xs">{children}</table></div>,
              th: ({ children }) => <th className="border border-white/10 bg-white/[0.06] px-2 py-1.5 font-semibold text-white">{children}</th>,
              td: ({ children }) => <td className="border border-white/10 px-2 py-1.5 text-white/70">{children}</td>,
            }}>{answer}</ReactMarkdown></section>}
          </div>
        </section>
        </div>,
        document.body,
      )}
    </>
  );
}
