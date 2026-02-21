import type { Worker } from "bullmq";
import { createPRIngestionWorker } from "./pr-ingestion.worker.js";
import { createIssueIngestionWorker } from "./issue-ingestion.worker.js";
import { createBatchSyncWorker } from "./batch-sync.worker.js";

let workers: Worker[] = [];

export function startWorkers(): void {
  if (workers.length > 0) return;

  workers = [
    createPRIngestionWorker(),
    createIssueIngestionWorker(),
    createBatchSyncWorker(),
  ];

  for (const worker of workers) {
    worker.on("completed", (job) => {
      console.log(`Job ${job.id} completed on ${worker.name}`);
    });

    worker.on("failed", (job, err) => {
      console.error(
        `Job ${job?.id} failed on ${worker.name}: ${err.message}`,
      );
    });
  }

  console.log(`Started ${workers.length} workers`);
}

export async function stopWorkers(): Promise<void> {
  await Promise.all(workers.map((w) => w.close()));
  workers = [];
}
