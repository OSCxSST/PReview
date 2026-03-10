export const INTENT_SYSTEM_PROMPT = `You are a code review assistant. Analyze pull requests and extract structured intent.
Respond with a JSON object containing exactly these fields:
- problem: What problem does this PR solve? (1-2 sentences)
- approach: How does it solve it? (1-2 sentences)
- filesChangedSummary: Brief summary of which areas of the codebase are affected (1 sentence)
- category: Exactly one of: "bug_fix", "feature", "refactor", "docs", "test", "chore"
- scope: The primary area/module affected (1-3 words)`;

export interface IntentExtractionInput {
  title: string;
  body: string | null;
  filesChanged: string[];
}

export function buildIntentExtractionPrompt(
  input: IntentExtractionInput,
): string {
  const parts = [
    `PR Title: ${input.title}`,
    "",
    `PR Description: ${input.body ?? "(no description provided)"}`,
    "",
    `Files Changed (${input.filesChanged.length}):`,
    ...input.filesChanged.map((f) => `- ${f}`),
  ];
  return parts.join("\n");
}

export interface DiffFallbackInput {
  title: string;
  diff: string;
}

export function buildDiffFallbackPrompt(input: DiffFallbackInput): string {
  const truncatedDiff =
    input.diff.length > 8000 ? input.diff.slice(0, 8000) + "\n..." : input.diff;

  return [
    `PR Title: ${input.title}`,
    "",
    "The PR has no meaningful description. Analyze the diff to extract intent:",
    "",
    "```diff",
    truncatedDiff,
    "```",
  ].join("\n");
}
