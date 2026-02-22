import { describe, it, expect } from "vitest";
import { normalizeRankingWeights, validateStalenessConfig } from "../config.js";
import { DEFAULT_RANKING_WEIGHTS, DEFAULT_STALENESS } from "../constants.js";

describe("normalizeRankingWeights", () => {
  it("returns defaults when called with no input", () => {
    const { weights, wasNormalized } = normalizeRankingWeights();
    expect(wasNormalized).toBe(false);
    expect(weights.codeQuality).toBe(DEFAULT_RANKING_WEIGHTS.codeQuality);
    expect(weights.testCoverage).toBe(DEFAULT_RANKING_WEIGHTS.testCoverage);
  });

  it("returns defaults when called with undefined", () => {
    const { weights, wasNormalized } = normalizeRankingWeights(undefined);
    expect(wasNormalized).toBe(false);
    expect(weights).toEqual(DEFAULT_RANKING_WEIGHTS);
  });

  it("returns defaults when called with empty object", () => {
    const { weights, wasNormalized } = normalizeRankingWeights({});
    expect(wasNormalized).toBe(false);
    expect(weights).toEqual(DEFAULT_RANKING_WEIGHTS);
  });

  it("does not normalize weights that already sum to 1.0", () => {
    const input = { ...DEFAULT_RANKING_WEIGHTS };
    const { wasNormalized } = normalizeRankingWeights(input);
    expect(wasNormalized).toBe(false);
  });

  it("normalizes weights that sum to more than 1.0", () => {
    const input = { codeQuality: 2, testCoverage: 2 };
    const { weights, wasNormalized } = normalizeRankingWeights(input);
    expect(wasNormalized).toBe(true);
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it("normalizes weights that sum to less than 1.0", () => {
    const input = {
      codeQuality: 0.01,
      testCoverage: 0.01,
      diffMinimality: 0.01,
      descriptionQuality: 0.01,
      authorEngagement: 0.01,
      responsiveness: 0.01,
      abandonmentRisk: 0.01,
      visionAlignment: 0.01,
    };
    const { weights, wasNormalized } = normalizeRankingWeights(input);
    expect(wasNormalized).toBe(true);
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it("fills missing fields with defaults before normalizing", () => {
    const input = { codeQuality: 0.5 };
    const { weights } = normalizeRankingWeights(input);
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it("preserves proportional ratios after normalization", () => {
    const input = { codeQuality: 0.3, testCoverage: 0.6 };
    const { weights } = normalizeRankingWeights(input);
    expect(weights.testCoverage / weights.codeQuality).toBeCloseTo(2.0, 5);
  });

  it("handles within-tolerance sum as not needing normalization", () => {
    const input = {
      codeQuality: 0.15,
      testCoverage: 0.2,
      diffMinimality: 0.1,
      descriptionQuality: 0.1,
      authorEngagement: 0.1,
      responsiveness: 0.1,
      abandonmentRisk: 0.1,
      visionAlignment: 0.1499,
    };
    const { wasNormalized } = normalizeRankingWeights(input);
    expect(wasNormalized).toBe(false);
  });
});

describe("validateStalenessConfig", () => {
  it("returns valid for default config", () => {
    const result = validateStalenessConfig();
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("returns valid for undefined input", () => {
    const result = validateStalenessConfig(undefined);
    expect(result.valid).toBe(true);
  });

  it("returns valid for correct ordering", () => {
    const result = validateStalenessConfig({
      warningAfterDays: 7,
      staleAfterDays: 21,
      closeAfterDays: 45,
    });
    expect(result.valid).toBe(true);
  });

  it("returns invalid when warning >= stale", () => {
    const result = validateStalenessConfig({
      warningAfterDays: 30,
      staleAfterDays: 30,
      closeAfterDays: 60,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("warningAfterDays");
    expect(result.error).toContain("staleAfterDays");
  });

  it("returns invalid when warning > stale", () => {
    const result = validateStalenessConfig({
      warningAfterDays: 40,
      staleAfterDays: 30,
      closeAfterDays: 60,
    });
    expect(result.valid).toBe(false);
  });

  it("returns invalid when stale >= close", () => {
    const result = validateStalenessConfig({
      warningAfterDays: 7,
      staleAfterDays: 60,
      closeAfterDays: 60,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("staleAfterDays");
    expect(result.error).toContain("closeAfterDays");
  });

  it("returns invalid when stale > close", () => {
    const result = validateStalenessConfig({
      warningAfterDays: 7,
      staleAfterDays: 90,
      closeAfterDays: 60,
    });
    expect(result.valid).toBe(false);
  });

  it("fills missing values with defaults", () => {
    const result = validateStalenessConfig({ warningAfterDays: 7 });
    expect(result.valid).toBe(true);
  });

  it("uses default staleness values correctly", () => {
    const result = validateStalenessConfig({ closeAfterDays: 25 });
    expect(result.valid).toBe(false);
    expect(result.error).toContain(
      `staleAfterDays (${DEFAULT_STALENESS.staleAfterDays})`,
    );
  });
});
