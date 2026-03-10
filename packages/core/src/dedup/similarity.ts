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
