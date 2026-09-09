import { neon } from "@neondatabase/serverless";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

export type SqlFn = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<any[]>;

let cloudSql: any = null;
let sqliteDb: Database.Database | null = null;

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch {}
}
const SQLITE_PATH = path.join(DATA_DIR, "trace.db");

function getSqliteInstance(): Database.Database {
  if (!sqliteDb) {
    sqliteDb = new Database(SQLITE_PATH);
    sqliteDb.pragma("journal_mode = WAL");
    sqliteDb.pragma("foreign_keys = ON");
    initSqliteTables(sqliteDb);
  }
  return sqliteDb;
}

function initSqliteTables(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL DEFAULT '',
      autonomy_mode TEXT NOT NULL DEFAULT 'assist',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL DEFAULT (datetime('now', '+30 days'))
    );

    CREATE TABLE IF NOT EXISTS data_sources (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS vector_embeddings (
      id TEXT PRIMARY KEY,
      source_id TEXT REFERENCES data_sources(id) ON DELETE CASCADE,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      embedding_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS missions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT 'Untitled mission',
      objective TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      autonomy_mode TEXT NOT NULL DEFAULT 'assist',
      normalized_goal TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      started_at TEXT,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS mission_tasks (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      tool TEXT NOT NULL,
      tool_input TEXT NOT NULL DEFAULT '{}',
      depends_on TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'pending',
      risk_level TEXT NOT NULL DEFAULT 'low',
      requires_approval INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      output TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      started_at TEXT,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS tool_calls (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      task_id TEXT REFERENCES mission_tasks(id) ON DELETE CASCADE,
      tool_name TEXT NOT NULL,
      input_json TEXT NOT NULL DEFAULT '{}',
      output_text TEXT,
      status TEXT NOT NULL DEFAULT 'ok',
      duration_ms INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS evidence (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      task_id TEXT,
      source_id TEXT REFERENCES data_sources(id) ON DELETE SET NULL,
      source_type TEXT NOT NULL DEFAULT 'tool_result',
      location TEXT,
      excerpt TEXT NOT NULL,
      confidence_score REAL NOT NULL DEFAULT 1.0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      task_id TEXT NOT NULL REFERENCES mission_tasks(id) ON DELETE CASCADE,
      action_name TEXT NOT NULL,
      risk_level TEXT NOT NULL DEFAULT 'high',
      reason TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      requested_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT,
      resolved_by TEXT REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'report',
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS agent_events (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      sequence_number INTEGER NOT NULL,
      type TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (mission_id, sequence_number)
    );

    CREATE TABLE IF NOT EXISTS agent_memories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category TEXT NOT NULL DEFAULT 'episodic',
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      embedding_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS system_metrics (
      id TEXT PRIMARY KEY,
      metric_name TEXT NOT NULL,
      metric_value REAL NOT NULL,
      meta_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function runSqliteQuery(sqlite: Database.Database, queryStr: string, values: any[]): any[] {
  let query = queryStr;

  query = query.replace(/\$(\d+)/g, "?");
  query = query.replace(/gen_random_uuid\(\)/gi, "lower(hex(randomblob(16)))");
  query = query.replace(/now\(\)/gi, "datetime('now')");

  const returningMatch = query.match(/RETURNING\s+([a-z0-9_,\s]+)$/i);
  if (returningMatch) {
    query = query.replace(/RETURNING\s+[a-z0-9_,\s]+$/i, "");
  }

  if (query.includes("ON CONFLICT (mission_id, sequence_number) DO UPDATE")) {
    query = query.replace(
      "ON CONFLICT (mission_id, sequence_number) DO UPDATE SET sequence_number = agent_events.sequence_number + 1, type = EXCLUDED.type, payload_json = EXCLUDED.payload_json",
      "ON CONFLICT (mission_id, sequence_number) DO UPDATE SET type = excluded.type, payload_json = excluded.payload_json"
    );
  }

  const isSelect = /^\s*(SELECT|PRAGMA|EXPLAIN)/i.test(query);

  if (isSelect) {
    const stmt = sqlite.prepare(query);
    return stmt.all(...values);
  } else {
    const stmt = sqlite.prepare(query);
    const info = stmt.run(...values);

    if (returningMatch) {
      if (values[0] && typeof values[0] === "string" && values[0].length > 10) {
        return [{ id: values[0] }];
      }
      return [{ id: info.lastInsertRowid.toString() }];
    }
    return [{ changes: info.changes, lastInsertRowid: info.lastInsertRowid }];
  }
}

export function db(): SqlFn {
  const dbUrl = process.env.DATABASE_URL;

  if (dbUrl && (dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://"))) {
    if (!cloudSql) {
      try {
        cloudSql = neon(dbUrl);
      } catch {
        console.warn("[TRACE DB] Connecting to cloud Postgres failed, falling back to embedded SQLite.");
        cloudSql = null;
      }
    }
    if (cloudSql) {
      return (async (strings: TemplateStringsArray, ...values: unknown[]) => {
        try {
          return await cloudSql(strings, ...values);
        } catch (err) {
          console.warn("[TRACE DB Cloud Error] Falling back to local SQLite execution:", err);
          const sqlite = getSqliteInstance();
          const rawQuery = strings.reduce((acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ""), "");
          return runSqliteQuery(sqlite, rawQuery, values);
        }
      }) as unknown as SqlFn;
    }
  }

  const sqlite = getSqliteInstance();
  return (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const rawQuery = strings.reduce((acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ""), "");
    return runSqliteQuery(sqlite, rawQuery, values);
  }) as unknown as SqlFn;
}

