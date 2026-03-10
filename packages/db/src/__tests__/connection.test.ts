import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("postgres", () => {
  const end = vi.fn().mockResolvedValue(undefined);
  const mockSql = Object.assign(vi.fn(), { end });
  return { default: vi.fn(() => mockSql) };
});

vi.mock("drizzle-orm/postgres-js", () => ({
  drizzle: vi.fn(() => ({ query: {} })),
}));

describe("connection", () => {
  const originalEnv = process.env["DATABASE_URL"];

  beforeEach(() => {
    vi.resetModules();
    process.env["DATABASE_URL"] = "postgresql://test:test@localhost:5432/test";
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env["DATABASE_URL"] = originalEnv;
    } else {
      delete process.env["DATABASE_URL"];
    }
  });

  it("getDb throws when DATABASE_URL is not set", async () => {
    delete process.env["DATABASE_URL"];
    const { getDb } = await import("../connection.js");
    expect(() => getDb()).toThrow(
      "DATABASE_URL environment variable is required",
    );
  });

  it("getDb returns a database instance", async () => {
    const { getDb } = await import("../connection.js");
    const db = getDb();
    expect(db).toBeDefined();
  });

  it("getDb returns the same singleton instance", async () => {
    const { getDb } = await import("../connection.js");
    const db1 = getDb();
    const db2 = getDb();
    expect(db1).toBe(db2);
  });

  it("closeDb resets the singleton", async () => {
    const { getDb, closeDb } = await import("../connection.js");
    getDb();
    await closeDb();
    // After close, a new call should create a fresh instance
    const db = getDb();
    expect(db).toBeDefined();
  });

  it("closeDb is safe to call when not initialized", async () => {
    const { closeDb } = await import("../connection.js");
    await expect(closeDb()).resolves.toBeUndefined();
  });
});
