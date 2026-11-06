import { NextRequest } from "next/server";
import { createBenchmarkSubmission } from "@/lib/judge-integration";

export async function POST(request: NextRequest) {
  return createBenchmarkSubmission(request);
}
