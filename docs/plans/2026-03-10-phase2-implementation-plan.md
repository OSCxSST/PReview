# Phase 2: Core Intelligence Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the intelligence pipeline that extracts intent from PRs, generates embeddings, detects duplicates, clusters related PRs, and dispatches GitHub actions.

**Architecture:** Event-driven BullMQ worker chain — each stage is a separate worker passing jobs to the next. Core intelligence logic lives in `packages/core`, orchestration in `packages/api/src/workers/`.

**Tech Stack:** Anthropic SDK (Claude Haiku 4.5 for intent, Sonnet 4.5 for judge), OpenAI SDK (text-embedding-3-large), pgvector HNSW, BullMQ, Drizzle ORM.

---

### Task 1: Add SDK Dependencies

**Files:**
- Modify: `packages/core/package.json`
- Modify: `pnpm-lock.yaml` (auto-generated)

**Step 1: Install Anthropic and OpenAI SDKs in core**

Run:
```bash
cd packages/core && pnpm add @anthropic-ai/sdk openai
```

**Step 2: Verify install**

Run: `pnpm turbo run build --filter=@preview/core`
Expected: BUILD SUCCESS

**Step 3: Commit**

```bash
git add packages/core/package.json pnpm-lock.yaml
git commit -m "feat: add Anthropic and OpenAI SDK dependencies to core"
```

---

### Task 2: Anthropic Client

**Files:**
- Create: `packages/core/src/llm/anthropic-client.ts`
- Create: `packages/core/src/__tests__/llm/anthropic-client.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/core/src/__tests__/llm/anthropic-client.test.ts
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
    const { getAnthropicClient } = await import(
      "../../llm/anthropic-client.js"
    );
    expect(() => getAnthropicClient()).toThrow(
      "ANTHROPIC_API_KEY environment variable is required",
    );
  });

  it("returns an Anthropic client when key is set", async () => {
    const { getAnthropicClient } = await import(
      "../../llm/anthropic-client.js"
    );
    const client = getAnthropicClient();
    expect(client).toBeDefined();
    expect(client.messages).toBeDefined();
  });

  it("returns the same instance on subsequent calls", async () => {
    const { getAnthropicClient } = await import(
      "../../llm/anthropic-client.js"
    );
    const a = getAnthropicClient();
    const b = getAnthropicClient();
    expect(a).toBe(b);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm vitest run src/__tests__/llm/anthropic-client.test.ts`
Expected: FAIL — cannot find module

**Step 3: Write minimal implementation**

```typescript
// packages/core/src/llm/anthropic-client.ts
import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (client) return client;

  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is required");
  }

  client = new Anthropic({ apiKey });
  return client;
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm vitest run src/__tests__/llm/anthropic-client.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add packages/core/src/llm/anthropic-client.ts packages/core/src/__tests__/llm/anthropic-client.test.ts
git commit -m "feat: add Anthropic client singleton with env validation"
```

---

### Task 3: OpenAI Client

**Files:**
- Create: `packages/core/src/llm/openai-client.ts`
- Create: `packages/core/src/__tests__/llm/openai-client.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/core/src/__tests__/llm/openai-client.test.ts
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
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm vitest run src/__tests__/llm/openai-client.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// packages/core/src/llm/openai-client.ts
import OpenAI from "openai";

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (client) return client;

  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }

  client = new OpenAI({ apiKey });
  return client;
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm vitest run src/__tests__/llm/openai-client.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add packages/core/src/llm/openai-client.ts packages/core/src/__tests__/llm/openai-client.test.ts
git commit -m "feat: add OpenAI client singleton with env validation"
```

---

### Task 4: Intent Extraction Prompts

**Files:**
- Create: `packages/core/src/intent/prompts.ts`
- Create: `packages/core/src/__tests__/intent/prompts.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/core/src/__tests__/intent/prompts.test.ts
import { describe, it, expect } from "vitest";
import {
  buildIntentExtractionPrompt,
  buildDiffFallbackPrompt,
  INTENT_SYSTEM_PROMPT,
} from "../../intent/prompts.js";

describe("intent prompts", () => {
  it("builds extraction prompt from PR title, body, and files", () => {
    const prompt = buildIntentExtractionPrompt({
      title: "Fix login bug",
      body: "The login page crashes when email is empty",
      filesChanged: ["src/auth/login.ts", "src/auth/validate.ts"],
    });

    expect(prompt).toContain("Fix login bug");
    expect(prompt).toContain("login page crashes");
    expect(prompt).toContain("src/auth/login.ts");
  });

  it("handles null body gracefully", () => {
    const prompt = buildIntentExtractionPrompt({
      title: "Update deps",
      body: null,
      filesChanged: ["package.json"],
    });

    expect(prompt).toContain("Update deps");
    expect(prompt).not.toContain("null");
  });

  it("builds diff fallback prompt", () => {
    const prompt = buildDiffFallbackPrompt({
      title: "Fix bug",
      diff: "@@ -1,3 +1,4 @@\n+const x = 1;",
    });

    expect(prompt).toContain("Fix bug");
    expect(prompt).toContain("const x = 1");
  });

  it("exports a system prompt string", () => {
    expect(INTENT_SYSTEM_PROMPT).toBeDefined();
    expect(typeof INTENT_SYSTEM_PROMPT).toBe("string");
    expect(INTENT_SYSTEM_PROMPT.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm vitest run src/__tests__/intent/prompts.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// packages/core/src/intent/prompts.ts
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
```

**Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm vitest run src/__tests__/intent/prompts.test.ts`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add packages/core/src/intent/prompts.ts packages/core/src/__tests__/intent/prompts.test.ts
git commit -m "feat: add intent extraction prompt templates"
```

---

### Task 5: Intent Extraction Service

**Files:**
- Create: `packages/core/src/intent/extract.ts`
- Create: `packages/core/src/__tests__/intent/extract.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/core/src/__tests__/intent/extract.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { IntentSummary } from "../../types.js";

// Mock the Anthropic client
vi.mock("../../llm/anthropic-client.js", () => ({
  getAnthropicClient: vi.fn(),
}));

describe("extractIntent", () => {
  const mockCreate = vi.fn();

  beforeEach(() => {
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

  it("flags low-quality descriptions", async () => {
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
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm vitest run src/__tests__/intent/extract.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// packages/core/src/intent/extract.ts
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

function isLowQualityDescription(body: string | null): boolean {
  if (!body || body.trim().length === 0) return true;
  if (body.trim().length < 20) return true;

  const genericPatterns = [
    /^#+\s*(description|summary|changes)/im,
    /no description provided/i,
    /\[describe your changes\]/i,
    /<!-- .* -->/s,
  ];

  const stripped = body.replace(/<!-- .*? -->/gs, "").trim();
  if (stripped.length < 20) return true;

  return genericPatterns.some((p) => p.test(stripped));
}

function parseIntentResponse(text: string): IntentSummary {
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

  const userPrompt = useDiffFallback && input.diff
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

export { isLowQualityDescription, parseIntentResponse };
```

**Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm vitest run src/__tests__/intent/extract.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add packages/core/src/intent/extract.ts packages/core/src/__tests__/intent/extract.test.ts
git commit -m "feat: add intent extraction service with diff fallback"
```

---

### Task 6: Embedding Generation Service

**Files:**
- Create: `packages/core/src/embedding/generate.ts`
- Create: `packages/core/src/__tests__/embedding/generate.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/core/src/__tests__/embedding/generate.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EMBEDDING_DIMENSIONS } from "../../constants.js";

vi.mock("../../llm/openai-client.js", () => ({
  getOpenAIClient: vi.fn(),
}));

