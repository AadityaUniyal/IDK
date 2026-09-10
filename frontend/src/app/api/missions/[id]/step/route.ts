import { NextRequest, NextResponse } from "next/server";
import { db } from "@backend/db";
import { requireUser } from "@backend/auth";
import { handle } from "@backend/api";
import { stepMission } from "@backend/agent/runtime";

// Executes at most one unit of agent work. The client polls this while the
// mission is active — durable and serverless-safe (no background worker).
export const maxDuration = 60;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    const missions = await db()`SELECT * FROM missions WHERE id = ${id} AND user_id = ${user.id}`;
    if (!missions.length) return NextResponse.json({ error: "Mission not found" }, { status: 404 });
    const mission = missions[0];
    if (["completed", "failed", "cancelled", "draft", "planning", "paused"].includes(mission.status)) {
      return NextResponse.json({ status: mission.status, advanced: false });
    }
    const leaseToken = crypto.randomUUID();
    const lease = await db()`UPDATE missions
      SET step_lease_token = ${leaseToken}, step_lease_until = now() + interval '90 seconds'
      WHERE id = ${id} AND (step_lease_until IS NULL OR step_lease_until < now())
      RETURNING id`;
    if (!lease.length) return NextResponse.json({ status: mission.status, advanced: false, reason: "Mission is already being advanced" }, { status: 409 });
    try {
      const result = await stepMission(db(), mission, user.id);
      return NextResponse.json(result);
    } finally {
      await db()`UPDATE missions SET step_lease_token = NULL, step_lease_until = NULL WHERE id = ${id} AND step_lease_token = ${leaseToken}`;
    }
  });
}
