import { NextRequest, NextResponse } from "next/server";
import { db } from "@backend/db";
import { requireUser } from "@backend/auth";
import { handle } from "@backend/api";
import { planMission, appendEvent } from "@backend/agent/runtime";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    const missions = await db()`SELECT * FROM missions WHERE id = ${id} AND user_id = ${user.id}`;
    if (!missions.length) return NextResponse.json({ error: "Mission not found" }, { status: 404 });
    const mission = missions[0];

    // Plan when there is no plan yet (draft, or a previously failed planning attempt).
    const existingTasks = await db()`SELECT id FROM mission_tasks WHERE mission_id = ${id} LIMIT 1`;
    if (!existingTasks.length) {
      await db()`UPDATE missions SET status = ${"planning"} WHERE id = ${id}`;
      if (mission.status === "draft") await appendEvent(id, "GOAL_RECEIVED", { objective: mission.objective });
      try {
        await planMission(db(), mission, user.id);
      } catch (err) {
        // Leave the mission resumable: back to draft so Start can be retried.
        await db()`UPDATE missions SET status = ${"draft"} WHERE id = ${id}`;
        throw err;
      }
    }
    return NextResponse.json({ mission: { id, status: "running" } });
  });
}
