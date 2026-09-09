import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { appendEvent } from "@/lib/agent/runtime";

// POST { decision: "approved" | "rejected" }
// The server — not the browser — finalizes the authorization.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    const { decision } = await req.json();
    if (decision !== "approved" && decision !== "rejected") {
      return NextResponse.json({ error: "decision must be approved or rejected" }, { status: 400 });
    }
    const rows = await db()`
      SELECT a.*, m.user_id AS owner FROM approvals a JOIN missions m ON m.id = a.mission_id WHERE a.id = ${id}`;
    const approval = rows[0];
    if (!approval || approval.owner !== user.id) return NextResponse.json({ error: "Approval not found" }, { status: 404 });
    if (approval.status !== "pending") return NextResponse.json({ error: "Approval already resolved" }, { status: 409 });

    await db()`UPDATE approvals SET status = ${decision}, resolved_at = now(), resolved_by = ${user.id} WHERE id = ${id}`;
    if (decision === "approved") {
      await db()`UPDATE mission_tasks SET status = ${"pending"} WHERE id = ${approval.task_id}`;
      await db()`UPDATE missions SET status = ${"running"} WHERE id = ${approval.mission_id} AND status = ${"waiting_for_approval"}`;
      await appendEvent(approval.mission_id, "APPROVAL_GRANTED", { approvalId: id, action: approval.action_name });
    } else {
      await db()`UPDATE mission_tasks SET status = ${"skipped"}, completed_at = now() WHERE id = ${approval.task_id}`;
      await db()`UPDATE missions SET status = ${"running"} WHERE id = ${approval.mission_id} AND status = ${"waiting_for_approval"}`;
      await appendEvent(approval.mission_id, "APPROVAL_REJECTED", { approvalId: id, action: approval.action_name });
    }
    return NextResponse.json({ ok: true, decision });
  });
}
