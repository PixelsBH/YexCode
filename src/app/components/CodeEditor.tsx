"use client";

import React, { useEffect, useRef, useState } from "react";

import { githubLight } from "@uiw/codemirror-theme-github";
import { dracula } from "@uiw/codemirror-theme-dracula";
import { oneDark } from "@codemirror/theme-one-dark";

import { javascript } from "@codemirror/lang-javascript";
import { cpp } from "@codemirror/lang-cpp";
import { python } from "@codemirror/lang-python";
import { java } from "@codemirror/lang-java";
import OutputPanel from "@/app/components/OutputPanel";

let CodeMirrorWrapper: any = null;

const languageExtensions: Record<string, any> = {
  JavaScript: javascript(),
  "C++": cpp(),
  Python: python(),
  Java: java(),
};

const themeMap: Record<string, any> = {
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

type CodeEditorProps = {
  initialCode: string;
  testCases?: TestCase[];
  limits?: Limits;
};

const CodeEditor: React.FC<CodeEditorProps> = ({
  initialCode,
  testCases = [],
  limits = { timeLimitMs: 1000, memoryLimitMb: 128 },
}) => {
  const [code, setCode] = useState(initialCode);
  const [loaded, setLoaded] = useState(false);
  const mountedRef = useRef(false);
  const pollTimerRef = useRef<number | null>(null);

  const [language, setLanguage] = useState("C++");
  const [theme, setTheme] = useState("Dark");
  const [output, setOutput] = useState("Run code to see output...");
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [submissionStatus, setSubmissionStatus] = useState<string>("idle");
  const [result, setResult] = useState<{ status: string; runtimeMs?: number } | null>(null);

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

      if (statusData.status === "queued" || statusData.status === "submitting") {
        setOutput("Running...");
        pollTimerRef.current = window.setTimeout(() => pollSubmission(id), 1500);
        return;
      }

      if (statusData.status === "finished") {
        setResult(statusData.result || null);
        const finalStatus = statusData.result?.status || "unknown";
        const runtime = statusData.result?.runtimeMs;

        let outputText = finalStatus;
        if (finalStatus === "accepted") {
          outputText = runtime != null ? `${finalStatus} ${runtime}` : finalStatus;
        } else if (statusData.result?.failedTestCases?.length != null) {
          const failedCount = statusData.result.failedTestCases.length;
          outputText = `${finalStatus} failed ${failedCount} case${failedCount === 1 ? "" : "s"}`;
        } else if (statusData.result?.failedTestCase) {
          outputText = `${finalStatus} failed 1 case`;
        } else {
          outputText = runtime != null ? `${finalStatus} ${runtime}` : finalStatus;
        }

        setOutput(outputText);
      }
    } catch (error) {
      setOutput(`Error polling submission: ${error}`);
      setSubmissionStatus("error");
    }
  };

  const handleSubmit = async () => {
    clearPolling();
    setSubmissionId(null);
    setSubmissionStatus("submitting");
    setResult(null);
    setOutput("Submitting code...");

    const payload = {
      language: language === "C++" ? "cpp" : language.toLowerCase(),
      sourceCode: code,
      testCases: testCases,
      limits: limits,
    };

    try {
      const submitUrl = getRunUrl();
      setOutput(`Submitting to ${submitUrl}...`);
      const response = await fetch(submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        setOutput(`Judge API error: ${response.status}`);
        setSubmissionStatus("error");
        return;
      }

      const data = await response.json();
      const id = data.submissionId || data.id;
      if (!id) {
        setOutput(`Unexpected judge response: ${JSON.stringify(data)}`);
        setSubmissionStatus("error");
        return;
      }

      setSubmissionId(id);
      setSubmissionStatus(data.status || "queued");
      setOutput("Running...");

      if (data.status === "queued" || data.status === "submitting") {
        pollTimerRef.current = window.setTimeout(() => pollSubmission(id), 1500);
      } else if (data.status === "finished") {
        await pollSubmission(id);
      }
    } catch (error) {
      setOutput(`Failed to submit code: ${error}`);
      setSubmissionStatus("error");
    }
  };

  return (
    <div className="flex flex-col rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-black/30">
        <div className="flex gap-3">
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
        <button className="flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition">
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
        <OutputPanel output={output} />
      </div>
    </div>
  );
};

export default CodeEditor;