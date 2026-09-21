"use client";

import React, { useState } from "react";

/* ────────────────────────── Types ────────────────────────── */

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

type SubmissionPanelProps = {
  activeTab: "run" | "submit";
  onTabChange: (tab: "run" | "submit") => void;

  /* Run state */
  runResult: JudgeResult | null;
  runExamples: ExampleTestCase[];
  runStatus: string; // idle | submitting | queued | running | finished | failed | error

  /* Submit state */
  submitResult: JudgeResult | null;
  submitStatus: string;
};

/* ────────────────────────── Helpers ────────────────────────── */

const statusConfig: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  accepted: { bg: "bg-emerald-950/40", text: "text-emerald-400", border: "border-emerald-500/30", icon: "✓" },
  wrong_answer: { bg: "bg-red-950/40", text: "text-red-400", border: "border-red-500/30", icon: "✗" },
  compilation_error: { bg: "bg-amber-950/40", text: "text-amber-400", border: "border-amber-500/30", icon: "⚠" },
  runtime_error: { bg: "bg-red-950/40", text: "text-red-400", border: "border-red-500/30", icon: "⚠" },
  infrastructure_error: { bg: "bg-red-950/40", text: "text-red-400", border: "border-red-500/30", icon: "⚠" },
  time_limit_exceeded: { bg: "bg-amber-950/40", text: "text-amber-400", border: "border-amber-500/30", icon: "⏱" },
  memory_limit_exceeded: { bg: "bg-amber-950/40", text: "text-amber-400", border: "border-amber-500/30", icon: "⏱" },
  output_limit_exceeded: { bg: "bg-amber-950/40", text: "text-amber-400", border: "border-amber-500/30", icon: "⚠" },
  validation_error: { bg: "bg-amber-950/40", text: "text-amber-400", border: "border-amber-500/30", icon: "⚠" },
};

const defaultConfig = { bg: "bg-zinc-900/50", text: "text-zinc-400", border: "border-zinc-700/50", icon: "•" };

const getConfig = (status: string) => statusConfig[status] || defaultConfig;

const formatStatus = (status: string) =>
  status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

const formatValue = (value: unknown): string => {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
};

/* ────────────────────── Metric Pill ────────────────────── */

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 text-xs text-white/60">
      <span className="text-white/40">{label}</span>
      <span className="text-white/80 font-medium">{value}</span>
    </span>
  );
}

/* ──────────────────── Loading Skeleton ──────────────────── */

function LoadingState({ status }: { status: string }) {
  const label = status === "queued" ? "Queued..." : status === "running" ? "Running..." : "Submitting...";
  return (
    <div className="flex items-center justify-center gap-3 py-10">
      <div className="relative h-5 w-5">
        <div className="absolute inset-0 rounded-full border-2 border-white/10" />
        <div className="absolute inset-0 rounded-full border-2 border-t-violet-400 animate-spin" />
      </div>
      <span className="text-sm text-white/50">{label}</span>
    </div>
  );
}

/* ────────────────────── Idle State ─────────────────────── */

function IdleState({ mode }: { mode: "run" | "submit" }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-white/30">
      <div className="text-2xl mb-2">{mode === "run" ? "▶" : "⬆"}</div>
      <div className="text-sm">
        {mode === "run" ? "Run your code to test against examples" : "Submit your code to run all test cases"}
      </div>
    </div>
  );
}

/* ────────────────────── Error Block ────────────────────── */

function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="rounded-lg bg-red-950/30 border border-red-500/20 p-3">
      <div className="text-xs font-semibold text-red-400/70 uppercase tracking-wide mb-1.5">Error</div>
      <pre className="text-sm font-mono text-red-300/90 whitespace-pre-wrap break-words leading-relaxed">
        {message}
      </pre>
    </div>
  );
}

/* ────────────────── Test Case Detail Card ────────────────── */

