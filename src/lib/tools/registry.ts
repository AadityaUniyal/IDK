// Universal tool registry. The agent discovers these capabilities at
// runtime; nothing here knows about specific objectives or domains.

import { db } from "../db";
import { generateLLM } from "../ai/provider";

export type RiskLevel = "read" | "analyze" | "write" | "external" | "destructive";

export interface ToolContext {
  userId: string;
  missionId: string;
}

export interface ToolResult {
  output: string;
  evidence?: { excerpt: string; sourceId?: string; location?: string }[];
}

export interface AgentTool {
  name: string;
  description: string;
  inputSchema: Record<string, string>;
  riskLevel: RiskLevel;
  execute(input: any, ctx: ToolContext): Promise<ToolResult>;
}

async function getUserSources(userId: string) {
  return db()`SELECT id, name, type, content FROM data_sources WHERE user_id = ${userId} ORDER BY created_at DESC`;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9_.%-]+/g) ?? [];
}

function chunkText(content: string, size = 600): { text: string; offset: number }[] {
  const chunks: { text: string; offset: number }[] = [];
  for (let i = 0; i < content.length; i += size) {
    chunks.push({ text: content.slice(i, i + size), offset: i });
  }
  return chunks.length ? chunks : [{ text: content, offset: 0 }];
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split(/\r?\n/);
  const headers = (lines[0] ?? "").split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((l) => l.split(",").map((c) => c.trim()));
  return { headers, rows };
}

