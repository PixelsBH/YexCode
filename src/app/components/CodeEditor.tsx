"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import type { Extension } from "@codemirror/state";

import { githubLight } from "@uiw/codemirror-theme-github";
import { dracula } from "@uiw/codemirror-theme-dracula";
import { oneDark } from "@codemirror/theme-one-dark";

import { javascript } from "@codemirror/lang-javascript";
import { cpp } from "@codemirror/lang-cpp";
import { python } from "@codemirror/lang-python";
import { java } from "@codemirror/lang-java";
import SubmissionPanel from "@/app/components/SubmissionPanel";

let CodeMirrorWrapper: typeof import("@uiw/react-codemirror").default | null = null;

const languageExtensions: Record<string, Extension> = {
  JavaScript: javascript(),
  "C++": cpp(),
  Python: python(),
  Java: java(),
};

const themeMap: Record<string, Extension> = {
  Light: githubLight,
  Dracula: dracula,
  Dark: oneDark,
};

type Limits = {
  timeLimitMs: number;
  memoryLimitMb: number;
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
};

type ExampleTestCase = {
  id: number;
  args: unknown[];
  expected: unknown;
  explanation?: string;
};

type TestCaseJson = {
  id: number;
  args: unknown[];
  expected: unknown;
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
  testCasesJson?: TestCaseJson[];
  limits?: Limits;
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
  testCasesJson = [],
  limits = { timeLimitMs: 1000, memoryLimitMb: 128 },
  templates = {},
  function: functionMetadata,
  examples = [],
}) => {
  const [code, setCode] = useState(initialCode);
  const [loaded, setLoaded] = useState(false);
  const mountedRef = useRef(false);
  const runPollRef = useRef<number | null>(null);
  const submitPollRef = useRef<number | null>(null);

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

    import("@uiw/react-codemirror").then((mod) => {
      CodeMirrorWrapper = mod.default || mod;
      if (mountedRef.current) setLoaded(true);
    });

    return () => {
      mountedRef.current = false;
      clearPoll(runPollRef);
      clearPoll(submitPollRef);
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

  const clearPoll = (ref: React.RefObject<number | null>) => {
    if (ref.current) {
      window.clearTimeout(ref.current);
      ref.current = null;
    }
  };

  const buildPayload = (testCases: { id: number; args: unknown[]; expected: unknown }[]) => {
    const functionPayload = functionMetadata
      ? {
          name: functionMetadata.name,
          returnType: functionMetadata.returnType,
          params: functionMetadata.params.map(({ name, type }) => ({ name, type })),
        }
      : undefined;

    const cleanedTestCases = testCases.map(({ id, args, expected }) => ({
      id,
      args,
      expected,
    }));

    return {
      language: language === "C++" ? "cpp" : language.toLowerCase(),
      sourceCode: code,
      testCases: cleanedTestCases,
      limits,
      ...(functionPayload ? { mode: "function", function: functionPayload } : {}),
    };
  };

  const pollSubmission = useCallback(
    (
      id: string,
      setStatus: (s: string) => void,
      setResult: (r: JudgeResult | null) => void,
      pollRef: React.RefObject<number | null>,
    ) => {
      const poll = async () => {
        try {
          const res = await fetch(`/api/run/${id}`);
          if (!res.ok) {
            const errData = await res.json().catch(() => null);
            const msg =
              (typeof errData?.error === "object" ? errData?.error?.message : errData?.error) ||
              `Failed to check status (${res.status})`;
            setResult({
              status: "infrastructure_error",
              errorMessage: msg,
            });
            setStatus("error");
            return;
          }

          const data = await res.json();
          setStatus(data.status || "unknown");

          if (data.status === "queued" || data.status === "running") {
            pollRef.current = window.setTimeout(poll, 1000);
            return;
          }

          if (data.status === "finished") {
            setResult(data.result || null);
            setStatus("finished");
            return;
          }

          if (data.status === "failed") {
            const finalResult = data.result || {
              status: "infrastructure_error",
              errorMessage: data.failureMessage || "The judge could not process this submission.",
            };
            setResult(finalResult);
            setStatus("failed");
            return;
          }

          setStatus("error");
          setResult({
            status: "infrastructure_error",
            errorMessage: `Unexpected submission status: ${data.status}`,
          });
        } catch (err) {
          setStatus("error");
          setResult({
            status: "infrastructure_error",
            errorMessage: err instanceof Error ? err.message : "Failed to communicate with the server",
          });
        }
      };

      poll();
    },
    [],
  );

  const submitToJudge = async (
    testCases: { id: number; args: unknown[]; expected: unknown }[],
    setStatus: (s: string) => void,
    setResult: (r: JudgeResult | null) => void,
    pollRef: React.RefObject<number | null>,
  ) => {
    clearPoll(pollRef);
    setStatus("submitting");
    setResult(null);

    if (!functionMetadata) {
      setResult({
        status: "infrastructure_error",
        errorMessage: "Missing function definition for this problem.",
      });
      setStatus("error");
      return;
    }

    if (testCases.length === 0) {
      setResult({
        status: "infrastructure_error",
        errorMessage: "No test cases provided.",
      });
      setStatus("error");
      return;
    }

    const payload = buildPayload(testCases);

    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const errorMsg =
          (typeof data?.error === "object" ? data?.error?.message : data?.error) ||
          data?.message ||
          `Judge error (${response.status})`;

        setResult({
          status: "infrastructure_error",
          errorMessage: errorMsg,
        });
        setStatus("error");
        return;
      }

      const id = data?.submissionId || data?.id;
      if (!id) {
        setResult({
          status: "infrastructure_error",
          errorMessage: data?.error || "Invalid response from judge (missing submission ID)",
        });
        setStatus("error");
        return;
      }

      setStatus(data.status || "queued");

      if (data.status === "finished" || data.status === "failed") {
        pollSubmission(String(id), setStatus, setResult, pollRef);
      } else {
        pollRef.current = window.setTimeout(
          () => pollSubmission(String(id), setStatus, setResult, pollRef),
          500,
        );
      }
    } catch (err) {
      setResult({
        status: "infrastructure_error",
        errorMessage: err instanceof Error ? err.message : "Failed to connect to judge",
      });
      setStatus("error");
    }
  };

  /* ─── Handlers ─── */

  const handleRun = () => {
    setActiveTab("run");
    const exampleTestCases = examples.map((ex, index) => ({
      id: typeof ex.id === "number" ? ex.id : index + 1,
      args: ex.args,
      expected: ex.expected,
    }));
    submitToJudge(exampleTestCases, setRunStatus, setRunResult, runPollRef);
  };

  const handleSubmit = () => {
    setActiveTab("submit");
    const testCases = testCasesJson.map((tc, index) => ({
      id: typeof tc.id === "number" ? tc.id : index + 1,
      args: tc.args,
      expected: tc.expected,
    }));
    submitToJudge(testCases, setSubmitStatus, setSubmitResult, submitPollRef);
  };

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