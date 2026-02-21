-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "actions_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_number" integer NOT NULL,
	"action_type" text NOT NULL,
	"payload" jsonb,
	"executed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cluster_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cluster_id" uuid NOT NULL,
	"item_type" text NOT NULL,
	"item_id" uuid NOT NULL,
	"rank" integer,
	"similarity" real,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clusters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"cluster_type" text NOT NULL,
	"summary" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"github_number" integer NOT NULL,
	"github_id" bigint NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"labels" text[],
	"embedding" vector(3072),
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"analyzed_at" timestamp with time zone,
	CONSTRAINT "issues_github_id_unique" UNIQUE("github_id")
);
--> statement-breakpoint
CREATE TABLE "pull_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"github_number" integer NOT NULL,
	"github_id" bigint NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"author_login" text NOT NULL,
	"author_id" bigint NOT NULL,
	"state" text NOT NULL,
	"files_changed" text[],
	"diff_stats" jsonb,
	"intent_summary" jsonb,
	"embedding" vector(3072),
	"quality_score" real,
	"abandon_risk" real,
	"vision_score" real,
	"staleness_stage" text DEFAULT 'active',
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"analyzed_at" timestamp with time zone,
	CONSTRAINT "pull_requests_github_id_unique" UNIQUE("github_id")
);
--> statement-breakpoint
CREATE TABLE "repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"github_id" bigint NOT NULL,
	"full_name" text NOT NULL,
	"vision_doc" text,
	"config" jsonb DEFAULT '{}'::jsonb,
	"installed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "repositories_github_id_unique" UNIQUE("github_id")
);
--> statement-breakpoint
CREATE TABLE "vision_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"source_file" text,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(3072),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "actions_log" ADD CONSTRAINT "actions_log_repo_id_repositories_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cluster_members" ADD CONSTRAINT "cluster_members_cluster_id_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."clusters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clusters" ADD CONSTRAINT "clusters_repo_id_repositories_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_repo_id_repositories_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_repo_id_repositories_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vision_chunks" ADD CONSTRAINT "vision_chunks_repo_id_repositories_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_actions_repo_target" ON "actions_log" USING btree ("repo_id","target_type","target_number");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_cluster_member_unique" ON "cluster_members" USING btree ("cluster_id","item_id");--> statement-breakpoint
CREATE INDEX "idx_cluster_members_cluster" ON "cluster_members" USING btree ("cluster_id");--> statement-breakpoint
CREATE INDEX "idx_cluster_members_item" ON "cluster_members" USING btree ("item_type","item_id");--> statement-breakpoint
CREATE INDEX "idx_clusters_repo_status" ON "clusters" USING btree ("repo_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_issue_repo_number" ON "issues" USING btree ("repo_id","github_number");--> statement-breakpoint
CREATE INDEX "idx_issues_repo" ON "issues" USING btree ("repo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pr_repo_number" ON "pull_requests" USING btree ("repo_id","github_number");--> statement-breakpoint
CREATE INDEX "idx_pr_repo_state" ON "pull_requests" USING btree ("repo_id","state");--> statement-breakpoint
CREATE INDEX "idx_vision_chunks_repo" ON "vision_chunks" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX "idx_pr_embedding" ON "pull_requests" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "idx_issue_embedding" ON "issues" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "idx_vision_embedding" ON "vision_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "idx_pr_staleness" ON "pull_requests" ("repo_id", "staleness_stage") WHERE "state" = 'open';