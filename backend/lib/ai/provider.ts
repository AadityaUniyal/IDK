// LLM provider abstraction: one interface, Gemini primary, Groq fallback.
// Every call is recorded in model_runs for observability.

import { db } from "../db";
import { gemini } from "./gemini";
import { groq } from "./groq";

export interface LLMRequest {
  system: string;
  prompt: string;
  json?: boolean;
  maxTokens?: number;
}

/** Observability context — records the call in model_runs when present. */
export interface LLMContext {
  missionId?: string;
  purpose: string; // plan | replan | synthesize | summarize | evaluate
}

export interface LLMResponse {
  text: string;
  provider: "gemini" | "groq";
  model: string;
}

export interface LLMProvider {
  name: "gemini" | "groq";
  generate(req: LLMRequest): Promise<LLMResponse>;
}

async function recordRun(ctx: LLMContext, res: LLMResponse | null, latencyMs: number, promptChars: number, err?: string) {
  try {
    await db()`INSERT INTO model_runs (mission_id, purpose, provider, model, latency_ms, prompt_chars, status, error_message)
      VALUES (${ctx.missionId ?? null}, ${ctx.purpose}, ${res?.provider ?? "unknown"}, ${res?.model ?? "unknown"},
      ${Math.round(latencyMs)}, ${promptChars}, ${err ? "failed" : "ok"}, ${err ?? null})`;
  } catch (e) {
    console.error("model_runs insert failed:", e instanceof Error ? e.message : e);
  }
}

export async function generateLLM(req: LLMRequest, ctx: LLMContext = { purpose: "unattributed" }): Promise<LLMResponse> {
  const primary = process.env.DEFAULT_LLM_PROVIDER === "groq" ? groq : gemini;
  const fallback = primary === gemini ? groq : gemini;
  const started = Date.now();
  try {
    const res = await primary.generate(req);
    await recordRun(ctx, res, Date.now() - started, req.prompt.length);
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`LLM provider ${primary.name} failed, falling back:`, msg);
    await recordRun(ctx, null, Date.now() - started, req.prompt.length, `${primary.name}: ${msg.slice(0, 300)}`);
    const res = await fallback.generate(req);
    await recordRun(ctx, res, Date.now() - started, req.prompt.length);
    return res;
  }
}

/** Generate JSON, parsing and repairing common model output quirks. */
export async function generateJSON<T>(req: LLMRequest, ctx: LLMContext = { purpose: "unattributed" }): Promise<T> {
  const res = await generateLLM({ ...req, json: true }, ctx);
  const text = res.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  return JSON.parse(text) as T;
}
