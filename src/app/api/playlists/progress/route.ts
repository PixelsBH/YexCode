import { Types } from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { curatedPlaylists } from "@/lib/curated-playlists";
import Playlist from "@/models/Playlist";
import PlaylistProgress from "@/models/PlaylistProgress";
import { getOrSyncUser } from "@/lib/auth-user";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function POST(request: NextRequest) {
  try {
    const user = await getOrSyncUser();
    if (!user) return NextResponse.json({ error: "Sign in to save playlist progress." }, { status: 401 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }
    if (!isRecord(body) || Object.keys(body).some((key) => !["playlistId", "problemSlug", "completed"].includes(key))) {
      return NextResponse.json({ error: "Playlist progress body is invalid." }, { status: 400 });
    }
    const { playlistId, problemSlug, completed } = body;
    if (typeof playlistId !== "string" || playlistId.length < 1 || playlistId.length > 100 ||
      typeof problemSlug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(problemSlug) ||
      typeof completed !== "boolean") {
      return NextResponse.json({ error: "Playlist progress fields are invalid." }, { status: 400 });
    }

    await dbConnect();
    const curated = curatedPlaylists.find((playlist) => playlist.id === playlistId);
    let containsProblem = curated?.problems.some((problem) => problem.slug === problemSlug) ?? false;
    if (!curated && Types.ObjectId.isValid(playlistId)) {
      const playlist = await Playlist.findOne({ _id: playlistId, userId: user._id }).select("problems.slug").lean() as unknown as { problems: Array<{ slug: string }> } | null;
      containsProblem = playlist?.problems.some((problem) => problem.slug === problemSlug) ?? false;
    }
    if (!containsProblem) return NextResponse.json({ error: "Playlist problem not found." }, { status: 404 });

    await PlaylistProgress.updateOne(
      { userId: user._id, playlistId, problemSlug },
      { $set: { completed } },
      { upsert: true, setDefaultsOnInsert: true },
    );
    return NextResponse.json({ playlistId, problemSlug, completed }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not save playlist progress." }, { status: 500 });
  }
}
