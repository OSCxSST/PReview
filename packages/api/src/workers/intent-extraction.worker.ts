import { Worker, type Job } from "bullmq";
import { getDb, pullRequests } from "@preview/db";
import { eq } from "drizzle-orm";
import { extractIntent } from "@preview/core";
import { getInstallationOctokit } from "../github/index.js";
import { getRedisUrl } from "../queue/connection.js";
import { getQueue, QUEUE_NAMES } from "../queue/queues.js";
import type { IntentExtractionJobData, EmbeddingJobData } from "./types.js";

async function processIntentExtraction(
  job: Job<IntentExtractionJobData>,
): Promise<void> {
  const { prId, repoId, installationId, repoFullName } = job.data;
  const db = getDb();

  const [pr] = await db
    .select()
    .from(pullRequests)
    .where(eq(pullRequests.id, prId))
    .limit(1);

  if (!pr) {
    job.log(`PR ${prId} not found in database`);
    return;
  }

  // Fetch diff for potential fallback
  let diff: string | undefined;
  const [owner = "", repoName = ""] = repoFullName.split("/");

  try {
    const octokit = await getInstallationOctokit(installationId);
    const { data } = await octokit.request(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}",
      {
        owner,
        repo: repoName,
        pull_number: pr.githubNumber,
        mediaType: { format: "diff" },
      },
    );
    diff = data as unknown as string;
  } catch (err) {
    job.log(`Failed to fetch diff, proceeding without: ${String(err)}`);
  }

  const result = await extractIntent({
    title: pr.title,
    body: pr.body,
    filesChanged: pr.filesChanged ?? [],
    diff,
  });

  job.log(
    `Extracted intent for PR #${pr.githubNumber}: category=${result.intent.category}, usedDiff=${result.usedDiffFallback}`,
  );

  await db
    .update(pullRequests)
    .set({
      intentSummary: result.intent,
      qualityScore: result.usedDiffFallback ? 0.3 : 0.8,
      analyzedAt: new Date(),
    })
    .where(eq(pullRequests.id, prId));

  const embeddingQueue = getQueue(QUEUE_NAMES.EMBEDDING);
  const embeddingData: EmbeddingJobData = { prId, repoId };
  await embeddingQueue.add(`embed.${pr.githubNumber}`, embeddingData);

  job.log(`Enqueued embedding generation for PR #${pr.githubNumber}`);
}

export function createIntentExtractionWorker(): Worker {
  return new Worker(QUEUE_NAMES.INTENT_EXTRACTION, processIntentExtraction, {
    connection: { url: getRedisUrl() },
    concurrency: 3,
  });
}
