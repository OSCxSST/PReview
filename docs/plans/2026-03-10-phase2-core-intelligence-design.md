# Phase 2: Core Intelligence — Design Document

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| LLM providers | Anthropic (intent + judge) + OpenAI (embeddings) | Follow TRD exactly |
| Pipeline architecture | Event-driven BullMQ chain | Independent scaling, retry, observability per stage |
| Action defaults | Full auto per TRD (>0.92 auto-label + comment, auto-close OFF) | Conservative enough; all actions logged |
| Intelligence location | `packages/core` | Reusable across api workers and github-action (Phase 3) |
| Testing strategy | Mock-first (no real API calls in CI) | Fast, deterministic, no API costs |

## Pipeline Flow

```
PR/Issue Ingested (existing workers)
  → INTENT_EXTRACTION queue
    → Intent Extraction Worker (Claude Haiku 4.5)
      → EMBEDDING queue
        → Embedding Worker (OpenAI text-embedding-3-large)
          → DEDUP queue
            → Dedup Worker (pgvector ANN + Claude Sonnet 4.5 judge)
              → ACTION_DISPATCH queue
                → Action Dispatcher Worker (GitHub API)
```

Each stage is a separate BullMQ worker. Existing PR/issue ingestion workers trigger the chain by adding a job to `INTENT_EXTRACTION` after upserting to the database.

## Package Structure

### `packages/core/src/` (intelligence engine)

```
llm/
  anthropic-client.ts    — Anthropic SDK singleton, env config
  openai-client.ts       — OpenAI SDK singleton, env config
intent/
  extract.ts             — extractIntent(pr) → IntentSummary
  prompts.ts             — prompt templates for intent extraction
  diff-fallback.ts       — extractIntentFromDiff(diff) for low-quality PRs
embedding/
  generate.ts            — generateEmbedding(text) → number[]
dedup/
  similarity.ts          — findSimilar(embedding, repoId) → candidates
  judge.ts               — judgeDuplicate(pr1, pr2) → JudgeResult
  judge-prompts.ts       — prompt templates for LLM judge
cluster/
  manager.ts             — createCluster, addToCluster, mergeCluster
```

### `packages/api/src/workers/` (orchestration)

```
intent-extraction.worker.ts  — calls core intent extraction, triggers embedding
embedding.worker.ts          — calls core embedding gen, triggers dedup
dedup.worker.ts              — calls core similarity + judge, triggers action
action-dispatch.worker.ts    — posts comments, applies labels via GitHub API
```

### `packages/api/src/queue/`

Add 4 new queues to existing queue setup:
- `INTENT_EXTRACTION`
- `EMBEDDING`
- `DEDUP`
- `ACTION_DISPATCH`

## Component Details

### 1. Intent Extraction (Claude Haiku 4.5)

Three-stage approach per TRD:

1. **Primary extraction**: PR title + body → structured JSON
   - Fields: `problem`, `approach`, `files_changed_summary`, `category`, `scope`
   - Uses structured output (tool_use) for reliable JSON parsing
2. **Quality check**: Flag low-quality descriptions (empty body, generic template, auto-generated)
3. **Diff fallback**: For low-quality PRs, extract intent from actual diff hunks

Output stored in `pullRequests.intentSummary` (JSONB) and `pullRequests.qualityScore`.

### 2. Embedding Generation (OpenAI text-embedding-3-large)

- **Input**: Concatenated intent summary fields (problem + approach + category)
- **Output**: 3072-dimension vector
- **Storage**: `pullRequests.embedding` (pgvector column)
- **Index**: HNSW index already defined in schema

### 3. Deduplication

**Stage 1 — ANN Search (pgvector)**:
- Query HNSW index for top-k nearest neighbors within same repo
- Thresholds (from `packages/core/src/constants.ts`):
  - `> 0.92`: High confidence duplicate
  - `0.80 - 0.92`: Probable duplicate
  - `0.65 - 0.80`: Related
  - `< 0.65`: Distinct (no action)

**Stage 2 — LLM Judge (Claude Sonnet 4.5)**:
- Only invoked for candidates with similarity > 0.65
- Confirms: "Are these two PRs solving the same problem?"
- Returns: `{ isDuplicate: boolean, confidence: number, reasoning: string, preferredPR: number }`
- Reduces O(n²) to O(n * k) where k = number of ANN candidates

### 4. Cluster Management

- High-confidence duplicates (>0.92 confirmed by judge) → auto-assign to cluster
- If matching cluster exists with <5 members → auto-merge
- If ≥5 members → flag for manual review
- Track `rank` (1 = best) and `similarity` in `clusterMembers`
- Cluster status: `open` | `resolved` | `dismissed`

### 5. Action Dispatcher

| Similarity | Actions |
|-----------|---------|
| > 0.92 (confirmed) | Auto-comment linking duplicates + label `duplicate-candidate` + assign to cluster |
| 0.80 - 0.92 | Auto-comment suggesting review + label `needs-review` |
| 0.65 - 0.80 | Cross-reference comment only |
| < 0.65 | No action |

- Auto-close: OFF by default (opt-in via `.github/preview.yml`)
- All actions logged to `actionsLog` table with full payload

### 6. Environment Variables

```
# Anthropic (intent extraction + judge)
ANTHROPIC_API_KEY=

# OpenAI (embeddings)
OPENAI_API_KEY=
```

## Database (existing schema, no changes needed)

All tables already exist from Phase 1:
- `pullRequests` — has `embedding`, `intentSummary`, `qualityScore` columns
- `issues` — has `embedding` column
- `clusters` — cluster type, summary, status
- `clusterMembers` — rank, similarity, item references
- `actionsLog` — audit trail for all GitHub actions
- HNSW indexes on embedding columns

## Testing Strategy

- Mock all LLM API calls (Anthropic SDK + OpenAI SDK)
- Validate prompt construction and structured output parsing
- Test similarity search with known embedding vectors
- Test cluster management logic (create, merge, membership)
- Test action dispatcher decision logic independently
- 85% coverage threshold on `packages/core`
