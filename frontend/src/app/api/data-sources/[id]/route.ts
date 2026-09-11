import { NextRequest, NextResponse } from "next/server";
import { db } from "@backend/db";
import { requireUser } from "@backend/auth";
import { handle } from "@backend/api";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    const sources = await db()`
      SELECT id, name, type, content, created_at
      FROM data_sources
      WHERE id = ${id} AND user_id = ${user.id}
    `;
    if (!sources.length) {
      return NextResponse.json({ error: "Data source not found" }, { status: 404 });
    }
    return NextResponse.json({ source: sources[0] });
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    const deleted = await db()`
      DELETE FROM data_sources
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING id
    `;
    if (!deleted.length) {
      return NextResponse.json({ error: "Data source not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, message: "Data source deleted successfully" });
  });
}
