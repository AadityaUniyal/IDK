import type { LLMProvider, LLMRequest, LLMResponse } from "./provider";

const MODEL = "openai/gpt-oss-120b";

export const groq: LLMProvider = {
  name: "groq",
  async generate(req: LLMRequest): Promise<LLMResponse> {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error("GROQ_API_KEY is not configured");
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.prompt },
        ],
        max_tokens: req.maxTokens ?? 4096,
        ...(req.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!res.ok) throw new Error(`Groq API error ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? "";
    if (!text) throw new Error("Groq returned empty response");
    return { text, provider: "groq", model: MODEL };
  },
};
