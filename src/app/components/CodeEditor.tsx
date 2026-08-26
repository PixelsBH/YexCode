"use client";

import React, { useEffect, useRef, useState } from "react";
import type { Extension } from "@codemirror/state";

import { githubLight } from "@uiw/codemirror-theme-github";
import { dracula } from "@uiw/codemirror-theme-dracula";
import { oneDark } from "@codemirror/theme-one-dark";

import { javascript } from "@codemirror/lang-javascript";
import { cpp } from "@codemirror/lang-cpp";
import { python } from "@codemirror/lang-python";
import { java } from "@codemirror/lang-java";
import OutputPanel from "@/app/components/OutputPanel";

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

type TestCase = {
  id: number;
  input: string;
  expectedOutput: string;
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

type TestCaseJson = {
  id: number;
  args: unknown[];
  expected: unknown;
};

type SubmissionResult = {
  status: string;
  runtimeMs?: number;
  memoryMb?: number;
  failedTestCase?: TestCaseJson & {
    actualOutput?: string;
  };
  errorMessage?: string;
};

type CodeEditorProps = {
  problemSlug: string;
  initialCode: string;
  testCases?: TestCase[];
  testCasesJson?: TestCaseJson[];
  limits?: Limits;
  templates?: Templates;
  function?: FunctionMetadata;
};

const getDraftKey = (problemSlug: string, language: string) => {
  const languageKey = language === "C++" ? "cpp" : language.toLowerCase();
  return `yexcode:draft:v1:${encodeURIComponent(problemSlug)}:${languageKey}`;
};

const CodeEditor: React.FC<CodeEditorProps> = ({
  problemSlug,
  initialCode,
  testCases = [],
  testCasesJson = [],
  limits = { timeLimitMs: 1000, memoryLimitMb: 128 },
  templates = {},
  function: functionMetadata,
}) => {
  const [code, setCode] = useState(initialCode);
  const [loaded, setLoaded] = useState(false);
  const mountedRef = useRef(false);
  const pollTimerRef = useRef<number | null>(null);

  const [language, setLanguage] = useState("C++");
  const [theme, setTheme] = useState("Dark");
  const [output, setOutput] = useState("Run code to see output...");

  const [submissionStatus, setSubmissionStatus] = useState<string>("idle");
  const [result, setResult] = useState<SubmissionResult | null>(null);
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
      clearPolling();
    };
  }, []);

  // Restore a draft for this problem/language, or fall back to the template.
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

  // Debounce writes so typing does not cause a storage operation per keystroke.
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

  const clearPolling = () => {
    if (pollTimerRef.current) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const getRunUrl = () => {
    return "/api/run";
  };

  const getRunStatusUrl = (id: string) => {
    return `/api/run/${id}`;
  };

  const pollSubmission = async (id: string) => {
    try {
      const statusUrl = getRunStatusUrl(id);
      const statusRes = await fetch(statusUrl);

      if (!statusRes.ok) {
        setOutput(`Failed to fetch submission status: ${statusRes.status}`);
        setSubmissionStatus("error");
        return;
      }

      const statusData = await statusRes.json();
      setSubmissionStatus(statusData.status || "unknown");

      if (statusData.status === "queued" || statusData.status === "running") {
        setOutput(statusData.status === "queued" ? "Queued..." : "Running...");
        pollTimerRef.current = window.setTimeout(() => pollSubmission(id), 1000);
        return;
      }

      if (statusData.status === "finished") {
        const finalResult = statusData.result || null;
        setResult(finalResult);

        const finalStatus = finalResult?.status || "unknown";
        const runtime = finalResult?.runtimeMs;
        setOutput(runtime != null ? `${finalStatus} (${runtime}ms)` : finalStatus);
        return;
      }

      if (statusData.status === "failed") {
        const finalResult = statusData.result || {
          status: "infrastructure_error",
          errorMessage: statusData.failureMessage || "The judge could not process this submission.",
        };
        setResult(finalResult);
        setOutput(finalResult.errorMessage || finalResult.status);
        setSubmissionStatus("failed");
        return;
      }

      setOutput(`Unexpected submission status: ${statusData.status || "unknown"}`);
      setSubmissionStatus("error");
    } catch (error) {
      setOutput(`Error polling submission: ${error}`);
      setSubmissionStatus("error");
    }
  };

  const handleSubmit = async () => {
    clearPolling();

    setSubmissionStatus("submitting");
    setResult(null);
    setOutput("Submitting code...");

    if (functionMetadata && testCasesJson.length === 0) {
      setOutput("This function-mode problem has no JSON test cases configured.");
      setSubmissionStatus("error");
      return;
    }

    // Mongoose adds `_id` fields to nested documents. YexJudge uses strict JSON
    // decoding, so forward only the fields in its public submission contract.
    const functionPayload = functionMetadata
      ? {
          name: functionMetadata.name,
          returnType: functionMetadata.returnType,
          params: functionMetadata.params.map(({ name, type }) => ({ name, type })),
        }
      : undefined;
    const functionTestCases = testCasesJson.map(({ id, args, expected }) => ({
      id,
      args,
      expected,
    }));
    const stdinTestCases = testCases.map(({ id, input, expectedOutput }) => ({
      id,
      input,
      expectedOutput,
    }));

    const payload = {
      language: language === "C++" ? "cpp" : language.toLowerCase(),
      sourceCode: code,
      testCases: functionMetadata ? functionTestCases : stdinTestCases,
      limits,
      ...(functionPayload
        ? { mode: "function", function: functionPayload }
        : {}),
    };

    try {
      const submitUrl = getRunUrl();
      const response = await fetch(submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message = data?.error?.message || data?.error || `Judge API error: ${response.status}`;
        setOutput(message);
        setSubmissionStatus("error");
        return;
      }

      const id = data?.submissionId || data?.id;
      if (!id) {
        setOutput(`Unexpected judge response: ${JSON.stringify(data)}`);
        setSubmissionStatus("error");
        return;
      }


      setSubmissionStatus(data.status || "queued");
      setOutput(data.status === "running" ? "Running..." : "Queued...");

      if (data.status === "finished" || data.status === "failed") {
        await pollSubmission(String(id));
      } else {
        pollTimerRef.current = window.setTimeout(() => pollSubmission(String(id)), 500);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setOutput(`Failed to submit code: ${message}`);
      setSubmissionStatus("error");
    }
  };

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
          onClick={handleSubmit}
          disabled={submissionStatus === "submitting" || submissionStatus === "queued" || submissionStatus === "running"}
          className="flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition"
        >
          ▶ Run Code
        </button>

        <button
          onClick={handleSubmit}
          className="px-4 py-1.5 rounded-md text-sm font-medium text-white bg-[#6c47ff] hover:opacity-90 transition"
        >
          Submit Code
        </button>
      </div>

      <div className="mt-4">
        <OutputPanel output={output} result={result} submissionStatus={submissionStatus} />
      </div>
    </div>
  );
};

export default CodeEditor;