export const searchFiles: AgentTool = {
  name: "search_files",
  description: "Lexically search all of the user's uploaded text/CSV/JSON/Markdown sources. Returns ranked passages.",
  inputSchema: { query: "string — search keywords", topK: "number (optional, default 6)" },
  riskLevel: "read",
  async execute(input, ctx) {
    const query = String(input?.query ?? "").trim();
    if (!query) throw new Error("query is required");
    const sources = await getUserSources(ctx.userId);
    if (!sources.length) throw new Error("No data sources uploaded yet");
    const terms = tokenize(query);
    type Scored = { score: number; excerpt: string; sourceId: string; name: string; offset: number };
    const scored: Scored[] = [];
    for (const s of sources) {
      for (const ch of chunkText(s.content)) {
        const tokens = tokenize(ch.text);
        let score = 0;
        for (const t of terms) {
          const hits = tokens.filter((tk) => tk === t || tk.includes(t)).length;
          score += hits * (tk_exact(tokens, t) ? 2 : 1);
        }
        if (score > 0) scored.push({ score, excerpt: ch.text, sourceId: s.id, name: s.name, offset: ch.offset });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    const topK = Math.min(Number(input?.topK) || 6, 8);
    const top = scored.slice(0, topK);
    if (!top.length) {
      return { output: `No passages matched "${query}" in ${sources.length} source(s).` };
    }
    const output = top
      .map((t, i) => `[#${i + 1} ${t.name} @offset ${t.offset}]\n${t.excerpt}`)
      .join("\n\n---\n\n");
    return {
      output,
      evidence: top.map((t) => ({ excerpt: t.excerpt.slice(0, 400), sourceId: t.sourceId, location: `offset ${t.offset}` })),
    };
  },
};

function tk_exact(tokens: string[], t: string) {
  return tokens.includes(t);
}

export const readFile: AgentTool = {
  name: "read_file",
  description: "Read a specific uploaded source by name, optionally a character range.",
  inputSchema: { name: "string — source name", start: "number (optional char offset)", length: "number (optional, default 1500 chars)" },
  riskLevel: "read",
  async execute(input, ctx) {
    const sources = await getUserSources(ctx.userId);
    const src = sources.find((s) => s.name.toLowerCase() === String(input?.name ?? "").toLowerCase().trim());
    if (!src) throw new Error(`Source "${input?.name}" not found. Available: ${sources.map((s) => s.name).join(", ") || "none"}`);
    const start = Math.max(0, Number(input?.start) || 0);
    const length = Math.min(Number(input?.length) || 1500, 4000);
    const excerpt = src.content.slice(start, start + length);
    return {
      output: `[${src.name} (${src.type}), chars ${start}–${start + excerpt.length} of ${src.content.length}]\n${excerpt}`,
      evidence: [{ excerpt: excerpt.slice(0, 400), sourceId: src.id, location: `chars ${start}-${start + excerpt.length}` }],
    };
  },
};

export const queryTable: AgentTool = {
  name: "query_table",
  description: "Filter and aggregate a CSV source. Supports where (column op value) and group-count / group-sum aggregation.",
  inputSchema: {
    name: "string — CSV source name",
    where: "object (optional): {column, op ('='|'>'|'<'|'contains'), value}",
    groupBy: "string (optional) column to group by",
    aggregate: "string (optional) 'count' | 'sum:<numeric column>'",
  },
  riskLevel: "analyze",
  async execute(input, ctx) {
    const sources = await getUserSources(ctx.userId);
    const src = sources.find((s) => s.name.toLowerCase() === String(input?.name ?? "").toLowerCase().trim());
    if (!src) throw new Error(`CSV "${input?.name}" not found. Available: ${sources.map((s) => s.name).join(", ") || "none"}`);
    const { headers, rows } = parseCSV(src.content);
    let filtered = rows;
    const w = input?.where;
    if (w?.column) {
      const col = headers.indexOf(w.column);
      if (col === -1) throw new Error(`Column "${w.column}" not in [${headers.join(", ")}]`);
      filtered = filtered.filter((r) => {
        const cell = r[col];
        const num = Number(cell);
        const val = Number.isFinite(Number(w.value)) && w.op !== "contains" ? Number(w.value) : w.value;
        switch (w.op) {
          case ">": return num > val;
          case "<": return num < val;
          case "=": return cell === String(val);
          case "contains": return cell.toLowerCase().includes(String(val).toLowerCase());
          default: return cell === String(val);
        }
      });
    }
    const agg = String(input?.aggregate ?? "count");
    const groupBy = input?.groupBy ? headers.indexOf(input.groupBy) : -1;
    if (groupBy >= 0) {
      const groups = new Map<string, { count: number; sum: number }>();
      for (const r of filtered) {
        const key = r[groupBy] || "(blank)";
        const g = groups.get(key) ?? { count: 0, sum: 0 };
        g.count++;
        if (agg.startsWith("sum:")) {
          const valCol = headers.indexOf(agg.slice(4));
          if (valCol >= 0) g.sum += Number(r[valCol]) || 0;
        }
        groups.set(key, g);
      }
      const lines = [...groups.entries()].map(([k, g]) => `${k}: ${agg.startsWith("sum:") ? `sum=${g.sum.toFixed(2)}, n=${g.count}` : `count=${g.count}`}`);
      return {
        output: `Grouped by ${input.groupBy} over ${filtered.length} rows:\n` + lines.join("\n"),
        evidence: [{ excerpt: lines.slice(0, 20).join("\n").slice(0, 400), sourceId: src.id }],
      };
    }
    const preview = filtered.slice(0, 15).map((r) => r.join(" | ")).join("\n");
    return {
      output: `${filtered.length} of ${rows.length} rows match.\nColumns: ${headers.join(", ")}\n${preview}`,
      evidence: [{ excerpt: preview.slice(0, 400), sourceId: src.id }],
    };
  },
};

export const calculate: AgentTool = {
  name: "calculate",
  description: "Deterministic arithmetic over an expression, e.g. '(125.4 - 98.1) / 98.1 * 100'.",
  inputSchema: { expression: "string — arithmetic expression" },
  riskLevel: "read",
  async execute(input) {
    const expr = String(input?.expression ?? "");
    if (!/^[-+*/(). 0-9eE]+$/.test(expr) || !expr.trim()) throw new Error("Only numeric arithmetic expressions are allowed");
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${expr});`)();
    if (!Number.isFinite(result)) throw new Error("Expression did not evaluate to a finite number");
    return { output: `${expr} = ${result}` };
  },
};

export const summarizeSource: AgentTool = {
  name: "summarize_source",
  description: "Use the LLM to analyze/summarize previously observed text (pass the text in `content`). Use for synthesis, comparison, hypothesis formation.",
  inputSchema: { content: "string — text/observations to analyze", question: "string — what to extract or answer" },
  riskLevel: "analyze",
  async execute(input) {
    const content = String(input?.content ?? "").slice(0, 12000);
    if (!content.trim()) throw new Error("content is required");
    const res = await generateLLM({
      system: "You are TRACE's analysis engine. Answer concisely, factually, only from the provided content. Never invent data.",
      prompt: `Question: ${input?.question ?? "Summarize the key findings."}\n\nContent:\n${content}`,
      maxTokens: 1200,
    });
    return { output: res.text, evidence: [{ excerpt: content.slice(0, 400) }] };
  },
};

export const generateDocument: AgentTool = {
  name: "generate_document",
  description: "Persist a final report/artifact into the mission. Markdown format. This writes state and requires approval.",
  inputSchema: { title: "string", content: "string — markdown report" },
  riskLevel: "write",
  async execute(input, ctx) {
    const title = String(input?.title ?? "Mission report").slice(0, 200);
    const content = String(input?.content ?? "").slice(0, 20000);
    await db()`INSERT INTO artifacts (mission_id, type, title, content) VALUES (${ctx.missionId}, ${"report"}, ${title}, ${content})`;
    return { output: `Artifact "${title}" created (${content.length} chars of markdown).` };
  },
};

export const registry: AgentTool[] = [
  searchFiles,
  readFile,
  queryTable,
  calculate,
  summarizeSource,
  generateDocument,
];

export function describeToolsForPlanner(): string {
  return registry
    .map((t) => `- ${t.name} (${t.riskLevel}): ${t.description}\n  input: ${JSON.stringify(t.inputSchema)}`)
    .join("\n");
}

export function getTool(name: string): AgentTool | undefined {
  return registry.find((t) => t.name === name);
}
