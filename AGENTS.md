# Repository Guidelines

## Rules

No backward compatibility, all must be standardized
Fail fast, dont add workarounds

## Project Structure & Module Organization

The VS Code extension lives in `src`, split by responsibility: `analysis/` for symbol+diff parsing and pipeline steps, `cli/` for the `ct` binary, `facts/` for drift/legacy/intended state detection, `storage/` for database and Qdrant integration, `state/` and `services/` for Cockpit orchestration, `webview/` for the React cockpit UI that bundles to `media/cockpit.js`, `providers/` for VS Code tree view providers, `commands/` for VS Code command handlers, `metrics/` for metric adapters, `llm/` for LLM client integration, `utils/` for shared utilities, `watchers/` for git commit watchers, and `contracts/` for type definitions. `liveTracker.ts` resides at `src/` root for live change tracking. Tree-sitter WASM files are downloaded to `out/` at build time (via `scripts/download-wasm.js`), while static assets like difftastic binary reside in `resources/`. Compiled JS ends up in `out/`. Keep generated data inside `.git/commit-tracker/` (database) or `out/` (WASM files, compiled code).

## Coding Style & Naming Conventions

Follow the existing 2-space indentation, `const`-first mindset, and explicit return types for exported functions. Module boundaries mirror the folder names—prefer domain-based filenames such as `liveTracker.ts` or `cockpitOrchestrator.ts`, and export discriminated unions for node types per the invariants in `README.md`. Keep imports ordered from Node built-ins → packages → local modules, and document nuanced logic with short comments rather than narrating every line.

Please try to adhere to these architecture standards: /docs/src/architecture-patterns.md

## Analysis Pipeline Steps (deps | key output | critical details)

1. **indexCommits** [] → `commitFacts[]`
   Parallel commit indexing (concurrency 8), Tree-sitter + Difftastic, symDiff/edgeDiff, renames/moves, risks, churn → DB

2. **scope** [] → `scope: ScopeSet`
   commit files + working changes + blast radius neighbors → allPaths

3. **intended** [] → `intended: Map<symbol, IntendedState>`
   Expected present/absent symbols from refactor intent in history

4. **working** [scope] → `working: WorkingSnapshot`
   Current symbols/edges from workspace files in scope

5. **drift** [intended,working] → `drift: DriftFindings`
   missing/zombie/divergent symbols & edges, conventionDrift, clusters, **unresolved_callers** (call edges with no target + name-guess + log-severity)

6. **legacy** [intended,working,scope] → `legacy: LegacyAuditResult`
   dead symbols, legacyUsed, replacedLeftovers

7. **hotspot** [] → `hotspots[]` (top 25 file/symbol)
   DB query → symbol_versions.dna_id → HotspotDetector scores

8. **movedBlock** [index_commits] → `movedBlocks[]` (top 50)
   Compares removed/added symbols via DNA + location → MovedBlockDetector

9. **workspaceOverlay** [] → `workspaceFacts?`
   If includeWorkspace=true → unstaged first → staged fallback → WorkspaceIndexer symDiff/edgeDiff/risks

10. **bundleFacts** [scope,intended,working,drift,legacy,hotspots] → `bundleFacts: RefactorBundleFacts`
    Assembles incompleteness, patternDrift, legacy summary (graceful partial fallback)

11. **embedding** [bundle_facts] → Qdrant vectors (conditional)
    Story shards → embed → store

12. **historyRetrieval** [bundle_facts] → `history[]` (conditional)
    Query Qdrant for similar past commits/symbols/drift episodes

13. **story** [bundle_facts,retrieve_history,embedding_index] → `llmOutputs` (conditional)
    Multi-pass LLM → intent, drift verification, cleanup plan, markdown

### Live Tracking (Independent)

- `LiveDiffTracker` → debounced `onDidChangeTextDocument`, incremental Tree-sitter, thresholds (lines=50, symbols=5), auto-run after N edits
- `LiveAnalysisEngine` → reconstructs intended from bundleFacts → live overrides → re-runs drift/legacy → live UI tab

### Key Supporting Systems

- **Symbol DNA** → stable hash (kind + signature + body shape) → survives rename/move → used by hotspot & movedBlock
- **Caching** → content-addressed (commit hash), structural diff (blob pair), TTL 3600s → 3-6× faster re-analysis
- **DB** → Modular schema (v2.0+) with 9 modules (core, commits, symbols, edges, conventions, structural, hotspots, moved, reports), per-module versioning, safe migrations via `safeAddColumn`, `migrateDatabase()` for automatic upgrades, `auditAllModules()` for gap detection. symbol_versions (DNA tracking), file_snapshots (full content), Qdrant (embeddings)
- **Context Export** → JSON + Mermaid graphs + token budgeting (~12k max) for external LLMs
- **Concurrency** → worker pool utility (used in indexing)
- **CLI/Hooks** → pre-commit analysis, standalone analyze/index/query commands, `ct index --reindex` for legacy DB migration

### Useful Commands

Use `npm run fix` to fix linting errors, dont fix by hand!!
./out/cli/index.js compare HEAD~1 HEAD // run pipline branch vs main
