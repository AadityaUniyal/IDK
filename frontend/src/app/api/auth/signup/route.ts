import { NextRequest, NextResponse } from "next/server";
import { db } from "@backend/db";
import { hashPassword, createSession, validatePassword, normalizeEmail } from "@backend/auth";
import { checkRateLimit } from "@backend/rate-limit";
import { handle } from "@backend/api";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const rate = checkRateLimit(`signup:${ip}`, 5, 60000);
    if (!rate.allowed) {
      return NextResponse.json({ error: "Too many registration attempts. Please wait 1 minute before trying again." }, { status: 429 });
    }
    const { email, password, displayName, workspaceName } = await req.json();
    const normalizedEmail = normalizeEmail(String(email ?? ""));
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }
    const check = validatePassword(password);
    if (!check.valid) {
      return NextResponse.json({ error: check.reason }, { status: 400 });
    }
    const existing = await db()`SELECT id FROM users WHERE email = ${normalizedEmail}`;
    if (existing.length) return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    const rows = await db()`INSERT INTO users (email, password_hash, display_name) VALUES (${normalizedEmail}, ${hashPassword(password)}, ${String(displayName ?? normalizedEmail).slice(0, 80)}) RETURNING id, email, display_name`;
    const userId = rows[0].id;

    // Every user gets a default workspace for policies and mission scoping.
    const ws = await db()`INSERT INTO workspaces (owner_id, name) VALUES (${userId}, ${String(workspaceName ?? "My Workspace").slice(0, 80)}) RETURNING id, name`;
    await db()`INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (${ws[0].id}, ${userId}, ${"owner"})`;

    await createSession(userId);
    return NextResponse.json({ user: rows[0], workspace: ws[0] });
  });
}
