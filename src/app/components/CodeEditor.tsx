"use client";

import React, { useEffect, useRef, useState } from "react";
import type { Extension } from "@codemirror/state";

import { githubLight } from "@uiw/codemirror-theme-github";
import { dracula } from "@uiw/codemirror-theme-dracula";
import { oneDark } from "@codemirror/theme-one-dark";

import { cpp } from "@codemirror/lang-cpp";
import { python } from "@codemirror/lang-python";
import SubmissionPanel from "@/app/components/SubmissionPanel";


let CodeMirrorWrapper: typeof import("@uiw/react-codemirror").default | null = null;

type EditorLanguage = "C++" | "Python";

const languageExtensions: Record<EditorLanguage, Extension> = {
  "C++": cpp(),
  Python: python(),
};

const themeMap: Record<string, Extension> = {
  Light: githubLight,
  Dracula: dracula,
  Dark: oneDark,
};


type Templates = {
  cpp?: string;
  python?: string;
  c?: string;
};

type FunctionParam = {
  name: string;
  type: string;
};

type FunctionMetadata = {
  name: string;
  returnType: string;
  params: FunctionParam[];
  comparison?: {
    returnArrayOrder?: "unordered";
  };
};

function getLanguageTemplate(
  language: EditorLanguage,
  templates: Templates,
  initialCode: string,
  functionMetadata?: FunctionMetadata,
): string {
  const template = language === "C++" ? templates.cpp : templates.python;
  if (template) return template;
  if (language !== "Python") return initialCode;
  if (!functionMetadata) return "from typing import List\n\n# Write your Python solution here\n";

  const params = ["self", ...functionMetadata.params.map((param) => param.name)].join(", ");
  return `class Solution:\n    def ${functionMetadata.name}(${params}):\n        pass\n`;
}

type ExampleTestCase = {
  id: number;
  args: unknown[];
  expected: unknown;
  explanation?: string;
};


type JudgeResult = {
  status: string;
  passedTestCases?: number;
  totalTestCases?: number;
  runtimeMs?: number;
  memoryMb?: number;
  score?: number;
  errorStage?: string;
  failedTestCase?: {
    id: number;
    args?: unknown[];
    expected?: unknown;
    expectedOutput?: string;
    actualOutput?: string;
  };
  errorMessage?: string;
};

type CodeEditorProps = {
  problemSlug: string;
  initialCode: string;


  templates?: Templates;
  function?: FunctionMetadata;
  examples?: ExampleTestCase[];
};

const getDraftKey = (problemSlug: string, language: string) => {
  const languageKey = language === "C++" ? "cpp" : language.toLowerCase();
  return `yexcode:draft:v1:${encodeURIComponent(problemSlug)}:${languageKey}`;
};

