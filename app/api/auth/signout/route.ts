import { NextResponse } from "next/server";
import { clearSession, getSession } from "@/lib/auth";

export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ ok: true, message: "Already signed out" });
    }

    await clearSession();
    return NextResponse.json({ ok: true, message: "Signed out successfully" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to sign out";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
