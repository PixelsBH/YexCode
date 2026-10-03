import Link from "next/link";
import dbConnect from "@/lib/mongodb";
import Problem from "@/models/Problem";

const curatedPaths = [
  {
    title: "Arrays & Hashing",
    description: "Build fluency with lookup tables and frequency counting.",
    problemSlugs: ["two-sum", "valid-anagram"],
  },
  {
    title: "Search & Dynamic Programming",
    description: "Practice sorted search and a foundational optimization pattern.",
    problemSlugs: ["binary-search", "maximum-subarray"],
  },
  {
    title: "Stacks & Backtracking",
    description: "Work through nested structure validation and recursive choices.",
    problemSlugs: ["valid-parentheses", "subsets"],
  },
];

type ProblemSummary = {
  slug: string;
  title: string;
  difficulty: string;
};

export default async function ForYouPage() {
  await dbConnect();
  const problems = await Problem.find({ slug: { $in: curatedPaths.flatMap((path) => path.problemSlugs) } })
    .select("slug title difficulty")
    .lean<ProblemSummary[]>();
  const problemBySlug = new Map(problems.map((problem) => [problem.slug, problem]));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-white">For You</h1>
        <p className="mt-2 text-white/60">
          Follow a curated path through the available practice problems. Personalized progress will be added with accounts and submissions.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {curatedPaths.map((path) => {
          const pathProblems = path.problemSlugs
            .map((slug) => problemBySlug.get(slug))
            .filter((problem): problem is ProblemSummary => problem !== undefined);

          return (
            <section key={path.title} className="rounded-xl border border-white/10 bg-black/35 p-5">
              <h2 className="text-xl font-semibold text-white">{path.title}</h2>
              <p className="mt-2 min-h-12 text-sm text-white/55">{path.description}</p>
              <ol className="mt-4 space-y-3">
                {pathProblems.map((problem, index) => (
                  <li key={problem.slug} className="flex items-center justify-between gap-3 border-t border-white/10 pt-3">
                    <Link href={`/problems/${problem.slug}`} className="text-sm text-blue-300 hover:underline">
                      <span className="mr-2 text-white/40">{index + 1}.</span>{problem.title}
                    </Link>
                    <span className="shrink-0 text-xs text-white/45">{problem.difficulty}</span>
                  </li>
                ))}
                {pathProblems.length === 0 && (
                  <li className="border-t border-white/10 pt-3 text-sm text-white/45">Problems in this path are not available yet.</li>
                )}
              </ol>
            </section>
          );
        })}
      </div>
    </div>
  );
}
