import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Problem from "@/models/Problem";

const DEFAULT_PAGE_SIZE = 8;
const MAX_PAGE_SIZE = 50;
const MAX_QUERY_LENGTH = 100;
const MAX_TOPIC_LENGTH = 80;

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
  const topic = searchParams.get("topic")?.trim() || "";
  const query = searchParams.get("q")?.trim() || "";

  if (!requestedPage || !pageSize || pageSize > MAX_PAGE_SIZE) {
    return NextResponse.json({ error: "Invalid pagination parameters." }, { status: 400 });
  }
  if (topic.length > MAX_TOPIC_LENGTH || query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ error: "Problem filters are too long." }, { status: 400 });
  }

  const filter: Record<string, unknown> = {};
  if (topic) filter.topics = topic;
  if (query) filter.title = { $regex: escapeRegex(query), $options: "i" };

  try {
    await dbConnect();
    const total = await Problem.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, totalPages);
    const [items, topicValues] = await Promise.all([
      Problem.find(filter)
        .select("slug title difficulty topics")
        .sort({ title: 1, slug: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      Problem.distinct("topics"),
    ]);
    const topics = topicValues
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .sort((left, right) => left.localeCompare(right));

    return NextResponse.json({ items, topics, page, pageSize, total, totalPages }, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch problems." }, { status: 500 });
  }
}
