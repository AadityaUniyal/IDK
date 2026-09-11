# TRACE — Universal Agentic AI Platform

> **Investigate. Reason. Execute. Verify.**

TRACE is a high-performance visual platform for autonomous agentic workflows and investigations. Given an objective and user context, TRACE formulates dynamic task graphs, executes safe parallel work, enforces security policies, collects evidence, and synthesizes executive reports.

---

## 🌟 Capabilities

- **Dynamic Task Graphs**: Automatically decomposes objectives into cycle-free task execution workflows.
- **Autonomous Execution & Recovery**: Executes parallel tasks with built-in self-healing and failure replanning capabilities.
- **Human-in-the-Loop Control**: High-impact or write actions pause for explicit user authorization.
- **Vector Search & Context RAG**: Indexes unstructured data (CSV, JSON, Markdown, Text) for semantic retrieval.
- **Trajectory Replay**: Interactive timeline scrubber for reviewing past mission execution events.
- **Multi-Provider AI Support**: Seamless support for primary and fallback model providers.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- Neon PostgreSQL Database

### 1. Environment Setup

Copy `.env.example` to `.env.local`:

```bash
cd frontend
cp .env.example .env.local
```

Configure your local database URL and provider API keys in `.env.local`.

### 2. Initialize Database Schema

```bash
npm run db:init
```

### 3. Run Development Server

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## 🚀 Production Build

```bash
cd frontend
npm run build
npm run start
```
