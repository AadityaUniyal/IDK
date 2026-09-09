import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { queryMemories, saveMemory } from "@/lib/agent/memory";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const q = new URL(req.url).searchParams.get("q");

    if (q && q.trim()) {
      const memories = await queryMemories(user.id, q.trim(), 10);
      return NextResponse.json({ memories });
    }

    const rows = await db()`SELECT id, category, key, value, created_at FROM agent_memories WHERE user_id = ${user.id} ORDER BY created_at DESC LIMIT 50`;
    return NextResponse.json({ memories: rows });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const body = await req.json();
    const category = (body.category as any) || "semantic";
    const key = String(body.key ?? "").trim();
    const value = String(body.value ?? "").trim();

    if (!key || !value) {
      return NextResponse.json({ error: "key and value parameters are required" }, { status: 400 });
    }

    const id = await saveMemory(user.id, category, key, value);
    return NextResponse.json({ ok: true, id });
  });
}
