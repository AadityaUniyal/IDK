import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";
import { handle } from "@/lib/api";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const { email, password, displayName } = await req.json();
    if (!email || !password || password.length < 6) {
      return NextResponse.json({ error: "Email and a password of at least 6 characters are required" }, { status: 400 });
    }
    const existing = await db()`SELECT id FROM users WHERE email = ${String(email).toLowerCase()}`;
    if (existing.length) return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    const rows = await db()`INSERT INTO users (email, password_hash, display_name) VALUES (${String(email).toLowerCase()}, ${hashPassword(password)}, ${String(displayName ?? email).slice(0, 80)}) RETURNING id, email, display_name`;
    await createSession(rows[0].id);
    return NextResponse.json({ user: rows[0] });
  });
}
