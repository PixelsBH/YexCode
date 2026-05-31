import ProblemsTable from "@/app/components/ProblemsTable";

async function getProblems() {
  const base = process.env.NEXT_PUBLIC_BASE_URL;
  const res = await fetch(`${base}/api/problems`, { cache: "no-store" });

  if (!res.ok) throw new Error("Failed to fetch problems");
  return res.json();
}

export default async function ProblemsListPage() {
  const problems = await getProblems();

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-3xl font-semibold text-white mb-1">Problems</h1>
      <p className="text-white/50 mb-6">
        Practice problems to benchmark your skills
      </p>

      <ProblemsTable problems={problems} />
    </div>
  );
}
