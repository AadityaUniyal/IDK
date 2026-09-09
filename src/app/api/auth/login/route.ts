import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";
import { handle } from "@/lib/api";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const { email, password } = await req.json();
    const rows = await db()`SELECT id, email, display_name, password_hash FROM users WHERE email = ${String(email ?? "").toLowerCase()}`;
    const user = rows[0];
    if (!user || !verifyPassword(String(password ?? ""), user.password_hash)) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    await createSession(user.id);
    return NextResponse.json({ user: { id: user.id, email: user.email, display_name: user.display_name } });
  });
}
