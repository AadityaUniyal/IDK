import { NextResponse } from "next/server";
import { db } from "@backend/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  let dbStatus = "ok";
  let dbLatencyMs = 0;

  try {
    const t0 = Date.now();
    await db()`SELECT 1`;
    dbLatencyMs = Date.now() - t0;
  } catch (err) {
    dbStatus = "error: " + (err instanceof Error ? err.message : String(err));
  }

  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);
  const groqConfigured = Boolean(process.env.GROQ_API_KEY);
  const healthy = dbStatus === "ok";

  return NextResponse.json(
    {
      status: healthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - started,
      services: {
        database: { status: dbStatus, latencyMs: dbLatencyMs },
        llmProviders: {
          gemini: geminiConfigured ? "configured" : "missing_key",
          groq: groqConfigured ? "configured" : "missing_key",
        },
      },
    },
    { status: healthy ? 200 : 503 }
  );
}
