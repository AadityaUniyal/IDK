import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/api";

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const missions = await db()`SELECT id, title, objective, status, created_at, completed_at FROM missions WHERE user_id = ${user.id} ORDER BY created_at DESC LIMIT 50`;
    return NextResponse.json({ missions });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const { objective, autonomyMode } = await req.json();
    const obj = String(objective ?? "").trim();
    if (obj.length < 10) return NextResponse.json({ error: "Objective must be at least 10 characters" }, { status: 400 });
    const rows = await db()`INSERT INTO missions (user_id, title, objective, autonomy_mode) VALUES (${user.id}, ${obj.slice(0, 60)}, ${obj.slice(0, 4000)}, ${String(autonomyMode ?? "assist")}) RETURNING id, title, objective, status`;
    return NextResponse.json({ mission: rows[0] });
  });
}
