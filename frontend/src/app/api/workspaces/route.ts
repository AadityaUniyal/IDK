import { NextResponse } from "next/server";
import { db } from "@backend/db";
import { requireUser } from "@backend/auth";
import { handle } from "@backend/api";

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const workspaces = await db()`
      SELECT w.id, w.name, w.created_at, wm.role
      FROM workspace_members wm
      JOIN workspaces w ON w.id = wm.workspace_id
      WHERE wm.user_id = ${user.id}
      ORDER BY w.created_at DESC`;

    if (!workspaces.length) {
      return NextResponse.json({ workspaces: [] });
    }

    const members = await db()`
      SELECT wm.workspace_id, u.id as user_id, u.email, u.display_name, wm.role, wm.created_at
      FROM workspace_members wm
      JOIN users u ON u.id = wm.user_id
      WHERE wm.workspace_id = ${workspaces[0].id}
      ORDER BY wm.created_at ASC`;

    return NextResponse.json({
      workspaces,
      activeWorkspace: workspaces[0],
      members,
    });
  });
}
