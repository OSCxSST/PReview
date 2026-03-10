import { Worker, type Job } from "bullmq";
import { getDb, pullRequests, clusters, clusterMembers } from "@preview/db";
import { eq, and, ne, isNotNull, sql } from "drizzle-orm";
import {
  classifySimilarity,
  judgeDuplicate,
  buildClusterSummary,
  DEFAULT_THRESHOLDS,
} from "@preview/core";
import type { IntentSummary } from "@preview/core";
import { getRedisUrl } from "../queue/connection.js";
import { getQueue, QUEUE_NAMES } from "../queue/queues.js";
import type { DedupJobData, ActionDispatchJobData } from "./types.js";

const TOP_K = 10;

async function processDedup(job: Job<DedupJobData>): Promise<void> {
  const { prId, repoId, installationId, repoFullName } = job.data;
  const db = getDb();

  const [pr] = await db
    .select()
    .from(pullRequests)
    .where(eq(pullRequests.id, prId))
    .limit(1);

  if (!pr || !pr.embedding) {
    job.log(`PR ${prId} not found or has no embedding`);
    return;
  }

  // ANN search: find top-k similar PRs in the same repo
  const embeddingStr = `[${(pr.embedding as number[]).join(",")}]`;
  const similar = await db
    .select({
      id: pullRequests.id,
      githubNumber: pullRequests.githubNumber,
      title: pullRequests.title,
      body: pullRequests.body,
      intentSummary: pullRequests.intentSummary,
      similarity:
        sql<number>`1 - (${pullRequests.embedding} <=> ${embeddingStr}::vector)`.as(
          "similarity",
        ),
    })
    .from(pullRequests)
    .where(
      and(
        eq(pullRequests.repoId, repoId),
        ne(pullRequests.id, prId),
        isNotNull(pullRequests.embedding),
      ),
    )
    .orderBy(sql`${pullRequests.embedding} <=> ${embeddingStr}::vector`)
    .limit(TOP_K);

  const candidates = similar.filter(
    (s) => s.similarity >= DEFAULT_THRESHOLDS.related,
  );

  if (candidates.length === 0) {
    job.log(`No similar PRs found for PR #${pr.githubNumber}`);
    return;
  }

  job.log(
    `Found ${candidates.length} candidates for PR #${pr.githubNumber}: ${candidates.map((c) => `#${c.githubNumber} (${c.similarity.toFixed(3)})`).join(", ")}`,
  );

  const actionQueue = getQueue(QUEUE_NAMES.ACTION_DISPATCH);

  for (const candidate of candidates) {
    const band = classifySimilarity(candidate.similarity);

    const judgeResult = await judgeDuplicate(
      {
        githubNumber: pr.githubNumber,
        title: pr.title,
        body: pr.body,
        intentSummary: pr.intentSummary as unknown as IntentSummary | null,
      },
      {
        githubNumber: candidate.githubNumber,
        title: candidate.title,
        body: candidate.body,
        intentSummary:
          candidate.intentSummary as unknown as IntentSummary | null,
      },
    );

    job.log(
      `Judge: PR #${pr.githubNumber} vs #${candidate.githubNumber}: isDuplicate=${judgeResult.isDuplicate}, confidence=${judgeResult.confidence}`,
    );

    if (judgeResult.isDuplicate && band === "high_confidence") {
      // Create or find cluster
      const existingMembership = await db
        .select({ clusterId: clusterMembers.clusterId })
        .from(clusterMembers)
        .where(eq(clusterMembers.itemId, candidate.id))
        .limit(1);

      let clusterId: string;

      if (existingMembership.length > 0 && existingMembership[0]) {
        clusterId = existingMembership[0].clusterId;

        await db.insert(clusterMembers).values({
          clusterId,
          itemType: "pr",
          itemId: prId,
          rank: null,
          similarity: candidate.similarity,
        });
      } else {
        const [newCluster] = await db
          .insert(clusters)
          .values({
            repoId,
            clusterType: "pr",
            summary: buildClusterSummary([pr.title, candidate.title]),
            status: "open",
          })
          .returning({ id: clusters.id });

        if (!newCluster) {
          throw new Error("Failed to create cluster");
        }

        clusterId = newCluster.id;

        await db.insert(clusterMembers).values([
          {
            clusterId,
            itemType: "pr",
            itemId: prId,
            rank: judgeResult.preferredPR === pr.githubNumber ? 1 : 2,
            similarity: 1.0,
          },
          {
            clusterId,
            itemType: "pr",
            itemId: candidate.id,
            rank:
              judgeResult.preferredPR === candidate.githubNumber ? 1 : 2,
            similarity: candidate.similarity,
          },
        ]);
      }

      // Dispatch comment + label actions
      const commentAction: ActionDispatchJobData = {
        repoId,
        installationId,
        repoFullName,
        targetType: "pr",
        targetNumber: pr.githubNumber,
        actionType: "comment",
        payload: {
          duplicateOf: candidate.githubNumber,
          similarity: candidate.similarity,
          reasoning: judgeResult.reasoning,
          clusterId,
        },
      };

      const labelAction: ActionDispatchJobData = {
        repoId,
        installationId,
        repoFullName,
        targetType: "pr",
        targetNumber: pr.githubNumber,
        actionType: "label",
        payload: { label: "duplicate-candidate" },
      };

      await actionQueue.add(`comment.${pr.githubNumber}`, commentAction);
      await actionQueue.add(`label.${pr.githubNumber}`, labelAction);
    } else if (band === "probable") {
      const commentAction: ActionDispatchJobData = {
        repoId,
        installationId,
        repoFullName,
        targetType: "pr",
        targetNumber: pr.githubNumber,
        actionType: "comment",
        payload: {
          relatedTo: candidate.githubNumber,
          similarity: candidate.similarity,
          reasoning: judgeResult.reasoning,
          band: "probable",
        },
      };
      await actionQueue.add(
        `comment.probable.${pr.githubNumber}`,
        commentAction,
      );
    } else if (band === "related") {
      const commentAction: ActionDispatchJobData = {
        repoId,
        installationId,
        repoFullName,
        targetType: "pr",
        targetNumber: pr.githubNumber,
        actionType: "comment",
        payload: {
          relatedTo: candidate.githubNumber,
          similarity: candidate.similarity,
          band: "related",
        },
      };
      await actionQueue.add(
        `comment.related.${pr.githubNumber}`,
        commentAction,
      );
    }
  }
}

export function createDedupWorker(): Worker {
  return new Worker(QUEUE_NAMES.DEDUP, processDedup, {
    connection: { url: getRedisUrl() },
    concurrency: 2,
  });
}
