import { Worker, type Job } from "bullmq";
import { getDb, repositories, pullRequests } from "@preview/db";
import { getInstallationOctokit, paginateAll } from "../github/index.js";
import { getRedisUrl } from "../queue/connection.js";
import { QUEUE_NAMES } from "../queue/queues.js";

import type { WebhookJobData, GitHubPR, GitHubRepo } from "./types.js";

interface GitHubInstallation {
  id: number;
}

function mapPRState(pr: GitHubPR): "open" | "closed" | "merged" {
  if (pr.merged) return "merged";
  return pr.state === "open" ? "open" : "closed";
}

async function processPREvent(job: Job<WebhookJobData>): Promise<void> {
  const { payload, event } = job.data;
  const db = getDb();

  if (event === "issue_comment" || event === "pull_request_review") {
    // For engagement-tracking events, just log for now.
    // Phase 2+ will use these for abandonment risk scoring.
    job.log(
      `Received ${event} event - engagement tracking deferred to Phase 2`,
    );
    return;
  }

  const ghPR = payload["pull_request"] as GitHubPR | undefined;
  const ghRepo = payload["repository"] as GitHubRepo | undefined;
  const installation = payload["installation"] as
    | GitHubInstallation
    | undefined;

  if (!ghPR || !ghRepo || !installation) {
    job.log("Missing required payload fields");
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

  // Fetch file list and diff stats via GitHub API
  const octokit = await getInstallationOctokit(installation.id);
  let filesChanged: string[] = [];
  let diffStats = { additions: 0, deletions: 0, changedFiles: 0 };

  const [owner = "", repoName = ""] = ghRepo.full_name.split("/");

  try {
    const { data: prDetail } = await octokit.request(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}",
      {
        owner,
        repo: repoName,
        pull_number: ghPR.number,
      },
    );

    diffStats = {
      additions: prDetail.additions,
      deletions: prDetail.deletions,
      changedFiles: prDetail.changed_files,
    };

    const files = await paginateAll<{ filename: string }>(
      octokit,
      "GET /repos/{owner}/{repo}/pulls/{pull_number}/files",
      { owner, repo: repoName, pull_number: ghPR.number },
    );

    filesChanged = files.map((f) => f.filename);
  } catch (err) {
    job.log(`Failed to fetch PR details: ${String(err)}`);
    throw err;
  }

  // Upsert pull request
  await db
    .insert(pullRequests)
    .values({
      repoId: repo.id,
      githubNumber: ghPR.number,
      githubId: ghPR.id,
      title: ghPR.title,
      body: ghPR.body,
      authorLogin: ghPR.user.login,
      authorId: ghPR.user.id,
      state: mapPRState(ghPR),
      filesChanged,
      diffStats,
      createdAt: new Date(ghPR.created_at),
      updatedAt: new Date(ghPR.updated_at),
    })
    .onConflictDoUpdate({
      target: pullRequests.githubId,
      set: {
        title: ghPR.title,
        body: ghPR.body,
        state: mapPRState(ghPR),
        filesChanged,
        diffStats,
        updatedAt: new Date(ghPR.updated_at),
        analyzedAt: null, // Flag for re-analysis
      },
    });

  job.log(
    `Upserted PR #${ghPR.number} (${ghPR.title}) for ${ghRepo.full_name}`,
  );
}

export function createPRIngestionWorker(): Worker {
  return new Worker(QUEUE_NAMES.PR_INGESTION, processPREvent, {
    connection: { url: getRedisUrl() },
    concurrency: 5,
  });
}
