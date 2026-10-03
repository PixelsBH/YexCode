import { NextRequest } from "next/server";
import { createJudgeSubmission } from "@/lib/judge-integration";

export async function POST(request: NextRequest) {
  return createJudgeSubmission(request, "submit");
}
