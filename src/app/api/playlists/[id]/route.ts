import { Types } from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { normalizePlaylistInput } from "@/lib/playlist-validation.mjs";
import Playlist from "@/models/Playlist";
import { getOrSyncUser } from "@/lib/auth-user";
import { readBoundedBody } from "@/lib/request-limits.mjs";

const MAX_PLAYLIST_BODY_BYTES = 64 * 1024;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Invalid playlist request.";
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getOrSyncUser();
    if (!user) return NextResponse.json({ error: "Sign in to edit playlists." }, { status: 401 });
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Playlist not found." }, { status: 404 });
    const rawBody = await readBoundedBody(request.body, MAX_PLAYLIST_BODY_BYTES);
    if (rawBody === null) return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
    let input: ReturnType<typeof normalizePlaylistInput>;
    try {
      input = normalizePlaylistInput(JSON.parse(rawBody));
    } catch (error) {
      return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
    }
    await dbConnect();
    const playlist = await Playlist.findOneAndUpdate(
      { _id: id, userId: user._id },
      { $set: input },
      { new: true, runValidators: true },
    ).lean() as unknown as { _id: unknown } | null;
    if (!playlist) return NextResponse.json({ error: "Playlist not found." }, { status: 404 });
    return NextResponse.json({ id: String(playlist._id), ...input }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Failed to update playlist." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getOrSyncUser();
    if (!user) return NextResponse.json({ error: "Sign in to delete playlists." }, { status: 401 });
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Playlist not found." }, { status: 404 });
    await dbConnect();
    const result = await Playlist.deleteOne({ _id: id, userId: user._id });
    if (result.deletedCount === 0) return NextResponse.json({ error: "Playlist not found." }, { status: 404 });
    return NextResponse.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Failed to delete playlist." }, { status: 500 });
  }
}
