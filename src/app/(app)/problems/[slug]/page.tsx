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
    <div className="grid h-[calc(100vh-7rem)] grid-cols-1 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/80 shadow-2xl shadow-black/20 lg:grid-cols-2">
      <div className="min-h-0 min-w-0 border-b border-white/10 lg:border-b-0 lg:border-r">
        <ProblemWorkspaceTabs problem={problem} problemSlug={slug} />
      </div>
      <div className="flex min-h-0 min-w-0 flex-col">
        <CodeEditor
          problemSlug={slug}
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
