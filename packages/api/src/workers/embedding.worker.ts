import { Worker, type Job } from "bullmq";
import { getDb, pullRequests } from "@preview/db";
import { eq } from "drizzle-orm";
import { generateEmbedding, buildEmbeddingText } from "@preview/core";
import type { IntentSummary } from "@preview/core";
import { getRedisUrl } from "../queue/connection.js";
import { getQueue, QUEUE_NAMES } from "../queue/queues.js";
import type { EmbeddingJobData, DedupJobData } from "./types.js";

async function processEmbedding(
  job: Job<EmbeddingJobData>,
): Promise<void> {
  const { prId, repoId } = job.data;
  const db = getDb();

  const [pr] = await db
    .select()
    .from(pullRequests)
    .where(eq(pullRequests.id, prId))
    .limit(1);

  if (!pr) {
    job.log(`PR ${prId} not found`);
    return;
  }

  if (!pr.intentSummary) {
    job.log(`PR ${prId} has no intent summary, skipping embedding`);
    return;
  }

  const intent = pr.intentSummary as unknown as IntentSummary;
  const text = buildEmbeddingText(intent);
  const embedding = await generateEmbedding(text);

  job.log(
    `Generated ${embedding.length}-dim embedding for PR #${pr.githubNumber}`,
  );

  await db
    .update(pullRequests)
    .set({ embedding })
    .where(eq(pullRequests.id, prId));

  // Enqueue dedup - installationId and repoFullName will be looked up by dedup worker
  const dedupQueue = getQueue(QUEUE_NAMES.DEDUP);
  const dedupData: DedupJobData = {
    prId,
    repoId,
    installationId: 0,
    repoFullName: "",
  };
  await dedupQueue.add(`dedup.${pr.githubNumber}`, dedupData);

  job.log(`Enqueued dedup for PR #${pr.githubNumber}`);
}

export function createEmbeddingWorker(): Worker {
  return new Worker(QUEUE_NAMES.EMBEDDING, processEmbedding, {
    connection: { url: getRedisUrl() },
    concurrency: 5,
  });
}
