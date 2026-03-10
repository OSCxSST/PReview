import { Queue, type JobsOptions } from "bullmq";
import { getRedisUrl } from "./connection.js";

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 1000 },
  removeOnComplete: { age: 3600 },
  removeOnFail: { age: 604800 },
};

const BATCH_SYNC_JOB_OPTIONS: JobsOptions = {
  ...DEFAULT_JOB_OPTIONS,
  attempts: 5,
  backoff: { type: "exponential", delay: 5000 },
  removeOnComplete: { age: 86400 },
};

export const QUEUE_NAMES = {
  WEBHOOK_EVENTS: "webhook-events",
  PR_INGESTION: "pr-ingestion",
  ISSUE_INGESTION: "issue-ingestion",
  BATCH_SYNC: "batch-sync",
  INTENT_EXTRACTION: "intent-extraction",
  EMBEDDING: "embedding",
  DEDUP: "dedup",
  ACTION_DISPATCH: "action-dispatch",
} as const;

let queues: Map<string, Queue> | null = null;

function createQueue(name: string, jobOptions: JobsOptions): Queue {
  return new Queue(name, {
    connection: { url: getRedisUrl() },
    defaultJobOptions: jobOptions,
  });
}

function initQueues(): Map<string, Queue> {
  const map = new Map<string, Queue>();

  map.set(
    QUEUE_NAMES.WEBHOOK_EVENTS,
    createQueue(QUEUE_NAMES.WEBHOOK_EVENTS, DEFAULT_JOB_OPTIONS),
  );
  map.set(
    QUEUE_NAMES.PR_INGESTION,
    createQueue(QUEUE_NAMES.PR_INGESTION, DEFAULT_JOB_OPTIONS),
  );
  map.set(
    QUEUE_NAMES.ISSUE_INGESTION,
    createQueue(QUEUE_NAMES.ISSUE_INGESTION, DEFAULT_JOB_OPTIONS),
  );
  map.set(
    QUEUE_NAMES.BATCH_SYNC,
    createQueue(QUEUE_NAMES.BATCH_SYNC, BATCH_SYNC_JOB_OPTIONS),
  );
  map.set(
    QUEUE_NAMES.INTENT_EXTRACTION,
    createQueue(QUEUE_NAMES.INTENT_EXTRACTION, DEFAULT_JOB_OPTIONS),
  );
  map.set(
    QUEUE_NAMES.EMBEDDING,
    createQueue(QUEUE_NAMES.EMBEDDING, DEFAULT_JOB_OPTIONS),
  );
  map.set(
    QUEUE_NAMES.DEDUP,
    createQueue(QUEUE_NAMES.DEDUP, DEFAULT_JOB_OPTIONS),
  );
  map.set(
    QUEUE_NAMES.ACTION_DISPATCH,
    createQueue(QUEUE_NAMES.ACTION_DISPATCH, DEFAULT_JOB_OPTIONS),
  );

  return map;
}

export function getQueue(name: string): Queue {
  if (!queues) {
    queues = initQueues();
  }

  const queue = queues.get(name);
  if (!queue) {
    throw new Error(`Unknown queue: ${name}`);
  }
  return queue;
}

export async function closeQueues(): Promise<void> {
  if (queues) {
    await Promise.all(Array.from(queues.values()).map((q) => q.close()));
    queues = null;
  }
}