function TestCaseDetail({
  args,
  expected,
  actual,
  passed,
}: {
  args?: unknown[];
  expected?: unknown;
  actual?: string;
  passed: boolean;
}) {
  return (
    <div className="space-y-2.5">
      {args && args.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-1">Input</div>
          <div className="rounded-md bg-black/40 border border-white/5 p-2.5 text-sm font-mono text-blue-300/90 overflow-x-auto">
            {args.map((arg, i) => (
              <div key={i}>{formatValue(arg)}</div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-1">Expected</div>
        <div className="rounded-md bg-black/40 border border-white/5 p-2.5 text-sm font-mono text-emerald-300/90 overflow-x-auto">
          {formatValue(expected)}
        </div>
      </div>

      {actual !== undefined && (
        <div>
          <div className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-1">Output</div>
          <div
            className={`rounded-md bg-black/40 border border-white/5 p-2.5 text-sm font-mono overflow-x-auto whitespace-pre-wrap break-words ${passed ? "text-emerald-300/90" : "text-red-300/90"
              }`}
          >
            {formatValue(actual)}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ RUN PANEL ═══════════════════════ */

function RunPanel({
  result,
  examples,
  status,
}: {
  result: JudgeResult | null;
  examples: ExampleTestCase[];
  status: string;
}) {
  const [selectedTab, setSelectedTab] = useState(0);

  if (status === "idle") return <IdleState mode="run" />;
  if (status === "submitting" || status === "queued" || status === "running")
    return <LoadingState status={status} />;
  if (status === "error" && !result)
    return (
      <div className="p-4">
        <ErrorBlock message="Failed to submit code. Please try again." />
      </div>
    );
  if (!result) return <IdleState mode="run" />;

  const cfg = getConfig(result.status);
  const passed = result.passedTestCases ?? 0;
  const total = result.totalTestCases ?? examples.length;

  // Build per-tab pass/fail state.
  // The judge stops at the first failure and returns its index in failedTestCase.
  // Test cases 0..passed-1 passed, test case at index `passed` is the failed one (if any).
  const tabStates = examples.map((_, i) => {
    if (i < passed) return "passed" as const;
    if (i === passed && result.status !== "accepted") return "failed" as const;
    return "pending" as const;
  });

  // Determine which example to show details for on the selected tab
  const currentExample = examples[selectedTab];
  const currentState = tabStates[selectedTab];

  // For the failed case, the judge returns the actual output in failedTestCase
  const failedCase = result.failedTestCase;
  const showActual =
    currentState === "failed" && failedCase
      ? failedCase.actualOutput
      : currentState === "passed"
        ? formatValue(currentExample?.expected) // passed = output matches expected
        : undefined;

  return (
    <div>
      {/* Status Header */}
      <div className={`px-4 py-3 border-b ${cfg.border} ${cfg.bg}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className={`text-lg ${cfg.text}`}>{cfg.icon}</span>
            <span className={`text-sm font-semibold ${cfg.text}`}>{formatStatus(result.status)}</span>
          </div>
          <div className="flex items-center gap-2">
            <MetricPill label="Passed" value={`${passed}/${total}`} />
            {result.runtimeMs !== undefined && <MetricPill label="Runtime" value={`${result.runtimeMs}ms`} />}
            {(result.memoryMb ?? 0) > 0 && <MetricPill label="Memory" value={`${result.memoryMb}MB`} />}
          </div>
        </div>
      </div>

      {/* Error message */}
      {result.errorMessage && (
        <div className="px-4 pt-3">
          <ErrorBlock message={result.errorMessage} />
        </div>
      )}

      {/* Test Case Tabs & Details (only when code was compiled and executed) */}
      {result.status !== "compilation_error" && result.status !== "infrastructure_error" && (
        <>
          <div className="px-4 pt-3">
            <div className="flex gap-1 border-b border-white/5 pb-0">
              {examples.map((_, i) => {
                const state = tabStates[i];
                const isActive = i === selectedTab;
                const stateIcon = state === "passed" ? "✓" : state === "failed" ? "✗" : "·";
                const stateColor =
                  state === "passed"
                    ? "text-emerald-400"
                    : state === "failed"
                      ? "text-red-400"
                      : "text-white/30";

                return (
                  <button
                    key={i}
                    onClick={() => setSelectedTab(i)}
                    className={`
                      relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-md transition-all
                      ${isActive
                        ? "bg-white/5 text-white border-b-2 border-violet-400"
                        : "text-white/50 hover:text-white/70 hover:bg-white/[0.03]"
                      }
                    `}
                  >
                    <span className={`text-sm ${stateColor}`}>{stateIcon}</span>
                    Test {i + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Test Case Content */}
          {currentExample && (
            <div className="px-4 py-3">
              <TestCaseDetail
                args={currentExample.args}
                expected={currentExample.expected}
                actual={showActual}
                passed={currentState === "passed"}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ═══════════════════════ SUBMIT PANEL ═══════════════════════ */

function SubmitPanel({ result, status }: { result: JudgeResult | null; status: string }) {
  if (status === "idle") return <IdleState mode="submit" />;
  if (status === "submitting" || status === "queued" || status === "running")
    return <LoadingState status={status} />;
  if (status === "error" && !result)
    return (
      <div className="p-4">
        <ErrorBlock message="Failed to submit code. Please try again." />
      </div>
    );
  if (!result) return <IdleState mode="submit" />;

  const cfg = getConfig(result.status);
  const passed = result.passedTestCases ?? 0;
  const total = result.totalTestCases ?? 0;
  const failedCase = result.failedTestCase;

  return (
    <div>
      {/* Status Header */}
      <div className={`px-4 py-4 border-b ${cfg.border} ${cfg.bg}`}>
        <div className="flex items-center gap-3 mb-2">
          <span className={`text-2xl ${cfg.text}`}>{cfg.icon}</span>
          <span className={`text-lg font-bold ${cfg.text}`}>{formatStatus(result.status)}</span>
        </div>

        {/* Progress bar */}
        {total > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-white/50 mb-1.5">
              <span>Test Cases</span>
              <span className={cfg.text}>
                {passed}/{total} passed
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${result.status === "accepted" ? "bg-emerald-400" : "bg-red-400"
                  }`}
                style={{ width: `${total > 0 ? (passed / total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          {total > 0 && <MetricPill label="Passed" value={`${passed}/${total}`} />}
          {result.runtimeMs !== undefined && <MetricPill label="Runtime" value={`${result.runtimeMs}ms`} />}
          {(result.memoryMb ?? 0) > 0 && <MetricPill label="Memory" value={`${result.memoryMb}MB`} />}
        </div>
      </div>

      {/* Error message */}
      {result.errorMessage && (
        <div className="px-4 pt-3">
          <ErrorBlock message={result.errorMessage} />
        </div>
      )}

      {/* Failed test case detail */}
      {failedCase && (
        <div className="px-4 py-3">
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-red-400 text-sm">✗</span>
              <span className="text-sm font-semibold text-white/70">
                Failed Test Case #{failedCase.id}
              </span>
            </div>
            <TestCaseDetail
              args={failedCase.args}
              expected={failedCase.expected ?? failedCase.expectedOutput}
              actual={failedCase.actualOutput}
              passed={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════ SUBMISSION PANEL (ROOT) ═══════════════════ */

export default function SubmissionPanel({
  activeTab,
  onTabChange,
  runResult,
  runExamples,
  runStatus,
  submitResult,
  submitStatus,
}: SubmissionPanelProps) {
  const runHasResult = runStatus !== "idle";
  const submitHasResult = submitStatus !== "idle";

  // Compute tab badge state
  const runBadge =
    runResult?.status === "accepted"
      ? "passed"
      : runResult && runResult.status !== "accepted" && runStatus === "finished"
        ? "failed"
        : null;
  const submitBadge =
    submitResult?.status === "accepted"
      ? "passed"
      : submitResult && submitResult.status !== "accepted" && submitStatus === "finished"
        ? "failed"
        : null;

  return (
    <div className="rounded-lg border border-white/[0.06] bg-zinc-900/60 backdrop-blur-sm overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center border-b border-white/[0.06] bg-black/20">
        <button
          onClick={() => onTabChange("run")}
          className={`
            relative flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-all
            ${activeTab === "run"
              ? "text-white bg-white/[0.04]"
              : "text-white/40 hover:text-white/60"
            }
          `}
        >
          <span className="text-xs">▶</span>
          Run
          {runBadge && (
            <span
              className={`w-1.5 h-1.5 rounded-full ${runBadge === "passed" ? "bg-emerald-400" : "bg-red-400"
                }`}
            />
          )}
          {activeTab === "run" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-400" />
          )}
        </button>

        <button
          onClick={() => onTabChange("submit")}
          className={`
            relative flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-all
            ${activeTab === "submit"
              ? "text-white bg-white/[0.04]"
              : "text-white/40 hover:text-white/60"
            }
          `}
        >
          <span className="text-xs">⬆</span>
          Submit
          {submitBadge && (
            <span
              className={`w-1.5 h-1.5 rounded-full ${submitBadge === "passed" ? "bg-emerald-400" : "bg-red-400"
                }`}
            />
          )}
          {activeTab === "submit" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-400" />
          )}
        </button>
      </div>

      {/* Panel content */}
      <div className="max-h-[360px] overflow-y-auto">
        {activeTab === "run" ? (
          <RunPanel result={runResult} examples={runExamples} status={runStatus} />
        ) : (
          <SubmitPanel result={submitResult} status={submitStatus} />
        )}
      </div>
    </div>
  );
}
