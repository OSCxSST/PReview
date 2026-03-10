import { CLUSTER_AUTO_MERGE_MAX_MEMBERS } from "../constants.js";

export function shouldAutoMerge(
  clusterASize: number,
  clusterBSize: number,
): boolean {
  return clusterASize + clusterBSize <= CLUSTER_AUTO_MERGE_MAX_MEMBERS;
}

export function buildClusterSummary(memberTitles: string[]): string {
  if (memberTitles.length === 1) {
    const title = memberTitles[0];
    if (title) return title;
  }

  return `Group of ${memberTitles.length} related PRs: ${memberTitles.join(", ")}`;
}
