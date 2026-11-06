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

  return <div className="mx-auto max-w-5xl px-4 py-8 text-white">
    <h1 className="text-3xl font-semibold">Your profile</h1>
    <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-5">
      <p className="text-lg">{user.name || "YexCode user"}</p><p className="text-sm text-white/50">{user.email}</p>
      <p className="mt-4 text-sm text-white/70">{solvedCount} solved · {rows.length - solvedCount} attempted</p>
    </div>
    <h2 className="mt-8 mb-3 text-xl font-medium">Question progress</h2>
    {rows.length === 0 ? <p className="text-white/50">Your submitted questions will appear here.</p> : <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
      {rows.map((row) => <li key={row._id} className="flex items-center justify-between p-4">
        <Link href={`/problems/${row._id}`} className="text-blue-300 hover:underline">{row.problem.title}</Link>
        <span className={row.solved === 1 ? "text-green-400" : "text-yellow-300"}>{row.solved === 1 ? "Solved" : "Attempted"}</span>
      </li>)}
    </ul>}
  </div>;
}
