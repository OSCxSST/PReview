import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/index.ts"],
      // thresholds enabled once github-action tests are added (Phase 2)
      // thresholds: { lines: 85, functions: 85, branches: 85, statements: 85 },
    },
  },
});
