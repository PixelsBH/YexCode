import { NextRequest, NextResponse } from "next/server";

const getJudgeBase = () => {
  return process.env.JUDGE_BASE_URL || process.env.NEXT_PUBLIC_JUDGE_BASE_URL || "";
};

const getJudgeSubmitUrl = () => {
  let judgeBase = getJudgeBase().trim();
  if (!judgeBase) return "";
  if (judgeBase.startsWith("//")) {
    judgeBase = `http:${judgeBase}`;
  }
  const normalized = judgeBase.replace(/\/$/, "");
  if (normalized.endsWith("/submissions")) {
    return normalized;
  }
  return `${normalized}/submissions`;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const judgeSubmitUrl = getJudgeSubmitUrl();
  if (!judgeSubmitUrl) {
    return NextResponse.json(
      { error: "JUDGE_BASE_URL is not configured on the server." },
      { status: 500 }
    );
  }

  const { id } = await params;
  const judgeUrl = `${judgeSubmitUrl.replace(/\/$/, "")}/${id}`;
  const response = await fetch(judgeUrl);
  const data = await response.text();
  return new NextResponse(data, {
    status: response.status,
    headers: { "Content-Type": response.headers.get("content-type") || "application/json" },
  });
}
