import { NextResponse } from "next/server";

// User persistence is intentionally deferred until the account/submission model is defined.
export function GET() {
  return NextResponse.json(
    { error: "User API is not implemented yet." },
    { status: 501 }
  );
}
