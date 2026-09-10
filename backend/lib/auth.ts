import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { db } from "./db";

const SESSION_COOKIE = "trace_session";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function validatePassword(password: string): { valid: boolean; reason?: string } {
  if (password.length < 8) {
    return { valid: false, reason: "Password must be at least 8 characters long" };
  }
  return { valid: true };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export async function createSession(userId: string) {
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);

  await db()`INSERT INTO sessions (token, user_id) VALUES (${tokenHash}, ${userId})`;
  const jar = await cookies();
  jar.set(SESSION_COOKIE, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

export async function destroySession() {
  const jar = await cookies();
  const rawToken = jar.get(SESSION_COOKIE)?.value;
  if (rawToken) {
    const tokenHash = hashToken(rawToken);
    await db()`DELETE FROM sessions WHERE token = ${tokenHash}`;
  }
  jar.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const jar = await cookies();
  const rawToken = jar.get(SESSION_COOKIE)?.value;
  if (!rawToken) return null;
  const tokenHash = hashToken(rawToken);
  const rows = await db()`
    SELECT u.id, u.email, u.display_name, u.autonomy_mode, u.default_provider, u.onboarded
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ${tokenHash} AND s.expires_at > now()
  `.catch(() => []);
  return rows[0] ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new AuthError();
  return user as {
    id: string; email: string; display_name: string; autonomy_mode: string;
    default_provider: string; onboarded: boolean;
  };
}

export class AuthError extends Error {
  constructor() {
    super("Unauthorized");
  }
}
