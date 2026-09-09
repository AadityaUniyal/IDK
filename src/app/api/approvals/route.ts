import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/api";

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const approvals = await db()`
      SELECT a.*, m.title AS mission_title, m.objective AS mission_objective
      FROM approvals a JOIN missions m ON m.id = a.mission_id
      WHERE m.user_id = ${user.id} ORDER BY a.requested_at DESC`;
    return NextResponse.json({ approvals });
  });
}
