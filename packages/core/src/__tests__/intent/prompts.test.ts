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
