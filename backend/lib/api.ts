import { NextResponse } from "next/server";
import { AuthError } from "./auth";

export function apiError(err: unknown) {
  if (err instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const message = err instanceof Error ? err.message : "Internal error";
  console.error("API error:", message);
  const safeMessage = process.env.NODE_ENV === "production" ? "The request could not be completed." : message;
  return NextResponse.json({ error: safeMessage }, { status: 500 });
}

export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    return apiError(err);
  }
}
