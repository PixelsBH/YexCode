import ProblemsTable from "@/app/components/ProblemsTable";

async function getProblems() {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const response = await fetch(`${base}/api/problems?page=1&pageSize=8`, { cache: "no-store" });

  if (!response.ok) throw new Error("Failed to fetch problems");
  return response.json();
}

export default async function ProblemsListPage() {
  const problems = await getProblems();

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-3xl font-semibold text-white mb-1">Problems</h1>
      <p className="text-white/50 mb-6">
        Practice problems to benchmark your skills
      </p>

      <ProblemsTable initialData={problems} />
    </div>
  );
}
