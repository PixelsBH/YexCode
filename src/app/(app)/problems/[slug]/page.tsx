  import ProblemStatement from "@/app/components/ProblemStatement";
import CodeEditor from "@/app/components/CodeEditor";

type Params = { slug: string };

export default async function ProblemPage({ params }: { params: Params }) {
  const { slug } = await params;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(
    `${baseUrl}/api/problems/${slug}`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    throw new Error("Failed to fetch problem");
  }

  const problem = await res.json();

  return (
    <div className="grid grid-cols-2 gap-4 h-screen">
      <div className="overflow-y-auto p-2">
        <ProblemStatement problem={problem} />
      </div>
      <div className="flex flex-col p-2">
        <CodeEditor
          problemSlug={slug}
          initialCode={problem.templates?.cpp || "// Write your code here"}
          templates={problem.templates}
          function={problem.function}
          examples={problem.examples}
        />
      </div>
    </div>
  );
}
