import { DEFAULT_RANKING_WEIGHTS, DEFAULT_STALENESS } from "./constants.js";

/** Per-repo configuration (from .github/preview.yml or API) */
export interface RepoConfig {
  version?: number;
  vision?: VisionConfig;
  dedup?: DedupConfig;
  ranking?: RankingWeights;
  staleness?: StalenessConfig;
  abandonmentDetection?: AbandonmentDetectionConfig;
  notifications?: NotificationsConfig;
}

export interface VisionConfig {
  files?: string[];
  text?: string;
}

export interface DedupConfig {
  prThreshold?: number;
  issueThreshold?: number;
  autoCloseDuplicates?: boolean;
  excludeLabels?: string[];
}

export interface RankingWeights {
  codeQuality?: number;
  testCoverage?: number;
  diffMinimality?: number;
  descriptionQuality?: number;
  authorEngagement?: number;
  responsiveness?: number;
  abandonmentRisk?: number;
  visionAlignment?: number;
}

export interface StalenessConfig {
  warningAfterDays?: number;
  staleAfterDays?: number;
  closeAfterDays?: number;
  exemptLabels?: string[];
}

export interface AbandonmentDetectionConfig {
  enabled?: boolean;
  flagThreshold?: number;
  autoLabel?: boolean;
}

export interface NotificationsConfig {
  webhookUrl?: string;
  webhookSecret?: string;
  events?: string[];
}

/**
 * Normalize ranking weights so they sum to 1.0.
 * Missing fields are filled with defaults before normalization.
 * Returns the normalized weights and whether normalization was needed.
 */
export function normalizeRankingWeights(input?: RankingWeights): {
  weights: Required<RankingWeights>;
  wasNormalized: boolean;
} {
  const raw = {
    codeQuality: input?.codeQuality ?? DEFAULT_RANKING_WEIGHTS.codeQuality,
    testCoverage: input?.testCoverage ?? DEFAULT_RANKING_WEIGHTS.testCoverage,
    diffMinimality:
      input?.diffMinimality ?? DEFAULT_RANKING_WEIGHTS.diffMinimality,
    descriptionQuality:
      input?.descriptionQuality ?? DEFAULT_RANKING_WEIGHTS.descriptionQuality,
    authorEngagement:
      input?.authorEngagement ?? DEFAULT_RANKING_WEIGHTS.authorEngagement,
    responsiveness:
      input?.responsiveness ?? DEFAULT_RANKING_WEIGHTS.responsiveness,
    abandonmentRisk:
      input?.abandonmentRisk ?? DEFAULT_RANKING_WEIGHTS.abandonmentRisk,
    visionAlignment:
      input?.visionAlignment ?? DEFAULT_RANKING_WEIGHTS.visionAlignment,
  };

  const sum = Object.values(raw).reduce((a, b) => a + b, 0);
  const needsNormalization = Math.abs(sum - 1.0) > 0.001;

  if (needsNormalization && sum > 0) {
    return {
      weights: {
        codeQuality: raw.codeQuality / sum,
        testCoverage: raw.testCoverage / sum,
        diffMinimality: raw.diffMinimality / sum,
        descriptionQuality: raw.descriptionQuality / sum,
        authorEngagement: raw.authorEngagement / sum,
        responsiveness: raw.responsiveness / sum,
        abandonmentRisk: raw.abandonmentRisk / sum,
        visionAlignment: raw.visionAlignment / sum,
      },
      wasNormalized: true,
    };
  }

  return { weights: raw, wasNormalized: false };
}

/**
 * Validate staleness config ordering constraint:
 * warningAfterDays < staleAfterDays < closeAfterDays
 */
export function validateStalenessConfig(config?: StalenessConfig): {
  valid: boolean;
  error?: string;
} {
  const warning =
    config?.warningAfterDays ?? DEFAULT_STALENESS.warningAfterDays;
  const stale = config?.staleAfterDays ?? DEFAULT_STALENESS.staleAfterDays;
  const close = config?.closeAfterDays ?? DEFAULT_STALENESS.closeAfterDays;

  if (warning >= stale) {
    return {
      valid: false,
      error: `warningAfterDays (${warning}) must be less than staleAfterDays (${stale})`,
    };
  }
  if (stale >= close) {
    return {
      valid: false,
      error: `staleAfterDays (${stale}) must be less than closeAfterDays (${close})`,
    };
  }

  return { valid: true };
}
