# Technical Requirements Document (TRD)

## PReview -- AI-Powered PR & Issue Intelligence Platform for Open-Source Maintainers

**Version:** 1.1
**Date:** 2026-02-16
**Origin:** [Peter Steinberger's tweet](https://x.com/steipete/status/2023057089346580828) requesting AI tooling for PR/Issue deduplication and triage on OpenClaw (180K+ stars, 3100+ open PRs)

---

## 1. Problem Statement

Open-source maintainers of high-velocity repositories face an existential workflow crisis:

| Metric                      | Reality                                                                                      |
| --------------------------- | -------------------------------------------------------------------------------------------- |
| PR growth rate (OpenClaw)   | 400+ new PRs/day                                                                             |
| Legitimate AI-generated PRs | ~10% ([source](https://www.theregister.com/2026/02/03/github_kill_switch_pull_requests_ai/)) |
| Maintainer review capacity  | ~50-80 PRs/day (generous)                                                                    |
| Duplicate/overlapping PRs   | Estimated 30-60% on viral repos                                                              |

**Core pain points (from steipete's tweet + thread + HN discussion):**

1. **Duplicate PRs/Issues** -- Multiple contributors solve the same problem independently. No tooling surfaces this at scale.
2. **Quality signal detection** -- Among N duplicate PRs, identifying the _best_ one requires deep code review, not just surface matching.
3. **Vision drift** -- PRs that don't align with project goals waste review cycles. Maintainers need automated alignment checks against a "vision document."
4. **Cognitive overload** -- The review trust model is broken when PR authors (human or AI) may not understand their own submissions.
5. **Abandoned PRs** -- AI-generated slop PRs are frequently abandoned after submission, clogging the queue.

**steipete's exact requirements (from tweet thread):**

> "I need AI that scans every PR and Issue and de-dupes. It should also detect which PR is the best based on various signals (so really also deep review). Ideally have a vision document and mark/reject PRs that stray too far. Can't be fully automated -- but even assisting would help."

---

## 2. Project Scope

### 2.1 In Scope

| Capability                  | Description                                                                    |
| --------------------------- | ------------------------------------------------------------------------------ |
| **PR Deduplication**        | Semantic clustering of PRs that address the same issue/feature                 |
| **Issue Deduplication**     | Detection and linking of duplicate/related issues                              |
| **PR Quality Ranking**      | Multi-signal scoring to rank competing PRs solving the same problem            |
| **Vision Alignment Check**  | Compare PR intent against a maintainer-defined project vision/roadmap document |
| **Automated Triage Labels** | Auto-classification: bug fix, feature, refactor, docs, test, chore             |
| **PR Staleness Detection**  | Flag abandoned, stale, or low-engagement PRs                                   |
| **Maintainer Dashboard**    | Web UI for reviewing clusters, rankings, and triage decisions                  |
| **GitHub Integration**      | Native GitHub App + GitHub Actions workflow                                    |
| **API**                     | REST + webhooks for third-party integrations                                   |

### 2.2 Out of Scope (v1)

- Automated merge decisions (always human-in-the-loop for merge, no exceptions)
- Non-GitHub platforms (GitLab, Bitbucket -- deferred to v2)
- Inline code-review comments and repository-level code suggestions (covered by existing tools like CodeRabbit, PR-Agent)
- CI/CD pipeline integration beyond status checks
- Auto-generated code fixes or refactoring suggestions

---

## 3. Use Cases

### UC-1: Duplicate PR Detection & Clustering

**Actor:** Maintainer
**Trigger:** New PR is opened
**Flow:**

1. System receives webhook for new PR
2. Extracts PR metadata: title, description, changed files, diff hunks, linked issues
3. Generates semantic embedding of PR intent (not just code similarity)
4. Compares against all open PRs using ANN (Approximate Nearest Neighbor) index
5. If similarity > configurable threshold, creates a **PR Cluster**
6. Posts a comment on the PR: "This PR appears related to #X, #Y, #Z. Cluster: [link to dashboard]"
7. Labels PR with `duplicate-candidate` or `cluster:ABC`

**Edge Cases:**

- PRs that solve the same issue differently (same intent, different approach) -- must cluster these
- PRs that partially overlap (touches same files but different scope) -- mark as `related`, not `duplicate`
- New PR matches PRs across two existing clusters -- triggers cluster merge evaluation (see Section 4.2.3)

### UC-2: Best-PR Ranking Within a Cluster

**Actor:** Maintainer reviewing a cluster
**Trigger:** Cluster has 2+ PRs
**Flow:**

1. For each PR in cluster, compute quality signals:
   - **Code quality score**: lint compliance, test coverage delta, complexity metrics
   - **Diff cleanliness**: minimal changes, no unrelated modifications, proper commit hygiene
   - **Test inclusion**: does the PR add/modify tests?
   - **Description quality**: clear problem statement, solution explanation, linked issue
   - **Author engagement**: current-PR activity (replies to reviews, iterations, follow-ups) and contributor history
   - **Responsiveness**: time-to-respond to review comments
   - **Abandonment risk**: probability that the PR will be abandoned based on behavioral signals (see Section 4.2.4)
2. Weighted composite score displayed in dashboard
3. Maintainer sees ranked list with drill-down into each signal
4. One-click action: "Approve as primary", "Request changes", "Close as duplicate"

### UC-3: Vision Alignment Check

**Actor:** Maintainer (setup), System (continuous)
**Trigger:** New PR opened, or maintainer updates vision doc
**Flow:**

1. Maintainer uploads/links a **Vision Document** (markdown, project roadmap, CONTRIBUTING.md, or free-text goals)
2. System chunks and embeds the vision document into the vector store
3. On each new PR, system computes alignment score: how well does this PR's intent match stated project goals?
4. PRs with low alignment get labeled `needs-alignment-review` and a comment explaining the mismatch
5. Maintainer can configure auto-close for PRs below a threshold (opt-in, dangerous)

### UC-4: Issue Deduplication

**Actor:** Contributor opens issue
**Trigger:** New issue created/edited
**Flow:**

1. System embeds issue title + body
2. Searches existing open issues for semantic duplicates
3. If duplicate found: comment with link to original, apply `duplicate` label
4. If related (not exact duplicate): comment with "See also: #X" cross-reference

### UC-5: Stale & Abandoned PR Detection

**Actor:** System (scheduled)
**Trigger:** Cron job (daily)
**Flow:**

1. Scan all open PRs for:
   - No author activity in N days (configurable, default: 14)
   - Unresolved review comments with no response
   - Merge conflicts unresolved for N days
   - CI failures unaddressed
2. Apply a single `stale` label. Staleness stage (warning, stale, abandoned) is tracked as metadata in the database and displayed on the dashboard, not as separate labels.
3. Post comment with grace period before auto-close
4. Exclude PRs with `do-not-close` or other exempt labels (configurable)

### UC-6: Maintainer Dashboard

**Actor:** Maintainer
**Flow:**

1. Overview: total open PRs, clusters, duplicates detected, PRs triaged today
2. Cluster view: grouped PRs with rankings, diffs, and signal breakdowns
3. Vision alignment heatmap: which areas of the codebase are getting PRs vs. what the vision prioritizes
4. Triage queue: PRs sorted by priority (needs review > needs-alignment > stale)
5. Bulk actions: close all duplicates in cluster, assign labels, request changes

---

## 4. Technical Architecture

### 4.1 High-Level Architecture

```
+------------------------------------------------------------------+
|                        GitHub Platform                            |
|  +----------+  +----------+  +----------+  +----------------+   |
|  |   PRs    |  |  Issues  |  | Webhooks |  |  GitHub API    |   |
|  +----+-----+  +----+-----+  +----+-----+  +-------+--------+   |
+-------|--------------|--------------|--------------|--------------+
        |              |              |              |
        v              v              v              v
+------------------------------------------------------------------+
|                     PReview Ingestion Layer                       |
|  +--------------+  +--------------+  +-----------------------+   |
|  | Webhook      |  | Batch Sync   |  | Rate-Limited GitHub   |   |
|  | Receiver     |  | Worker       |  | Client                |   |
|  +------+-------+  +------+-------+  +-----------+-----------+   |
+---------|-----------------|-----------------------|---------------+
          |                 |                       |
          v                 v                       v
+------------------------------------------------------------------+
|                     Message Queue (BullMQ + Redis)                |
+----------------------------+-------------------------------------+
                             |
            +----------------+----------------+
            v                v                v
+----------------+ +--------------+ +------------------+
| Embedding      | | Analysis     | | Vision           |
| Pipeline       | | Pipeline     | | Alignment Engine |
|                | |              | |                  |
| - Intent       | | - Code qual  | | - Vision doc     |
|   extraction   | | - Test cov   | |   embedding      |
| - Diff-aware   | | - Author sig | | - Alignment      |
|   fallback     | | - Abandon    | |   scoring        |
| - Semantic     | |   risk       | | - Drift alerts   |
|   embedding    | | - Staleness  | |                  |
+-------+--------+ +------+-------+ +--------+---------+
        |                 |                   |
        v                 v                   v
+------------------------------------------------------------------+
|                     Core Intelligence Layer                       |
|  +------------------+  +------------------+  +---------------+   |
|  | Dedup Engine      |  | Ranking Engine   |  | Triage Engine |   |
|  | (ANN + LLM judge) |  | (Multi-signal)   |  | (Rule + ML)   |   |
|  +------------------+  +------------------+  +---------------+   |
+----------------------------+-------------------------------------+
                             |
            +----------------+----------------+
            v                v                v
+----------------+ +--------------+ +------------------+
| PostgreSQL 17  | | pgvector     | | Action Dispatcher|
| (metadata,     | | (HNSW index, | | (GitHub comments,|
|  clusters,     | |  embeddings) | |  labels, status  |
|  scores,       | |              | |  checks)         |
|  audit log)    | |              | |                  |
+----------------+ +--------------+ +--------+---------+
                                             |
                                             v
                                    +----------------+
                                    | Web Dashboard  |
                                    | (Next.js 15)   |
                                    +----------------+
```

### 4.2 Component Breakdown

#### 4.2.1 Ingestion Layer

- **Webhook Receiver**: Fastify server handling GitHub `pull_request.*`, `issues.*`, `issue_comment.*`, `pull_request_review.*` events
- **Batch Sync Worker**: On first install, backfills all existing open PRs/issues via GitHub REST API with pagination and rate-limit respect
- **Rate-Limited GitHub Client**: Octokit wrapper with token rotation, retry logic, conditional requests (ETags), and secondary rate limit handling

#### 4.2.2 Embedding Pipeline

- **Three-stage embedding strategy** (addresses HN criticism that "naive embeddings don't work"):
  1. **Intent Extraction (LLM)**: Use a fast model (Claude Haiku 4.5 / GPT-4o-mini) to summarize each PR into a structured intent from title, body, and file list:
     ```json
     {
       "problem": "Fix race condition in connection pool",
       "approach": "Add mutex lock around pool.acquire()",
       "files_changed_summary": "src/pool.ts: added lock, tests/pool.test.ts: new test",
       "category": "bug_fix",
       "scope": "core/networking"
     }
     ```
  2. **Diff-Aware Fallback**: If the description quality score is below a threshold (empty body, generic description, or auto-generated template text), the system extracts intent from the actual diff hunks instead. This catches PRs where the description is missing or misleading -- common with AI-generated slop.
  3. **Semantic Embedding**: Embed the structured intent (not raw diff) using `text-embedding-3-large` (3072 dimensions)
- **Why three stages**: Raw diffs are noisy. Two PRs fixing the same bug with different approaches will have very different diffs but near-identical intents. The LLM extraction normalizes this. The diff-aware fallback ensures PRs with poor descriptions still get meaningful embeddings.

#### 4.2.3 Deduplication Engine

- **ANN Index**: pgvector with HNSW index for sub-100ms nearest-neighbor lookup
- **Adaptive threshold tiers**: Default thresholds are provided, but the system calibrates per-repo during initial sync by computing the baseline similarity distribution across all open PRs. Thresholds are then set at percentile-based boundaries relative to that distribution. This prevents a repo with 50 PRs from using the same thresholds as one with 5000.
  - Default thresholds (used until calibration completes):
    - `> 0.92` similarity: **High confidence duplicate** (auto-label, auto-comment)
    - `0.80 - 0.92`: **Probable duplicate** (flag for review, suggest cluster)
    - `0.65 - 0.80`: **Related** (cross-reference only)
    - `< 0.65`: **Distinct** (no action)
  - Calibrated thresholds are stored per-repo in the `repositories.config` column and can be manually overridden via `.github/preview.yml`
- **LLM Judge (second pass)**: For high-similarity pairs, invoke an LLM to confirm: "Are these two PRs solving the same problem? If so, which is better and why?" This addresses the O(n^2) concern by only invoking LLM on ANN-filtered candidates.
- **Incremental updates**: New PRs only compare against existing index entries, not full pairwise recompute
- **Cluster merging**: When a new PR matches PRs in two different existing clusters above the probable-duplicate threshold, the system proposes a cluster merge. Merges are auto-applied if both clusters have fewer than 5 members; otherwise, they are flagged for maintainer approval on the dashboard.

#### 4.2.4 PR Quality Ranking Engine

**Signal weights (configurable per repo):**

| Signal                          | Weight | Source                                                          |
| ------------------------------- | ------ | --------------------------------------------------------------- |
| Code quality (lint, complexity) | 0.15   | Static analysis (ESLint, Ruff, etc.) via CI status              |
| Test coverage delta             | 0.20   | CI coverage reports                                             |
| Diff minimality                 | 0.10   | Lines changed vs. problem scope                                 |
| Description quality             | 0.10   | LLM assessment                                                  |
| Author engagement               | 0.10   | Current-PR activity (replies, iterations) + contributor history |
| Responsiveness to reviews       | 0.10   | Time-to-reply on review comments                                |
| Abandonment risk (inverse)      | 0.10   | Behavioral signals (see below)                                  |
| Vision alignment score          | 0.15   | Cosine similarity to vision doc                                 |

**Abandonment Risk Signals** (replaces "AI-generation detection" -- the problem is abandonment, not authorship):

- No follow-up activity after submission (no replies to comments, no force-pushes)
- Single-commit PRs with large diffs and no iteration
- Generic PR descriptions (auto-generated template text with no customization)
- Account age < 30 days with no prior activity on the repository
- Uniform commit messages ("Update file.py", "Fix issue")
- Unresolved review comments with no author response after 72 hours

Note: The ranking engine does not penalize a PR for being AI-generated. An AI-generated PR that is actively maintained, iterated on, and responsive to reviews scores the same as a human-authored PR with equal quality. The signal is engagement and follow-through, not authorship.

#### 4.2.5 Vision Alignment Engine

- Maintainer provides one or more "vision documents": `ROADMAP.md`, `VISION.md`, `CONTRIBUTING.md`, or free-text in dashboard
- Documents are chunked (by section/heading) and embedded into the vector store with metadata tracking the source document and chunk position
- Each PR's intent embedding is compared against vision chunks
- **Alignment score**: weighted cosine similarity across top-K vision chunks
- **Misalignment report**: LLM generates a 2-sentence explanation of _why_ a PR doesn't align (e.g., "This PR adds a dark mode feature, but the current roadmap prioritizes API stability and performance")
- **Re-scoring on vision update**: When a maintainer updates a vision document, all open PRs are re-scored against the new vision. This is enqueued as a background job with lower priority than real-time webhook processing.

#### 4.2.6 Action Dispatcher

All actions are **configurable** and **auditable**:

| Action                            | Default | Configurable |
| --------------------------------- | ------- | ------------ |
| Post duplicate comment            | ON      | Yes          |
| Apply `duplicate-candidate` label | ON      | Yes          |
| Auto-close confirmed duplicates   | OFF     | Yes (opt-in) |
| Post vision misalignment comment  | ON      | Yes          |
| Auto-close misaligned PRs         | OFF     | Yes (opt-in) |
| Apply triage labels               | ON      | Yes          |
| Post staleness warnings           | ON      | Yes          |
| Auto-close stale PRs              | OFF     | Yes (opt-in) |

---

## 5. Data Model

```sql
-- Core entities
CREATE TABLE repositories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    github_id       BIGINT UNIQUE NOT NULL,
    full_name       TEXT NOT NULL,            -- "owner/repo"
    vision_doc      TEXT,                     -- raw vision document text
    config          JSONB DEFAULT '{}',       -- per-repo config overrides (includes calibrated thresholds)
    installed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE clusters (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repo_id         UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    cluster_type    TEXT NOT NULL CHECK (cluster_type IN ('pr', 'issue')),
    summary         TEXT,                     -- LLM-generated cluster summary
    status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE pull_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repo_id         UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    github_number   INT NOT NULL,
    github_id       BIGINT UNIQUE NOT NULL,
    title           TEXT NOT NULL,
    body            TEXT,
    author_login    TEXT NOT NULL,
    author_id       BIGINT NOT NULL,
    state           TEXT NOT NULL CHECK (state IN ('open', 'closed', 'merged')),
    files_changed   TEXT[],
    diff_stats      JSONB,                   -- {additions, deletions, changed_files}
    intent_summary  JSONB,                   -- LLM-extracted structured intent
    embedding       VECTOR(3072),            -- semantic embedding
    quality_score   FLOAT,
    abandon_risk    FLOAT,                   -- abandonment risk probability (0-1)
    vision_score    FLOAT,                   -- alignment to vision doc (0-1)
    staleness_stage TEXT DEFAULT 'active' CHECK (staleness_stage IN ('active', 'warning', 'stale', 'abandoned')),
    created_at      TIMESTAMPTZ NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL,
    analyzed_at     TIMESTAMPTZ,
    UNIQUE(repo_id, github_number)
);

CREATE TABLE issues (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repo_id         UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    github_number   INT NOT NULL,
    github_id       BIGINT UNIQUE NOT NULL,
    title           TEXT NOT NULL,
    body            TEXT,
    labels          TEXT[],
    embedding       VECTOR(3072),
    created_at      TIMESTAMPTZ NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    analyzed_at     TIMESTAMPTZ,
    UNIQUE(repo_id, github_number)
);

-- Cluster membership (replaces circular FK between pull_requests/clusters)
CREATE TABLE cluster_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id      UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    item_type       TEXT NOT NULL CHECK (item_type IN ('pr', 'issue')),
    item_id         UUID NOT NULL,
    rank            INT,                     -- position within cluster (1 = best)
    similarity      FLOAT,                   -- similarity score to cluster centroid
    added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(cluster_id, item_id)
);

-- Vision document chunks for alignment scoring
CREATE TABLE vision_chunks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repo_id         UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    source_file     TEXT,                    -- "ROADMAP.md", "CONTRIBUTING.md", or "inline"
    chunk_index     INT NOT NULL,            -- position within source document
    content         TEXT NOT NULL,            -- raw chunk text
    embedding       VECTOR(3072),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit trail for all automated actions
CREATE TABLE actions_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repo_id         UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    target_type     TEXT NOT NULL CHECK (target_type IN ('pr', 'issue')),
    target_number   INT NOT NULL,
    action_type     TEXT NOT NULL CHECK (action_type IN ('comment', 'label', 'close', 'status_check', 'cluster_assign')),
    payload         JSONB,
    executed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_pr_embedding ON pull_requests USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_issue_embedding ON issues USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_vision_embedding ON vision_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_cluster_members_cluster ON cluster_members(cluster_id);
CREATE INDEX idx_cluster_members_item ON cluster_members(item_type, item_id);
CREATE INDEX idx_pr_repo_state ON pull_requests(repo_id, state);
CREATE INDEX idx_pr_staleness ON pull_requests(repo_id, staleness_stage) WHERE state = 'open';
CREATE INDEX idx_issues_repo ON issues(repo_id);
CREATE INDEX idx_actions_repo_target ON actions_log(repo_id, target_type, target_number);
CREATE INDEX idx_vision_chunks_repo ON vision_chunks(repo_id);
CREATE INDEX idx_clusters_repo_status ON clusters(repo_id, status);
```

---

## 6. Tech Stack

| Layer                       | Technology                                                           | Rationale                                                                                                                         |
| --------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Runtime**                 | Node.js 22 (TypeScript, strict mode)                                 | GitHub ecosystem native, Octokit first-class support                                                                              |
| **Web Framework**           | Fastify                                                              | Low overhead for webhook-heavy workload                                                                                           |
| **Queue**                   | BullMQ + Redis                                                       | Reliable job processing with retries, rate limiting, priority queues                                                              |
| **Database**                | PostgreSQL 17 + pgvector                                             | Single DB for relational + vector storage, reduces operational complexity. pgvector with HNSW is sufficient for sub-100K vectors. |
| **ORM / Query Builder**     | Drizzle ORM                                                          | Type-safe queries, migration management, lightweight                                                                              |
| **Embedding Model**         | OpenAI `text-embedding-3-large` (3072 dimensions)                    | Best-in-class retrieval performance. Single model to avoid cross-model similarity drift.                                          |
| **LLM (Intent Extraction)** | Claude Haiku 4.5                                                     | Fast, cheap, structured output via tool use                                                                                       |
| **LLM (Judge/Ranking)**     | Claude Sonnet 4.5                                                    | Nuanced code understanding for quality ranking                                                                                    |
| **Dashboard**               | Next.js 15 + Tailwind CSS + shadcn/ui                                | Rapid UI development, SSR for dashboard                                                                                           |
| **Auth**                    | GitHub OAuth (GitHub App installation flow)                          | Zero-friction for target users                                                                                                    |
| **Monorepo**                | Turborepo                                                            | Shared types/config across API and dashboard                                                                                      |
| **Deployment**              | Docker, `docker compose` for self-hosted. Railway / Fly.io for SaaS. | Flexible deployment model                                                                                                         |
| **Monitoring**              | OpenTelemetry + Grafana                                              | Observability for webhook processing, LLM latency, queue depth                                                                    |

### 6.1 Monorepo Structure

```
preview/
  packages/
    core/              # Shared types, constants, config schema validation
    api/               # Fastify backend, webhook handler, BullMQ workers
    dashboard/         # Next.js 15 frontend
    github-action/     # Lightweight GitHub Action wrapper
    db/                # Drizzle schema, migrations, seed scripts
  docker/
    docker-compose.yml
    Dockerfile.api
    Dockerfile.dashboard
  turbo.json
  package.json
  tsconfig.base.json
```

---

## 7. API Specification

### 7.1 Authentication

All REST API endpoints require authentication via one of:

- **GitHub App installation token**: For programmatic access and GitHub Action usage. Validated against the GitHub App's installation ID for the target repository.
- **Session cookie**: For dashboard users authenticated via GitHub OAuth flow. Session is stored server-side in Redis with a 24-hour TTL.

The webhook endpoint (`/api/webhooks/github`) authenticates via `X-Hub-Signature-256` HMAC validation against the app's webhook secret.

### 7.2 Rate Limiting

All REST API endpoints are rate-limited per installation:

- **Standard tier**: 100 requests/minute
- **Pro/Team tier**: 500 requests/minute
- **Self-hosted**: Configurable, defaults to unlimited

Rate limit headers are included in all responses: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

### 7.3 Pagination

All list endpoints use **cursor-based pagination** with the following query parameters:

- `cursor`: Opaque cursor string from the previous response
- `limit`: Number of items per page (default: 50, max: 100)

Response format:

```json
{
  "data": [...],
  "pagination": {
    "next_cursor": "eyJpZCI6...",
    "has_more": true
  }
}
```

### 7.4 Webhook Endpoint (Incoming)

```
POST /api/webhooks/github
Headers: X-GitHub-Event, X-Hub-Signature-256
```

Validates HMAC signature, enqueues processing job, returns `202 Accepted` immediately.

### 7.5 REST API (Dashboard + Integrations)

```
GET    /api/v1/repos/:owner/:repo/clusters              # List PR/Issue clusters
GET    /api/v1/repos/:owner/:repo/clusters/:id           # Cluster detail with ranked members
POST   /api/v1/repos/:owner/:repo/clusters/:id/resolve   # Mark cluster resolved
DELETE /api/v1/repos/:owner/:repo/clusters/:id            # Dismiss cluster

GET    /api/v1/repos/:owner/:repo/prs                    # List PRs with scores
GET    /api/v1/repos/:owner/:repo/prs/:number/analysis   # Full PR analysis breakdown
DELETE /api/v1/repos/:owner/:repo/prs/:number/analysis   # Clear analysis, trigger re-analyze

GET    /api/v1/repos/:owner/:repo/issues                 # List issues with dedup status

POST   /api/v1/repos/:owner/:repo/vision                 # Upload/update vision document
GET    /api/v1/repos/:owner/:repo/vision                 # Get current vision document and chunks
DELETE /api/v1/repos/:owner/:repo/vision                 # Remove vision document

GET    /api/v1/repos/:owner/:repo/stats                  # Dashboard statistics

POST   /api/v1/repos/:owner/:repo/resync                 # Trigger full re-analysis (idempotent: deduplicates against in-progress jobs by repo_id)

PUT    /api/v1/repos/:owner/:repo/config                 # Update repo configuration
GET    /api/v1/repos/:owner/:repo/config                 # Get current configuration

GET    /api/v1/repos/:owner/:repo/actions                # Audit log of all automated actions
```

### 7.6 Webhook Notifications (Outgoing)

```
POST {user_configured_url}
Headers: X-PReview-Event, X-PReview-Signature (HMAC)
Payload: { event: "cluster_created" | "duplicate_detected" | "vision_drift" | "stale_pr", data: {...} }
```

---

## 8. Scalability & Performance

### 8.1 Target Performance

| Operation                         | Target Latency | Strategy                              |
| --------------------------------- | -------------- | ------------------------------------- |
| Webhook receipt to job enqueued   | < 200ms        | Immediate 202 ack, async processing   |
| PR analysis (embedding + scoring) | < 30s          | Parallel LLM calls, cached embeddings |
| ANN similarity search             | < 100ms        | HNSW index on pgvector                |
| Full cluster recompute (1000 PRs) | < 5 min        | Incremental, not full pairwise        |
| Dashboard page load               | < 500ms        | SSR + query optimization              |

### 8.2 Scaling Strategy

- **Horizontal worker scaling**: BullMQ workers scale independently; add workers when queue depth exceeds threshold
- **Embedding cache**: Once computed, embeddings are immutable. PR body changes trigger re-embed.
- **LLM cost control**: Intent extraction only on new/updated PRs; judge invocations only on ANN-filtered pairs (reduces O(n^2) to O(n \* k) where k = avg cluster size)

### 8.3 Cost Model

**Per 1000 PRs analyzed (initial analysis):**

| Operation                                          | Estimated Cost |
| -------------------------------------------------- | -------------- |
| Intent extraction (Haiku, ~500 tokens/PR)          | ~$0.50         |
| Embeddings (3072-dim, ~500 tokens/PR)              | ~$0.30         |
| Judge calls (Sonnet, ~50 comparisons at 1K tokens) | ~$2.00         |
| **Total**                                          | **~$2.80**     |

**Re-analysis costs (must be budgeted separately):**

| Trigger                 | Scope                                 | Estimated Cost per 1000 PRs |
| ----------------------- | ------------------------------------- | --------------------------- |
| Vision document update  | Re-score all open PRs (no re-embed)   | ~$0.20                      |
| Embedding model upgrade | Re-embed + re-cluster all PRs         | ~$3.50                      |
| Threshold recalibration | Re-cluster only (no re-embed, no LLM) | ~$0.00                      |

---

## 9. Deployment Models

### 9.1 SaaS (Hosted)

- GitHub App installed from marketplace
- Freemium: free for public repos with < 500 open PRs, paid tiers for larger repos / private repos
- Multi-tenant, isolated per-repo data

### 9.2 Self-Hosted (Open Source)

- Single `docker compose up` with PostgreSQL + Redis + app
- Bring-your-own LLM API keys (OpenAI, Anthropic, or local models via Ollama)
- Configuration via `.github/preview.yml` in repo root

### 9.3 GitHub Action (Lightweight)

- For repos that want dedup/triage without a full deployment
- Runs on `pull_request` and `issues` triggers
- Uses GitHub Actions cache for embedding persistence
- Limited to per-run analysis (no persistent cluster state)

---

## 10. Configuration Schema

```yaml
# .github/preview.yml
preview:
  version: 1

  # Vision document(s) for alignment checking
  vision:
    files:
      - ROADMAP.md
      - CONTRIBUTING.md
    text: |
      Focus on API stability and performance.
      No new UI features until v3.0.

  # Deduplication settings
  dedup:
    pr_threshold: 0.85 # similarity score for duplicate flag (overrides calibrated value)
    issue_threshold: 0.88
    auto_close_duplicates: false
    exclude_labels: ["do-not-close", "wip"]

  # Quality ranking weights
  # Must sum to 1.0. If they do not, the system normalizes them proportionally
  # and logs a warning. Omitted fields use the default weight.
  ranking:
    code_quality: 0.15
    test_coverage: 0.20
    diff_minimality: 0.10
    description_quality: 0.10
    author_engagement: 0.10
    responsiveness: 0.10
    abandonment_risk: 0.10
    vision_alignment: 0.15

  # Staleness rules
  staleness:
    warning_after_days: 14
    stale_after_days: 30
    close_after_days: 60
    exempt_labels: ["long-running", "blocked", "do-not-close"]

  # Abandonment risk detection
  abandonment_detection:
    enabled: true
    flag_threshold: 0.75 # probability above this triggers flag
    auto_label: true

  # Notifications
  notifications:
    webhook_url: https://your-slack-webhook.example.com
    webhook_secret: ${PREVIEW_WEBHOOK_SECRET} # HMAC signing secret for outgoing webhooks
    events: [cluster_created, vision_drift, stale_pr]
```

**Validation rules:**

- `ranking` weights must be non-negative. If they do not sum to 1.0, the system auto-normalizes and logs a warning.
- Omitted `ranking` fields inherit default values before normalization.
- `staleness` day values must satisfy: `warning_after_days < stale_after_days < close_after_days`.
- `dedup` threshold values must be between 0.0 and 1.0.
- Invalid configuration is rejected on save via the API. For `.github/preview.yml`, invalid config is reported as a commit status check failure with a descriptive error message.

---

## 11. Competitive Landscape & Differentiation

| Tool                                                                         | Scope                | Key Limitation                                | PReview Advantage                                  |
| ---------------------------------------------------------------------------- | -------------------- | --------------------------------------------- | -------------------------------------------------- |
| [ai-duplicate-detector](https://github.com/mackgorski/ai-duplicate-detector) | Issue dedup only     | No PR support, 100 issues/run cap, no ranking | Full PR+Issue dedup, ranking, vision alignment     |
| [Dosu](https://dosu.dev)                                                     | Issue triage         | No PR dedup, no code-level analysis           | Deep PR analysis with diff understanding           |
| [trIAge](https://github.com/trIAgelab/trIAge)                                | Issue classification | No PR quality ranking                         | Multi-signal PR ranking engine                     |
| [PR-Agent (Qodo)](https://github.com/qodo-ai/pr-agent)                       | PR review            | No dedup, no clustering, no vision alignment  | Complementary -- PReview triages, PR-Agent reviews |
| [CodeRabbit](https://github.com/coderabbitai/ai-pr-reviewer)                 | PR review            | No dedup, no maintainer dashboard             | Different focus -- PReview is triage, not review   |
| GitHub native (proposed)                                                     | TBD                  | Not shipped yet, likely basic                 | Purpose-built, open-source, extensible             |

**PReview's unique value**: It is the only tool that combines **deduplication + quality ranking + vision alignment + maintainer dashboard** in a single platform. It does not replace code review tools -- it ensures maintainers review the _right_ PRs.

---

## 12. Commercialization Strategy

### 12.1 Open-Source Core (AGPLv3)

- Full dedup engine, ranking, triage, GitHub Action
- Self-hosted deployment with BYO API keys
- Community-maintained, accepting contributions

### 12.2 Paid SaaS Tiers

| Tier           | Price   | Includes                                                                     |
| -------------- | ------- | ---------------------------------------------------------------------------- |
| **Free**       | $0      | Public repos, < 500 open PRs, 3 repos                                        |
| **Pro**        | $49/mo  | Private repos, < 5000 open PRs, 20 repos, Slack/Discord notifications        |
| **Team**       | $149/mo | Unlimited repos, team dashboard, SSO, priority queue, custom ranking weights |
| **Enterprise** | Custom  | On-prem deployment, dedicated support, custom LLM integration, audit logs    |

### 12.3 Revenue Expansion

- **Marketplace integrations**: Jira, Linear, Notion sync for cluster management
- **Analytics**: PR velocity trends, contributor quality scores, vision drift over time
- **API access**: Charge for high-volume API usage beyond included tiers

---

## 13. Implementation Phases

### Phase 1: Infrastructure & Ingestion (Weeks 1-3)

- [ ] Monorepo setup (Turborepo, TypeScript strict, ESLint, Prettier)
- [ ] CI/CD pipeline (GitHub Actions: lint, type-check, test, build)
- [ ] Database schema and migrations (Drizzle ORM, pgvector extension)
- [ ] GitHub App scaffold with webhook receiver (Fastify, signature validation)
- [ ] PR/Issue ingestion pipeline with batch sync worker
- [ ] Rate-limited GitHub client (Octokit wrapper with token rotation, ETags)
- [ ] BullMQ job queue setup with Redis

### Phase 2: Core Intelligence (Weeks 4-6)

- [ ] Intent extraction LLM pipeline (structured output via Claude Haiku)
- [ ] Diff-aware fallback for low-quality descriptions
- [ ] Embedding generation and pgvector HNSW storage
- [ ] ANN-based deduplication with default thresholds
- [ ] LLM Judge for duplicate confirmation (Claude Sonnet)
- [ ] Cluster creation and membership management
- [ ] GitHub comment/label action dispatcher

### Phase 3: Advanced Features (Weeks 7-9)

- [ ] PR quality ranking engine (all 8 signals)
- [ ] Abandonment risk scoring
- [ ] Vision document ingestion, chunking, and embedding
- [ ] Vision alignment scoring and misalignment reports
- [ ] Per-repo threshold calibration during initial sync
- [ ] Staleness detection cron job
- [ ] Configuration loading from `.github/preview.yml`
- [ ] Configuration validation and commit status reporting

### Phase 4: Dashboard & Polish (Weeks 10-13)

- [ ] Next.js dashboard with GitHub OAuth authentication
- [ ] Cluster visualization and management UI
- [ ] Triage queue with bulk actions
- [ ] Vision alignment heatmap
- [ ] Outgoing webhook notifications
- [ ] Monitoring and alerting (OpenTelemetry)
- [ ] Documentation site and onboarding flow
- [ ] GitHub Action wrapper for lightweight usage

### Phase 5: Scale & Launch (Weeks 14-16)

- [ ] Multi-tenant SaaS deployment
- [ ] Billing integration (Stripe)
- [ ] API rate limiting and usage metering
- [ ] Performance optimization for repos with 5000+ open PRs
- [ ] Public launch and GitHub Marketplace listing

---

## 14. Success Metrics

| Metric                                         | Target (6 months post-launch) |
| ---------------------------------------------- | ----------------------------- |
| Repos installed                                | 500+                          |
| PRs analyzed                                   | 100K+                         |
| Duplicate detection precision                  | > 90%                         |
| Duplicate detection recall                     | > 75%                         |
| Maintainer time saved per week (surveyed)      | > 5 hours                     |
| False positive rate (incorrect duplicate flag) | < 5%                          |
| Mean time from PR open to triage label         | < 5 minutes                   |
| Dashboard MAU                                  | 200+                          |

---

## 15. Risk Register

| Risk                                                | Impact | Likelihood | Mitigation                                                                                               |
| --------------------------------------------------- | ------ | ---------- | -------------------------------------------------------------------------------------------------------- |
| LLM hallucinations mislabel PRs                     | High   | Medium     | LLM Judge as second pass; human-in-the-loop for destructive actions; confidence scores displayed         |
| GitHub API rate limits hit on large repos           | High   | High       | Token rotation, conditional requests (ETags), aggressive caching, batch sync during off-peak             |
| Embedding model changes break similarity thresholds | Medium | Low        | Version-pin embeddings; re-embed on model change with migration script; per-repo threshold recalibration |
| Maintainer trust erosion from false positives       | High   | Medium     | Conservative default thresholds; all auto-close actions OFF by default; clear audit trail                |
| LLM cost spikes on viral repos                      | Medium | Medium     | Cost caps per repo; intent extraction caching; tiered LLM usage (Haiku first, Sonnet only for judge)     |
| GitHub ships native solution                        | High   | Medium     | Open-source moat; deeper features (vision alignment, ranking); platform-agnostic v2                      |

---

## 16. Open Questions for Implementation

1. **Embedding model benchmarking**: Run benchmarks comparing `text-embedding-3-large` vs open-source alternatives (e.g., `nomic-embed-text`) on a PR dedup dataset. Validate that the chosen model gives best precision/recall at acceptable cost.
2. **Cluster merging strategy**: Validate the "auto-merge below 5 members, flag above" heuristic against real-world cluster data. Tune the merge threshold.
3. **Cross-repo dedup**: For monorepo or multi-repo projects, should dedup work across repositories? Deferred to v2 but needs data model consideration now.
4. **Diff-level analysis**: Should the system compare actual code diffs (AST-level) in addition to intent embeddings for higher accuracy? Evaluate cost/benefit.
5. **Feedback loop**: How should maintainer actions (accepting/rejecting dedup suggestions) feed back into per-repo threshold calibration? Design the feedback data model.

---

_This TRD is the blueprint for PReview -- a tool that addresses a real, validated problem (3100+ PRs on OpenClaw, GitHub considering kill-switches for AI PRs). No existing tool addresses the full scope of deduplication + ranking + vision alignment. Build it open-source, monetize the hosted version._
