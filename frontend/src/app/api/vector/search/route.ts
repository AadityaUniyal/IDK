import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@backend/auth";
import { handle } from "@backend/api";
import { hybridVectorSearch } from "@backend/vector";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const body = await req.json();
    const query = String(body.query ?? "").trim();
    const limit = Math.min(Number(body.limit) || 5, 20);

    if (!query) {
      return NextResponse.json({ error: "query parameter is required" }, { status: 400 });
    }

    const chunks = await hybridVectorSearch(query, limit, user.id);
    return NextResponse.json({ query, count: chunks.length, results: chunks });
  });
}
