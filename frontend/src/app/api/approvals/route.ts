import { NextResponse } from "next/server";
import { db } from "@backend/db";
import { requireUser } from "@backend/auth";
import { handle } from "@backend/api";

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
