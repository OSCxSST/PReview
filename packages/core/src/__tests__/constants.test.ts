import { describe, it, expect } from "vitest";
import {
  APP_NAME,
  APP_VERSION,
  DEFAULT_THRESHOLDS,
  DEFAULT_RANKING_WEIGHTS,
  DEFAULT_STALENESS,
  PAGINATION,
  EMBEDDING_DIMENSIONS,
  CLUSTER_AUTO_MERGE_MAX_MEMBERS,
} from "../constants.js";

describe("constants", () => {
  it("exports correct app metadata", () => {
    expect(APP_NAME).toBe("PReview");
    expect(APP_VERSION).toBe("0.0.1");
  });

  describe("DEFAULT_THRESHOLDS", () => {
    it("has correct similarity thresholds", () => {
      expect(DEFAULT_THRESHOLDS.highConfidenceDuplicate).toBe(0.92);
      expect(DEFAULT_THRESHOLDS.probableDuplicate).toBe(0.8);
      expect(DEFAULT_THRESHOLDS.related).toBe(0.65);
    });

    it("thresholds are in descending order", () => {
      expect(DEFAULT_THRESHOLDS.highConfidenceDuplicate).toBeGreaterThan(
        DEFAULT_THRESHOLDS.probableDuplicate,
      );
      expect(DEFAULT_THRESHOLDS.probableDuplicate).toBeGreaterThan(
        DEFAULT_THRESHOLDS.related,
      );
    });
  });

  describe("DEFAULT_RANKING_WEIGHTS", () => {
    it("weights sum to 1.0", () => {
      const sum = Object.values(DEFAULT_RANKING_WEIGHTS).reduce(
        (a, b) => a + b,
        0,
      );
      expect(sum).toBeCloseTo(1.0, 10);
    });

    it("all weights are positive", () => {
      for (const value of Object.values(DEFAULT_RANKING_WEIGHTS)) {
        expect(value).toBeGreaterThan(0);
      }
    });

    it("has all expected fields", () => {
      expect(DEFAULT_RANKING_WEIGHTS).toHaveProperty("codeQuality");
      expect(DEFAULT_RANKING_WEIGHTS).toHaveProperty("testCoverage");
      expect(DEFAULT_RANKING_WEIGHTS).toHaveProperty("diffMinimality");
      expect(DEFAULT_RANKING_WEIGHTS).toHaveProperty("descriptionQuality");
      expect(DEFAULT_RANKING_WEIGHTS).toHaveProperty("authorEngagement");
      expect(DEFAULT_RANKING_WEIGHTS).toHaveProperty("responsiveness");
      expect(DEFAULT_RANKING_WEIGHTS).toHaveProperty("abandonmentRisk");
      expect(DEFAULT_RANKING_WEIGHTS).toHaveProperty("visionAlignment");
    });
  });

  describe("DEFAULT_STALENESS", () => {
    it("days are in ascending order", () => {
      expect(DEFAULT_STALENESS.warningAfterDays).toBeLessThan(
        DEFAULT_STALENESS.staleAfterDays,
      );
      expect(DEFAULT_STALENESS.staleAfterDays).toBeLessThan(
        DEFAULT_STALENESS.closeAfterDays,
      );
    });

    it("has correct default values", () => {
      expect(DEFAULT_STALENESS.warningAfterDays).toBe(14);
      expect(DEFAULT_STALENESS.staleAfterDays).toBe(30);
      expect(DEFAULT_STALENESS.closeAfterDays).toBe(60);
    });
  });

  describe("PAGINATION", () => {
    it("has correct defaults", () => {
      expect(PAGINATION.defaultLimit).toBe(50);
      expect(PAGINATION.maxLimit).toBe(100);
    });

    it("maxLimit is greater than defaultLimit", () => {
      expect(PAGINATION.maxLimit).toBeGreaterThan(PAGINATION.defaultLimit);
    });
  });

  it("EMBEDDING_DIMENSIONS is 3072", () => {
    expect(EMBEDDING_DIMENSIONS).toBe(3072);
  });

  it("CLUSTER_AUTO_MERGE_MAX_MEMBERS is 5", () => {
    expect(CLUSTER_AUTO_MERGE_MAX_MEMBERS).toBe(5);
  });
});
