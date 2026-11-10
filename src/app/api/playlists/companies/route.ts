import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { companyPlaylists } from "@/lib/company-playlists";
import PlaylistProgress from "@/models/PlaylistProgress";
import Problem from "@/models/Problem";
import { getOrSyncUser } from "@/lib/auth-user";

const CACHE_HEADERS = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  try {
    const companyId = request.nextUrl.searchParams.get("companyId");
    const user = await getOrSyncUser();

    if (!companyId) {
      const completionCounts = new Map<string, number>();
      if (user) {
        const rows = await PlaylistProgress.aggregate([
          { $match: { userId: user._id, playlistId: { $in: companyPlaylists.map((company) => `company:${company.id}`) }, completed: true } },
          { $group: { _id: "$playlistId", count: { $sum: 1 } } },
        ]) as Array<{ _id: string; count: number }>;
        for (const row of rows) completionCounts.set(row._id, row.count);
      }

      return NextResponse.json({
        authenticated: Boolean(user),
        source: { snapshot: "2026-07-12", url: "https://github.com/snehasishroy/leetcode-companywise-interview-questions" },
        companies: companyPlaylists.map((company) => ({
          id: company.id,
          name: company.name,
          description: company.description,
          problemCount: company.problems.length,
          completedCount: completionCounts.get(`company:${company.id}`) ?? 0,
        })),
      }, { headers: CACHE_HEADERS });
    }

    if (companyId.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(companyId)) {
      return NextResponse.json({ error: "Invalid company playlist." }, { status: 400 });
    }
    const company = companyPlaylists.find((entry) => entry.id === companyId);
    if (!company) return NextResponse.json({ error: "Company playlist not found." }, { status: 404 });

    await dbConnect();
    const slugs = company.problems.map((problem) => problem.slug);
    const [problemRows, completedRows] = await Promise.all([
      Problem.find({ slug: { $in: slugs } }).select("slug title difficulty").lean(),
      user
        ? PlaylistProgress.find({ userId: user._id, playlistId: `company:${company.id}`, problemSlug: { $in: slugs }, completed: true }).select("problemSlug").lean()
        : Promise.resolve([] as Array<{ problemSlug: string }>),
    ]);
    const problemsBySlug = new Map(problemRows.map((problem) => [problem.slug, problem]));
    const completedSlugs = new Set(completedRows.map((row) => row.problemSlug));

    return NextResponse.json({
      authenticated: Boolean(user),
      playlist: {
        id: `company:${company.id}`,
        name: company.name,
        description: company.description,
        problems: company.problems.map((entry) => {
          const problem = problemsBySlug.get(entry.slug);
          return {
            ...entry,
            title: problem?.title ?? entry.title,
            difficulty: problem?.difficulty ?? entry.difficulty,
            available: Boolean(problem),
            completed: user ? completedSlugs.has(entry.slug) : null,
          };
        }),
      },
    }, { headers: CACHE_HEADERS });
  } catch {
    return NextResponse.json({ error: "Failed to load company playlists." }, { status: 500 });
  }
}
