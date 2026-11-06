import { NextRequest, NextResponse } from "next/server";
import { getOrSyncUser } from "@/lib/auth-user";
import Submission from "@/models/Submission";
import Problem from "@/models/Problem";
import { ownedSubmissionFilter } from "@/lib/submission-access.mjs";

function parsePositive(value: string | null, fallback: number, max: number) {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 && number <= max ? number : null;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getOrSyncUser();
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const page = parsePositive(request.nextUrl.searchParams.get("page"), 1, 1_000_000);
    const pageSize = parsePositive(request.nextUrl.searchParams.get("pageSize"), 20, 50);
    const problemSlug = request.nextUrl.searchParams.get("problemSlug");
    if (!page || !pageSize || (problemSlug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(problemSlug))) {
      return NextResponse.json({ error: "Invalid history query." }, { status: 400 });
    }
    const filter = ownedSubmissionFilter(user._id, problemSlug ? { problemSlug } : {});
    const [total, items] = await Promise.all([
      Submission.countDocuments(filter),
      Submission.find(filter).select("problemSlug language status verdict score passedTestCases totalTestCases runtimeMs memoryMb errorStage errorMessage createdAt")
        .sort({ createdAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    ]);
    const slugs = [...new Set(items.map((item) => item.problemSlug))];
    const problems = await Problem.find({ slug: { $in: slugs } }).select("slug title").lean();
    const titles = new Map(problems.map((problem) => [problem.slug, problem.title]));
    return NextResponse.json({ items: items.map((item) => ({ ...item, title: titles.get(item.problemSlug) || item.problemSlug })), page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not load submission history." }, { status: 500 });
  }
}
