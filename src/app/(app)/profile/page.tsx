import Link from "next/link";
import { redirect } from "next/navigation";
import { getOrSyncUser } from "@/lib/auth-user";
import Submission from "@/models/Submission";
import Problem from "@/models/Problem";

export default async function ProfilePage() {
  const user = await getOrSyncUser();
  if (!user) redirect("/sign-in");
  const progress = await Submission.aggregate([
    { $match: { userId: user._id } },
    { $group: { _id: "$problemSlug", solved: { $max: { $cond: [{ $eq: ["$verdict", "accepted"] }, 1, 0] } }, latest: { $max: "$createdAt" } } },
    { $sort: { latest: -1 } },
  ]);
  const problems = await Problem.find({ slug: { $in: progress.map((row) => row._id) } }).select("slug title difficulty").lean();
  const bySlug = new Map(problems.map((problem) => [problem.slug, problem]));
  const rows = progress.map((row) => ({ ...row, problem: bySlug.get(row._id) })).filter((row) => row.problem);
  const solvedCount = rows.filter((row) => row.solved === 1).length;

  return <div className="mx-auto max-w-5xl px-1 py-5 text-white sm:px-2 sm:py-8">
    <header className="mb-7">
      <p className="page-eyebrow mb-2">Your account</p>
      <h1 className="page-title">Profile & progress</h1>
      <p className="page-description mt-3">A snapshot of your practice activity and recent submissions.</p>
    </header>
    <section className="surface-panel overflow-hidden">
      <div className="flex flex-col gap-5 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-center gap-4">
          <div aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-300/10 text-lg font-semibold text-violet-100">{(user.name || user.email || "Y").slice(0, 1).toUpperCase()}</div>
          <div className="min-w-0"><h2 className="truncate text-lg font-semibold text-white">{user.name || "YexCode user"}</h2><p className="truncate text-sm text-white/50">{user.email}</p></div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:w-72">
          <div className="rounded-xl border border-emerald-300/10 bg-emerald-300/[0.04] px-4 py-3"><p className="text-2xl font-semibold tabular-nums text-emerald-200">{solvedCount}</p><p className="mt-1 text-[11px] uppercase tracking-wide text-white/45">Solved</p></div>
          <div className="rounded-xl border border-amber-200/10 bg-amber-200/[0.035] px-4 py-3"><p className="text-2xl font-semibold tabular-nums text-amber-100">{rows.length - solvedCount}</p><p className="mt-1 text-[11px] uppercase tracking-wide text-white/45">Attempted</p></div>
        </div>
      </div>
      <div className="flex items-end justify-between gap-4 px-5 pb-3 pt-5 sm:px-6"><div><h2 className="text-base font-semibold text-white">Recent question progress</h2><p className="mt-1 text-xs text-white/45">Your latest activity across submitted problems.</p></div><span className="text-xs tabular-nums text-white/40">{rows.length} total</span></div>
      {rows.length === 0 ? <div className="mx-5 mb-5 rounded-xl border border-dashed border-white/10 px-5 py-10 text-center sm:mx-6"><p className="text-sm font-medium text-white/75">Nothing here yet</p><p className="mt-1 text-xs text-white/45">Submit a solution to see your progress on this page.</p><Link href="/problems-list" className="mt-4 inline-flex rounded-lg border border-violet-300/20 bg-violet-300/[0.07] px-3 py-2 text-xs font-medium text-violet-100 hover:bg-violet-300/[0.12]">Browse problems</Link></div> : <ul className="surface-striped divide-y divide-white/[0.06] border-t border-white/[0.06]">
        {rows.map((row) => <li key={row._id} className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-white/[0.025] sm:px-6">
          <Link href={`/problems/${row._id}`} className="min-w-0 truncate text-sm font-medium text-white/85 transition-colors hover:text-violet-200">{row.problem.title}</Link>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${row.solved === 1 ? "bg-emerald-400/10 text-emerald-200" : "bg-amber-300/10 text-amber-100"}`}>{row.solved === 1 ? "Solved" : "Attempted"}</span>
        </li>)}
      </ul>}
    </section>
  </div>;
}
