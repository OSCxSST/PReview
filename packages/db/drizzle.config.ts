import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env["DATABASE_URL"] ?? "",
  },
  // drizzle-kit has no pgvector filter; "postgis" is the closest workaround for extension columns
  extensionsFilters: ["postgis"],
  verbose: true,
  strict: true,
});
