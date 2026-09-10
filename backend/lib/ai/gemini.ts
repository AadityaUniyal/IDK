import type { LLMProvider, LLMRequest, LLMResponse } from "./provider";

const MODEL = "gemini-3.6-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export const gemini: LLMProvider = {
  name: "gemini",
  async generate(req: LLMRequest): Promise<LLMResponse> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is not configured");
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: "user", parts: [{ text: req.prompt }] }],
        generationConfig: {
          maxOutputTokens: req.maxTokens ?? 4096,
          ...(req.json ? { responseMimeType: "application/json" } : {}),
        },
      }),
    });
    if (!res.ok) throw new Error(`Gemini API error ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
    if (!text) throw new Error("Gemini returned empty response");
    return { text, provider: "gemini", model: MODEL };
  },
};
