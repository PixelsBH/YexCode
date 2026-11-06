import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { getOrSyncUser } from "@/lib/auth-user";
import Submission from "@/models/Submission";
import Problem from "@/models/Problem";
import { ownedSubmissionFilter } from "@/lib/submission-access.mjs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getOrSyncUser();
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    const submission = await Submission.findOne(ownedSubmissionFilter(user._id, { submissionId: id })).select("+sourceCode problemSlug language status verdict score passedTestCases totalTestCases runtimeMs memoryMb failedTestCase errorStage errorMessage createdAt").lean() as unknown as { problemSlug: string; sourceCode: string; [key: string]: unknown } | null;
    if (!submission) return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    const problem = await Problem.findOne({ slug: submission.problemSlug }).select("title").lean() as unknown as { title: string } | null;
    return NextResponse.json({ ...submission, title: problem?.title || submission.problemSlug }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not load submission." }, { status: 500 });
  }
}
