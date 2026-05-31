import CodeEditor from "@/app/components/CodeEditor";
import OutputPanel from "@/app/components/OutputPanel";

export default function BenchmarkPage() {
  const defaultCode = `// Write your code here`;
  const placeholderOutput = `Output will appear here`;

  // Placeholder metrics (wire later)
  const metrics = {
    status: "Idle",
    time: "-- ms",
    memory: "-- MB",
  };

  return (
    <div className="max-w-[95vw] mx-auto px-2 lg:px-4 py-6">
      <div className="mb-4">
        <h1 className="text-3xl font-semibold text-white">Benchmark</h1>
        <p className="text-white/50 mt-1">
          Write, run, and analyze your code performance
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <CodeEditor initialCode={defaultCode} />
        </div>

        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="flex-1 rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden">
            <div className="px-4 py-2 border-b border-white/10 text-sm text-white/60">
              Output
            </div>
            <OutputPanel output={placeholderOutput} />
          </div>

          <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-4">
            <h3 className="text-sm font-medium text-white/60 mb-3">
              Execution Metrics
            </h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <Metric label="Status" value={metrics.status} />
              <Metric label="Time" value={metrics.time} />
              <Metric label="Memory" value={metrics.memory} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/5 py-3">
      <div className="text-xs text-white/50">{label}</div>
      <div className="text-sm font-medium text-white mt-1">{value}</div>
    </div>
  );
}
