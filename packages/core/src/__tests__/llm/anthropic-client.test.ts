import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("anthropic-client", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("throws when ANTHROPIC_API_KEY is not set", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.resetModules();
    const { getAnthropicClient } =
      await import("../../llm/anthropic-client.js");
    expect(() => getAnthropicClient()).toThrow(
      "ANTHROPIC_API_KEY environment variable is required",
    );
  });

  it("returns an Anthropic client when key is set", async () => {
    const { getAnthropicClient } =
      await import("../../llm/anthropic-client.js");
    const client = getAnthropicClient();
    expect(client).toBeDefined();
    expect(client.messages).toBeDefined();
  });

  it("returns the same instance on subsequent calls", async () => {
    const { getAnthropicClient } =
      await import("../../llm/anthropic-client.js");
    const a = getAnthropicClient();
    const b = getAnthropicClient();
    expect(a).toBe(b);
  });
});
