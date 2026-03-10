import { Worker, type Job } from "bullmq";
import { getDb, repositories, issues } from "@preview/db";
import { getRedisUrl } from "../queue/connection.js";
import { QUEUE_NAMES } from "../queue/queues.js";

interface WebhookJobData {
  event: string;
  action: string;
  deliveryId: string;
  payload: Record<string, unknown>;
  receivedAt: string;
}

interface GitHubIssue {
  number: number;
  id: number;
  title: string;
  body: string | null;
  labels: Array<{ name: string } | string>;
  created_at: string;
  updated_at: string;
  pull_request?: unknown;
}

interface GitHubRepo {
  id: number;
  full_name: string;
}

function extractLabels(labels: GitHubIssue["labels"]): string[] {
  return labels.map((l) => (typeof l === "string" ? l : l.name));
}

async function processIssueEvent(job: Job<WebhookJobData>): Promise<void> {
  const { payload } = job.data;
  const db = getDb();

  const ghIssue = payload["issue"] as GitHubIssue | undefined;
  const ghRepo = payload["repository"] as GitHubRepo | undefined;

  if (!ghIssue || !ghRepo) {
    job.log("Missing required payload fields");
    return;
  }

  // Skip pull requests (GitHub sends issue events for PRs too)
  if (ghIssue.pull_request) {
    job.log(`Skipping PR #${ghIssue.number} received as issue event`);
    return;
  }

  // Upsert repository
  const [repo] = await db
    .insert(repositories)
    .values({
      githubId: ghRepo.id,
      fullName: ghRepo.full_name,
    })
    .onConflictDoUpdate({
      target: repositories.githubId,
      set: { fullName: ghRepo.full_name, updatedAt: new Date() },
    })
    .returning({ id: repositories.id });

  if (!repo) {
    throw new Error("Failed to upsert repository");
  }

  // Upsert issue
  await db
    .insert(issues)
    .values({
      repoId: repo.id,
      githubNumber: ghIssue.number,
      githubId: ghIssue.id,
      title: ghIssue.title,
      body: ghIssue.body,
      labels: extractLabels(ghIssue.labels),
      createdAt: new Date(ghIssue.created_at),
      updatedAt: new Date(ghIssue.updated_at),
    })
    .onConflictDoUpdate({
      target: issues.githubId,
      set: {
        title: ghIssue.title,
        body: ghIssue.body,
        labels: extractLabels(ghIssue.labels),
        updatedAt: new Date(ghIssue.updated_at),
        analyzedAt: null, // Flag for re-analysis
      },
    });

  job.log(
    `Upserted issue #${ghIssue.number} (${ghIssue.title}) for ${ghRepo.full_name}`,
  );
}

export function createIssueIngestionWorker(): Worker {
  return new Worker(QUEUE_NAMES.ISSUE_INGESTION, processIssueEvent, {
    connection: { url: getRedisUrl() },
    concurrency: 5,
  });
}
