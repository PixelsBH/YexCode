  import ProblemStatement from "@/app/components/ProblemStatement";
import CodeEditor from "@/app/components/CodeEditor";

type Params = { slug: string };

export default async function ProblemPage({ params }: { params: Params }) {
  const { slug } = await params;
  console.log("Rendering ProblemPage for slug:", slug);

  // Fetch problem data server-side
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/problems/${slug}`,
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
          initialCode={"// Write your code here"} 
          testCases={problem.testCases}
          limits={problem.limits}
        />
      </div>
    </div>
  );
}
