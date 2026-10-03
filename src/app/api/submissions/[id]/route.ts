import { NextRequest } from "next/server";
import { getJudgeSubmission } from "@/lib/judge-integration";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return getJudgeSubmission(request, id);
}
