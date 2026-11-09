import Link from "next/link";
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
    <div className="mx-auto max-w-7xl px-1 py-5 sm:px-2 sm:py-8">
        <header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="page-eyebrow mb-2">Practice library</p>
            <h1 className="page-title">Problems</h1>
            <p className="page-description mt-3">Build consistency with focused practice. Search the catalog and filter by your submission progress.</p>
          </div>
          <Link href="/workspace" className="inline-flex w-fit items-center gap-2 rounded-lg border border-violet-300/20 bg-violet-300/[0.07] px-4 py-2.5 text-sm font-medium text-violet-100 transition hover:border-violet-300/35 hover:bg-violet-300/[0.12]">Open workspace <span aria-hidden="true">↗</span></Link>
        </header>
        <ProblemsTable initialData={problems} />
      </div>
  );
}
