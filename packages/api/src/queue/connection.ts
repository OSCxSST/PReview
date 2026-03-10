import { Redis } from "ioredis";

let connection: Redis | null = null;

export function getRedisUrl(): string {
  const url = process.env["REDIS_URL"];
  if (!url) {
    throw new Error("REDIS_URL environment variable is required");
  }
  return url;
}

export function getRedisConnection(): Redis {
  if (connection) return connection;

  connection = new Redis(getRedisUrl(), {
    maxRetriesPerRequest: null, // Required by BullMQ
  });

  return connection;
}

export async function closeRedis(): Promise<void> {
  if (!connection) return;
  const conn = connection;
  connection = null;
  try {
    await conn.quit();
  } catch (err) {
    console.error("Redis graceful shutdown failed, forcing disconnect:", err);
    conn.disconnect();
  }
}
