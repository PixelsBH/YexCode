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

async function forwardResponse(response: Response) {
  const body = await response.text();
  const headers = new Headers();
  headers.set("Content-Type", response.headers.get("content-type") || "application/json");
  const requestId = response.headers.get("x-request-id");
  if (requestId) headers.set("X-Request-ID", requestId);
  const location = response.headers.get("location");
  if (location) headers.set("Location", location);
  return new NextResponse(body, { status: response.status, headers });
}

export async function POST(req: NextRequest) {
  const judgeUrl = getJudgeSubmissionsUrl();
  if (!judgeUrl) {
    return NextResponse.json(
      { error: "JUDGE_BASE_URL is not configured on the server." },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    const response = await fetch(judgeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(req.headers.get("x-request-id")
          ? { "X-Request-ID": req.headers.get("x-request-id") as string }
          : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    return forwardResponse(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reach YexJudge.";
    return NextResponse.json(
      { error: `YexJudge is unavailable: ${message}` },
      { status: 502 }
    );
  }
}
