import { NextRequest, NextResponse } from "next/server";
import { db } from "@backend/db";
import { verifyPassword, createSession, normalizeEmail } from "@backend/auth";
import { handle } from "@backend/api";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const { email, password } = await req.json();
    const normalizedEmail = normalizeEmail(String(email ?? ""));
    if (!normalizedEmail || !String(password ?? "")) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }
    const rows = await db()`SELECT id, email, display_name, password_hash FROM users WHERE email = ${normalizedEmail}`;
    const user = rows[0];
    if (!user || !verifyPassword(String(password ?? ""), user.password_hash)) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    await createSession(user.id);
    return NextResponse.json({ user: { id: user.id, email: user.email, display_name: user.display_name } });
  });
}
