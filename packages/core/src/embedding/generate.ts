import { getOpenAIClient } from "../llm/openai-client.js";
import { EMBEDDING_DIMENSIONS } from "../constants.js";
import type { IntentSummary } from "../types.js";

export function buildEmbeddingText(intent: IntentSummary): string {
  return [
    `Problem: ${intent.problem}`,
    `Approach: ${intent.approach}`,
    `Files: ${intent.filesChangedSummary}`,
    `Category: ${intent.category}`,
    `Scope: ${intent.scope}`,
  ].join("\n");
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getOpenAIClient();

  const response = await client.embeddings.create({
    model: "text-embedding-3-large",
    input: text,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  const first = response.data[0];
  if (!first) throw new Error("No embedding returned");
  return first.embedding;
}
