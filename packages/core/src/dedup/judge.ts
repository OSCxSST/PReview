import { getAnthropicClient } from "../llm/anthropic-client.js";
import {
  JUDGE_SYSTEM_PROMPT,
  buildJudgePrompt,
  type JudgePRInput,
} from "./judge-prompts.js";

export interface JudgeResult {
  isDuplicate: boolean;
  confidence: number;
  reasoning: string;
  preferredPR: number | null;
}

export async function judgeDuplicate(
  prA: JudgePRInput,
  prB: JudgePRInput,
): Promise<JudgeResult> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20241022",
    max_tokens: 512,
    system: JUDGE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildJudgePrompt(prA, prB) }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from judge");
  }

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON in judge response");
  }

  const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

  return {
    isDuplicate: Boolean(parsed["isDuplicate"]),
    confidence: Number(parsed["confidence"] ?? 0),
    reasoning: String(parsed["reasoning"] ?? ""),
    preferredPR:
      parsed["preferredPR"] != null ? Number(parsed["preferredPR"]) : null,
  };
}
