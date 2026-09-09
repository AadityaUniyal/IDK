import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { hybridVectorSearch } from "@/lib/vector";

export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireUser();
    const body = await req.json();
    const query = String(body.query ?? "").trim();
    const limit = Math.min(Number(body.limit) || 5, 20);

    if (!query) {
      return NextResponse.json({ error: "query parameter is required" }, { status: 400 });
    }

    const chunks = await hybridVectorSearch(query, limit);
    return NextResponse.json({ query, count: chunks.length, results: chunks });
  });
}
