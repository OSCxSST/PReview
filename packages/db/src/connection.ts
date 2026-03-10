import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as schema from "./schema.js";

export type Database = PostgresJsDatabase<typeof schema>;

let db: Database | null = null;
let sql: Sql | null = null;

export function getDb(): Database {
  if (db) return db;

  const url = process.env["DATABASE_URL"];
  if (!url) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  sql = postgres(url, {
    max: parseInt(process.env["DB_POOL_MAX"] ?? "10"),
    idle_timeout: parseInt(process.env["DB_IDLE_TIMEOUT"] ?? "20"),
    connect_timeout: parseInt(process.env["DB_CONNECT_TIMEOUT"] ?? "10"),
  });
  db = drizzle(sql, { schema });
  return db;
}

export async function closeDb(): Promise<void> {
  if (sql) {
    await sql.end();
    sql = null;
    db = null;
  }
}
