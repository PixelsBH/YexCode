import { NextRequest, NextResponse } from "next/server";

const getJudgeBase = () => {
  return process.env.JUDGE_BASE_URL || process.env.NEXT_PUBLIC_JUDGE_BASE_URL || "";
};

const getJudgeSubmissionsUrl = () => {
  const judgeBase = getJudgeBase().trim().replace(/\/$/, "");
  if (!judgeBase) return "";
  return judgeBase.endsWith("/submissions")
    ? judgeBase
    : `${judgeBase}/submissions`;
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const submissionsUrl = getJudgeSubmissionsUrl();
  if (!submissionsUrl) {
    return NextResponse.json(
      { error: "JUDGE_BASE_URL is not configured on the server." },
      { status: 500 }
    );
  }

  const { id } = await params;
  if (!id || id.includes("/")) {
    return NextResponse.json({ error: "Invalid submission ID." }, { status: 400 });
  }

  try {
    const response = await fetch(`${submissionsUrl}/${encodeURIComponent(id)}`, {
      cache: "no-store",
      headers: req.headers.get("x-request-id")
        ? { "X-Request-ID": req.headers.get("x-request-id") as string }
        : undefined,
    });
    const body = await response.text();
    const headers = new Headers({
      "Content-Type": response.headers.get("content-type") || "application/json",
    });
    const requestId = response.headers.get("x-request-id");
    if (requestId) headers.set("X-Request-ID", requestId);
    return new NextResponse(body, { status: response.status, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reach YexJudge.";
    return NextResponse.json(
      { error: `YexJudge is unavailable: ${message}` },
      { status: 502 }
    );
  }
}
