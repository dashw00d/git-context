# Pipeline Audit Report

**Date:** November 30, 2025
**Scope:** `/src/analysis` and `/src/services`

## 1. Executive Summary
The `git-context` analysis pipeline is a sophisticated, parallel execution engine capable of deep semantic analysis. It successfully employs a topological sort to run independent steps concurrently, maximizing performance. However, the system suffers from a significant **"Dual System"** architecture where live analysis (unsaved changes) and commit analysis (history) use separate, partially duplicated logic. Additionally, the `commitIndexer` step is a major performance bottleneck (~284s for 3 commits), and the central `PipelineState` object presents coupling risks.

## 2. Structural Analysis

### Execution Flow
1.  **Entry Points:**
    *   **CLI:** `src/cli/index.ts` -> `pipelineFactory` -> `RefactorPipeline`
    *   **VSCode:** `src/extension.ts` -> `ReportService` -> `RefactorPipeline`
    *   **Live Tracker:** `src/liveTracker.ts` -> `LiveAnalysisEngine` (Bypasses main pipeline!)

2.  **Core Pipeline (`src/analysis/refactorPipeline.ts`):**
    *   **Runner:** `src/analysis/runner/pipelineRunner.ts` (Handles concurrency)
    *   **State:** `PipelineState` (Mutable state bag)
    *   **Steps:** Modular steps in `src/analysis/runner/steps/` (e.g., `scope`, `drift`, `hotspots`)

3.  **Data Flow:**
    *   `RefactorBundleFacts` is the canonical output, assembled by `factsAssembler.ts`.
    *   Data flows from `index_commits` -> `scope` -> `working` -> detectors (`drift`, `legacy`, `hotspots`) -> `bundle_facts` -> `llm_story`.

## 3. Hidden Issues & Risks

### 🔴 Critical: Dual Analysis Engines
The `LiveAnalysisEngine` (`src/analysis/liveAnalysis.ts`) manually reconstructs scope, builds intended maps, and instantiates detectors (`DriftDetector`, `LegacyDetector`) directly. This **duplicates logic** found in `RefactorPipeline` steps (`scopeStep`, `intendedStep`, `driftStep`).
*   **Risk:** Inconsistent results between "Live" and "Report" views. Fixes applied to the main pipeline (e.g., hybrid drift detection logic) must be manually ported to the live engine.
*   **Evidence:** `LiveAnalysisEngine` contains manual `detectHybridDrift` logic loops that mirror the `drift` step's behavior.

### 🟠 High: State Bag Coupling
`PipelineState` mixes inputs (`selectedCommitShas`), heavy intermediate data (`commitFacts`), and final outputs (`bundleFacts`).
*   **Risk:** Hard to test steps in isolation. Implicit dependencies (e.g., a step assuming `commitFacts` is fully populated) can lead to runtime errors if step order changes.
*   **Observation:** `createBundleFactsStep` has to manually check for 5+ different state properties (`scope`, `intended`, `working`, etc.) to determine execution mode.

### 🟡 Medium: Performance Bottleneck
`index_commits` is disproportionately slow.
*   **Observation:** In diagnostics, `index_commits` took **284 seconds** for 3 commits. This blocks all downstream steps that depend on commit data (intended state, hotspots).
*   **Cause:** Likely sequential processing of files within each commit or inefficient AST parsing/diffing.

## 4. Unused & Legacy Features

### Unused / Dev Tools
*   `debug_db.ts`: Root-level file, likely a development script. Should be moved to `scripts/` or removed from the production build.
*   `debug_db` function in `src/services/symbolService.ts`: Likely dead code if not called by the CLI.

### "Legacy" Naming Confusion
*   **Feature:** `LegacyAudit` (`src/facts/legacyAudit.ts`) and `legacyStep.ts`.
*   **Assessment:** This is an *active* feature for detecting dead code and usage of deprecated symbols. It is **not** unused code itself.
*   **Recommendation:** Rename to `DeadCodeDetector` or `UsageAudit` to avoid confusion with "legacy code" (meaning old/deprecated pipeline code).

## 5. Improvements & Recommendations

### Phase 1: Consolidation (High Impact)
1.  **Refactor Live Engine:** Convert `LiveAnalysisEngine` to use `RefactorPipeline` with a specific "Live" configuration (skipping heavy steps like embeddings/history). This eliminates code duplication.
2.  **Unified Step Logic:** Ensure `driftStep` and `liveAnalysis` call the exact same shared functions for hybrid drift detection.

### Phase 2: Performance (High Impact)
1.  **Optimize Commit Indexing:**
    *   Profile `CommitIndexer`.
    *   Parallelize file parsing within `indexCommit`.
    *   Ensure AST caching (`SnapshotManager`) is actually hitting.
2.  **Parallelize Detectors:** `DriftDetector` and `LegacyDetector` currently run sequentially in `LiveAnalysis`. They are independent and can run in parallel.

### Phase 3: Architecture (Long Term)
1.  **Split Pipeline State:** Separate `PipelineInput` (immutable) from `PipelineContext` (mutable results).
2.  **Dependency Injection:** Pass specific inputs to steps (e.g., `run(scope, intended)`) instead of the whole `state` object, making dependencies explicit.

## 6. Conclusion
The pipeline architecture is sound but implementation details (duplication in live analysis, massive commit indexing time) hold it back. Consolidating the "Live" and "Report" pipelines is the most critical architectural improvement to ensure consistency and reduce maintenance burden.
