# Pipeline Enhancements Audit (Dec 2025)

Goals: tighten pipeline concurrency, DNA stability, best-effort fallbacks, timing visibility, and DB/workspace correctness so the pipeline runs <5s in benchmarks while honoring AGENTS.md (3-6× speedup targets, graceful failures).

## Current Gaps (code refs)
- Concurrency is implicit. `RefactorPipeline` sets `config.concurrency = 8` but `runPipeline` just parallelizes within topo levels; `createIndexCommitsStep` accepts concurrency yet there is no explicit worker pool wrapper for multi-commit indexing (`src/analysis/refactorPipeline.ts`, `src/analysis/runner/pipelineRunner.ts`).
- DNA stability is hash-only. `computeBodyShape` token-replaces identifiers but lacks tree edit distance or structure-aware scoring, making DNA fragile across minor edits (`src/analysis/symbolDna.ts:26-55`). Detectors/hotspot/movedBlock trust this DNA.
- Error handling is best-effort per step, but bundle facts aren’t marked partial on failures and there is no fallback summary for downstream consumers (`src/analysis/runner/pipelineRunner.ts:54-156`).
- Timings are collected internally in `runPipeline` but not exposed in pipeline state/metrics, so `benchmarks/pipeline_diagnostics.ts` cannot report per-step durations or cache stats.
- Database access has no explicit locking/queue; all writers share `DatabaseService` without mutex/backpressure (see `src/services/databaseService.ts` singleton). Busy/locked errors would surface during parallel steps.
- Workspace/staged coverage has TODOs: reverse edge index missing in `WorkspaceIndexer` (`src/analysis/workspaceIndexer.ts:15` comment) and staged content extraction TODO in `SymbolExtractor` path (`src/analysis/symbols.ts:199-246` notes staged handling with TODO comment “Implement staged content extraction”). Hybrid facts for staged/unstaged rely on `safeGetStagedContent` without verification.
- Detectors rely on DNA without eviction/consistency logging (hotspot/movedBlock) and don’t validate shape drift post-DNA change.

## Recommended Changes
1) **Explicit worker pool for commit indexing**
   - Wrap `createIndexCommitsStep` execution in `RefactorPipeline` with an explicit `p-limit`/workerPool(8) to enforce concurrency across commits rather than relying on topo-level parallelism. Reuse `pLimit` already used in `CommitIndexer`.

2) **Strengthen DNA shape**
   - Extend `computeBodyShape` to include tree edit distance/structure fingerprints (e.g., multiset of AST node n-grams) before hashing. Propagate to detectors/hotspot/movedBlock by updating their DNA expectations/tests. Add small stability test: minor whitespace/identifier change should keep DNA; structural change should flip.

3) **Best-effort flags and fallbacks**
   - In `pipelineRunner`, wrap each step with try/catch (already per-step) and, on failure of legacy/hotspot/movedBlock, set `state.bundleFacts = { ...partial:true }` or attach `state.partialReasons`. Ensure `createBundleFactsStep` emits a fallback summary (counts from whatever data exists) even when some deps fail.

4) **Surface timings/metrics**
   - Add `performance.now()` (or Date.now) per step in `RefactorPipeline` and thread `PipelineMetrics` onto `PipelineState`. Expose `{ stepTimings, cacheHits/Misses }` so `benchmarks/pipeline_diagnostics.ts` can print and assert <5s total.

5) **DB serialization**
   - Add a lightweight mutex/queue in `DatabaseService` for write paths (bundle updates, symbol/edge inserts) to avoid SQLite busy during parallel levels. Log lock waits and surface retry counts.

6) **Workspace/staged accuracy**
   - Resolve staged extraction TODO in `SymbolExtractor`/`extractWorkingTreeFileSymbols` by ensuring staged content reads use git index blobs and are validated. Add reverse edge index in `WorkspaceIndexer` to populate `incoming` edges for blast radius.

7) **Detectors after DNA change**
   - Update hotspot/movedBlock detectors to use the new DNA shape and add eviction/logging for DNA cache hits/misses when matching blocks.

8) **Migrations/alerts**
   - Add schema/version alert in `src/storage/schema.ts` when DNA shape changes to force reindex, and log migration hints when pipeline errors occur.

## Validation Plan
- Run `npx ts-node benchmarks/pipeline_diagnostics.ts --commit-count=10 --no-embeddings --include-workspace` and target <5s locally with cache warmed; capture timings from new metrics.
- Simulate step failure (e.g., force hotspot error) and confirm bundleFacts.partial + fallback summary still returned.
- Verify DNA stability test (minor rename/whitespace) and detector matching results before/after change.
