import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { indexDataSource } from "@/lib/vector";

const MAX_CONTENT = 200_000;

function detectType(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["csv", "tsv"].includes(ext)) return "csv";
  if (ext === "json") return "json";
  if (["md", "markdown"].includes(ext)) return "markdown";
  if (ext === "txt" || ext === "log") return "text";
  return "text";
}

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const sources = await db()`SELECT id, name, type, length(content) AS size, created_at FROM data_sources WHERE user_id = ${user.id} ORDER BY created_at DESC`;
    return NextResponse.json({ sources });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const body = await req.json();
    let name = String(body.name ?? "").trim();
    let content = String(body.content ?? "");
    if (body.base64) {
      content = Buffer.from(body.base64, "base64").toString("utf8");
    }
    if (!name || !content.trim()) return NextResponse.json({ error: "name and content are required" }, { status: 400 });
    if (content.length > MAX_CONTENT) content = content.slice(0, MAX_CONTENT);
    const type = detectType(name);
    const rows = await db()`INSERT INTO data_sources (user_id, name, type, content) VALUES (${user.id}, ${name.slice(0, 120)}, ${type}, ${content}) RETURNING id, name, type, length(content) AS size`;
    
    // Auto-index into RAG Vector Store asynchronously
    try {
      if (rows[0]?.id) {
        await indexDataSource(rows[0].id, name, content);
      }
    } catch (e) {
      console.warn("Async vector indexing skipped:", e);
    }

    return NextResponse.json({ source: rows[0] });
  });
}

export async function DELETE(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    await db()`DELETE FROM data_sources WHERE id = ${id} AND user_id = ${user.id}`;
    return NextResponse.json({ ok: true });
  });
}
