import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { curatedPlaylists } from "@/lib/curated-playlists";
import { normalizePlaylistInput } from "@/lib/playlist-validation.mjs";
import Playlist from "@/models/Playlist";
import Problem from "@/models/Problem";
import PlaylistProgress from "@/models/PlaylistProgress";
import { getOrSyncUser } from "@/lib/auth-user";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Invalid playlist request.";
}

export async function GET() {
  try {
    await dbConnect();
    const user = await getOrSyncUser();
    const personal = user
      ? await Playlist.find({ userId: user._id }).sort({ createdAt: -1, _id: 1 }).lean()
      : [];
    const allEntries = [
      ...curatedPlaylists.flatMap((playlist) => playlist.problems),
      ...personal.flatMap((playlist) => playlist.problems),
    ];
    const slugs = [...new Set(allEntries.map((entry) => entry.slug))];
    const playlistIds = [...curatedPlaylists.map((playlist) => playlist.id), ...personal.map((playlist) => String(playlist._id))];
    const [problemRecords, completedRows] = await Promise.all([
      Problem.find({ slug: { $in: slugs } }).select("slug title difficulty").lean(),
      user
        ? PlaylistProgress.find({ userId: user._id, playlistId: { $in: playlistIds }, completed: true })
            .select("playlistId problemSlug")
            .lean()
        : Promise.resolve([] as Array<{ playlistId: string; problemSlug: string }>),
    ]);
    const problemsBySlug = new Map(problemRecords.map((problem) => [problem.slug, problem]));
    const completedKeys = new Set(completedRows.map((row) => `${row.playlistId}:${row.problemSlug}`));
    const withProgress = (playlistId: string, entries: Array<{ slug: string; title: string; topic: string }>) => entries.map((entry) => {
      const problem = problemsBySlug.get(entry.slug);
      return {
        ...entry,
        title: problem?.title ?? entry.title,
        difficulty: problem?.difficulty ?? null,
        available: Boolean(problem),
        completed: user ? completedKeys.has(`${playlistId}:${entry.slug}`) : null,
      };
    });
    return NextResponse.json({
      authenticated: Boolean(user),
      curated: curatedPlaylists.map((playlist) => ({ ...playlist, problems: withProgress(playlist.id, playlist.problems) })),
      personal: personal.map((playlist) => ({
        id: String(playlist._id),
        name: playlist.name,
        description: playlist.description,
        problems: withProgress(String(playlist._id), playlist.problems),
        updatedAt: playlist.updatedAt,
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Failed to load playlists." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getOrSyncUser();
    if (!user) return NextResponse.json({ error: "Sign in to create a playlist." }, { status: 401 });
    let input: ReturnType<typeof normalizePlaylistInput>;
    try {
      input = normalizePlaylistInput(await request.json());
    } catch (error) {
      return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
    }
    await dbConnect();
    const playlist = await Playlist.create({ userId: user._id, ...input });
    return NextResponse.json({ id: String(playlist._id), ...input }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Failed to create playlist." }, { status: 500 });
  }
}
