import { NextRequest, NextResponse } from "next/server";
import { db } from "@backend/db";
import { requireUser } from "@backend/auth";
import { handle } from "@backend/api";

const AUTONOMY_MODES = ["observe", "assist", "controlled_autonomous"];
const PROVIDERS = ["gemini", "groq"];

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    return NextResponse.json({
      settings: {
        email: user.email,
        displayName: user.display_name,
        autonomyMode: user.autonomy_mode,
        defaultProvider: user.default_provider,
        onboarded: user.onboarded,
      },
    });
  });
}

export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (body.displayName !== undefined) {
      const name = String(body.displayName).slice(0, 80).trim();
      if (!name) return NextResponse.json({ error: "Display name cannot be empty" }, { status: 400 });
      updates.display_name = name;
    }
    if (body.autonomyMode !== undefined) {
      if (!AUTONOMY_MODES.includes(body.autonomyMode)) {
        return NextResponse.json({ error: `autonomyMode must be one of ${AUTONOMY_MODES.join(", ")}` }, { status: 400 });
      }
      updates.autonomy_mode = body.autonomyMode;
    }
    if (body.defaultProvider !== undefined) {
      if (!PROVIDERS.includes(body.defaultProvider)) {
        return NextResponse.json({ error: `defaultProvider must be one of ${PROVIDERS.join(", ")}` }, { status: 400 });
      }
      updates.default_provider = body.defaultProvider;
    }
    if (body.onboarded !== undefined) {
      updates.onboarded = Boolean(body.onboarded);
    }
    if (!Object.keys(updates).length) return NextResponse.json({ error: "No recognized fields to update" }, { status: 400 });

    await db()`
      UPDATE users SET
        display_name = COALESCE(${updates.display_name ?? null}, display_name),
        autonomy_mode = COALESCE(${updates.autonomy_mode ?? null}, autonomy_mode),
        default_provider = COALESCE(${updates.default_provider ?? null}, default_provider),
        onboarded = COALESCE(${updates.onboarded ?? null}, onboarded)
      WHERE id = ${user.id}`;
    return NextResponse.json({ ok: true });
  });
}
