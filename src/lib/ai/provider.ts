// LLM provider abstraction: one interface, Gemini primary, Groq fallback.

import { gemini } from "./gemini";
import { groq } from "./groq";

export interface LLMRequest {
  system: string;
  prompt: string;
  json?: boolean;
  maxTokens?: number;
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

export async function generateLLM(req: LLMRequest): Promise<LLMResponse> {
  const primary = process.env.DEFAULT_LLM_PROVIDER === "groq" ? groq : gemini;
  const fallback = primary === gemini ? groq : gemini;
  try {
    return await primary.generate(req);
  } catch (err) {
    console.error(`LLM provider ${primary.name} failed, falling back:`, err instanceof Error ? err.message : err);
    return await fallback.generate(req);
  }
}

/** Generate JSON, parsing and repairing common model output quirks. */
export async function generateJSON<T>(req: LLMRequest): Promise<T> {
  const res = await generateLLM({ ...req, json: true });
  const text = res.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  return JSON.parse(text) as T;
}
