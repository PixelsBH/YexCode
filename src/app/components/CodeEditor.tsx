"use client";

import React, { useEffect, useRef, useState } from "react";
import type { Extension } from "@codemirror/state";

import { githubLight } from "@uiw/codemirror-theme-github";
import { dracula } from "@uiw/codemirror-theme-dracula";
import { oneDark } from "@codemirror/theme-one-dark";

import { cpp } from "@codemirror/lang-cpp";
import SubmissionPanel from "@/app/components/SubmissionPanel";

let CodeMirrorWrapper: typeof import("@uiw/react-codemirror").default | null = null;

const languageExtensions: Record<string, Extension> = {
  "C++": cpp(),
};

const themeMap: Record<string, Extension> = {
  Light: githubLight,
  Dracula: dracula,
  Dark: oneDark,
};


type Templates = {
  cpp?: string;
  python?: string;
  java?: string;
  javascript?: string;
  c?: string;
  go?: string;
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

  const [language, setLanguage] = useState("C++");
  const [theme, setTheme] = useState("Dark");

  /* ─── Run state ─── */
  const [runStatus, setRunStatus] = useState<string>("idle");
  const [runResult, setRunResult] = useState<JudgeResult | null>(null);

  /* ─── Submit state ─── */
  const [submitStatus, setSubmitStatus] = useState<string>("idle");
  const [submitResult, setSubmitResult] = useState<JudgeResult | null>(null);

  /* ─── Panel tab ─── */
  const [activeTab, setActiveTab] = useState<"run" | "submit">("run");

  /* ─── Draft state ─── */
  const [draftStatus, setDraftStatus] = useState<"loading" | "saved" | "template" | "unavailable">("loading");
  const skipNextDraftSaveRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    const runAbortControllerRef = runAbortRef;
    const submitAbortControllerRef = submitAbortRef;

    import("@uiw/react-codemirror").then((mod) => {
      CodeMirrorWrapper = mod.default || mod;
      if (mountedRef.current) setLoaded(true);
    });

    return () => {
      mountedRef.current = false;
      clearPoll(runPollRef);
      clearPoll(submitPollRef);
      runAbortControllerRef.current?.abort();
      submitAbortControllerRef.current?.abort();
    };
  }, []);

  // Restore draft
  useEffect(() => {
    const langKey = language === "C++" ? "cpp" : language.toLowerCase();
    const template = templates[langKey as keyof Templates] || initialCode;
    skipNextDraftSaveRef.current = true;
    setDraftStatus("loading");

    try {
      const savedDraft = window.localStorage.getItem(getDraftKey(problemSlug, language));
      setCode(savedDraft ?? template);
      setDraftStatus(savedDraft === null ? "template" : "saved");
    } catch {
      setCode(template);
      setDraftStatus("unavailable");
    }
  }, [problemSlug, language, templates, initialCode]);

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
    const langKey = language === "C++" ? "cpp" : language.toLowerCase();
    const template = templates[langKey as keyof Templates] || initialCode;

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
          if ([502, 503, 504].includes(response.status) && retryAttempt < 3) {
            schedule(retryAttempt + 1, 500 * 2 ** retryAttempt);
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
          language: "cpp",
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

  const isRunBusy = runStatus === "submitting" || runStatus === "queued" || runStatus === "running";
  const isSubmitBusy = submitStatus === "submitting" || submitStatus === "queued" || submitStatus === "running";

  return (
    <div className="flex flex-col rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-black/30">
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
            onChange={(e) => setLanguage(e.target.value)}
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
      </div>

      {/* Editor */}
      <div>
        {loaded && CodeMirrorWrapper ? (
          <CodeMirrorWrapper
            value={code}
            height="320px"
            theme={themeMap[theme]}
            extensions={[languageExtensions[language]]}
            onChange={(val: string) => setCode(val || "")}
          />
        ) : (
          <div className="h-[320px] flex items-center justify-center text-white/50">
            Loading editor...
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div className="flex items-center justify-end gap-3 px-4 py-2 border-t border-white/10 bg-black/30">
        <button
          onClick={handleRun}
          disabled={isRunBusy || isSubmitBusy}
          className="flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition"
        >
          ▶ Run Code
        </button>

        <button
          onClick={handleSubmit}
          disabled={isRunBusy || isSubmitBusy}
          className="px-4 py-1.5 rounded-md text-sm font-medium text-white bg-[#6c47ff] hover:opacity-90 disabled:opacity-50 transition"
        >
          Submit Code
        </button>
      </div>

      {/* Submission Panel */}
      <div className="mt-0">
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
  );
};

export default CodeEditor;