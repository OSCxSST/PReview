/** Application-wide constants */

export const APP_NAME = "PReview";
export const APP_VERSION = "0.0.1";

/** Default similarity thresholds (used until per-repo calibration completes) */
export const DEFAULT_THRESHOLDS = {
  highConfidenceDuplicate: 0.92,
  probableDuplicate: 0.8,
  related: 0.65,
} as const;

/** Default ranking signal weights (must sum to 1.0) */
export const DEFAULT_RANKING_WEIGHTS = {
  codeQuality: 0.15,
  testCoverage: 0.2,
  diffMinimality: 0.1,
  descriptionQuality: 0.1,
  authorEngagement: 0.1,
  responsiveness: 0.1,
  abandonmentRisk: 0.1,
  visionAlignment: 0.15,
} as const;

/** Default staleness rules (in days) */
export const DEFAULT_STALENESS = {
  warningAfterDays: 14,
  staleAfterDays: 30,
  closeAfterDays: 60,
} as const;

/** Pagination defaults */
export const PAGINATION = {
  defaultLimit: 50,
  maxLimit: 100,
} as const;

/** Embedding dimensions */
export const EMBEDDING_DIMENSIONS = 3072;

/** Cluster merge auto-apply threshold */
export const CLUSTER_AUTO_MERGE_MAX_MEMBERS = 5;
