import { NextResponse, NextRequest } from "next/server";
import dbConnect from "@/lib/mongodb";
import Problem from "@/models/Problem";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;

    await dbConnect();
    
    const problem = await Problem.findOne({ slug });

    if (!problem) {
      return NextResponse.json({ error: "Problem not found" }, { status: 404 });
    }

    return NextResponse.json(problem, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch problem" },
      { status: 500 }
    );
  }
}
