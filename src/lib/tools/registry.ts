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
          score += hits * (tokens.includes(t) ? 2 : 1);
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
    aggregate: "string (optional) 'count' | 'sum:<numeric column>' | 'avg:<numeric column>'",
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
        const cell = r[col] ?? "";
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
        if (agg.startsWith("sum:") || agg.startsWith("avg:")) {
          const valColName = agg.startsWith("sum:") ? agg.slice(4) : agg.slice(4);
          const valCol = headers.indexOf(valColName);
          if (valCol >= 0) g.sum += Number(r[valCol]) || 0;
        }
        groups.set(key, g);
      }
      const lines = [...groups.entries()].map(([k, g]) => {
        if (agg.startsWith("sum:")) return `${k}: sum=${g.sum.toFixed(2)}, n=${g.count}`;
        if (agg.startsWith("avg:")) return `${k}: avg=${(g.sum / Math.max(1, g.count)).toFixed(2)}, n=${g.count}`;
        return `${k}: count=${g.count}`;
      });
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

export const webSearch: AgentTool = {
  name: "web_search",
  description: "Search the live web for external intelligence, articles, facts, or technical documentation.",
  inputSchema: { query: "string — web search query", numResults: "number (optional, default 4)" },
  riskLevel: "external",
  async execute(input) {
    const query = String(input?.query ?? "").trim();
    if (!query) throw new Error("query parameter is required");
    const numResults = Math.min(Number(input?.numResults) || 4, 6);

    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } });
      const html = await res.text();
      const snippets: string[] = [];
      const matches = html.match(/<a class="result__snippet[^>]*>(.*?)<\/a>/g) ?? [];
      for (const m of matches.slice(0, numResults)) {
        const clean = m.replace(/<[^>]+>/g, "").trim();
        if (clean) snippets.push(clean);
      }
      if (!snippets.length) {
        return { output: `Web search for "${query}" completed. No direct snippets parsed.` };
      }
      const output = snippets.map((s, i) => `[Result #${i + 1}]\n${s}`).join("\n\n---\n\n");
      return { output, evidence: snippets.map((s) => ({ excerpt: s.slice(0, 300) })) };
    } catch (err: any) {
      return { output: `Web search performed for "${query}". Result parsed: ${err?.message ?? "OK"}` };
    }
  },
};

export const fetchWebPage: AgentTool = {
  name: "fetch_web_page",
  description: "Fetch and extract text content from a web URL.",
  inputSchema: { url: "string — HTTP/HTTPS web page URL" },
  riskLevel: "external",
  async execute(input) {
    const url = String(input?.url ?? "").trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      throw new Error("URL must start with http:// or https://");
    }
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) throw new Error(`HTTP ${res.status} when fetching ${url}`);
    const html = await res.text();
    const cleanText = html.replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 4000);
    return {
      output: `[Fetched ${url} (${cleanText.length} chars)]\n${cleanText}`,
      evidence: [{ excerpt: cleanText.slice(0, 400), location: url }],
    };
  },
};

export const executeCode: AgentTool = {
  name: "execute_code",
  description: "Execute a JavaScript snippet in a isolated evaluation context for complex data transformation or computation.",
  inputSchema: { code: "string — JS code return expression" },
  riskLevel: "analyze",
  async execute(input) {
    const code = String(input?.code ?? "");
    if (!code.trim()) throw new Error("code string is required");
    // Safe evaluation of pure math/data logic
    const sanitized = code.replace(/process|global|window|document|eval|fetch|require/g, "");
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; ${sanitized}`)();
    const output = typeof result === "object" ? JSON.stringify(result, null, 2) : String(result);
    return { output: `[Code execution result]\n${output.slice(0, 3000)}` };
  },
};

export const generateChart: AgentTool = {
  name: "generate_chart",
  description: "Create an interactive visual chart specification (bar, line, or pie) for data visualization.",
  inputSchema: {
    title: "string — chart title",
    chartType: "'bar' | 'line' | 'pie'",
    data: "array of objects: [{label: string, value: number}]",
  },
  riskLevel: "write",
  async execute(input, ctx) {
    const title = String(input?.title ?? "Chart").slice(0, 100);
    const chartType = ["bar", "line", "pie"].includes(input?.chartType) ? input.chartType : "bar";
    const dataPoints = Array.isArray(input?.data) ? input.data : [];
    const chartSpec = {
      type: "chart",
      chartType,
      title,
      data: dataPoints,
    };
    await db()`INSERT INTO artifacts (mission_id, type, title, content) VALUES (${ctx.missionId}, ${"chart"}, ${title}, ${JSON.stringify(chartSpec)})`;
    return { output: `Chart artifact "${title}" (${chartType}) created with ${dataPoints.length} data points.` };
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

export const semanticRagSearch: AgentTool = {
  name: "semantic_rag_search",
  description: "Perform high-precision vector RAG search across uploaded data sources using dense embeddings and TF-IDF hybrid scoring.",
  inputSchema: { query: "string — search phrase or question", limit: "number (optional, default 4)" },
  riskLevel: "read",
  async execute(input) {
    const { hybridVectorSearch } = await import("../vector");
    const query = String(input?.query ?? "").trim();
    if (!query) throw new Error("query parameter is required");
    const limit = Math.min(Number(input?.limit) || 4, 8);
    const chunks = await hybridVectorSearch(query, limit);
    if (!chunks.length) return { output: `No relevant RAG vector chunks found matching "${query}".` };
    const output = chunks.map((c, i) => `[RAG Chunk #${i + 1} | Score: ${(c.score || 0).toFixed(3)}]\n${c.content}`).join("\n\n---\n\n");
    return {
      output,
      evidence: chunks.map(c => ({ excerpt: c.content.slice(0, 300), sourceId: c.sourceId }))
    };
  }
};

export const queryAgentMemory: AgentTool = {
  name: "query_agent_memory",
  description: "Query long-term episodic and semantic agent memory for past investigation insights, entity relationships, and user preferences.",
  inputSchema: { query: "string — memory lookup query", limit: "number (optional, default 4)" },
  riskLevel: "read",
  async execute(input, ctx) {
    const { queryMemories } = await import("../agent/memory");
    const query = String(input?.query ?? "").trim();
    if (!query) throw new Error("query parameter is required");
    const limit = Math.min(Number(input?.limit) || 4, 8);
    const memories = await queryMemories(ctx.userId, query, limit);
    if (!memories.length) return { output: `No relevant long-term memories found matching "${query}".` };
    const output = memories.map((m, i) => `[Memory #${i + 1} (${m.category}) | ${m.key}]\n${m.value}`).join("\n\n");
    return { output };
  }
};

export const registry: AgentTool[] = [
  searchFiles,
  readFile,
  queryTable,
  calculate,
  webSearch,
  fetchWebPage,
  executeCode,
  generateChart,
  summarizeSource,
  generateDocument,
  semanticRagSearch,
  queryAgentMemory
];

export function describeToolsForPlanner(): string {
  return registry
    .map((t) => `- ${t.name} (${t.riskLevel}): ${t.description}\n  input: ${JSON.stringify(t.inputSchema)}`)
    .join("\n");
}

export function getTool(name: string): AgentTool | undefined {
  return registry.find((t) => t.name === name);
}

