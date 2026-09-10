# TRACE

**Investigate. Understand. Act.**

TRACE is a visual operating system for agentic investigation. A user provides an objective and their own context; TRACE discovers available tools, creates a dynamic task graph, executes safe work, collects evidence, adapts after failures, and pauses before consequential actions.

## Product capabilities

- Branded landing, signup, login, onboarding, mission control, settings, data inventory, tool registry, approvals, artifacts, replay, and mission canvas.
- Dynamic AI planning through Gemini or Groq behind one server-side provider interface.
- Durable Neon Postgres persistence for users, sessions, workspaces, policies, missions, tasks, runs, tool calls, model calls, evidence, claims, approvals, artifacts, events, vector chunks, and memory.
- Deterministic policy enforcement: the model proposes actions, but the server decides whether they may execute.
- Human approval gates for writes, external requests, and destructive actions.
- Step-driven, serverless-safe execution with mission leases, bounded retries, self-healing, replanning, SSE refresh, and replayable events.
- Hashed local embeddings with hybrid retrieval and long-term mission memory.

## Repository layout

```text
trace/
├── frontend/                 # Next.js App Router, UI, route handlers
│   ├── src/app/              # Public pages, authenticated product, API endpoints
│   ├── src/components/       # TRACE visual and interaction components
│   ├── package.json
│   └── tsconfig.json
├── backend/                  # Server-only runtime and integrations
│   └── lib/
│       ├── agent/            # Planning, execution, policy, memory, events
│       ├── ai/               # Gemini/Groq provider adapters and failover
│       └── tools/            # Runtime capability registry
├── database/                 # Neon schema initializer and indexes
│   └── init-db.mjs
└── SECURITY.md               # Secret handling and deployment checklist
```

Frontend route handlers import server-only modules through `@backend/*`. Client components never receive provider keys, database credentials, raw session tokens, or privileged database access.

## Local setup

Requirements:

- Node.js 20+
- A Neon Postgres database
- Rotated Gemini and/or Groq API keys

PowerShell:

```powershell
cd frontend
Copy-Item .env.example .env.local
# Edit frontend/.env.local with your own local values.
npm install
npm run db:init
npm run dev
```

Open `http://localhost:3000`, create an account, complete onboarding, upload a CSV/JSON/Markdown/text source, and launch a mission.

## Environment variables

All variables below are server-side except `NEXT_PUBLIC_APP_URL`, which is only a public origin and must never contain credentials.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string |
| `GEMINI_API_KEY` | Primary model provider key |
| `GROQ_API_KEY` | Fallback model provider key |
| `DEFAULT_LLM_PROVIDER` | `gemini` or `groq` |
| `FALLBACK_LLM_PROVIDER` | Secondary provider |
| `AUTH_SECRET` | Reserved for future signed-token features |
| `NEXT_PUBLIC_APP_URL` | Public application origin |

Never commit `.env.local`, provider keys, database URLs, session cookies, logs, screenshots containing secrets, or copied API responses. If a secret has appeared in chat, terminal output, or a public repository, revoke and rotate it.

## Runtime flow

```text
objective
  -> context and tool discovery
  -> AI architect creates a cycle-checked DAG
  -> Neon lease prevents duplicate step execution
  -> runnable tasks execute in parallel
  -> deterministic policy evaluates risk
  -> tool output, evidence, runs, and events persist
  -> bounded self-healing and replanning recover failures
  -> synthesis creates a report and evidence-linked claims
  -> mission insights enter long-term memory
```

The browser advances active work through `POST /api/missions/:id/step`. This keeps the runtime compatible with serverless deployment and lets missions survive refreshes, reconnects, and device changes.

## Production build

```powershell
cd frontend
npm run build
```

Initialize the Neon schema once per environment:

```powershell
cd frontend
npm run db:init
```

## Git workflow

Do not commit generated directories or local state. Before pushing:

```powershell
git status --short
git diff --check
cd frontend
npm run build
```

Review the staged diff manually and confirm that no `.env*`, key, database URL, cookie, log, or local data file is present.
