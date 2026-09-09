import { neon } from "@neondatabase/serverless";

export type SqlFn = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<any[]>;

let sql: SqlFn | null = null;

export function db(): SqlFn {
  if (!sql) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
    sql = neon(process.env.DATABASE_URL) as unknown as SqlFn;
  }
  return sql;
}
