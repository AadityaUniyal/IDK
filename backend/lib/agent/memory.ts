// Episodic & Semantic Agent Memory Engine
import { db } from "../db";
import { computeTermVector, cosineSimilarity } from "../vector";
import { generateLLM } from "../ai/provider";

export interface AgentMemory {
  id: string;
  userId: string;
  category: "episodic" | "semantic" | "preference" | "entity";
  key: string;
  value: string;
  createdAt: string;
  score?: number;
}

export async function saveMemory(
  userId: string,
  category: "episodic" | "semantic" | "preference" | "entity",
  key: string,
  value: string
): Promise<string> {
  const sql = db();
  const id = crypto.randomUUID();
  const vec = computeTermVector(`${key}: ${value}`);
  
  await sql`
    INSERT INTO agent_memories (id, user_id, category, key, value, embedding_json)
    VALUES (${id}, ${userId}, ${category}, ${key}, ${value}, ${JSON.stringify(vec)})
  `;
  return id;
}

export async function queryMemories(userId: string, query: string, limit = 5): Promise<AgentMemory[]> {
  const sql = db();
  const queryVec = computeTermVector(query);
  const rows = await sql`
    SELECT id, user_id, category, key, value, embedding_json, created_at
    FROM agent_memories
    WHERE user_id = ${userId}
    LIMIT 100
  `;

  if (!rows || rows.length === 0) return [];

  const scored = rows.map((r: any) => {
    let embedding: number[] = [];
    try {
      embedding = typeof r.embedding_json === "string" ? JSON.parse(r.embedding_json) : r.embedding_json;
    } catch {
      embedding = [];
    }
    const score = cosineSimilarity(queryVec, embedding);
    return {
      id: r.id,
      userId: r.user_id,
      category: r.category,
      key: r.key,
      value: r.value,
      createdAt: r.created_at,
      score
    };
  });

  scored.sort((a, b) => (b.score || 0) - (a.score || 0));
  return scored.slice(0, limit);
}

export async function extractAndPersistMissionInsights(userId: string, missionId: string, objective: string, reportContent: string) {
  try {
    const summary = await generateLLM({
      system: `You are TRACE Memory Engine. Extract 2-3 concise long-term key findings or entities from this completed mission report. Respond in clear bullet format with key: value.`,
      prompt: `OBJECTIVE: ${objective}\nREPORT:\n${reportContent.slice(0, 3000)}`,
      maxTokens: 400
    });

    const lines = summary.text.split("\n").filter(l => l.trim().startsWith("-") || l.trim().startsWith("*"));
    for (const line of lines) {
      const cleaned = line.replace(/^[-*]\s*/, "").trim();
      if (cleaned.length > 5) {
        await saveMemory(userId, "episodic", `Mission ${missionId.slice(0, 8)}`, cleaned);
      }
    }
  } catch (err) {
    console.warn("Failed to extract mission memory:", err);
  }
}
