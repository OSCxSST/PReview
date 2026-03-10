import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../llm/anthropic-client.js", () => ({
  getAnthropicClient: vi.fn(),
}));

describe("judgeDuplicate", () => {
  const mockCreate = vi.fn();

  beforeEach(async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");

    const { getAnthropicClient } = vi.mocked(
      await import("../../llm/anthropic-client.js"),
    );
    getAnthropicClient.mockReturnValue({
      messages: { create: mockCreate },
    } as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  });

  it("confirms duplicates when LLM says yes", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            isDuplicate: true,
            confidence: 0.95,
            reasoning: "Both fix the same login bug",
            preferredPR: 42,
          }),
        },
      ],
    });

    const { judgeDuplicate } = await import("../../dedup/judge.js");
    const result = await judgeDuplicate(
      {
        githubNumber: 42,
        title: "Fix login crash",
        body: "Fixes null pointer in auth",
        intentSummary: {
          problem: "Login crashes",
          approach: "Null check",
          filesChangedSummary: "auth",
          category: "bug_fix",
          scope: "auth",
        },
      },
      {
        githubNumber: 43,
        title: "Fix auth null pointer",
        body: "Handle null email in login",
        intentSummary: {
          problem: "Auth null pointer",
          approach: "Null guard",
          filesChangedSummary: "auth",
          category: "bug_fix",
          scope: "auth",
        },
      },
    );

    expect(result.isDuplicate).toBe(true);
    expect(result.confidence).toBe(0.95);
    expect(result.preferredPR).toBe(42);
  });

  it("rejects non-duplicates when LLM says no", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            isDuplicate: false,
            confidence: 0.85,
            reasoning: "Different bugs in different modules",
            preferredPR: null,
          }),
        },
      ],
    });

    const { judgeDuplicate } = await import("../../dedup/judge.js");
    const result = await judgeDuplicate(
      {
        githubNumber: 42,
        title: "Fix login crash",
        body: "Auth issue",
        intentSummary: null,
      },
      {
        githubNumber: 44,
        title: "Fix dashboard crash",
        body: "Dashboard issue",
        intentSummary: null,
      },
    );

    expect(result.isDuplicate).toBe(false);
  });
});

describe("buildJudgePrompt", () => {
  it("includes both PR details", async () => {
    const { buildJudgePrompt } = await import(
      "../../dedup/judge-prompts.js"
    );
    const prompt = buildJudgePrompt(
      { githubNumber: 1, title: "PR A", body: "Body A", intentSummary: null },
      { githubNumber: 2, title: "PR B", body: "Body B", intentSummary: null },
    );

    expect(prompt).toContain("PR A");
    expect(prompt).toContain("PR B");
    expect(prompt).toContain("#1");
    expect(prompt).toContain("#2");
  });
});
