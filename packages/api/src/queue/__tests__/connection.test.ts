import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockQuit = vi.fn().mockResolvedValue("OK");
const MockRedis = vi.fn().mockImplementation(() => ({ quit: mockQuit }));

vi.mock("ioredis", () => ({
  Redis: MockRedis,
}));

describe("queue/connection", () => {
  const originalRedisUrl = process.env["REDIS_URL"];

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env["REDIS_URL"] = "redis://localhost:6379";
  });

  afterEach(() => {
    if (originalRedisUrl !== undefined) {
      process.env["REDIS_URL"] = originalRedisUrl;
    } else {
      delete process.env["REDIS_URL"];
    }
  });

  describe("getRedisUrl", () => {
    it("returns REDIS_URL from environment", async () => {
      const { getRedisUrl } = await import("../connection.js");
      expect(getRedisUrl()).toBe("redis://localhost:6379");
    });

    it("throws when REDIS_URL is not set", async () => {
      delete process.env["REDIS_URL"];
      const { getRedisUrl } = await import("../connection.js");
      expect(() => getRedisUrl()).toThrow(
        "REDIS_URL environment variable is required",
      );
    });
  });

  describe("getRedisConnection", () => {
    it("creates a Redis connection", async () => {
      const { getRedisConnection } = await import("../connection.js");
      const conn = getRedisConnection();
      expect(conn).toBeDefined();
      expect(MockRedis).toHaveBeenCalledWith("redis://localhost:6379", {
        maxRetriesPerRequest: null,
      });
    });

    it("returns singleton on subsequent calls", async () => {
      const { getRedisConnection } = await import("../connection.js");
      const conn1 = getRedisConnection();
      const conn2 = getRedisConnection();
      expect(conn1).toBe(conn2);
      expect(MockRedis).toHaveBeenCalledTimes(1);
    });
  });

  describe("closeRedis", () => {
    it("closes the connection and resets singleton", async () => {
      const { getRedisConnection, closeRedis } = await import(
        "../connection.js"
      );
      getRedisConnection();
      await closeRedis();
      expect(mockQuit).toHaveBeenCalled();
    });

    it("is safe to call when not initialized", async () => {
      const { closeRedis } = await import("../connection.js");
      await expect(closeRedis()).resolves.toBeUndefined();
    });
  });
});
