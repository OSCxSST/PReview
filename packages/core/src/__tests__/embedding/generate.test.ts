import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EMBEDDING_DIMENSIONS } from "../../constants.js";

vi.mock("../../llm/openai-client.js", () => ({
  getOpenAIClient: vi.fn(),
}));

describe("generateEmbedding", () => {
  const mockCreate = vi.fn();

  beforeEach(async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");

    const { getOpenAIClient } = vi.mocked(
      await import("../../llm/openai-client.js"),
    );
    getOpenAIClient.mockReturnValue({
      embeddings: { create: mockCreate },
    } as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  });

  it("generates an embedding from text", async () => {
    const fakeEmbedding = Array(EMBEDDING_DIMENSIONS).fill(0.1);
    mockCreate.mockResolvedValueOnce({
      data: [{ embedding: fakeEmbedding }],
    });

    const { generateEmbedding } = await import("../../embedding/generate.js");
    const result = await generateEmbedding("test text");

    expect(result).toEqual(fakeEmbedding);
    expect(result).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(mockCreate).toHaveBeenCalledWith({
      model: "text-embedding-3-large",
      input: "test text",
      dimensions: EMBEDDING_DIMENSIONS,
    });
  });

  it("builds embedding text from intent summary", async () => {
    const { buildEmbeddingText } = await import("../../embedding/generate.js");
    const text = buildEmbeddingText({
      problem: "Login crashes",
      approach: "Add null check",
      filesChangedSummary: "Auth module",
      category: "bug_fix",
      scope: "auth",
    });

    expect(text).toContain("Login crashes");
    expect(text).toContain("Add null check");
    expect(text).toContain("bug_fix");
  });
});
