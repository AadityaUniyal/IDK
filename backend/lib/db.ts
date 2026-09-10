import { neon } from "@neondatabase/serverless";

export type SqlFn = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<any[]>;

let sqlClient: SqlFn | null = null;

/**
 * TRACE intentionally uses Neon as its only persistence layer. Keeping the
 * adapter server-only prevents credentials and database state from reaching
 * the browser and keeps local development aligned with production.
 */
export function db(): SqlFn {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured. Run database initialization with a Neon connection.");
  }

  if (!sqlClient) {
    sqlClient = neon(databaseUrl) as unknown as SqlFn;
  }

  return sqlClient;
}
