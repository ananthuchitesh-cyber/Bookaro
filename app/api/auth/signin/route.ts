import { NextResponse } from "next/server";
import { createSessionCookie, findUserByEmail, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body?.email || "").trim();
    const password = String(body?.password || "");

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: "No account found for this email" }, { status: 401 });
    }

    const validPassword = await verifyPassword(password, user.password_hash);
    if (!validPassword) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }

    await createSessionCookie(user);

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
      },
      redirectTo: "/",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to sign in";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
