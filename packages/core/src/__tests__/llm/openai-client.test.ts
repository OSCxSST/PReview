import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("openai-client", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("throws when OPENAI_API_KEY is not set", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.resetModules();
    const { getOpenAIClient } = await import("../../llm/openai-client.js");
    expect(() => getOpenAIClient()).toThrow(
      "OPENAI_API_KEY environment variable is required",
    );
  });

  it("returns an OpenAI client when key is set", async () => {
    const { getOpenAIClient } = await import("../../llm/openai-client.js");
    const client = getOpenAIClient();
    expect(client).toBeDefined();
    expect(client.embeddings).toBeDefined();
  });

  it("returns the same instance on subsequent calls", async () => {
    const { getOpenAIClient } = await import("../../llm/openai-client.js");
    const a = getOpenAIClient();
    const b = getOpenAIClient();
    expect(a).toBe(b);
  });
});
