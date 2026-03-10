import type { Worker } from "bullmq";
import { createPRIngestionWorker } from "./pr-ingestion.worker.js";
import { createIssueIngestionWorker } from "./issue-ingestion.worker.js";
import { createBatchSyncWorker } from "./batch-sync.worker.js";
import { createIntentExtractionWorker } from "./intent-extraction.worker.js";
import { createEmbeddingWorker } from "./embedding.worker.js";
import { createDedupWorker } from "./dedup.worker.js";
import { createActionDispatchWorker } from "./action-dispatch.worker.js";

let workers: Worker[] = [];

export function startWorkers(): void {
  if (workers.length > 0) return;

  workers = [
    createPRIngestionWorker(),
    createIssueIngestionWorker(),
    createBatchSyncWorker(),
    createIntentExtractionWorker(),
    createEmbeddingWorker(),
    createDedupWorker(),
    createActionDispatchWorker(),
  ];

  for (const worker of workers) {
    worker.on("completed", (job) => {
      console.log(`Job ${job.id} completed on ${worker.name}`);
    });

    worker.on("failed", (job, err) => {
      console.error(`Job ${job?.id} failed on ${worker.name}: ${err.message}`);
    });
  }

  console.log(`Started ${workers.length} workers`);
}

export async function stopWorkers(): Promise<void> {
  const current = workers.slice();
  workers = [];
  await Promise.all(current.map((w) => w.close()));
}
