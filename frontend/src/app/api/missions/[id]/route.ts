import { NextRequest, NextResponse } from "next/server";
import { db } from "@backend/db";
import { requireUser } from "@backend/auth";
import { handle } from "@backend/api";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    const missions = await db()`SELECT * FROM missions WHERE id = ${id} AND user_id = ${user.id}`;
    if (!missions.length) return NextResponse.json({ error: "Mission not found" }, { status: 404 });
    const mission = missions[0];
    const [tasks, events, evidence, artifacts, approvals, claims, runs] = await Promise.all([
      db()`SELECT * FROM mission_tasks WHERE mission_id = ${id} ORDER BY position`,
      db()`SELECT * FROM agent_events WHERE mission_id = ${id} ORDER BY sequence_number`,
      db()`SELECT e.*, d.name AS source_name FROM evidence e LEFT JOIN data_sources d ON d.id = e.source_id WHERE e.mission_id = ${id} ORDER BY e.created_at`,
      db()`SELECT id, type, title, content, created_at FROM artifacts WHERE mission_id = ${id} ORDER BY created_at`,
      db()`SELECT * FROM approvals WHERE mission_id = ${id} ORDER BY requested_at DESC`,
      db()`SELECT * FROM claims WHERE mission_id = ${id} ORDER BY created_at`,
      db()`SELECT task_id, attempt_number, status, error_message, started_at, completed_at FROM task_runs WHERE mission_id = ${id} ORDER BY started_at`,
    ]);
    // Evidence relationships for the claims inspector.
    let claimEvidence: any[] = [];
    if (claims.length) {
      const claimIds = claims.map((c: any) => c.id);
      claimEvidence = await db()`
          SELECT ce.claim_id, ce.relationship, e.id AS evidence_id, e.excerpt, e.location, d.name AS source_name
          FROM claim_evidence ce
          JOIN evidence e ON e.id = ce.evidence_id
          LEFT JOIN data_sources d ON d.id = e.source_id
          WHERE ce.claim_id = ANY(${claimIds})`;
    }
    return NextResponse.json({ mission, tasks, events, evidence, artifacts, approvals, claims, claimEvidence, runs });
  });
}
