import { NextRequest, NextResponse } from "next/server";
import { db } from "@backend/db";
import { requireUser } from "@backend/auth";
import { handle } from "@backend/api";
import { z } from "zod";

const createMissionSchema = z.object({
  objective: z.string().trim().min(10).max(4000),
  autonomyMode: z.enum(["observe", "assist", "controlled_autonomous"]).default("assist"),
});

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const [missions, counts, pendingApprovals, sources, artifacts] = await Promise.all([
      db()`SELECT id, title, objective, status, created_at, completed_at FROM missions WHERE user_id = ${user.id} ORDER BY created_at DESC LIMIT 50`,
      db()`SELECT status, count(*)::int AS count FROM missions WHERE user_id = ${user.id} GROUP BY status`,
      db()`SELECT count(*)::int AS count FROM approvals a JOIN missions m ON m.id = a.mission_id WHERE m.user_id = ${user.id} AND a.status = 'pending'`,
      db()`SELECT count(*)::int AS count FROM data_sources WHERE user_id = ${user.id}`,
      db()`SELECT count(*)::int AS count FROM artifacts a JOIN missions m ON m.id = a.mission_id WHERE m.user_id = ${user.id}`,
    ]);
    return NextResponse.json({
      missions,
      metrics: {
        total: counts.reduce((sum: number, row: any) => sum + Number(row.count), 0),
        running: Number(counts.find((row: any) => row.status === "running")?.count ?? 0),
        completed: Number(counts.find((row: any) => row.status === "completed")?.count ?? 0),
        approvals: Number(pendingApprovals[0]?.count ?? 0),
        sources: Number(sources[0]?.count ?? 0),
        artifacts: Number(artifacts[0]?.count ?? 0),
      },
    });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const parsed = createMissionSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Objective must be 10-4000 characters and autonomyMode must be valid" }, { status: 400 });
    const { objective: obj, autonomyMode } = parsed.data;
    const rows = await db()`INSERT INTO missions (user_id, title, objective, autonomy_mode) VALUES (${user.id}, ${obj.slice(0, 160)}, ${obj}, ${autonomyMode}) RETURNING id, title, objective, status`;
    return NextResponse.json({ mission: rows[0] });
  });
}
