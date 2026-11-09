"use client";

import { useState } from "react";
import ProblemStatement from "@/app/components/ProblemStatement";
import SubmissionHistory from "@/app/components/SubmissionHistory";

type ProblemContent = React.ComponentProps<typeof ProblemStatement>["problem"];

export default function ProblemWorkspaceTabs({ problem, problemSlug }: { problem: ProblemContent; problemSlug: string }) {
  const [activeTab, setActiveTab] = useState<"description" | "submissions">("description");

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-transparent">
      <div role="tablist" aria-label="Problem workspace" className="flex shrink-0 border-b border-white/[0.08] bg-white/[0.025] px-2">
        <button
          id="problem-description-tab"
          type="button"
          role="tab"
          aria-selected={activeTab === "description"}
          aria-controls="problem-description-panel"
          onClick={() => setActiveTab("description")}
          className={`border-b-2 px-5 py-3 text-sm font-medium transition ${activeTab === "description" ? "border-violet-400 text-violet-100" : "border-transparent text-white/45 hover:text-white/80"}`}
        >
          Description
        </button>
        <button
          id="problem-submissions-tab"
          type="button"
          role="tab"
          aria-selected={activeTab === "submissions"}
          aria-controls="problem-submissions-panel"
          onClick={() => setActiveTab("submissions")}
          className={`border-b-2 px-5 py-3 text-sm font-medium transition ${activeTab === "submissions" ? "border-violet-400 text-violet-100" : "border-transparent text-white/45 hover:text-white/80"}`}
        >
          Submissions
        </button>
      </div>
      <div
        id={activeTab === "description" ? "problem-description-panel" : "problem-submissions-panel"}
        role="tabpanel"
        aria-labelledby={activeTab === "description" ? "problem-description-tab" : "problem-submissions-tab"}
        className="problem-panel-scrollbar min-h-0 flex-1 overflow-y-auto"
      >
        {activeTab === "description"
          ? <ProblemStatement problem={problem} />
          : <SubmissionHistory problemSlug={problemSlug} />}
      </div>
    </section>
  );
}
