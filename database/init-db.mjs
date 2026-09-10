// TRACE full database schema — idempotent: safe to run repeatedly.
// Creates all tables and adds any missing columns to existing ones.
// Usage: node scripts/init-db.mjs
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const sql = neon(process.env.DATABASE_URL);

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  // ── Identity & access ──────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    autonomy_mode TEXT NOT NULL DEFAULT 'assist',
    default_provider TEXT NOT NULL DEFAULT 'gemini',
    onboarded BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '30 days'
  )`,

  // ── Workspaces ─────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS workspace_members (
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'owner',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, user_id)
  )`,

  // ── Workspace policies (risk overrides per tool) ───────────────────
  `CREATE TABLE IF NOT EXISTS agent_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    action_pattern TEXT NOT NULL,
    risk_level TEXT,
    requires_approval BOOLEAN NOT NULL DEFAULT true,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  // ── Data & missions ────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS data_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS missions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    title TEXT NOT NULL DEFAULT 'Untitled mission',
    objective TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    autonomy_mode TEXT NOT NULL DEFAULT 'assist',
    normalized_goal TEXT,
    replan_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    step_lease_token TEXT,
    step_lease_until TIMESTAMPTZ
  )`,
  `ALTER TABLE missions ADD COLUMN IF NOT EXISTS step_lease_token TEXT`,
  `ALTER TABLE missions ADD COLUMN IF NOT EXISTS step_lease_until TIMESTAMPTZ`,
  `CREATE TABLE IF NOT EXISTS mission_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    tool TEXT NOT NULL,
    tool_input JSONB NOT NULL DEFAULT '{}',
    depends_on JSONB NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'pending',
    risk_level TEXT NOT NULL DEFAULT 'low',
    requires_approval BOOLEAN NOT NULL DEFAULT false,
    position INT NOT NULL DEFAULT 0,
    output TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
  )`,

  // ── Execution records ──────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS task_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES mission_tasks(id) ON DELETE CASCADE,
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    attempt_number INT NOT NULL DEFAULT 1,
    provider TEXT,
    model TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'running',
    error_message TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS tool_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    task_id UUID REFERENCES mission_tasks(id) ON DELETE CASCADE,
    tool_name TEXT NOT NULL,
    input_json JSONB NOT NULL DEFAULT '{}',
    output_text TEXT,
    status TEXT NOT NULL DEFAULT 'ok',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS model_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    latency_ms INT,
    prompt_chars INT,
    status TEXT NOT NULL DEFAULT 'ok',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  // ── Evidence & claims ──────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    task_id UUID,
    source_id UUID REFERENCES data_sources(id) ON DELETE SET NULL,
    source_type TEXT NOT NULL DEFAULT 'tool_result',
    location TEXT,
    excerpt TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    confidence DOUBLE PRECISION,
    status TEXT NOT NULL DEFAULT 'candidate',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS claim_evidence (
    claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    evidence_id UUID NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
    relationship TEXT NOT NULL,
    PRIMARY KEY (claim_id, evidence_id, relationship)
  )`,

  // ── Approvals & artifacts ──────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES mission_tasks(id) ON DELETE CASCADE,
    action_name TEXT NOT NULL,
    risk_level TEXT NOT NULL DEFAULT 'high',
    reason TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'report',
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  // ── Event log ──────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS agent_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    sequence_number INT NOT NULL,
    type TEXT NOT NULL,
    payload_json JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (mission_id, sequence_number)
  )`,

  // ── Backfill columns for databases created with schema v1 ─────────
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS default_provider TEXT NOT NULL DEFAULT 'gemini'`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE missions ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id)`,
  `ALTER TABLE missions ADD COLUMN IF NOT EXISTS replan_count INT NOT NULL DEFAULT 0`,
  `ALTER TABLE tool_calls ADD COLUMN IF NOT EXISTS duration_ms INT`,
  `ALTER TABLE mission_tasks ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0`,

  // ── Vector RAG store & agent memory (hash-embedding based) ─────────
  `CREATE TABLE IF NOT EXISTS vector_embeddings (
    id UUID PRIMARY KEY,
    source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL DEFAULT 0,
    content TEXT NOT NULL,
    embedding_json TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS agent_memories (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category TEXT NOT NULL DEFAULT 'episodic',
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    embedding_json TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  // ── Indexes ────────────────────────────────────────────────────────
  `CREATE INDEX IF NOT EXISTS idx_missions_user ON missions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_missions_workspace ON missions(workspace_id)`,
  `CREATE INDEX IF NOT EXISTS idx_missions_step_lease ON missions(step_lease_until)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_mission ON mission_tasks(mission_id)`,
  `CREATE INDEX IF NOT EXISTS idx_task_runs_task ON task_runs(task_id)`,
  `CREATE INDEX IF NOT EXISTS idx_events_mission ON agent_events(mission_id, sequence_number)`,
  `CREATE INDEX IF NOT EXISTS idx_evidence_mission ON evidence(mission_id)`,
  `CREATE INDEX IF NOT EXISTS idx_claims_mission ON claims(mission_id)`,
  `CREATE INDEX IF NOT EXISTS idx_model_runs_mission ON model_runs(mission_id)`,
  `CREATE INDEX IF NOT EXISTS idx_vector_embeddings_source ON vector_embeddings(source_id)`,
  `CREATE INDEX IF NOT EXISTS idx_agent_memories_user ON agent_memories(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_data_sources_user ON data_sources(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_status ON mission_tasks(status)`,
  `CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status)`,
  `CREATE INDEX IF NOT EXISTS idx_tool_calls_mission_task ON tool_calls(mission_id, task_id)`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'missions_autonomy_mode_check') THEN
      ALTER TABLE missions ADD CONSTRAINT missions_autonomy_mode_check CHECK (autonomy_mode IN ('observe', 'assist', 'controlled_autonomous'));
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'claims_confidence_check') THEN
      ALTER TABLE claims ADD CONSTRAINT claims_confidence_check CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1));
    END IF;
  END $$`,

];

for (const stmt of STATEMENTS) {
  await sql.query(stmt);
}
console.log(`Schema v2 ready — ${STATEMENTS.length} statements applied.`);
