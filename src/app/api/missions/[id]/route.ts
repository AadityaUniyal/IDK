import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/api";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    const missions = await db()`SELECT * FROM missions WHERE id = ${id} AND user_id = ${user.id}`;
    if (!missions.length) return NextResponse.json({ error: "Mission not found" }, { status: 404 });
    const mission = missions[0];
    const [tasks, events, evidence, artifacts, approvals] = await Promise.all([
      db()`SELECT * FROM mission_tasks WHERE mission_id = ${id} ORDER BY position`,
      db()`SELECT * FROM agent_events WHERE mission_id = ${id} ORDER BY sequence_number`,
      db()`SELECT e.*, d.name AS source_name FROM evidence e LEFT JOIN data_sources d ON d.id = e.source_id WHERE e.mission_id = ${id} ORDER BY e.created_at`,
      db()`SELECT id, type, title, content, created_at FROM artifacts WHERE mission_id = ${id} ORDER BY created_at`,
      db()`SELECT * FROM approvals WHERE mission_id = ${id} ORDER BY requested_at DESC`,
    ]);
    return NextResponse.json({ mission, tasks, events, evidence, artifacts, approvals });
  });
}
