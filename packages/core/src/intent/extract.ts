import { getAnthropicClient } from "../llm/anthropic-client.js";
import type { IntentSummary, PRCategory } from "../types.js";
import {
  INTENT_SYSTEM_PROMPT,
  buildIntentExtractionPrompt,
  buildDiffFallbackPrompt,
} from "./prompts.js";

const VALID_CATEGORIES: PRCategory[] = [
  "bug_fix",
  "feature",
  "refactor",
  "docs",
  "test",
  "chore",
];

export interface ExtractIntentInput {
  title: string;
  body: string | null;
  filesChanged: string[];
  diff?: string;
}

export interface ExtractIntentResult {
  intent: IntentSummary;
  usedDiffFallback: boolean;
}

export function isLowQualityDescription(body: string | null): boolean {
  if (!body || body.trim().length === 0) return true;
  if (body.trim().length < 20) return true;

  const genericPatterns = [
    /^#+\s*(description|summary|changes)/im,
    /no description provided/i,
    /\[describe your changes\]/i,
  ];

  const stripped = body.replace(/<!-- .*? -->/gs, "").trim();
  if (stripped.length < 20) return true;

  return genericPatterns.some((p) => p.test(stripped));
}

export function parseIntentResponse(text: string): IntentSummary {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON object found in LLM response");
  }

  const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

  const category = VALID_CATEGORIES.includes(parsed["category"] as PRCategory)
    ? (parsed["category"] as PRCategory)
    : "chore";

  return {
    problem: String(parsed["problem"] ?? ""),
    approach: String(parsed["approach"] ?? ""),
    filesChangedSummary: String(parsed["filesChangedSummary"] ?? ""),
    category,
    scope: String(parsed["scope"] ?? ""),
  };
}

export async function extractIntent(
  input: ExtractIntentInput,
): Promise<ExtractIntentResult> {
  const client = getAnthropicClient();
  const useDiffFallback = isLowQualityDescription(input.body);

  const userPrompt =
    useDiffFallback && input.diff
      ? buildDiffFallbackPrompt({ title: input.title, diff: input.diff })
      : buildIntentExtractionPrompt({
          title: input.title,
          body: input.body,
          filesChanged: input.filesChanged,
        });

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20241022",
    max_tokens: 1024,
    system: INTENT_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from intent extraction");
  }

  const intent = parseIntentResponse(textBlock.text);

  return { intent, usedDiffFallback: useDiffFallback && !!input.diff };
}
