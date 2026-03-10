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