describe("generateEmbedding", () => {
  const mockCreate = vi.fn();

  beforeEach(() => {
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
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm vitest run src/__tests__/embedding/generate.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// packages/core/src/embedding/generate.ts
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

  return response.data[0]!.embedding;
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm vitest run src/__tests__/embedding/generate.test.ts`
Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add packages/core/src/embedding/generate.ts packages/core/src/__tests__/embedding/generate.test.ts
git commit -m "feat: add embedding generation service with OpenAI"
```

---

### Task 7: Similarity Search Service

**Files:**
- Create: `packages/core/src/dedup/similarity.ts`
- Create: `packages/core/src/__tests__/dedup/similarity.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/core/src/__tests__/dedup/similarity.test.ts
import { describe, it, expect } from "vitest";
import {
  classifySimilarity,
  type SimilarityBand,
} from "../../dedup/similarity.js";
import { DEFAULT_THRESHOLDS } from "../../constants.js";

describe("classifySimilarity", () => {
  it("classifies high confidence duplicates", () => {
    expect(classifySimilarity(0.95)).toBe("high_confidence");
    expect(classifySimilarity(0.92)).toBe("high_confidence");
  });

  it("classifies probable duplicates", () => {
    expect(classifySimilarity(0.85)).toBe("probable");
    expect(classifySimilarity(0.80)).toBe("probable");
  });

  it("classifies related items", () => {
    expect(classifySimilarity(0.70)).toBe("related");
    expect(classifySimilarity(0.65)).toBe("related");
  });

  it("classifies distinct items", () => {
    expect(classifySimilarity(0.5)).toBe("distinct");
    expect(classifySimilarity(0.0)).toBe("distinct");
  });

  it("respects custom thresholds", () => {
    const custom = {
      highConfidenceDuplicate: 0.95,
      probableDuplicate: 0.85,
      related: 0.70,
    };
    expect(classifySimilarity(0.93, custom)).toBe("probable");
    expect(classifySimilarity(0.95, custom)).toBe("high_confidence");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm vitest run src/__tests__/dedup/similarity.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// packages/core/src/dedup/similarity.ts
import { DEFAULT_THRESHOLDS } from "../constants.js";

export type SimilarityBand =
  | "high_confidence"
  | "probable"
  | "related"
  | "distinct";

export interface SimilarityThresholds {
  highConfidenceDuplicate: number;
  probableDuplicate: number;
  related: number;
}

export interface SimilarCandidate {
  prId: string;
  githubNumber: number;
  title: string;
  similarity: number;
  band: SimilarityBand;
}

export function classifySimilarity(
  score: number,
  thresholds: SimilarityThresholds = DEFAULT_THRESHOLDS,
): SimilarityBand {
  if (score >= thresholds.highConfidenceDuplicate) return "high_confidence";
  if (score >= thresholds.probableDuplicate) return "probable";
  if (score >= thresholds.related) return "related";
  return "distinct";
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm vitest run src/__tests__/dedup/similarity.test.ts`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add packages/core/src/dedup/similarity.ts packages/core/src/__tests__/dedup/similarity.test.ts
git commit -m "feat: add similarity classification with configurable thresholds"
```

---

### Task 8: LLM Judge Prompts and Service

**Files:**
- Create: `packages/core/src/dedup/judge-prompts.ts`
- Create: `packages/core/src/dedup/judge.ts`
- Create: `packages/core/src/__tests__/dedup/judge.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/core/src/__tests__/dedup/judge.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../llm/anthropic-client.js", () => ({
  getAnthropicClient: vi.fn(),
}));

describe("judgeDuplicate", () => {
  const mockCreate = vi.fn();

  beforeEach(() => {
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
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm vitest run src/__tests__/dedup/judge.test.ts`
Expected: FAIL

**Step 3: Write judge prompts**

```typescript
// packages/core/src/dedup/judge-prompts.ts
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

export function buildJudgePrompt(
  prA: JudgePRInput,
  prB: JudgePRInput,
): string {
  const formatPR = (pr: JudgePRInput) => {
    const parts = [
      `Title: ${pr.title}`,
      `Description: ${pr.body ?? "(none)"}`,
    ];
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
```

**Step 4: Write judge service**

```typescript
// packages/core/src/dedup/judge.ts
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
```

**Step 5: Run test to verify it passes**

Run: `cd packages/core && pnpm vitest run src/__tests__/dedup/judge.test.ts`
Expected: PASS (3 tests)

**Step 6: Commit**

```bash
git add packages/core/src/dedup/judge-prompts.ts packages/core/src/dedup/judge.ts packages/core/src/__tests__/dedup/judge.test.ts
git commit -m "feat: add LLM judge for duplicate confirmation"
```

---

### Task 9: Cluster Manager Service

**Files:**
- Create: `packages/core/src/cluster/manager.ts`
- Create: `packages/core/src/__tests__/cluster/manager.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/core/src/__tests__/cluster/manager.test.ts
import { describe, it, expect } from "vitest";
import { shouldAutoMerge, buildClusterSummary } from "../../cluster/manager.js";
import { CLUSTER_AUTO_MERGE_MAX_MEMBERS } from "../../constants.js";

describe("shouldAutoMerge", () => {
  it("returns true when both clusters are small", () => {
    expect(shouldAutoMerge(2, 3)).toBe(true);
    expect(shouldAutoMerge(1, 1)).toBe(true);
  });

  it("returns false when combined exceeds max", () => {
    expect(shouldAutoMerge(3, 3)).toBe(false);
    expect(shouldAutoMerge(5, 1)).toBe(false);
  });

  it("uses CLUSTER_AUTO_MERGE_MAX_MEMBERS as limit", () => {
    expect(shouldAutoMerge(CLUSTER_AUTO_MERGE_MAX_MEMBERS, 0)).toBe(true);
    expect(shouldAutoMerge(CLUSTER_AUTO_MERGE_MAX_MEMBERS, 1)).toBe(false);
  });
});

describe("buildClusterSummary", () => {
  it("builds a summary from member titles", () => {
    const summary = buildClusterSummary([
      "Fix login crash",
      "Fix auth null pointer",
      "Handle empty email in login",
    ]);

    expect(summary).toBeDefined();
    expect(typeof summary).toBe("string");
    expect(summary.length).toBeGreaterThan(0);
  });

  it("handles single member", () => {
    const summary = buildClusterSummary(["Fix login crash"]);
    expect(summary).toContain("Fix login crash");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm vitest run src/__tests__/cluster/manager.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// packages/core/src/cluster/manager.ts
import { CLUSTER_AUTO_MERGE_MAX_MEMBERS } from "../constants.js";

export function shouldAutoMerge(
  clusterASize: number,
  clusterBSize: number,
): boolean {
  return clusterASize + clusterBSize <= CLUSTER_AUTO_MERGE_MAX_MEMBERS;
}

export function buildClusterSummary(memberTitles: string[]): string {
  if (memberTitles.length === 1) {
    return memberTitles[0]!;
  }

  return `Group of ${memberTitles.length} related PRs: ${memberTitles.join(", ")}`;
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm vitest run src/__tests__/cluster/manager.test.ts`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add packages/core/src/cluster/manager.ts packages/core/src/__tests__/cluster/manager.test.ts
git commit -m "feat: add cluster manager with auto-merge logic"
```

---

### Task 10: Export Core Intelligence Modules

**Files:**
- Modify: `packages/core/src/index.ts`

**Step 1: Update exports**

Add to `packages/core/src/index.ts`:

```typescript
export * from "./llm/anthropic-client.js";
export * from "./llm/openai-client.js";
export * from "./intent/extract.js";
export * from "./intent/prompts.js";
export * from "./embedding/generate.js";
export * from "./dedup/similarity.js";
export * from "./dedup/judge.js";
export * from "./dedup/judge-prompts.js";
export * from "./cluster/manager.js";
```

**Step 2: Verify build**

Run: `pnpm turbo run build --filter=@preview/core`
Expected: BUILD SUCCESS

**Step 3: Run all core tests**

Run: `cd packages/core && pnpm vitest run`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "feat: export all core intelligence modules"
```

---

### Task 11: Add New BullMQ Queues

**Files:**
- Modify: `packages/api/src/queue/queues.ts`

**Step 1: Add queue names and create queues**

Add to `QUEUE_NAMES`:
```typescript
INTENT_EXTRACTION: "intent-extraction",
EMBEDDING: "embedding",
DEDUP: "dedup",
ACTION_DISPATCH: "action-dispatch",
```

Add to `initQueues()`:
```typescript
map.set(
  QUEUE_NAMES.INTENT_EXTRACTION,
  createQueue(QUEUE_NAMES.INTENT_EXTRACTION, DEFAULT_JOB_OPTIONS),
);
map.set(
  QUEUE_NAMES.EMBEDDING,
  createQueue(QUEUE_NAMES.EMBEDDING, DEFAULT_JOB_OPTIONS),
);
map.set(
  QUEUE_NAMES.DEDUP,
  createQueue(QUEUE_NAMES.DEDUP, DEFAULT_JOB_OPTIONS),
);
map.set(
  QUEUE_NAMES.ACTION_DISPATCH,
  createQueue(QUEUE_NAMES.ACTION_DISPATCH, DEFAULT_JOB_OPTIONS),
);
```

**Step 2: Verify build**

Run: `pnpm turbo run build --filter=@preview/api`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add packages/api/src/queue/queues.ts
git commit -m "feat: add Phase 2 BullMQ queues for intelligence pipeline"
```

---

### Task 12: Add Job Data Types for New Workers

**Files:**
- Modify: `packages/api/src/workers/types.ts`

**Step 1: Add new job data interfaces**

Append to `types.ts`:

```typescript
export interface IntentExtractionJobData {
  prId: string;
  repoId: string;
  installationId: number;
  repoFullName: string;
}

export interface EmbeddingJobData {
  prId: string;
  repoId: string;
}

export interface DedupJobData {
  prId: string;
  repoId: string;
  installationId: number;
  repoFullName: string;
}

export interface ActionDispatchJobData {
  repoId: string;
  installationId: number;
  repoFullName: string;
  targetType: "pr" | "issue";
  targetNumber: number;
  actionType: "comment" | "label" | "close" | "cluster_assign";
  payload: Record<string, unknown>;
}
```

**Step 2: Verify build**

Run: `pnpm turbo run build --filter=@preview/api`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add packages/api/src/workers/types.ts
git commit -m "feat: add job data types for Phase 2 workers"
```

---

### Task 13: Intent Extraction Worker

**Files:**
- Create: `packages/api/src/workers/intent-extraction.worker.ts`

**Step 1: Write the worker**

```typescript
// packages/api/src/workers/intent-extraction.worker.ts
import { Worker, type Job } from "bullmq";
import { getDb, pullRequests } from "@preview/db";
import { eq } from "drizzle-orm";
import { extractIntent } from "@preview/core";
import { getInstallationOctokit } from "../github/index.js";
import { getRedisUrl } from "../queue/connection.js";
import { getQueue, QUEUE_NAMES } from "../queue/queues.js";
import type { IntentExtractionJobData, EmbeddingJobData } from "./types.js";

async function processIntentExtraction(
  job: Job<IntentExtractionJobData>,
): Promise<void> {
  const { prId, repoId, installationId, repoFullName } = job.data;
  const db = getDb();

  // Fetch the PR from database
  const [pr] = await db
    .select()
    .from(pullRequests)
    .where(eq(pullRequests.id, prId))
    .limit(1);

  if (!pr) {
    job.log(`PR ${prId} not found in database`);
    return;
  }

  // Optionally fetch diff for low-quality descriptions
  let diff: string | undefined;
  const [owner = "", repoName = ""] = repoFullName.split("/");

  try {
    const octokit = await getInstallationOctokit(installationId);
    const { data } = await octokit.request(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}",
      {
        owner,
        repo: repoName,
        pull_number: pr.githubNumber,
        mediaType: { format: "diff" },
      },
    );
    diff = data as unknown as string;
  } catch (err) {
    job.log(`Failed to fetch diff, proceeding without: ${String(err)}`);
  }

  // Extract intent
  const result = await extractIntent({
    title: pr.title,
    body: pr.body,
    filesChanged: pr.filesChanged ?? [],
    diff,
  });

  job.log(
    `Extracted intent for PR #${pr.githubNumber}: category=${result.intent.category}, usedDiff=${result.usedDiffFallback}`,
  );

  // Update PR with intent summary
  await db
    .update(pullRequests)
    .set({
      intentSummary: result.intent,
      qualityScore: result.usedDiffFallback ? 0.3 : 0.8,
      analyzedAt: new Date(),
    })
    .where(eq(pullRequests.id, prId));

  // Enqueue embedding generation
  const embeddingQueue = getQueue(QUEUE_NAMES.EMBEDDING);
  const embeddingData: EmbeddingJobData = { prId, repoId };
  await embeddingQueue.add(`embed.${pr.githubNumber}`, embeddingData);

  job.log(`Enqueued embedding generation for PR #${pr.githubNumber}`);
}

export function createIntentExtractionWorker(): Worker {
  return new Worker(QUEUE_NAMES.INTENT_EXTRACTION, processIntentExtraction, {
    connection: { url: getRedisUrl() },
    concurrency: 3,
  });
}
```

**Step 2: Verify build**

Run: `pnpm turbo run build --filter=@preview/api`
Expected: SUCCESS (may need to check drizzle-orm `eq` import)

**Step 3: Commit**

```bash
git add packages/api/src/workers/intent-extraction.worker.ts
git commit -m "feat: add intent extraction worker"
```

---

### Task 14: Embedding Worker

**Files:**
- Create: `packages/api/src/workers/embedding.worker.ts`

**Step 1: Write the worker**

```typescript
// packages/api/src/workers/embedding.worker.ts
import { Worker, type Job } from "bullmq";
import { getDb, pullRequests } from "@preview/db";
import { eq } from "drizzle-orm";
import { generateEmbedding, buildEmbeddingText } from "@preview/core";
import type { IntentSummary } from "@preview/core";
import { getRedisUrl } from "../queue/connection.js";
import { getQueue, QUEUE_NAMES } from "../queue/queues.js";
import type { EmbeddingJobData, DedupJobData } from "./types.js";

async function processEmbedding(
  job: Job<EmbeddingJobData>,
): Promise<void> {
  const { prId, repoId } = job.data;
  const db = getDb();

  const [pr] = await db
    .select()
    .from(pullRequests)
    .where(eq(pullRequests.id, prId))
    .limit(1);

  if (!pr) {
    job.log(`PR ${prId} not found`);
    return;
  }

  if (!pr.intentSummary) {
    job.log(`PR ${prId} has no intent summary, skipping embedding`);
    return;
  }

  const intent = pr.intentSummary as unknown as IntentSummary;
  const text = buildEmbeddingText(intent);
  const embedding = await generateEmbedding(text);

  job.log(`Generated ${embedding.length}-dim embedding for PR #${pr.githubNumber}`);

  // Update PR with embedding
  await db
    .update(pullRequests)
    .set({ embedding })
    .where(eq(pullRequests.id, prId));

  // Enqueue dedup — need installationId and repoFullName from repository
  // The dedup worker will look these up from the repo record
  const dedupQueue = getQueue(QUEUE_NAMES.DEDUP);
  const dedupData: DedupJobData = {
    prId,
    repoId,
    installationId: 0, // Looked up by dedup worker from repo
    repoFullName: "",   // Looked up by dedup worker from repo
  };
  await dedupQueue.add(`dedup.${pr.githubNumber}`, dedupData);

  job.log(`Enqueued dedup for PR #${pr.githubNumber}`);
}

export function createEmbeddingWorker(): Worker {
  return new Worker(QUEUE_NAMES.EMBEDDING, processEmbedding, {
    connection: { url: getRedisUrl() },
    concurrency: 5,
  });
}
```

**Step 2: Verify build**

Run: `pnpm turbo run build --filter=@preview/api`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add packages/api/src/workers/embedding.worker.ts
git commit -m "feat: add embedding generation worker"
```

---

### Task 15: Dedup Worker

**Files:**
- Create: `packages/api/src/workers/dedup.worker.ts`

**Step 1: Write the worker**

This worker queries pgvector for similar PRs, runs the LLM judge on candidates, and creates/updates clusters. It then enqueues action dispatch jobs.

```typescript
// packages/api/src/workers/dedup.worker.ts
import { Worker, type Job } from "bullmq";
import { getDb, pullRequests, clusters, clusterMembers } from "@preview/db";
import { eq, and, ne, isNotNull, sql } from "drizzle-orm";
import {
  classifySimilarity,
  judgeDuplicate,
  shouldAutoMerge,
  buildClusterSummary,
  DEFAULT_THRESHOLDS,
  type SimilarCandidate,
} from "@preview/core";
import type { IntentSummary } from "@preview/core";
import { getRedisUrl } from "../queue/connection.js";
import { getQueue, QUEUE_NAMES } from "../queue/queues.js";
import type { DedupJobData, ActionDispatchJobData } from "./types.js";

const TOP_K = 10;

async function processDedup(job: Job<DedupJobData>): Promise<void> {
  const { prId, repoId, installationId, repoFullName } = job.data;
  const db = getDb();

  // Fetch the current PR
  const [pr] = await db
    .select()
    .from(pullRequests)
    .where(eq(pullRequests.id, prId))
    .limit(1);

  if (!pr || !pr.embedding) {
    job.log(`PR ${prId} not found or has no embedding`);
    return;
  }

  // ANN search: find top-k similar PRs in the same repo
  const embeddingStr = `[${(pr.embedding as number[]).join(",")}]`;
  const similar = await db
    .select({
      id: pullRequests.id,
      githubNumber: pullRequests.githubNumber,
      title: pullRequests.title,
      body: pullRequests.body,
      intentSummary: pullRequests.intentSummary,
      similarity: sql<number>`1 - (${pullRequests.embedding} <=> ${embeddingStr}::vector)`.as("similarity"),
    })
    .from(pullRequests)
    .where(
      and(
        eq(pullRequests.repoId, repoId),
        ne(pullRequests.id, prId),
        isNotNull(pullRequests.embedding),
      ),
    )
    .orderBy(sql`${pullRequests.embedding} <=> ${embeddingStr}::vector`)
    .limit(TOP_K);

  const candidates: SimilarCandidate[] = similar
    .filter((s) => s.similarity >= DEFAULT_THRESHOLDS.related)
    .map((s) => ({
      prId: s.id,
      githubNumber: s.githubNumber,
      title: s.title,
      similarity: s.similarity,
      band: classifySimilarity(s.similarity),
    }));

  if (candidates.length === 0) {
    job.log(`No similar PRs found for PR #${pr.githubNumber}`);
    return;
  }

  job.log(
    `Found ${candidates.length} candidates for PR #${pr.githubNumber}: ${candidates.map((c) => `#${c.githubNumber} (${c.similarity.toFixed(3)})`).join(", ")}`,
  );

  const actionQueue = getQueue(QUEUE_NAMES.ACTION_DISPATCH);

  // Run LLM judge on each candidate
  for (const candidate of candidates) {
    const matchedPR = similar.find((s) => s.id === candidate.prId);
    if (!matchedPR) continue;

    const judgeResult = await judgeDuplicate(
      {
        githubNumber: pr.githubNumber,
        title: pr.title,
        body: pr.body,
        intentSummary: pr.intentSummary as unknown as IntentSummary | null,
      },
      {
        githubNumber: matchedPR.githubNumber,
        title: matchedPR.title,
        body: matchedPR.body,
        intentSummary: matchedPR.intentSummary as unknown as IntentSummary | null,
      },
    );

    job.log(
      `Judge: PR #${pr.githubNumber} vs #${matchedPR.githubNumber}: isDuplicate=${judgeResult.isDuplicate}, confidence=${judgeResult.confidence}`,
    );

    if (judgeResult.isDuplicate && candidate.band === "high_confidence") {
      // Create or find cluster
      const existingMembership = await db
        .select({ clusterId: clusterMembers.clusterId })
        .from(clusterMembers)
        .where(eq(clusterMembers.itemId, candidate.prId))
        .limit(1);

      let clusterId: string;

      if (existingMembership.length > 0) {
        clusterId = existingMembership[0]!.clusterId;

        // Add current PR to existing cluster
        await db.insert(clusterMembers).values({
          clusterId,
          itemType: "pr",
          itemId: prId,
          rank: null,
          similarity: candidate.similarity,
        });
      } else {
        // Create new cluster with both PRs
        const [newCluster] = await db
          .insert(clusters)
          .values({
            repoId,
            clusterType: "pr",
            summary: buildClusterSummary([pr.title, matchedPR.title]),
            status: "open",
          })
          .returning({ id: clusters.id });

        clusterId = newCluster!.id;

        await db.insert(clusterMembers).values([
          {
            clusterId,
            itemType: "pr",
            itemId: prId,
            rank: judgeResult.preferredPR === pr.githubNumber ? 1 : 2,
            similarity: 1.0,
          },
          {
            clusterId,
            itemType: "pr",
            itemId: candidate.prId,
            rank: judgeResult.preferredPR === matchedPR.githubNumber ? 1 : 2,
            similarity: candidate.similarity,
          },
        ]);
      }

      // Dispatch actions: comment + label
      const commentAction: ActionDispatchJobData = {
        repoId,
        installationId,
        repoFullName,
        targetType: "pr",
        targetNumber: pr.githubNumber,
        actionType: "comment",
        payload: {
          duplicateOf: matchedPR.githubNumber,
          similarity: candidate.similarity,
          reasoning: judgeResult.reasoning,
          clusterId,
        },
      };

      const labelAction: ActionDispatchJobData = {
        repoId,
        installationId,
        repoFullName,
        targetType: "pr",
        targetNumber: pr.githubNumber,
        actionType: "label",
        payload: { label: "duplicate-candidate" },
      };

      await actionQueue.add(`comment.${pr.githubNumber}`, commentAction);
      await actionQueue.add(`label.${pr.githubNumber}`, labelAction);

    } else if (candidate.band === "probable") {
      // Comment suggesting review
      const commentAction: ActionDispatchJobData = {
        repoId,
        installationId,
        repoFullName,
        targetType: "pr",
        targetNumber: pr.githubNumber,
        actionType: "comment",
        payload: {
          relatedTo: matchedPR.githubNumber,
          similarity: candidate.similarity,
          reasoning: judgeResult.reasoning,
          band: "probable",
        },
      };

      await actionQueue.add(`comment.probable.${pr.githubNumber}`, commentAction);

    } else if (candidate.band === "related") {
      // Cross-reference comment only
      const commentAction: ActionDispatchJobData = {
        repoId,
        installationId,
        repoFullName,
        targetType: "pr",
        targetNumber: pr.githubNumber,
        actionType: "comment",
        payload: {
          relatedTo: matchedPR.githubNumber,
          similarity: candidate.similarity,
          band: "related",
        },
      };

      await actionQueue.add(`comment.related.${pr.githubNumber}`, commentAction);
    }
  }
}

export function createDedupWorker(): Worker {
  return new Worker(QUEUE_NAMES.DEDUP, processDedup, {
    connection: { url: getRedisUrl() },
    concurrency: 2,
  });
}
```

**Step 2: Verify build**

Run: `pnpm turbo run build --filter=@preview/api`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add packages/api/src/workers/dedup.worker.ts
git commit -m "feat: add dedup worker with ANN search and LLM judge"
```

---

### Task 16: Action Dispatch Worker

**Files:**
- Create: `packages/api/src/workers/action-dispatch.worker.ts`

**Step 1: Write the worker**

```typescript
// packages/api/src/workers/action-dispatch.worker.ts
import { Worker, type Job } from "bullmq";
import { getDb, actionsLog } from "@preview/db";
import { getInstallationOctokit } from "../github/index.js";
import { getRedisUrl } from "../queue/connection.js";
import { QUEUE_NAMES } from "../queue/queues.js";
import type { ActionDispatchJobData } from "./types.js";

function buildDuplicateComment(payload: Record<string, unknown>): string {
  const similarity = ((payload["similarity"] as number) * 100).toFixed(1);
  const reasoning = payload["reasoning"] as string;
  const duplicateOf = payload["duplicateOf"] as number;

  return [
    `## 🔍 PReview: Potential Duplicate Detected`,
    "",
    `This PR appears to be a duplicate of #${duplicateOf} (${similarity}% similar).`,
    "",
    `**Analysis:** ${reasoning}`,
    "",
    `_This analysis was performed automatically by [PReview](https://github.com/apps/preview-bot)._`,
  ].join("\n");
}

function buildProbableComment(payload: Record<string, unknown>): string {
  const similarity = ((payload["similarity"] as number) * 100).toFixed(1);
  const relatedTo = payload["relatedTo"] as number;
  const reasoning = payload["reasoning"] as string | undefined;

  return [
    `## 🔗 PReview: Related PR Detected`,
    "",
    `This PR may be related to #${relatedTo} (${similarity}% similar).`,
    reasoning ? `\n**Analysis:** ${reasoning}` : "",
    "",
    `Please review for potential overlap.`,
    "",
    `_This analysis was performed automatically by [PReview](https://github.com/apps/preview-bot)._`,
  ].join("\n");
}

function buildRelatedComment(payload: Record<string, unknown>): string {
  const similarity = ((payload["similarity"] as number) * 100).toFixed(1);
  const relatedTo = payload["relatedTo"] as number;

  return [
    `## 📌 PReview: Cross-Reference`,
    "",
    `This PR may be related to #${relatedTo} (${similarity}% similar). You might want to check it for context.`,
    "",
    `_This analysis was performed automatically by [PReview](https://github.com/apps/preview-bot)._`,
  ].join("\n");
}

async function processActionDispatch(
  job: Job<ActionDispatchJobData>,
): Promise<void> {
  const { repoId, installationId, repoFullName, targetType, targetNumber, actionType, payload } =
    job.data;

  const [owner = "", repoName = ""] = repoFullName.split("/");
  const octokit = await getInstallationOctokit(installationId);
  const db = getDb();

  if (actionType === "comment") {
    const band = (payload["band"] as string) ?? "high_confidence";

    let body: string;
    if (payload["duplicateOf"]) {
      body = buildDuplicateComment(payload);
    } else if (band === "probable") {
      body = buildProbableComment(payload);
    } else {
      body = buildRelatedComment(payload);
    }

    await octokit.request(
      "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
      { owner, repo: repoName, issue_number: targetNumber, body },
    );

    job.log(`Posted ${band} comment on ${targetType} #${targetNumber}`);
  } else if (actionType === "label") {
    const label = payload["label"] as string;

    try {
      await octokit.request(
        "POST /repos/{owner}/{repo}/issues/{issue_number}/labels",
        { owner, repo: repoName, issue_number: targetNumber, labels: [label] },
      );
      job.log(`Applied label "${label}" to ${targetType} #${targetNumber}`);
    } catch (err) {
      job.log(`Failed to apply label: ${String(err)}`);
    }
  }

  // Log action to database
  await db.insert(actionsLog).values({
    repoId,
    targetType,
    targetNumber,
    actionType,
    payload,
  });

  job.log(`Logged action to actionsLog: ${actionType} on #${targetNumber}`);
}

export function createActionDispatchWorker(): Worker {
  return new Worker(QUEUE_NAMES.ACTION_DISPATCH, processActionDispatch, {
    connection: { url: getRedisUrl() },
    concurrency: 3,
  });
}
```

**Step 2: Verify build**

Run: `pnpm turbo run build --filter=@preview/api`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add packages/api/src/workers/action-dispatch.worker.ts
git commit -m "feat: add action dispatch worker for GitHub comments and labels"
```

---

### Task 17: Register New Workers

**Files:**
- Modify: `packages/api/src/workers/index.ts`

**Step 1: Add new worker imports and registration**

Add imports:
```typescript
import { createIntentExtractionWorker } from "./intent-extraction.worker.js";
import { createEmbeddingWorker } from "./embedding.worker.js";
import { createDedupWorker } from "./dedup.worker.js";
import { createActionDispatchWorker } from "./action-dispatch.worker.js";
```

Add to the `workers` array in `startWorkers()`:
```typescript
workers = [
  createPRIngestionWorker(),
  createIssueIngestionWorker(),
  createBatchSyncWorker(),
  createIntentExtractionWorker(),
  createEmbeddingWorker(),
  createDedupWorker(),
  createActionDispatchWorker(),
];
```

**Step 2: Verify build**

Run: `pnpm turbo run build --filter=@preview/api`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add packages/api/src/workers/index.ts
git commit -m "feat: register Phase 2 workers in worker index"
```

---

### Task 18: Wire PR Ingestion to Intent Extraction

**Files:**
- Modify: `packages/api/src/workers/pr-ingestion.worker.ts`

**Step 1: Add trigger after PR upsert**

After the existing `job.log("Upserted PR...")` line, add:

```typescript
// Trigger intent extraction pipeline
const intentQueue = getQueue(QUEUE_NAMES.INTENT_EXTRACTION);
const [upsertedPR] = await db
  .select({ id: pullRequests.id })
  .from(pullRequests)
  .where(eq(pullRequests.githubId, ghPR.id))
  .limit(1);

if (upsertedPR) {
  await intentQueue.add(`intent.${ghPR.number}`, {
    prId: upsertedPR.id,
    repoId: repo.id,
    installationId: installation.id,
    repoFullName: ghRepo.full_name,
  });
  job.log(`Enqueued intent extraction for PR #${ghPR.number}`);
}
```

Also add the import for `eq` from `drizzle-orm` and `getQueue, QUEUE_NAMES` if not already present.

**Step 2: Verify build**

Run: `pnpm turbo run build --filter=@preview/api`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add packages/api/src/workers/pr-ingestion.worker.ts
git commit -m "feat: wire PR ingestion to intent extraction pipeline"
```

---

### Task 19: Update Docker Compose Environment

**Files:**
- Modify: `docker/docker-compose.yml`

**Step 1: Add API keys to env documentation**

Add a comment near the api service noting the new required env vars:
```yaml
# Required env vars (in ../.env):
# ANTHROPIC_API_KEY - for intent extraction (Claude Haiku) and judge (Claude Sonnet)
# OPENAI_API_KEY - for embedding generation (text-embedding-3-large)
```

**Step 2: Commit**

```bash
git add docker/docker-compose.yml
git commit -m "docs: document Phase 2 API key env vars in docker-compose"
```

---

### Task 20: Full Pipeline Verification

**Step 1: Run lint**

Run: `pnpm turbo run lint`
Expected: PASS

**Step 2: Run format check**

Run: `pnpm turbo run format:check`
Expected: PASS (if not, run `pnpm format` first)

**Step 3: Run typecheck**

Run: `pnpm turbo run typecheck`
Expected: PASS

**Step 4: Run all tests**

Run: `pnpm turbo run test`
Expected: ALL PASS

**Step 5: Commit any fixes, then create PR**

```bash
git push -u origin feat/phase2-core-intelligence
gh pr create --title "Phase 2: Core Intelligence pipeline" --body "..."
```
