import { NextRequest, NextResponse } from "next/server";
import { db } from "@backend/db";
import { requireUser, verifyPassword, hashPassword, validatePassword } from "@backend/auth";
import { handle } from "@backend/api";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Current password and new password are required" }, { status: 400 });
    }

    const check = validatePassword(newPassword);
    if (!check.valid) {
      return NextResponse.json({ error: check.reason }, { status: 400 });
    }

    const rows = await db()`SELECT password_hash FROM users WHERE id = ${user.id}`;
    const storedHash = rows[0]?.password_hash;

    if (!storedHash || !verifyPassword(String(currentPassword), storedHash)) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }

    const newHash = hashPassword(newPassword);
    await db()`UPDATE users SET password_hash = ${newHash} WHERE id = ${user.id}`;

    return NextResponse.json({ ok: true, message: "Password updated successfully" });
  });
}
