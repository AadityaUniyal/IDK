# TRACE — Universal Agentic AI & Autonomous Investigation OS

> **Investigate. Reason. Execute. Verify.**

TRACE is a state-of-the-art, production-grade visual operating system for autonomous AI agents. Given an investigation objective and unstructured ground-truth data, TRACE normalizes goals, discovers runtime tools, formulates cycle-free Directed Acyclic Graphs (DAGs), executes parallel tasks, enforces deterministic security guardrails, self-heals after failures, and synthesizes evidence-linked executive reports.

---

## 🌟 Key Platform Capabilities

### 🧠 1. Dynamic DAG Mission Planning & Multi-Agent Swarm
- **Autonomous DAG Generation**: Transforms arbitrary user objectives into optimal, cycle-free task execution graphs.
- **Multi-Agent Swarm Collaboration**: Engages specialized AI roles (Architect Agent, Safety & Audit Agent, Research Agent, Code Execution Agent, Synthesis Agent).
- **Self-Healing & Replanning**: Automatically diagnoses tool execution errors, corrects parameters via LLM self-healing, and dynamically replans failing task subgraphs (bounded up to 2 replan cycles).

### 🛡️ 2. Deterministic Security & AI Guard Engine
- **AI Prompt Injection Defense**: `backend/lib/ai/guard.ts` neutralizes adversarial prompt injection attempts (`ignore instructions`, `system prompt:`, `DAN mode`, `override policy`).
- **Deterministic Policy Engine**: Models propose actions, but a server-side rule engine evaluates risk (`read`, `analyze`, `write`, `external`, `destructive`). High-risk actions strictly pause for human authorization.
- **Node `node:vm` Sandboxed Code Execution**: The `execute_code` tool runs inside an isolated Node.js VM context with a strict **1,000ms CPU execution timeout**, preventing infinite loop freezes (`while (true) {}`).
- **User Data Isolation**: Vector RAG searches (`hybridVectorSearch`) strictly filter vector embeddings by `user_id`, preventing cross-user data leakage.
- **Rate-Limited Authentication**: Sliding-window rate limiting on `/api/auth/login` (10 req/min) and `/api/auth/signup` (5 req/min) prevents brute-force attacks.
- **Response Security Headers**: Next.js middleware enforces `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `X-XSS-Protection`.

### 🔄 3. Multi-Provider Failover Architecture
- **Primary & Fallback Providers**: Seamless failover between Google Gemini (`gemini-3.6-flash`) and Groq (`llama-3.3-70b-versatile`).
- **Unified Provider Interface**: Standardized `LLMProvider` abstraction with character/token metric logging.

### 🔍 4. Hybrid Vector RAG & Episodic Agent Memory
- **64-Dimension Hash Vectors**: Fast, lightweight term-vector embeddings combined with BM25-style keyword matching for precise document chunk retrieval.
- **Long-Term Episodic Memory**: Persists past investigation insights and entity relationships across user missions.

### ⏱️ 5. Time-Travel Trajectory Replay Center (`/app/replay`)
- Interactive playback controls (1X, 2X, 4X speed, step scrub slider) allowing users to inspect exact timeline state changes for any mission.

### 🛠️ 6. Universal Tool Registry (14 Tools)
| Tool Name | Risk Level | Description |
| --- | --- | --- |
| `search_files` | `read` | Search user data sources using BM25 scoring |
| `read_file` | `read` | Inspect content of a specific uploaded file |
| `query_table` | `read` | Filter and aggregate tabular CSV/JSON datasets |
| `calculate` | `analyze` | Evaluate numeric mathematical expressions |
| `web_search` | `external` | Perform external web searches |
| `fetch_web_page` | `external` | Fetch and extract text content from public URLs |
| `execute_code` | `analyze` | Execute JS snippets in a 1s-timed Node `vm` sandbox |
| `generate_chart` | `analyze` | Render interactive bar, line, or pie SVG charts |
| `summarize_source` | `read` | Extract key facts and citations from long text |
| `generate_document` | `write` | Create executive report artifacts |
| `semantic_rag_search` | `read` | Perform vector RAG search across uploaded data |
| `query_agent_memory` | `read` | Query long-term episodic memory for past insights |
| `run_sql` | `analyze` | Execute read-only SELECT SQL queries |
| `inspect_code_diff` | `read` | Analyze additions and deletions between text diffs |

---

## 🏗️ Architecture & Data Flow

```text
User Objective
      │
      ▼
