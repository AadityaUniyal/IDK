import { NextResponse } from "next/server";
import { AuthError } from "./auth";

export function apiError(err: unknown) {
  if (err instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const message = err instanceof Error ? err.message : "Internal error";
  console.error("API error:", message);
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    return apiError(err);
  }
}
