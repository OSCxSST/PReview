import { Worker, type Job } from "bullmq";
import { getDb, repositories } from "@preview/db";
import { getInstallationOctokit, paginateAll } from "../github/index.js";
import { getQueue, QUEUE_NAMES } from "../queue/queues.js";
import { getRedisUrl } from "../queue/connection.js";

interface BatchSyncJobData {
  event: string;
  action: string;
  deliveryId: string;
  payload: Record<string, unknown>;
  receivedAt: string;
}

interface GitHubInstallation {
  id: number;
  account: { login: string; id: number } | null;
}

interface GitHubInstallationRepo {
  id: number;
  full_name: string;
  node_id: string;
}

interface GitHubPR {
  number: number;
  id: number;
  title: string;
  body: string | null;
  user: { login: string; id: number };
  state: string;
  merged_at: string | null;
  created_at: string;
  updated_at: string;
}

interface GitHubIssue {
  number: number;
  id: number;
  title: string;
  body: string | null;
  labels: Array<{ name: string }>;
  pull_request?: unknown;
  created_at: string;
  updated_at: string;
}

async function processBatchSync(job: Job<BatchSyncJobData>): Promise<void> {
  const { payload } = job.data;
  const db = getDb();

  const installation = payload["installation"] as
    | GitHubInstallation
    | undefined;

  if (!installation) {
    job.log("Missing installation in payload");
    return;
  }

  const octokit = await getInstallationOctokit(installation.id);

  // Get all repos for this installation
  const installationRepos = await paginateAll<GitHubInstallationRepo>(
    octokit,
    "GET /installation/repositories",
  );

  job.log(`Found ${installationRepos.length} repositories for installation`);

  const prQueue = getQueue(QUEUE_NAMES.PR_INGESTION);
  const issueQueue = getQueue(QUEUE_NAMES.ISSUE_INGESTION);

  let totalPRs = 0;
  let totalIssues = 0;

  for (const ghRepo of installationRepos) {
    try {
      const [owner, repo] = ghRepo.full_name.split("/") as [string, string];

      // Upsert repository
      await db
        .insert(repositories)
        .values({
          githubId: ghRepo.id,
          fullName: ghRepo.full_name,
        })
        .onConflictDoUpdate({
          target: repositories.githubId,
          set: { fullName: ghRepo.full_name, updatedAt: new Date() },
        });

      // Fetch all open PRs
      job.log(`Syncing open PRs for ${ghRepo.full_name}...`);
      const openPRs = await paginateAll<GitHubPR>(
        octokit,
        "GET /repos/{owner}/{repo}/pulls",
        { owner, repo, state: "open" },
      );

      for (const pr of openPRs) {
        await prQueue.add(`batch-sync.pr.${ghRepo.full_name}#${pr.number}`, {
          event: "pull_request",
          action: "opened",
          deliveryId: `batch-sync-${job.id}`,
          payload: {
            pull_request: pr,
            repository: { id: ghRepo.id, full_name: ghRepo.full_name },
            installation: { id: installation.id },
          },
          receivedAt: new Date().toISOString(),
        });
      }

      totalPRs += openPRs.length;
      job.log(`Enqueued ${openPRs.length} PRs for ${ghRepo.full_name}`);

      // Fetch all open issues (excluding PRs)
      job.log(`Syncing open issues for ${ghRepo.full_name}...`);
      const openIssues = await paginateAll<GitHubIssue>(
        octokit,
        "GET /repos/{owner}/{repo}/issues",
        { owner, repo, state: "open" },
      );

      const issuesOnly = openIssues.filter((i) => !i.pull_request);

      for (const issue of issuesOnly) {
        await issueQueue.add(
          `batch-sync.issue.${ghRepo.full_name}#${issue.number}`,
          {
            event: "issues",
            action: "opened",
            deliveryId: `batch-sync-${job.id}`,
            payload: {
              issue,
              repository: { id: ghRepo.id, full_name: ghRepo.full_name },
              installation: { id: installation.id },
            },
            receivedAt: new Date().toISOString(),
          },
        );
      }

      totalIssues += issuesOnly.length;
      job.log(`Enqueued ${issuesOnly.length} issues for ${ghRepo.full_name}`);
    } catch (err) {
      job.log(
        `Failed to sync ${ghRepo.full_name}: ${String(err)}. Continuing with remaining repos.`,
      );
    }

    await job.updateProgress({
      repos: installationRepos.length,
      currentRepo: ghRepo.full_name,
      totalPRs,
      totalIssues,
    });
  }

  job.log(
    `Batch sync complete: ${totalPRs} PRs and ${totalIssues} issues across ${installationRepos.length} repos`,
  );
}

export function createBatchSyncWorker(): Worker {
  return new Worker(QUEUE_NAMES.BATCH_SYNC, processBatchSync, {
    connection: { url: getRedisUrl() },
    concurrency: 1, // One batch sync at a time
  });
}