┌─────────────────────────────────────────────────────────┐
│ AI Architect & Swarm Collaboration                      │
│ Formulates cycle-free Task DAG (4-8 tasks)              │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│ Step Lease Locking (Neon Postgres)                      │
│ Prevents duplicate execution across serverless instances│
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│ SafetyAudit & Deterministic Policy Gate                 │
│ Evaluates tool risk level against user autonomy mode    │
└──────────────┬──────────────────────────┬───────────────┘
               │                          │
      Requires Approval           Approved / Read
               │                          │
               ▼                          ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│ Hold-to-Confirm Gate     │  │ Parallel Tool Execution  │
│ Pauses for user action   │  │ Sandboxed VM / Vector RAG│
└──────────────────────────┘  └───────────┬──────────────┘
                                          │
                                          ▼
                              ┌──────────────────────────┐
                              │ Failure & Replanner Loop │
                              │ Self-heals parameters    │
                              └───────────┬──────────────┘
                                          │
                                          ▼
                              ┌──────────────────────────┐
                              │ Executive Synthesis      │
                              │ Evidence-Linked Claims   │
                              └──────────────────────────┘
```

For an in-depth breakdown of the codebase architecture, file responsibilities, and database ERD, see [ARCHITECTURE.md](file:///c:/Users/HP/OneDrive/Desktop/NEW/trace/ARCHITECTURE.md).

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js 20+**
- **Neon Serverless PostgreSQL Database**
- **Gemini API Key** and/or **Groq API Key**

### 1. Environment Setup

Create `frontend/.env.local`:

```env
DATABASE_URL=postgresql://user:password@ep-cool-dbname.us-east-2.aws.neon.tech/neondb?sslmode=require
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here
DEFAULT_LLM_PROVIDER=gemini
FALLBACK_LLM_PROVIDER=groq
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 2. Database Initialization

Initialize the 15-table idempotent schema and performance indexes:

```bash
cd frontend
npm run db:init
```

### 3. Launch Development Server

```bash
cd frontend
npm run dev
```

Navigate to `http://localhost:3000` to create an account, configure settings, upload data sources, and launch agent missions.

---

## 📡 API Reference Overview

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/auth/signup` | `POST` | User registration with rate limiting & email validation |
| `/api/auth/login` | `POST` | Password authentication & session cookie creation |
| `/api/auth/logout` | `POST` | Session termination and cookie invalidation |
| `/api/auth/me` | `GET` | Retrieve current authenticated user profile |
| `/api/auth/change-password` | `POST` | Update account password |
| `/api/health` | `GET` | System health check (DB latency & provider status) |
| `/api/search` | `GET` | Unified global search across missions, sources, artifacts |
| `/api/workspaces` | `GET` | List user workspaces and active member roster |
| `/api/data-sources` | `GET`, `POST` | Data inventory management and vector indexing |
| `/api/data-sources/[id]` | `GET`, `DELETE` | Retrieve or delete specific data source |
| `/api/missions` | `GET`, `POST` | Mission list and mission creation |
| `/api/missions/[id]` | `GET`, `PATCH`, `DELETE` | Mission details, title editing, and deletion |
| `/api/missions/[id]/start` | `POST` | Trigger AI DAG planning & mission launch |
| `/api/missions/[id]/step` | `POST` | Execute next runnable task batch |
| `/api/missions/[id]/stream` | `GET` | Real-time Server-Sent Events (SSE) stream |
| `/api/missions/[id]/control` | `POST` | Cancel or pause mission execution |
| `/api/approvals` | `GET` | List pending authorization requests |
| `/api/approvals/[id]` | `POST` | Approve or reject a pending tool action |
| `/api/tools` | `GET` | List registered tool capabilities |
| `/api/memories` | `GET`, `POST` | Access long-term agent memory insights |

---

## 🔒 Security Practices

- **Zero Client-Exposed Secrets**: Provider API keys, DB connection strings, and session secret hashes remain strictly server-side.
- **Input Sanitization**: File uploads strip null bytes (`\0`) to prevent PostgreSQL UTF-8 encoding rejection.
- **CSRF & Security Headers**: SameSite session cookies paired with X-Frame-Options and Content-Type security headers.

---

## 📄 License

Built for advanced agentic AI research and enterprise autonomous decision support systems.
