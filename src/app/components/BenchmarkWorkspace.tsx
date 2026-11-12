"use client";

import { useEffect, useRef, useState } from "react";
import type { Extension } from "@codemirror/state";
import { indentUnit } from "@codemirror/language";
import { cpp } from "@codemirror/lang-cpp";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { indentationScopes } from "@/app/components/indentationScopes";
import CodeAssistant from "@/app/components/CodeAssistant";

type Language = "c" | "cpp" | "python";
type EditableCase = { key: number; input: string; expectedOutput: string };
type FailedTestCase = { id: number; input?: string; expectedOutput?: string; actualOutput?: string };
type JudgeResult = {
  status: string;
  passedTestCases?: number;
  totalTestCases?: number;
  runtimeMs?: number;
  memoryMb?: number;
  errorMessage?: string;
  failedTestCase?: FailedTestCase;
};
type SubmissionEnvelope = { submissionId?: string; status: string; result?: JudgeResult };

let CodeMirrorWrapper: typeof import("@uiw/react-codemirror").default | null = null;
const languageExtensions: Record<Language, Extension> = { c: cpp(), cpp: cpp(), python: python() };
const starters: Record<Language, string> = {
  c: "#include <stdio.h>\n\nint main(void) {\n    return 0;\n}\n",
  cpp: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}\n",
  python: "import sys\n\n# Read from stdin and write to stdout\n",
};

