  import ProblemStatement from "@/app/components/ProblemStatement";
  import CodeEditor from "@/app/components/CodeEditor";
import OutputPanel from "@/app/components/OutputPanel";

  type Params = { slug: string };

  export default async function ProblemPage({ params }: { params: Params }) {
    const { slug } = await params;
    console.log("Rendering ProblemPage for slug:", slug);
    //const userCode = await getUserSubmission(params.slug, "user123");
    return (
      <div className="grid grid-cols-2 gap-4 h-screen">
        <div className="overflow-y-auto p-2">
          <ProblemStatement slug={slug} />
        </div>
        <div className="flex flex-col p-2">
          <CodeEditor initialCode={"// Write your code here"} />
          <OutputPanel output={"Output"} />
        </div>
      </div>
    );
  }
