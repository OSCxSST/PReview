import { describe, it, expect, vi, beforeEach } from "vitest";

const mockClose = vi.fn().mockResolvedValue(undefined);
const MockQueue = vi.fn().mockImplementation(() => ({ close: mockClose }));

vi.mock("bullmq", () => ({
  Queue: MockQueue,
}));

vi.mock("../connection.js", () => ({
  getRedisUrl: vi.fn(() => "redis://localhost:6379"),
}));

describe("queue/queues", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe("QUEUE_NAMES", () => {
    it("exports all expected queue names", async () => {
      const { QUEUE_NAMES } = await import("../queues.js");
      expect(QUEUE_NAMES.WEBHOOK_EVENTS).toBe("webhook-events");
      expect(QUEUE_NAMES.PR_INGESTION).toBe("pr-ingestion");
      expect(QUEUE_NAMES.ISSUE_INGESTION).toBe("issue-ingestion");
      expect(QUEUE_NAMES.BATCH_SYNC).toBe("batch-sync");
    });
  });

  describe("getQueue", () => {
    it("returns a queue by name", async () => {
      const { getQueue, QUEUE_NAMES } = await import("../queues.js");
      const queue = getQueue(QUEUE_NAMES.PR_INGESTION);
      expect(queue).toBeDefined();
    });

    it("initializes all queues on first call", async () => {
      const { getQueue, QUEUE_NAMES } = await import("../queues.js");
      getQueue(QUEUE_NAMES.PR_INGESTION);
      // 4 queues should be created
      expect(MockQueue).toHaveBeenCalledTimes(4);
    });

    it("returns singleton queues", async () => {
      const { getQueue, QUEUE_NAMES } = await import("../queues.js");
      const q1 = getQueue(QUEUE_NAMES.PR_INGESTION);
      const q2 = getQueue(QUEUE_NAMES.PR_INGESTION);
      expect(q1).toBe(q2);
      // Still only 4 queues total (no re-initialization)
      expect(MockQueue).toHaveBeenCalledTimes(4);
    });

    it("throws for unknown queue name", async () => {
      const { getQueue } = await import("../queues.js");
      expect(() => getQueue("nonexistent")).toThrow("Unknown queue: nonexistent");
    });

    it("creates batch-sync queue with different job options", async () => {
      const { getQueue, QUEUE_NAMES } = await import("../queues.js");
      getQueue(QUEUE_NAMES.BATCH_SYNC);

      const batchCall = MockQueue.mock.calls.find(
        (call: unknown[]) => call[0] === "batch-sync",
      );
      expect(batchCall).toBeDefined();
      const options = batchCall![1] as { defaultJobOptions: { attempts: number } };
      expect(options.defaultJobOptions.attempts).toBe(5);
    });
  });

  describe("closeQueues", () => {
    it("closes all queues", async () => {
      const { getQueue, closeQueues, QUEUE_NAMES } = await import(
        "../queues.js"
      );
      getQueue(QUEUE_NAMES.PR_INGESTION);
      await closeQueues();
      expect(mockClose).toHaveBeenCalledTimes(4);
    });

    it("is safe to call when no queues exist", async () => {
      const { closeQueues } = await import("../queues.js");
      await expect(closeQueues()).resolves.toBeUndefined();
    });

    it("allows re-initialization after close", async () => {
      const { getQueue, closeQueues, QUEUE_NAMES } = await import(
        "../queues.js"
      );
      getQueue(QUEUE_NAMES.PR_INGESTION);
      await closeQueues();
      MockQueue.mockClear();

      getQueue(QUEUE_NAMES.PR_INGESTION);
      expect(MockQueue).toHaveBeenCalledTimes(4);
    });
  });
});