function readableError(data: unknown, fallback: string) {
  if (data && typeof data === "object") {
    const value = data as { error?: unknown; message?: unknown };
    if (typeof value.error === "string") return value.error;
    if (value.error && typeof value.error === "object" && "message" in value.error && typeof value.error.message === "string") return value.error.message;
    if (typeof value.message === "string") return value.message;
  }
  return fallback;
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function BenchmarkWorkspace() {
  const [language, setLanguage] = useState<Language>("cpp");
  const [code, setCode] = useState(starters.cpp);
  const [cases, setCases] = useState<EditableCase[]>([{ key: 1, input: "", expectedOutput: "" }]);
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState<JudgeResult | null>(null);
  const [runOutput, setRunOutput] = useState<string | null>(null);
  const [activeRunMode, setActiveRunMode] = useState<"run" | "tests" | null>(null);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const nextCaseKey = useRef(2);
  const activeController = useRef<AbortController | null>(null);

  useEffect(() => {
    let mounted = true;
    import("@uiw/react-codemirror").then((module) => {
      CodeMirrorWrapper = module.default || module;
      if (mounted) setLoaded(true);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => () => activeController.current?.abort(), []);

  const updateCase = (key: number, field: "input" | "expectedOutput", value: string) => {
    setCases((current) => current.map((testCase) => testCase.key === key ? { ...testCase, [field]: value } : testCase));
    setResult(null);
    setRunOutput(null);
    setStatus("idle");
  };

  const addCase = () => {
    setCases((current) => [...current, { key: nextCaseKey.current++, input: "", expectedOutput: "" }]);
    setResult(null);
    setRunOutput(null);
    setStatus("idle");
  };

  const removeCase = (key: number) => {
    setCases((current) => current.filter((testCase) => testCase.key !== key));
    setResult(null);
    setRunOutput(null);
    setStatus("idle");
  };

  const runBenchmark = async (singleRun = false) => {
    const controller = new AbortController();
    activeController.current?.abort();
    activeController.current = controller;
    setError("");
    setResult(null);
    setRunOutput(null);
    setActiveRunMode(singleRun ? "run" : "tests");
    setStatus("submitting");

    try {
      const response = await fetch("/api/benchmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          sourceCode: code,
          runOnly: singleRun,
          testCases: singleRun
            ? [{ id: 1, input: cases[0]?.input ?? "", expectedOutput: "" }]
            : cases.map((testCase, index) => ({ id: index + 1, input: testCase.input, expectedOutput: testCase.expectedOutput })),
        }),
        cache: "no-store",
        signal: controller.signal,
      });
      const envelope = await response.json() as SubmissionEnvelope | { error?: unknown };
      if (!response.ok) throw new Error(readableError(envelope, `Benchmark request failed (${response.status}).`));
      const submission = envelope as SubmissionEnvelope;
      if (!submission.submissionId) throw new Error("YexJudge did not return a benchmark ID.");
      setStatus(submission.status);

      let current = submission;
      for (let attempt = 0; attempt < 180 && current.status !== "finished" && current.status !== "failed"; attempt++) {
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        const poll = await fetch(`/api/benchmark/${encodeURIComponent(submission.submissionId)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = await poll.json() as SubmissionEnvelope | { error?: unknown };
        if (!poll.ok) {
          if (poll.status === 429) {
            const waitSeconds = Number(poll.headers.get("Retry-After"));
            if (Number.isFinite(waitSeconds) && waitSeconds > 0) {
              await new Promise((resolve) => window.setTimeout(resolve, Math.min(waitSeconds * 1000, 120_000)));
              continue;
            }
          }
          throw new Error(readableError(body, `Could not check benchmark status (${poll.status}).`));
        }
        current = body as SubmissionEnvelope;
        setStatus(current.status);
      }
      if (current.status !== "finished" && current.status !== "failed") throw new Error("Benchmark is taking too long to finish. Try again shortly.");
      if (!current.result) throw new Error("YexJudge finished without returning a result.");
      if (singleRun) {
        setRunOutput(current.result.failedTestCase?.actualOutput ?? current.result.errorMessage ?? "");
      } else {
        setResult(current.result);
      }
      setStatus(current.status);
    } catch (runError) {
      if (controller.signal.aborted) return;
      setError(runError instanceof Error ? runError.message : "Could not run this benchmark.");
      setStatus("error");
    } finally {
      if (activeController.current === controller) {
        activeController.current = null;
        setActiveRunMode(null);
      }
    }
  };

  const isRunning = status === "submitting" || status === "queued" || status === "running";

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] min-h-[28rem] max-w-[1700px] flex-col overflow-hidden px-1 py-2 text-white sm:px-2">
      <header className="mb-4 flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div><p className="page-eyebrow mb-1">Sandbox</p><h1 className="page-title text-2xl sm:text-3xl">Workspace</h1><p className="mt-1.5 max-w-3xl text-xs leading-5 text-white/50 sm:text-sm">Write a standalone C, C++, or Python program and test it with custom stdin/stdout cases. Runs are not saved as submissions.</p></div>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-white/45">Custom input · No submission history</span>
      </header>

      <div className="mb-3 flex shrink-0 flex-wrap items-end gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3">
        <label className="flex flex-col gap-1.5 text-xs text-white/55">
          Language
          <select value={language} onChange={(event) => { const next = event.target.value as Language; setLanguage(next); setCode(starters[next]); setResult(null); setRunOutput(null); setStatus("idle"); }} className="control-field px-3 py-2 text-sm text-white">
            <option value="c">C</option><option value="cpp">C++</option><option value="python">Python</option>
          </select>
        </label>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => runBenchmark(true)} disabled={isRunning} className="rounded-lg border border-white/12 px-4 py-2 text-sm font-medium text-white/80 transition hover:border-white/25 hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-50">Run</button>
          <button type="button" onClick={() => runBenchmark(false)} disabled={isRunning || cases.length === 0} className="rounded-lg bg-violet-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-950/40 transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50">
            {isRunning ? `${statusLabel(status)}…` : "Run tests"}
          </button>
          <CodeAssistant code={code} language={language} />
        </div>
      </div>

      {error && <div role="alert" className="mb-3 shrink-0 rounded-lg border border-rose-400/20 bg-rose-400/5 px-4 py-3 text-sm text-rose-200">{error}</div>}

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(420px,0.75fr)] xl:grid-rows-1">
        <section className="surface-panel flex min-h-0 min-w-0 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div><h2 className="text-sm font-medium">Program</h2><p className="mt-0.5 text-xs text-white/40">Standard input / standard output</p></div>
            <span aria-live="polite" className="text-xs text-white/45">{status === "idle" ? "Ready" : statusLabel(status)}</span>
          </div>
          <div className="min-h-0 flex-1 [&_.cm-editor]:h-full [&_.cm-scroller]:overflow-auto">
            {loaded && CodeMirrorWrapper ? <CodeMirrorWrapper value={code} height="100%" className="dark-code-scrollbar h-full" theme={oneDark} extensions={[languageExtensions[language], indentUnit.of("    "), indentationScopes]} onChange={(value: string) => { setCode(value || ""); setResult(null); setRunOutput(null); setStatus("idle"); }} /> : <div className="flex h-full items-center justify-center text-sm text-white/40">Loading editor…</div>}
          </div>
        </section>

        <section className="flex min-h-0 min-w-0 flex-col gap-3">
          <div className="surface-panel-raised flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl p-4">
            <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
              <div><h2 className="font-medium">Test cases</h2><p className="mt-1 text-xs text-white/45">Provide the exact stdin text and expected stdout for each run.</p></div>
              <button type="button" onClick={addCase} disabled={cases.length >= 50} className="shrink-0 rounded-md border border-white/15 px-3 py-2 text-xs text-white/75 hover:bg-white/5 disabled:opacity-40">Add case</button>
            </div>
            <div className="problem-panel-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              {cases.map((testCase, index) => (
                <article key={testCase.key} className="surface-panel-inset p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2"><h3 className="text-sm font-medium">Case {index + 1}</h3>{result && <span className={result.status === "accepted" || index < (result.passedTestCases ?? 0) ? "text-xs text-emerald-300" : result.failedTestCase?.id === index + 1 ? "text-xs text-rose-300" : "text-xs text-white/35"}>{result.status === "accepted" || index < (result.passedTestCases ?? 0) ? "Passed" : result.failedTestCase?.id === index + 1 ? "Failed" : "Not run"}</span>}</div>
                    <button type="button" onClick={() => removeCase(testCase.key)} disabled={cases.length <= 1} className="text-xs text-white/45 hover:text-rose-300 disabled:opacity-30">Remove</button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-xs text-white/55">Input (stdin)
                      <textarea value={testCase.input} onChange={(event) => updateCase(testCase.key, "input", event.target.value)} rows={4} spellCheck={false} className="problem-panel-scrollbar resize-y rounded-md border border-white/10 bg-black/40 p-2 font-mono text-xs text-white outline-none focus:border-violet-400/60" />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-white/55">Expected output (stdout)
                      <textarea value={testCase.expectedOutput} onChange={(event) => updateCase(testCase.key, "expectedOutput", event.target.value)} rows={4} spellCheck={false} className="problem-panel-scrollbar resize-y rounded-md border border-white/10 bg-black/40 p-2 font-mono text-xs text-white outline-none focus:border-violet-400/60" />
                    </label>
                  </div>
                </article>
              ))}
            </div>
            <p className="mt-3 text-right text-xs text-white/40">{cases.length} / 50 cases maximum</p>
          </div>

          <div className="surface-panel-inset flex h-[28%] min-h-36 shrink-0 flex-col overflow-hidden p-4">
            <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
              <h2 className="font-medium">Output</h2>
              <span className="text-xs text-white/55">{runOutput !== null ? "Program output" : activeRunMode === "run" && isRunning ? statusLabel(status) : "Run the program to see output"}</span>
            </div>
            {runOutput !== null && <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words rounded-md bg-black/40 p-3 font-mono text-xs text-white/85">{runOutput || "(no output)"}</pre>}
            {runOutput === null && activeRunMode === "run" && isRunning && <p className="flex flex-1 items-center justify-center text-center text-sm text-white/35">Running program…</p>}
            {runOutput === null && !(activeRunMode === "run" && isRunning) && <p className="flex flex-1 items-center justify-center text-center text-sm text-white/35">Run the program to see output.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
