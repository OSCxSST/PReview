import { describe, it, expect } from "vitest";
import { classifySimilarity } from "../../dedup/similarity.js";

describe("classifySimilarity", () => {
  it("classifies high confidence duplicates", () => {
    expect(classifySimilarity(0.95)).toBe("high_confidence");
    expect(classifySimilarity(0.92)).toBe("high_confidence");
  });

  it("classifies probable duplicates", () => {
    expect(classifySimilarity(0.85)).toBe("probable");
    expect(classifySimilarity(0.8)).toBe("probable");
  });

  it("classifies related items", () => {
    expect(classifySimilarity(0.7)).toBe("related");
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
      related: 0.7,
    };
    expect(classifySimilarity(0.93, custom)).toBe("probable");
    expect(classifySimilarity(0.95, custom)).toBe("high_confidence");
  });
});
