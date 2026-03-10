import { Worker, type Job } from "bullmq";
import { getDb, actionsLog } from "@preview/db";
import { getInstallationOctokit } from "../github/index.js";
import { getRedisUrl } from "../queue/connection.js";
import { QUEUE_NAMES } from "../queue/queues.js";
import type { ActionDispatchJobData } from "./types.js";

function buildDuplicateComment(payload: Record<string, unknown>): string {
  const similarity = ((payload["similarity"] as number) * 100).toFixed(1);
  const reasoning = payload["reasoning"] as string;
  const duplicateOf = payload["duplicateOf"] as number;

  return [
    `## PReview: Potential Duplicate Detected`,
    "",
    `This PR appears to be a duplicate of #${duplicateOf} (${similarity}% similar).`,
    "",
    `**Analysis:** ${reasoning}`,
    "",
    `_This analysis was performed automatically by [PReview](https://github.com/apps/preview-bot)._`,
  ].join("\n");
}

function buildProbableComment(payload: Record<string, unknown>): string {
  const similarity = ((payload["similarity"] as number) * 100).toFixed(1);
  const relatedTo = payload["relatedTo"] as number;
  const reasoning = payload["reasoning"] as string | undefined;

  return [
    `## PReview: Related PR Detected`,
    "",
    `This PR may be related to #${relatedTo} (${similarity}% similar).`,
    reasoning ? `\n**Analysis:** ${reasoning}` : "",
    "",
    `Please review for potential overlap.`,
    "",
    `_This analysis was performed automatically by [PReview](https://github.com/apps/preview-bot)._`,
  ].join("\n");
}

function buildRelatedComment(payload: Record<string, unknown>): string {
  const similarity = ((payload["similarity"] as number) * 100).toFixed(1);
  const relatedTo = payload["relatedTo"] as number;

  return [
    `## PReview: Cross-Reference`,
    "",
    `This PR may be related to #${relatedTo} (${similarity}% similar). You might want to check it for context.`,
    "",
    `_This analysis was performed automatically by [PReview](https://github.com/apps/preview-bot)._`,
  ].join("\n");
}

async function processActionDispatch(
  job: Job<ActionDispatchJobData>,
): Promise<void> {
  const {
    repoId,
    installationId,
    repoFullName,
    targetType,
    targetNumber,
    actionType,
    payload,
  } = job.data;

  const [owner = "", repoName = ""] = repoFullName.split("/");
  const octokit = await getInstallationOctokit(installationId);
  const db = getDb();

  if (actionType === "comment") {
    const band = (payload["band"] as string) ?? "high_confidence";

    let body: string;
    if (payload["duplicateOf"]) {
      body = buildDuplicateComment(payload);
    } else if (band === "probable") {
      body = buildProbableComment(payload);
    } else {
      body = buildRelatedComment(payload);
    }

    await octokit.request(
      "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
      { owner, repo: repoName, issue_number: targetNumber, body },
    );

    job.log(`Posted ${band} comment on ${targetType} #${targetNumber}`);
  } else if (actionType === "label") {
    const label = payload["label"] as string;

    try {
      await octokit.request(
        "POST /repos/{owner}/{repo}/issues/{issue_number}/labels",
        {
          owner,
          repo: repoName,
          issue_number: targetNumber,
          labels: [label],
        },
      );
      job.log(`Applied label "${label}" to ${targetType} #${targetNumber}`);
    } catch (err) {
      job.log(`Failed to apply label: ${String(err)}`);
    }
  }

  // Log action to database
  await db.insert(actionsLog).values({
    repoId,
    targetType,
    targetNumber,
    actionType,
    payload,
  });

  job.log(`Logged action to actionsLog: ${actionType} on #${targetNumber}`);
}

export function createActionDispatchWorker(): Worker {
  return new Worker(QUEUE_NAMES.ACTION_DISPATCH, processActionDispatch, {
    connection: { url: getRedisUrl() },
    concurrency: 3,
  });
}
