"use client";

import React from "react";

type FailedTestCase = {
  id: number;
  args?: unknown[];
  input?: string;
  expected?: unknown;
  expectedOutput?: string;
  actualOutput?: string;
};

type Result = {
  status: string;
  runtimeMs?: number;
  memoryMb?: number;
  failedTestCase?: FailedTestCase;
  errorMessage?: string;
};

type OutputPanelProps = {
  output?: string;
  result?: Result | null;
  submissionStatus?: string;
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "accepted":
      return { bg: "bg-green-900/30", text: "text-green-400", border: "border-green-500/50" };
    case "wrong_answer":
      return { bg: "bg-red-900/30", text: "text-red-400", border: "border-red-500/50" };
    case "compilation_error":
      return { bg: "bg-orange-900/30", text: "text-orange-400", border: "border-orange-500/50" };
    case "runtime_error":
    case "infrastructure_error":
      return { bg: "bg-red-900/30", text: "text-red-400", border: "border-red-500/50" };
    case "time_limit_exceeded":
    case "memory_limit_exceeded":
      return { bg: "bg-yellow-900/30", text: "text-yellow-400", border: "border-yellow-500/50" };
    default:
      return { bg: "bg-gray-900/30", text: "text-gray-400", border: "border-gray-500/50" };
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "accepted":
      return "✓";
    case "wrong_answer":
      return "✗";
    case "compilation_error":
    case "runtime_error":
    case "infrastructure_error":
      return "⚠";
    case "time_limit_exceeded":
    case "memory_limit_exceeded":
      return "⏱";
    default:
      return "•";
  }
};

const formatMemory = (memoryMb: number): string =>
  memoryMb < 1 ? `${Math.max(1, Math.round(memoryMb * 1024))}KB` : `${memoryMb.toFixed(2)}MB`;

const formatValue = (value: unknown): string => {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return JSON.stringify(value);
  const formatted = JSON.stringify(value);
  return formatted === undefined ? String(value) : formatted;
};

export default function OutputPanel({ output, result, submissionStatus }: OutputPanelProps) {
  if (result?.status) {
    const colors = getStatusColor(result.status);
    const icon = getStatusIcon(result.status);
    const statusDisplay = result.status
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
    const failedTestCase = result.failedTestCase;
    const expected = failedTestCase?.expected ?? failedTestCase?.expectedOutput;
    const actual = failedTestCase?.actualOutput;

    return (
      <div className={`p-4 rounded-md border ${colors.bg} ${colors.border} overflow-auto`}>
        <div className={`flex items-center gap-3 mb-4 pb-3 border-b ${colors.border}`}>
          <span className={`text-2xl ${colors.text}`}>{icon}</span>
          <div className="flex-1">
            <div className={`text-lg font-semibold ${colors.text}`}>{statusDisplay}</div>
            {result.runtimeMs !== undefined && (
              <div className="text-xs text-gray-400 mt-1">
                Runtime: {result.runtimeMs}ms
                {result.memoryMb !== undefined && result.memoryMb > 0 && ` • Memory: ${formatMemory(result.memoryMb)}`}
              </div>
            )}
          </div>
        </div>

        {result.errorMessage && (
          <div className="bg-red-900/20 border border-red-700/50 rounded p-3 mb-4">
            <div className="text-sm font-mono text-red-300 whitespace-pre-wrap break-words">
              {result.errorMessage}
            </div>
          </div>
        )}

        {failedTestCase && (
          <div className="bg-gray-900/50 border border-gray-700/50 rounded p-4">
            <div className="text-sm font-semibold text-gray-300 mb-3">
              Failed Test Case #{failedTestCase.id}
            </div>

            <div className="space-y-3">
              {(failedTestCase.args || failedTestCase.input !== undefined) && (
                <div>
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                    Input
                  </div>
                  <div className="bg-black/50 rounded p-2 text-sm font-mono text-blue-300 overflow-x-auto">
                    {failedTestCase.args
                      ? failedTestCase.args.map((arg, index) => (
                          <div key={index}>{formatValue(arg)}</div>
                        ))
                      : failedTestCase.input}
                  </div>
                </div>
              )}

              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                  Expected Output
                </div>
                <div className="bg-black/50 rounded p-2 text-sm font-mono text-green-300 overflow-x-auto">
                  {formatValue(expected)}
                </div>
              </div>

              {actual !== undefined && (
                <div>
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                    Your Output
                  </div>
                  <div className="bg-black/50 rounded p-2 text-sm font-mono text-red-300 whitespace-pre-wrap break-words overflow-x-auto">
                    {formatValue(actual)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-900/50 text-gray-300 rounded-md border border-gray-700/50 h-40 overflow-auto font-mono text-sm">
      <pre>{output || (submissionStatus === "idle" ? "Run code to see output..." : "Waiting for judge...")}</pre>
    </div>
  );
}
