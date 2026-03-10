export interface WebhookJobData {
  event: string;
  action: string;
  deliveryId: string;
  payload: Record<string, unknown>;
  receivedAt: string;
}

export interface GitHubRepo {
  id: number;
  full_name: string;
}

export interface GitHubPR {
  number: number;
  id: number;
  title: string;
  body: string | null;
  user: { login: string; id: number };
  state: string;
  merged?: boolean;
  merged_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GitHubIssue {
  number: number;
  id: number;
  title: string;
  body: string | null;
  labels: Array<{ name: string } | string>;
  created_at: string;
  updated_at: string;
  pull_request?: unknown;
}

export interface GitHubInstallation {
  id: number;
  account: { login: string; id: number } | null;
}

export interface GitHubInstallationRepo {
  id: number;
  full_name: string;
  node_id: string;
}

export interface IntentExtractionJobData {
  prId: string;
  repoId: string;
  installationId: number;
  repoFullName: string;
}

export interface EmbeddingJobData {
  prId: string;
  repoId: string;
}

export interface DedupJobData {
  prId: string;
  repoId: string;
  installationId: number;
  repoFullName: string;
}

export interface ActionDispatchJobData {
  repoId: string;
  installationId: number;
  repoFullName: string;
  targetType: "pr" | "issue";
  targetNumber: number;
  actionType: "comment" | "label" | "close" | "cluster_assign";
  payload: Record<string, unknown>;
}
