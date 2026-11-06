import { NextResponse } from "next/server";
import { getOrSyncUser } from "@/lib/auth-user";
import Submission from "@/models/Submission";

export async function GET() {
  try {
    const user = await getOrSyncUser();
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const progress = await Submission.aggregate([
      { $match: { userId: user._id } },
      { $group: {
        _id: "$problemSlug",
        solved: { $max: { $cond: [{ $eq: ["$verdict", "accepted"] }, 1, 0] } },
        latestCreatedAt: { $max: "$createdAt" },
        attempts: { $sum: 1 },
      } },
      { $project: { _id: 0, problemSlug: "$_id", status: { $cond: [{ $eq: ["$solved", 1] }, "solved", "attempted"] }, latestCreatedAt: 1, attempts: 1 } },
      { $sort: { latestCreatedAt: -1 } },
    ]);
    return NextResponse.json({
      user: { name: user.name, email: user.email, avatarUrl: user.avatarUrl },
      progress,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not load your account." }, { status: 500 });
  }
}
