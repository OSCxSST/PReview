/**
 * Drizzle ORM schema for PReview database.
 *
 * Matches the data model from TRD Section 5.
 * pgvector columns will be added once drizzle-orm/pg-vector
 * integration is configured with the actual DB connection.
 */

import {
  pgTable,
  uuid,
  bigint,
  text,
  integer,
  real,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const repositories = pgTable("repositories", {
  id: uuid("id").primaryKey().defaultRandom(),
  githubId: bigint("github_id", { mode: "number" }).unique().notNull(),
  fullName: text("full_name").notNull(),
  visionDoc: text("vision_doc"),
  config: jsonb("config").default({}).$type<Record<string, unknown>>(),
  installedAt: timestamp("installed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const clusters = pgTable(
  "clusters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repoId: uuid("repo_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    clusterType: text("cluster_type", { enum: ["pr", "issue"] }).notNull(),
    summary: text("summary"),
    status: text("status", { enum: ["open", "resolved", "dismissed"] })
      .notNull()
      .default("open"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_clusters_repo_status").on(table.repoId, table.status)],
);

export const pullRequests = pgTable(
  "pull_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repoId: uuid("repo_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    githubNumber: integer("github_number").notNull(),
    githubId: bigint("github_id", { mode: "number" }).unique().notNull(),
    title: text("title").notNull(),
    body: text("body"),
    authorLogin: text("author_login").notNull(),
    authorId: bigint("author_id", { mode: "number" }).notNull(),
    state: text("state", { enum: ["open", "closed", "merged"] }).notNull(),
    filesChanged: text("files_changed").array(),
    diffStats: jsonb("diff_stats").$type<{
      additions: number;
      deletions: number;
      changedFiles: number;
    }>(),
    intentSummary: jsonb("intent_summary").$type<{
      problem: string;
      approach: string;
      filesChangedSummary: string;
      category: string;
      scope: string;
    }>(),
    // embedding: vector column added via raw SQL migration (pgvector)
    qualityScore: real("quality_score"),
    abandonRisk: real("abandon_risk"),
    visionScore: real("vision_score"),
    stalenessStage: text("staleness_stage", {
      enum: ["active", "warning", "stale", "abandoned"],
    }).default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    analyzedAt: timestamp("analyzed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("idx_pr_repo_number").on(table.repoId, table.githubNumber),
    index("idx_pr_repo_state").on(table.repoId, table.state),
  ],
);

export const issues = pgTable(
  "issues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repoId: uuid("repo_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    githubNumber: integer("github_number").notNull(),
    githubId: bigint("github_id", { mode: "number" }).unique().notNull(),
    title: text("title").notNull(),
    body: text("body"),
    labels: text("labels").array(),
    // embedding: vector column added via raw SQL migration (pgvector)
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    analyzedAt: timestamp("analyzed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("idx_issue_repo_number").on(table.repoId, table.githubNumber),
    index("idx_issues_repo").on(table.repoId),
  ],
);

export const clusterMembers = pgTable(
  "cluster_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clusterId: uuid("cluster_id")
      .notNull()
      .references(() => clusters.id, { onDelete: "cascade" }),
    itemType: text("item_type", { enum: ["pr", "issue"] }).notNull(),
    itemId: uuid("item_id").notNull(),
    rank: integer("rank"),
    similarity: real("similarity"),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_cluster_member_unique").on(table.clusterId, table.itemId),
    index("idx_cluster_members_cluster").on(table.clusterId),
    index("idx_cluster_members_item").on(table.itemType, table.itemId),
  ],
);

export const visionChunks = pgTable(
  "vision_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repoId: uuid("repo_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    sourceFile: text("source_file"),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    // embedding: vector column added via raw SQL migration (pgvector)
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_vision_chunks_repo").on(table.repoId)],
);

export const actionsLog = pgTable(
  "actions_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repoId: uuid("repo_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    targetType: text("target_type", { enum: ["pr", "issue"] }).notNull(),
    targetNumber: integer("target_number").notNull(),
    actionType: text("action_type", {
      enum: ["comment", "label", "close", "status_check", "cluster_assign"],
    }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    executedAt: timestamp("executed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_actions_repo_target").on(
      table.repoId,
      table.targetType,
      table.targetNumber,
    ),
  ],
);
