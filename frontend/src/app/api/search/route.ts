import { NextRequest, NextResponse } from "next/server";
import { db } from "@backend/db";
import { requireUser } from "@backend/auth";
import { handle } from "@backend/api";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";

    if (!q) {
      return NextResponse.json({ query: "", results: { missions: [], sources: [], artifacts: [] } });
    }

    const pattern = `%${q}%`;

    const [missions, sources, artifacts] = await Promise.all([
      db()`
        SELECT id, title, objective, status, created_at
        FROM missions
        WHERE user_id = ${user.id} AND (title ILIKE ${pattern} OR objective ILIKE ${pattern})
        ORDER BY created_at DESC LIMIT 10`,

      db()`
        SELECT id, name, type, length(content) AS size, created_at
        FROM data_sources
        WHERE user_id = ${user.id} AND (name ILIKE ${pattern} OR content ILIKE ${pattern})
        ORDER BY created_at DESC LIMIT 10`,

      db()`
        SELECT a.id, a.mission_id, a.type, a.title, a.created_at
        FROM artifacts a
        JOIN missions m ON m.id = a.mission_id
        WHERE m.user_id = ${user.id} AND (a.title ILIKE ${pattern} OR a.content ILIKE ${pattern})
        ORDER BY a.created_at DESC LIMIT 10`,
    ]);

    return NextResponse.json({
      query: q,
      results: {
        missions,
        sources,
        artifacts,
      },
    });
  });
}
