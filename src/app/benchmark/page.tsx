import CodeEditor from "../components/CodeEditor";

export default function BenchmarkPage() {
  const defaultCode = `// Write your code here`;

  return (
    <div className="min-h-screen bg-gray-800 p-8 text-white space-y-4">
      <h1 className="text-3xl font-bold">Benchmark</h1>
      <CodeEditor initialCode={defaultCode} />
    </div>
  );
}