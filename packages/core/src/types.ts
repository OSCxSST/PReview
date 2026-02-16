/** Core domain types for PReview */

import type { RepoConfig } from "./config.js";

export interface Repository {
  id: string;
  githubId: number;
  fullName: string;
  visionDoc: string | null;
  config: RepoConfig;
  installedAt: Date;
  updatedAt: Date;
}

export interface PullRequest {
  id: string;
  repoId: string;
  githubNumber: number;
  githubId: number;
  title: string;
  body: string | null;
  authorLogin: string;
  authorId: number;
  state: PRState;
  filesChanged: string[];
  diffStats: DiffStats | null;
  intentSummary: IntentSummary | null;
  qualityScore: number | null;
  abandonRisk: number | null;
  visionScore: number | null;
  stalenessStage: StalenessStage;
  createdAt: Date;
  updatedAt: Date;
  analyzedAt: Date | null;
}

export interface Issue {
  id: string;
  repoId: string;
  githubNumber: number;
  githubId: number;
  title: string;
  body: string | null;
  labels: string[];
  createdAt: Date;
  updatedAt: Date;
  analyzedAt: Date | null;
}

export interface Cluster {
  id: string;
  repoId: string;
  clusterType: ClusterType;
  summary: string | null;
  status: ClusterStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClusterMember {
  id: string;
  clusterId: string;
  itemType: ClusterType;
  itemId: string;
  rank: number | null;
  similarity: number | null;
  addedAt: Date;
}

export interface VisionChunk {
  id: string;
  repoId: string;
  sourceFile: string | null;
  chunkIndex: number;
  content: string;
  createdAt: Date;
}

export interface ActionLog {
  id: string;
  repoId: string;
  targetType: ClusterType;
  targetNumber: number;
  actionType: ActionType;
  payload: Record<string, unknown> | null;
  executedAt: Date;
}

export interface IntentSummary {
  problem: string;
  approach: string;
  filesChangedSummary: string;
  category: PRCategory;
  scope: string;
}

export interface DiffStats {
  additions: number;
  deletions: number;
  changedFiles: number;
}

export type PRState = "open" | "closed" | "merged";
export type StalenessStage = "active" | "warning" | "stale" | "abandoned";
export type ClusterType = "pr" | "issue";
export type ClusterStatus = "open" | "resolved" | "dismissed";
export type ActionType =
  | "comment"
  | "label"
  | "close"
  | "status_check"
  | "cluster_assign";
export type PRCategory =
  | "bug_fix"
  | "feature"
  | "refactor"
  | "docs"
  | "test"
  | "chore";

/** Pagination */
export interface PaginationParams {
  cursor?: string;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
  };
}
