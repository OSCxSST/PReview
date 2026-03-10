import type { IntentSummary } from "../types.js";

export const JUDGE_SYSTEM_PROMPT = `You are a duplicate PR detector. Given two pull requests, determine if they solve the same problem.
Respond with a JSON object:
- isDuplicate: boolean — true if both PRs address the same underlying problem
- confidence: number (0-1) — how confident you are
- reasoning: string — brief explanation (1-2 sentences)
- preferredPR: number | null — the PR number of the better implementation, or null if not a duplicate`;

export interface JudgePRInput {
  githubNumber: number;
  title: string;
  body: string | null;
  intentSummary: IntentSummary | null;
}

export function buildJudgePrompt(prA: JudgePRInput, prB: JudgePRInput): string {
  const formatPR = (pr: JudgePRInput) => {
    const parts = [`Title: ${pr.title}`, `Description: ${pr.body ?? "(none)"}`];
    if (pr.intentSummary) {
      parts.push(`Extracted Intent: ${JSON.stringify(pr.intentSummary)}`);
    }
    return parts.join("\n");
  };

  return [
    `## PR #${prA.githubNumber}`,
    formatPR(prA),
    "",
    `## PR #${prB.githubNumber}`,
    formatPR(prB),
    "",
    "Are these two PRs solving the same problem?",
  ].join("\n");
}
