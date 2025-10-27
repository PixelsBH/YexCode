import ProblemStatement from "@/app/components/ProblemStatement";
import CodeEditor from "@/app/components/CodeEditor";

type Params = { slug: string };

export default async function ProblemPage({ params }: { params: Params }) {
  //const userCode = await getUserSubmission(params.slug, "user123");
  return (
    <div className="grid grid-cols-2 gap-4 h-screen">
      <div className="overflow-y-auto p-4">
        <ProblemStatement slug={params.slug} />
      </div>
      <div className="flex flex-col p-4">
        <CodeEditor initialCode={"// Write your code here"} />
      </div>
    </div>
  );
}
