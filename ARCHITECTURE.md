# TRACE — High-Level System Architecture

High-level architectural overview of TRACE platform organization and runtime data flow.

---

## 🏗️ Core Modules

```text
trace/
├── backend/            # Server-side agent runtime, LLM providers, and tool engine
│   └── lib/
│       ├── agent/      # Execution planning, event logging, memory, policy
│       ├── ai/         # Model provider adapters & input validation
│       └── tools/      # Universal capability registry
├── database/           # Schema initializers & migrations
└── frontend/           # Next.js App Router UI & API endpoint handlers
```

---

## ⚡ Execution Pipeline

1. **Objective Ingestion**: User submits investigation objective and context files.
2. **Task Graph Formulation**: Agent generates a Directed Acyclic Graph (DAG) of execution tasks.
3. **Policy Gate Check**: Server-side engine evaluates task risk level against active autonomy settings.
4. **Execution & Evidence Collection**: Runs safe tasks in parallel, collects observations, and indexes vector RAG chunks.
5. **Report Synthesis**: Merges observations into executive reports and evidence-linked claim assertions.
