import { NextRequest, NextResponse } from "next/server";
import { db } from "@backend/db";
import { requireUser } from "@backend/auth";
import { handle } from "@backend/api";
import { appendEvent } from "@backend/agent/runtime";

const transitions: Record<string, string[]> = {
  pause: ["running", "planning", "waiting_for_approval"],
  resume: ["paused"],
  cancel: ["draft", "planning", "running", "waiting_for_approval", "paused"],
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    const { action } = await req.json();
    if (!["pause", "resume", "cancel"].includes(action)) {
      return NextResponse.json({ error: "action must be pause, resume, or cancel" }, { status: 400 });
    }
    const rows = await db()`SELECT id, status FROM missions WHERE id = ${id} AND user_id = ${user.id}`;
    const mission = rows[0];
    if (!mission) return NextResponse.json({ error: "Mission not found" }, { status: 404 });
    if (!transitions[action].includes(mission.status)) {
      return NextResponse.json({ error: `Cannot ${action} a ${mission.status} mission` }, { status: 409 });
    }
    const nextStatus = action === "pause" ? "paused" : action === "resume" ? "running" : "cancelled";
    await db()`UPDATE missions SET status = ${nextStatus}, completed_at = ${action === "cancel" ? new Date().toISOString() : null}, step_lease_token = NULL, step_lease_until = NULL WHERE id = ${id}`;
    if (action === "cancel") {
      await db()`UPDATE mission_tasks SET status = 'skipped', completed_at = now() WHERE mission_id = ${id} AND status IN ('pending', 'running', 'waiting_approval')`;
      await db()`UPDATE approvals SET status = 'rejected', resolved_at = now(), resolved_by = ${user.id} WHERE mission_id = ${id} AND status = 'pending'`;
    }
    await appendEvent(id, action === "pause" ? "MISSION_PAUSED" : action === "resume" ? "MISSION_RESUMED" : "MISSION_CANCELLED", { by: user.id });
    return NextResponse.json({ ok: true, status: nextStatus });
  });
}
