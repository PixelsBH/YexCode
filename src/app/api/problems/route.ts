import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Problem from "@/models/Problem";

export async function GET() {
  try {
    await dbConnect();

    const problems = await Problem.find({})
      .select("slug title difficulty topics companies")
      .sort({ title: 1 })
      .lean();

    return NextResponse.json(problems, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch problems" },
      { status: 500 }
    );
  }
}
