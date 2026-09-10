import { NextResponse } from "next/server";
import { destroySession } from "@backend/auth";
import { handle } from "@backend/api";

export async function POST() {
  return handle(async () => {
    await destroySession();
    return NextResponse.json({ ok: true });
  });
}
