import { NextResponse } from "next/server";
import { createSessionCookie, createUser, findUserByEmail } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const fullName = String(body?.fullName || "").trim();
    const email = String(body?.email || "").trim();
    const password = String(body?.password || "");
    const confirmPassword = String(body?.confirmPassword || "");

    if (!fullName || !email || !password || !confirmPassword) {
      return NextResponse.json({ error: "All sign up fields are required" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters long" }, { status: 400 });
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    const user = await createUser(fullName, email, password);
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
    const message = error instanceof Error ? error.message : "Failed to sign up";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
