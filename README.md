# TRACE — Universal Agentic Investigation Platform

**Investigate. Understand. Act.**

TRACE is a full-stack web application that turns an arbitrary objective into a dynamic, tool-executing, evidence-backed AI investigation — streamed live to a mission canvas, gated by human approval for high-impact actions, and fully replayable.

Give the agent a goal. Watch it investigate. Stay in control.

---

## What it does

1. **Sign up / sign in** — server-side auth (scrypt-hashed passwords, HTTP-only session cookies) on Neon Postgres.
2. **Upload data sources** — `.txt`, `.md`, `.json`, `.csv`, `.log` files become searchable context.
3. **Describe any objective** — no templates, no hardcoded workflows. The agent plans at runtime.
4. **Watch the mission** — the LLM planner generates a task graph from the objective + available tools + your data. Tasks execute one by one, streaming events into the activity feed. Evidence is captured from every tool result.
5. **Approve high-impact actions** — tools classified `write` / `external` / `destructive` pause the mission at an approval gate. The UI uses a **hold-to-confirm** control (release early cancels; Escape works; keyboard accessible). The **server**, not the browser, finalizes the authorization.
6. **Get artifacts** — the mission ends with an evidence-cited markdown report, plus any documents the agent generated along the way.
7. **Replay** — every event is persisted with a sequence number and timestamp for a full audit trail.

## Architecture

```
Next.js (App Router, TS, Tailwind)
├── UI: landing, auth, mission center, mission canvas + inspector +
│   activity/evidence/replay/artifact tabs, approval center, tools registry
└── API routes (all server-side)
    ├── /api/auth/*            scrypt + session cookies
    ├── /api/missions[/*]      create / start / step / detail
    ├── /api/approvals[/*]     list / approve / reject (server-verified)
    ├── /api/data-sources      upload & manage context files
    └── /api/tools             live tool registry description

Agent runtime (src/lib/agent/runtime.ts) — step-driven state machine:
    planMission() → LLM planner → task graph rows
    stepMission() → scheduler → policy gate → tool executor → evidence
                 → synthesizer → artifact → MISSION_COMPLETED

LLM providers (src/lib/ai) — one interface, two adapters:
    Gemini (gemini-2.5-flash) primary, Groq (openai/gpt-oss-120b) fallback.

Tool registry (src/lib/tools/registry.ts) — capability discovery:
    search_files · read_file · query_table · calculate ·
    summarize_source (LLM) · generate_document (approval-gated)

Neon Postgres — users, sessions, data_sources, missions, mission_tasks,
    tool_calls, evidence, approvals, artifacts, agent_events
```

### Why step-driven?

Vercel serverless functions can't run background workers. The runtime advances **one unit of work per `POST /api/missions/:id/step`** call; the client drives stepping while the mission is active. All state lives in Postgres, so a refresh, reconnect, or different device resumes exactly where the mission left off — and every event is durable.

### No hardcoded workflows

The planner prompt receives the objective, your actual data-source inventory, and the tool registry — then emits the graph. Nothing in the codebase maps objectives to fixed task sequences. Tools are validated, risk-classified, and executed server-side only.

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in your own keys
node scripts/init-db.mjs     # creates the schema on your Neon database
npm run dev
```

Environment variables (all server-only, never shipped to the browser):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string |
| `GEMINI_API_KEY` | Google AI Studio key (primary provider) |
| `GROQ_API_KEY` | Groq key (fallback provider) |
| `DEFAULT_LLM_PROVIDER` | `gemini` (default) or `groq` |
| `FALLBACK_LLM_PROVIDER` | the other one |
| `AUTH_SECRET` | reserved for future token signing |

## Deploy to Vercel

1. Push this folder to a GitHub repository (`.env.local` is git-ignored — secrets never leave your machine).
2. On [vercel.com](https://vercel.com): **Add New → Project** → import the repo. Next.js is auto-detected.
3. Add environment variables in **Project → Settings → Environment Variables** (all environments):
   `DATABASE_URL`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `DEFAULT_LLM_PROVIDER`, `FALLBACK_LLM_PROVIDER`, `AUTH_SECRET`.
4. Deploy. Then run the schema init once against production (locally with the same env vars, or via the Vercel CLI):
   ```bash
   node scripts/init-db.mjs
   ```
5. Open the deployment URL, sign up, upload a CSV, start a mission.

Notes:
- `/step` sets `maxDuration = 60`; Hobby-plan functions allow this.
- Neon's HTTP driver (`@neondatabase/serverless`) works over serverless fetch — no connection pooling issues.

## Security model

- API keys and the database URL live only in server-side env vars; API routes are the only code that touches them.
- The LLM proposes; the server disposes. Tool calls are schema-checked, risk-classified, and gated by the policy engine **before** execution. Approval decisions are stored server-side and verified there.
- The approval control is deliberately slow (press-and-hold) because the actions behind it are consequential.

## Disclaimer

TRACE is a portfolio/research project. Tools operate only on data you upload to your own workspace; there are no external side-effecting integrations configured.

## Known limitations / future work

- PDF ingestion (extract to text before upload for now)
- Streaming responses (SSE) instead of step-polling
- Evidence graph visualization, claim support/contradiction linking
- Team workspaces and per-workspace policy editing
