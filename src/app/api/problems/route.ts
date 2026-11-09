import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Problem from "@/models/Problem";
import Submission from "@/models/Submission";
import { getOrSyncUser } from "@/lib/auth-user";

const DEFAULT_PAGE_SIZE = 8;
const MAX_PAGE_SIZE = 50;
const MAX_QUERY_LENGTH = 100;

function positiveInteger(value: string | null, fallback: number): number | null {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const requestedPage = positiveInteger(searchParams.get("page"), 1);
  const pageSize = positiveInteger(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE);
  const query = searchParams.get("q")?.trim() || "";
  const progress = searchParams.get("progress") || "all";
  if (progress !== "all" && progress !== "solved" && progress !== "attempted" && progress !== "unattempted") {
    return NextResponse.json({ error: "Invalid progress filter." }, { status: 400 });
  }

  if (!requestedPage || !pageSize || pageSize > MAX_PAGE_SIZE) {
    return NextResponse.json({ error: "Invalid pagination parameters." }, { status: 400 });
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ error: "Problem search is too long." }, { status: 400 });
  }

  const filter: Record<string, unknown> = {};
  if (query) filter.title = { $regex: escapeRegex(query), $options: "i" };

  try {
    await dbConnect();
    const user = await getOrSyncUser();
    if (progress !== "all" && !user) {
      return NextResponse.json({ error: "Sign in to filter by your progress." }, { status: 401 });
    }

    let statusBySlug = new Map<string, "solved" | "attempted">();
    if (user) {
      const progressRows = await Submission.aggregate([
        { $match: { userId: user._id } },
        { $group: {
          _id: "$problemSlug",
          solved: { $max: { $cond: [{ $eq: ["$verdict", "accepted"] }, 1, 0] } },
        } },
      ]);
      statusBySlug = new Map(progressRows.map((row: { _id: string; solved: number }) => [row._id, row.solved === 1 ? "solved" : "attempted"]));
      if (progress === "solved") {
        const solvedSlugs = [...statusBySlug].filter(([, status]) => status === "solved").map(([slug]) => slug);
        filter.slug = { $in: solvedSlugs };
      } else if (progress === "attempted") {
        const attemptedSlugs = [...statusBySlug].filter(([, status]) => status === "attempted").map(([slug]) => slug);
        filter.slug = { $in: attemptedSlugs };
      } else if (progress === "unattempted") {
        filter.slug = { $nin: [...statusBySlug.keys()] };
      }
    }

    const total = await Problem.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, totalPages);
    const items = await Problem.find(filter)
      .select("slug title difficulty topics")
      .sort({ title: 1, slug: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean();

    return NextResponse.json({
      items: items.map((item) => ({ ...item, topics: item.topics ?? [], progress: statusBySlug.get(item.slug) ?? (user ? "unattempted" : null) })),
      authenticated: Boolean(user),
      page,
      pageSize,
      total,
      totalPages,
    }, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch problems." }, { status: 500 });
  }
}
