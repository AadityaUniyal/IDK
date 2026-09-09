// Advanced RAG Vector Store & Hybrid Retrieval Engine
import { db } from "./db";
import { generateLLM } from "./ai/provider";

export interface VectorChunk {
  id: string;
  sourceId: string;
  sourceName?: string;
  chunkIndex: number;
  content: string;
  embedding: number[];
  score?: number;
}

// Semantic text chunker — splits documents by structural boundaries
export function chunkText(text: string, maxChunkSize = 800, overlap = 150): string[] {
  if (!text || text.trim().length === 0) return [];
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const para of paragraphs) {
    if ((currentChunk + "\n\n" + para).length <= maxChunkSize) {
      currentChunk += (currentChunk ? "\n\n" : "") + para;
    } else {
      if (currentChunk) chunks.push(currentChunk.trim());
      if (para.length > maxChunkSize) {
        // Sentence level split fallback
        const sentences = para.match(/[^.!?]+[.!?]+/g) || [para];
        let subChunk = "";
        for (const sentence of sentences) {
          if ((subChunk + " " + sentence).length <= maxChunkSize) {
            subChunk += (subChunk ? " " : "") + sentence;
          } else {
            if (subChunk) chunks.push(subChunk.trim());
            subChunk = sentence;
          }
        }
        currentChunk = subChunk;
      } else {
        currentChunk = para;
      }
    }
  }
  if (currentChunk.trim()) chunks.push(currentChunk.trim());

  // Add overlaps between chunks for context preservation
  if (chunks.length <= 1) return chunks;
  const overlappedChunks: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    let chunk = chunks[i];
    if (i > 0 && overlap > 0) {
      const prevChunk = chunks[i - 1];
      const overlapSnippet = prevChunk.slice(Math.max(0, prevChunk.length - overlap));
      chunk = `[Context prior]: ...${overlapSnippet}\n` + chunk;
    }
    overlappedChunks.push(chunk);
  }
  return overlappedChunks;
}

// Compute frequency vector (fallback representation for fast zero-cost embeddings)
export function computeTermVector(text: string): number[] {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length > 2);
  const freqMap = new Map<string, number>();
  for (const w of words) {
    freqMap.set(w, (freqMap.get(w) || 0) + 1);
  }
  
  // Hash words to a 64-dimensional feature vector space
  const dim = 64;
  const vector = new Array(dim).fill(0);
  for (const [w, count] of freqMap.entries()) {
    let hash = 0;
    for (let i = 0; i < w.length; i++) {
      hash = (hash << 5) - hash + w.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % dim;
    vector[idx] += count;
  }

  // Normalize vector
  const mag = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  return mag > 0 ? vector.map(v => v / mag) : vector;
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA.length || !vecB.length || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function indexDataSource(sourceId: string, name: string, content: string) {
  const sql = db();
  const chunks = chunkText(content);
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const vec = computeTermVector(chunk);
    const id = crypto.randomUUID();
    await sql`
      INSERT INTO vector_embeddings (id, source_id, chunk_index, content, embedding_json)
      VALUES (${id}, ${sourceId}, ${i}, ${chunk}, ${JSON.stringify(vec)})
    `;
  }
}

export async function hybridVectorSearch(query: string, limit = 5): Promise<VectorChunk[]> {
  const sql = db();
  const queryVec = computeTermVector(query);
  const rows = await sql`
    SELECT v.id, v.source_id, v.chunk_index, v.content, v.embedding_json, d.name as source_name
    FROM vector_embeddings v
    JOIN data_sources d ON v.source_id = d.id
    LIMIT 200
  `;

  if (!rows || rows.length === 0) return [];

  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);

  const scored = rows.map((r: any) => {
    let embedding: number[] = [];
    try {
      embedding = typeof r.embedding_json === "string" ? JSON.parse(r.embedding_json) : r.embedding_json;
    } catch {
      embedding = [];
    }

    const cosSim = cosineSimilarity(queryVec, embedding);
    
    // Keyword match boost (BM25 style overlap)
    const contentLower = String(r.content).toLowerCase();
    let keywordScore = 0;
    for (const term of queryTerms) {
      if (contentLower.includes(term)) keywordScore += 0.2;
    }

    const combinedScore = cosSim * 0.7 + keywordScore * 0.3;

    return {
      id: r.id,
      sourceId: r.source_id,
      sourceName: r.source_name,
      chunkIndex: r.chunk_index,
      content: r.content,
      embedding,
      score: combinedScore
    };
  });

  scored.sort((a, b) => (b.score || 0) - (a.score || 0));
  return scored.slice(0, limit);
}
