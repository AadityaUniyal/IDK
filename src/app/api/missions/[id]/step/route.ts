import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { stepMission } from "@/lib/agent/runtime";

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
    if (["completed", "failed", "cancelled", "draft", "planning"].includes(mission.status)) {
      return NextResponse.json({ status: mission.status, advanced: false });
    }
    const result = await stepMission(db(), mission, user.id);
    return NextResponse.json(result);
  });
}
