import { NextResponse, NextRequest } from "next/server";
import dbConnect from "@/lib/mongodb";
import Problem from "@/models/Problem";

export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    const problems = await Problem.find({}); 

    return NextResponse.json(problems, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch problems" },
      { status: 500 }
    );
  }
}
