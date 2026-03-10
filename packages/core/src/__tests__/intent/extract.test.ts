import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { IntentSummary } from "../../types.js";

// Mock the Anthropic client
vi.mock("../../llm/anthropic-client.js", () => ({
  getAnthropicClient: vi.fn(),
}));

describe("extractIntent", () => {
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

  it("extracts intent from a PR with good description", async () => {
    const mockResponse: IntentSummary = {
      problem: "Login crashes on empty email",
      approach: "Added null check before validation",
      filesChangedSummary: "Auth module validation logic",
      category: "bug_fix",
      scope: "auth",
    };

    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify(mockResponse) }],
    });

    const { extractIntent } = await import("../../intent/extract.js");
    const result = await extractIntent({
      title: "Fix login crash",
      body: "The login page crashes when email field is empty",
      filesChanged: ["src/auth/login.ts"],
    });

    expect(result.intent).toEqual(mockResponse);
    expect(result.usedDiffFallback).toBe(false);
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("flags low-quality descriptions and uses diff fallback", async () => {
    const mockResponse: IntentSummary = {
      problem: "Unknown from diff analysis",
      approach: "Modified configuration",
      filesChangedSummary: "Config files",
      category: "chore",
      scope: "config",
    };

    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify(mockResponse) }],
    });

    const { extractIntent } = await import("../../intent/extract.js");
    const result = await extractIntent({
      title: "Update",
      body: null,
      filesChanged: ["config.json"],
      diff: "@@ -1 +1 @@\n-old\n+new",
    });

    expect(result.usedDiffFallback).toBe(true);
  });

  it("parses the LLM JSON response correctly", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: '{"problem":"test","approach":"test","filesChangedSummary":"test","category":"feature","scope":"api"}',
        },
      ],
    });

    const { extractIntent } = await import("../../intent/extract.js");
    const result = await extractIntent({
      title: "Add feature",
      body: "A detailed description of the feature",
      filesChanged: ["src/api/route.ts"],
    });

    expect(result.intent.category).toBe("feature");
  });
});

describe("isLowQualityDescription", () => {
  it("flags null body", async () => {
    const { isLowQualityDescription } = await import(
      "../../intent/extract.js"
    );
    expect(isLowQualityDescription(null)).toBe(true);
  });

  it("flags empty body", async () => {
    const { isLowQualityDescription } = await import(
      "../../intent/extract.js"
    );
    expect(isLowQualityDescription("")).toBe(true);
    expect(isLowQualityDescription("   ")).toBe(true);
  });

  it("flags very short body", async () => {
    const { isLowQualityDescription } = await import(
      "../../intent/extract.js"
    );
    expect(isLowQualityDescription("fix")).toBe(true);
  });

  it("accepts good descriptions", async () => {
    const { isLowQualityDescription } = await import(
      "../../intent/extract.js"
    );
    expect(
      isLowQualityDescription(
        "This PR fixes the login bug by adding null check validation to the email field",
      ),
    ).toBe(false);
  });
});

describe("parseIntentResponse", () => {
  it("extracts JSON from markdown-wrapped response", async () => {
    const { parseIntentResponse } = await import("../../intent/extract.js");
    const result = parseIntentResponse(
      'Here is the analysis:\n```json\n{"problem":"test","approach":"test","filesChangedSummary":"test","category":"feature","scope":"api"}\n```',
    );
    expect(result.category).toBe("feature");
  });

  it("defaults invalid category to chore", async () => {
    const { parseIntentResponse } = await import("../../intent/extract.js");
    const result = parseIntentResponse(
      '{"problem":"t","approach":"t","filesChangedSummary":"t","category":"invalid","scope":"t"}',
    );
    expect(result.category).toBe("chore");
  });

  it("throws on non-JSON response", async () => {
    const { parseIntentResponse } = await import("../../intent/extract.js");
    expect(() => parseIntentResponse("just some text")).toThrow(
      "No JSON object found",
    );
  });
});