const CodeEditor: React.FC<CodeEditorProps> = ({
  problemSlug,
  initialCode,
  templates = {},
  function: functionMetadata,
  examples = [],
}) => {
  const [code, setCode] = useState(initialCode);
  const [loaded, setLoaded] = useState(false);
  const mountedRef = useRef(false);
  const runPollRef = useRef<number | null>(null);
  const submitPollRef = useRef<number | null>(null);
  const runAbortRef = useRef<AbortController | null>(null);
  const submitAbortRef = useRef<AbortController | null>(null);
  const runSequenceRef = useRef(0);
  const submitSequenceRef = useRef(0);

  const [language, setLanguage] = useState<EditorLanguage>("C++");
  const [theme, setTheme] = useState("Dark");

  /* ─── Run state ─── */
  const [runStatus, setRunStatus] = useState<string>("idle");
  const [runResult, setRunResult] = useState<JudgeResult | null>(null);

  /* ─── Submit state ─── */
  const [submitStatus, setSubmitStatus] = useState<string>("idle");
  const [submitResult, setSubmitResult] = useState<JudgeResult | null>(null);

  /* ─── Panel tab ─── */
  const [activeTab, setActiveTab] = useState<"run" | "submit">("run");
  const [editorRatio, setEditorRatio] = useState(0.68);
  const [editorHeight, setEditorHeight] = useState(0);
  const splitAreaRef = useRef<HTMLDivElement>(null);
  const editorPaneRef = useRef<HTMLDivElement>(null);

  /* ─── Draft state ─── */
  const [draftStatus, setDraftStatus] = useState<"loading" | "saved" | "template" | "unavailable">("loading");
  const skipNextDraftSaveRef = useRef(false);
  const copiedSourceRef = useRef<{ language: EditorLanguage; sourceCode: string } | null>(null);

  useEffect(() => {
    const pane = editorPaneRef.current;
    if (!pane) return;
    const observer = new ResizeObserver(([entry]) => {
      const nextHeight = Math.floor(entry.contentRect.height);
      setEditorHeight((current) => current === nextHeight ? current : nextHeight);
    });
    observer.observe(pane);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const loadSource = (event: Event) => {
      const detail = (event as CustomEvent<{ sourceCode: string; language: "cpp" | "python" }>).detail;
      if (!detail || typeof detail.sourceCode !== "string") return;
      const copiedLanguage = detail.language === "cpp" ? "C++" : "Python";
      copiedSourceRef.current = { language: copiedLanguage, sourceCode: detail.sourceCode };
      setCode(detail.sourceCode);
      setLanguage(copiedLanguage);
    };
    window.addEventListener("yexcode:load-source", loadSource);
    const runAbortControllerRef = runAbortRef;
    const submitAbortControllerRef = submitAbortRef;

    import("@uiw/react-codemirror").then((mod) => {
      CodeMirrorWrapper = mod.default || mod;
      if (mountedRef.current) setLoaded(true);
    });

    return () => {
      mountedRef.current = false;
      window.removeEventListener("yexcode:load-source", loadSource);
      clearPoll(runPollRef);
      clearPoll(submitPollRef);
      runAbortControllerRef.current?.abort();
      submitAbortControllerRef.current?.abort();
    };
  }, []);

  // Restore draft
  useEffect(() => {
    const template = getLanguageTemplate(language, templates, initialCode, functionMetadata);
    const copiedSource = copiedSourceRef.current?.language === language ? copiedSourceRef.current : null;
    if (copiedSource) copiedSourceRef.current = null;
    skipNextDraftSaveRef.current = !copiedSource;
    setDraftStatus(copiedSource ? "saved" : "loading");

    if (copiedSource) {
      setCode(copiedSource.sourceCode);
      return;
    }

    try {
      const savedDraft = window.localStorage.getItem(getDraftKey(problemSlug, language));
      setCode(savedDraft ?? template);
      setDraftStatus(savedDraft === null ? "template" : "saved");
    } catch {
      setCode(template);
      setDraftStatus("unavailable");
    }
  }, [problemSlug, language, templates, initialCode, functionMetadata]);

  // Debounced draft save
  useEffect(() => {
    if (skipNextDraftSaveRef.current) {
      skipNextDraftSaveRef.current = false;
      return;
    }

    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(getDraftKey(problemSlug, language), code);
        setDraftStatus("saved");
      } catch {
        setDraftStatus("unavailable");
      }
    }, 400);

    return () => window.clearTimeout(timer);
  }, [code, problemSlug, language]);

  const clearDraft = () => {
    const template = getLanguageTemplate(language, templates, initialCode, functionMetadata);

    try {
      window.localStorage.removeItem(getDraftKey(problemSlug, language));
      skipNextDraftSaveRef.current = true;
      setCode(template);
      setDraftStatus("template");
    } catch {
      setDraftStatus("unavailable");
    }
  };

  /* ─── Polling helpers ─── */

  const clearPoll = (ref: { current: number | null }) => {
    if (ref.current !== null) {
      window.clearTimeout(ref.current);
      ref.current = null;
    }
  };

  const pollSubmission = (
    operation: "run" | "submit",
    id: string,
    setStatus: (status: string) => void,
    setResult: (result: JudgeResult | null) => void,
    pollRef: { current: number | null },
    controller: AbortController,
    requestId: string,
    isCurrent: () => boolean,
  ) => {
    const resultUrl = operation === "run" ? `/api/run/${encodeURIComponent(id)}` : `/api/submissions/${encodeURIComponent(id)}`;
    const abortRef = operation === "run" ? runAbortRef : submitAbortRef;

    const finish = () => {
      if (abortRef.current === controller) abortRef.current = null;
    };

    const schedule = (attempt: number, delayMs: number) => {
      pollRef.current = window.setTimeout(() => poll(attempt), delayMs);
    };

    const poll = async (retryAttempt = 0) => {
      if (!isCurrent()) return;

      try {
        const response = await fetch(resultUrl, {
          headers: { "X-Request-ID": requestId },
          cache: "no-store",
          signal: controller.signal,
        });
        if (!isCurrent()) return;

        if (!response.ok) {
          const isRateLimited = response.status === 429;
          if (([502, 503, 504].includes(response.status) || isRateLimited) && retryAttempt < 5) {
            const retryAfterSeconds = Number(response.headers.get("Retry-After"));
            const retryDelay = isRateLimited && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
              ? Math.min(retryAfterSeconds * 1000, 120_000)
              : 500 * 2 ** retryAttempt;
            schedule(retryAttempt + 1, retryDelay);
            return;
          }
          const errorData = await response.json().catch(() => null);
          const message = typeof errorData?.error === "string"
            ? errorData.error
            : errorData?.error?.message || `Could not check submission status (${response.status}).`;
          setResult({ status: "infrastructure_error", errorMessage: message });
          setStatus("error");
          finish();
          return;
        }

        const data = await response.json();
        if (!isCurrent()) return;
        if (operation === "submit" && (data.status === "finished" || data.status === "failed")) {
          window.dispatchEvent(new Event("yexcode:submission-updated"));
        }

        if (data.status === "queued" || data.status === "running") {
          setStatus(data.status);
          schedule(0, 1000);
          return;
        }

        if (data.status === "finished") {
          setResult(data.result || {
            status: "infrastructure_error",
            errorMessage: "The judge finished without returning a result.",
          });
          setStatus("finished");
          finish();
          return;
        }

        if (data.status === "failed") {
          setResult(data.result || {
            status: "infrastructure_error",
            errorMessage: "The judge could not process this submission.",
          });
          setStatus("failed");
          finish();
          return;
        }

        setResult({
          status: "infrastructure_error",
          errorMessage: `Unexpected submission status: ${String(data.status || "unknown")}.`,
        });
        setStatus("error");
        finish();
      } catch {
        if (controller.signal.aborted || !isCurrent()) return;
        if (retryAttempt < 3) {
          schedule(retryAttempt + 1, 500 * 2 ** retryAttempt);
          return;
        }
        setResult({
          status: "infrastructure_error",
          errorMessage: "Could not reach YexCode to check this run. Please retry.",
        });
        setStatus("error");
        finish();
      }
    };

    void poll();
  };

  const execute = async (operation: "run" | "submit") => {
    const isRun = operation === "run";
    const pollRef = isRun ? runPollRef : submitPollRef;
    const abortRef = isRun ? runAbortRef : submitAbortRef;
    const sequenceRef = isRun ? runSequenceRef : submitSequenceRef;
    const setStatus = isRun ? setRunStatus : setSubmitStatus;
    const setResult = isRun ? setRunResult : setSubmitResult;
    const endpoint = isRun ? "/api/run" : "/api/submissions";

    clearPoll(pollRef);
    abortRef.current?.abort();
    const sequence = ++sequenceRef.current;
    const controller = new AbortController();
    const requestId = crypto.randomUUID();
    abortRef.current = controller;
    const isCurrent = () => mountedRef.current && sequenceRef.current === sequence;

    setStatus("submitting");
    setResult(null);
    if (isRun) setActiveTab("run");
    else setActiveTab("submit");

    if (!functionMetadata) {
      setResult({ status: "validation_error", errorMessage: "This problem has no Function Mode definition." });
      setStatus("error");
      abortRef.current = null;
      return;
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Request-ID": requestId,
        },
        body: JSON.stringify({
          slug: problemSlug,
          language: language === "C++" ? "cpp" : "python",
          sourceCode: code,
        }),
        cache: "no-store",
        signal: controller.signal,
      });
      if (!isCurrent()) return;

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message = typeof data?.error === "string"
          ? data.error
          : data?.error?.message || data?.message || `Request failed (${response.status}).`;
        setResult({ status: response.status === 400 ? "validation_error" : "infrastructure_error", errorMessage: message });
        setStatus("error");
        abortRef.current = null;
        return;
      }

      const id = data?.submissionId || data?.id;
      if (typeof id !== "string" && typeof id !== "number") {
        setResult({ status: "infrastructure_error", errorMessage: "The judge did not return a submission ID." });
        setStatus("error");
        abortRef.current = null;
        return;
      }

      const judgeStatus = typeof data.status === "string" ? data.status : "queued";
      if (!isRun) window.dispatchEvent(new Event("yexcode:submission-created"));
      setStatus(judgeStatus);
      pollRef.current = window.setTimeout(
        () => pollSubmission(operation, String(id), setStatus, setResult, pollRef, controller, requestId, isCurrent),
        judgeStatus === "finished" || judgeStatus === "failed" ? 0 : 500,
      );
    } catch {
      if (controller.signal.aborted || !isCurrent()) return;
      setResult({
        status: "infrastructure_error",
        errorMessage: "Could not send code to YexCode. Please check your connection and retry.",
      });
      setStatus("error");
      abortRef.current = null;
    }
  };

  /* ─── Handlers ─── */

  const handleRun = () => execute("run");
  const handleSubmit = () => execute("submit");

  const resizeEditor = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.buttons !== 1) return;
    const bounds = splitAreaRef.current?.getBoundingClientRect();
    if (!bounds || bounds.height <= 0) return;
    const ratio = (event.clientY - bounds.top) / bounds.height;
    setEditorRatio(Math.min(0.82, Math.max(0.25, ratio)));
  };

  const isRunBusy = runStatus === "submitting" || runStatus === "queued" || runStatus === "running";
  const isSubmitBusy = submitStatus === "submitting" || submitStatus === "queued" || submitStatus === "running";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-transparent">
      {/* Top Bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/[0.08] bg-white/[0.015] px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/50" aria-live="polite">
            {draftStatus === "saved" && "Saved locally"}
            {draftStatus === "template" && "Using template"}
            {draftStatus === "unavailable" && "Local saving unavailable"}
          </span>
          <button
            type="button"
            onClick={clearDraft}
            className="text-xs text-white/60 hover:text-white transition"
          >
            Clear draft
          </button>
          {/* Language Select */}
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as EditorLanguage)}
            className="bg-black/50 border border-white/15 text-white text-sm rounded-md px-3 py-1.5"
          >
            {Object.keys(languageExtensions).map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>

          {/* Theme Select */}
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="bg-black/50 border border-white/15 text-white text-sm rounded-md px-3 py-1.5"
          >
            {Object.keys(themeMap).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={handleRun}
            disabled={isRunBusy || isSubmitBusy}
            className="flex items-center gap-2 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
          >
            ▶ Run Code
          </button>
          <button
            onClick={handleSubmit}
            disabled={isRunBusy || isSubmitBusy}
            className="rounded-md bg-[#6c47ff] px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            Submit Code
          </button>
        </div>
      </div>

      <div ref={splitAreaRef} className="flex min-h-0 flex-1 flex-col">
        {/* Editor */}
        <div
          ref={editorPaneRef}
          className="problem-panel-scrollbar min-h-[160px] overflow-auto"
          style={{ flex: `${editorRatio} 1 0%` }}
        >
          {loaded && CodeMirrorWrapper ? (
            <CodeMirrorWrapper
              value={code}
              height={editorHeight > 0 ? `${editorHeight}px` : "100%"}
              className="dark-code-scrollbar"
              theme={themeMap[theme]}
              extensions={[languageExtensions[language]]}
              onChange={(val: string) => setCode(val || "")}
            />
          ) : (
            <div className="flex h-full min-h-[160px] items-center justify-center text-white/50">
              Loading editor...
            </div>
          )}
        </div>

        <div
          role="separator"
          aria-label="Resize editor and results panels"
          aria-orientation="horizontal"
          aria-valuemin={25}
          aria-valuemax={82}
          aria-valuenow={Math.round(editorRatio * 100)}
          tabIndex={0}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            resizeEditor(event);
          }}
          onPointerMove={resizeEditor}
          className="group relative z-10 flex h-2 shrink-0 cursor-row-resize touch-none items-center justify-center border-y border-white/[0.06] bg-black/40 transition-colors hover:bg-violet-400/10 focus-visible:outline-1 focus-visible:outline-violet-400"
        >
          <span className="h-0.5 w-10 rounded-full bg-white/20 transition-colors group-hover:bg-violet-300/70" />
        </div>

        {/* Results panel */}
        <div
          className="min-h-[140px] overflow-y-auto border-t border-white/[0.08]"
          style={{ flex: `${1 - editorRatio} 1 0%` }}
        >
          <SubmissionPanel
            activeTab={activeTab}
            onTabChange={setActiveTab}
            runResult={runResult}
            runExamples={examples}
            runStatus={runStatus}
            submitResult={submitResult}
            submitStatus={submitStatus}
          />
        </div>
      </div>

    </div>
  );
};

export default CodeEditor;