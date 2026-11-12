import { notFound } from "next/navigation";
import ProblemWorkspaceTabs from "@/app/components/ProblemWorkspaceTabs";
import CodeEditor from "@/app/components/CodeEditor";

type Params = { slug: string };

export default async function ProblemPage({ params }: { params: Params }) {
  const { slug } = await params;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(
    `${baseUrl}/api/problems/${slug}`,
    { cache: "no-store" }
  );

  if (res.status === 404) notFound();
  if (!res.ok) throw new Error("Failed to fetch problem");

  const problem = await res.json();

  return (
    <div className="mx-auto grid h-[calc(100dvh-8rem)] min-h-[34rem] w-full max-w-[1800px] grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] overflow-hidden rounded-2xl border border-white/[0.15] bg-[#15151c] shadow-2xl shadow-black/30 lg:grid-cols-2 lg:grid-rows-1">
      <div className="min-h-0 min-w-0 border-b border-white/10 lg:border-b-0 lg:border-r">
        <ProblemWorkspaceTabs problem={problem} problemSlug={slug} />
      </div>
      <div className="flex min-h-0 min-w-0 flex-col">
        <CodeEditor
          problemSlug={slug}
          problemTitle={problem.title}
          initialCode={problem.templates?.cpp || "// Write your code here"}
          templates={problem.templates}
          function={problem.function}
          class={problem.class}
          examples={problem.examples}
        />
      </div>
    </div>
  );
}
