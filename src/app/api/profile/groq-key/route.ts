import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { encryptAiKey } from "@/lib/ai-key-encryption.mjs";
import { getOrSyncUser } from "@/lib/auth-user";
import { readBoundedBody } from "@/lib/request-limits.mjs";
import GroqCredential from "@/models/GroqCredential";

const RESPONSE_HEADERS = { "Cache-Control": "no-store" };
const MAX_KEY_BODY_BYTES = 2048;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function GET() {
  try {
    const user = await getOrSyncUser();
    if (!user) return NextResponse.json({ error: "Sign in to manage your Groq key." }, { status: 401, headers: RESPONSE_HEADERS });
    await dbConnect();
    const credential = await GroqCredential.findOne({ userId: user._id }).select("updatedAt").lean() as unknown as { updatedAt?: Date } | null;
    return NextResponse.json({ configured: Boolean(credential), updatedAt: credential?.updatedAt ?? null }, { headers: RESPONSE_HEADERS });
  } catch {
    return NextResponse.json({ error: "Could not load Groq key settings." }, { status: 500, headers: RESPONSE_HEADERS });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getOrSyncUser();
    if (!user) return NextResponse.json({ error: "Sign in to save your Groq key." }, { status: 401, headers: RESPONSE_HEADERS });

    const rawBody = await readBoundedBody(request.body, MAX_KEY_BODY_BYTES);
    if (rawBody === null) return NextResponse.json({ error: "Request body is too large." }, { status: 413, headers: RESPONSE_HEADERS });
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400, headers: RESPONSE_HEADERS });
    }
    if (!isRecord(body) || Object.keys(body).length !== 1 || typeof body.apiKey !== "string") {
      return NextResponse.json({ error: "Provide a Groq API key." }, { status: 400, headers: RESPONSE_HEADERS });
    }
    const apiKey = body.apiKey.trim();
    if (apiKey.length < 20 || apiKey.length > 512 || /\\s/.test(apiKey)) {
      return NextResponse.json({ error: "The Groq API key format looks invalid." }, { status: 400, headers: RESPONSE_HEADERS });
    }

    let encrypted: ReturnType<typeof encryptAiKey>;
    try {
      encrypted = encryptAiKey(apiKey);
    } catch (error) {
      if (error instanceof Error && error.message.includes("AI_KEY_ENCRYPTION_KEY")) {
        return NextResponse.json({ error: "Encrypted AI key storage is not configured on this server." }, { status: 503, headers: RESPONSE_HEADERS });
      }
      throw error;
    }

    await dbConnect();
    await GroqCredential.updateOne(
      { userId: user._id },
      { $set: { ...encrypted } },
      { upsert: true, setDefaultsOnInsert: true },
    );
    return NextResponse.json({ configured: true }, { headers: RESPONSE_HEADERS });
  } catch {
    return NextResponse.json({ error: "Could not save the Groq API key." }, { status: 500, headers: RESPONSE_HEADERS });
  }
}

export async function DELETE() {
  try {
    const user = await getOrSyncUser();
    if (!user) return NextResponse.json({ error: "Sign in to remove your Groq key." }, { status: 401, headers: RESPONSE_HEADERS });
    await dbConnect();
    await GroqCredential.deleteOne({ userId: user._id });
    return NextResponse.json({ configured: false }, { headers: RESPONSE_HEADERS });
  } catch {
    return NextResponse.json({ error: "Could not remove the Groq API key." }, { status: 500, headers: RESPONSE_HEADERS });
  }
}
