# Super Webview Migration Plan (facts-first, LLM-optional)

Objective: Replace the legacy Cockpit UI with the Super Webview (facts-first, zoomable, LLM on-demand) and retire legacy state/flows. Minimize regressions by staging feature parity and disabling legacy entrypoints as we go.

## Current State (staged)
- SuperWebview is rendered by default in `src/webview/cockpit/index.tsx` but relies on mock explorer data and unimplemented messages (`getExplorerTree`, `getBundleData`).
- Legacy Cockpit tabs/stats are bypassed; legacy orchestrator/store coexist, causing drift.
- Pipeline is facts-first (`skipLLM: true`), auto-index-on-activation disabled.
- Staged additions: new store/effects/reducers, super report command/webview.

## Migration Goals
1) SuperWebview is the primary UI: loads real bundle facts, explorer tree, and zoomable scopes.
2) Legacy Cockpit state/flows are retired or gated off to prevent accidental use.
3) State is unified: one store/effects path drives UI; legacy `updateState`/`refreshCockpitState` calls are removed or bridged cleanly.
4) LLM is opt-in: only runs via explicit user action with scoped context.

## Phased Plan
### Phase 0: Stabilize pipeline & entrypoints
- Disable any remaining auto-runs on activation (already done).
- Ensure analyze commands surface success/failure; clear `isAnalyzing` reliably on error/cancel.
- Verify bundle facts save to `.git/commit-tracker/last-bundle-facts.json` for fallback.

### Phase 1: Wire SuperWebview to real data (read-only)
- Implement `CockpitProvider` handlers:
  - `getExplorerTree`: build a connected file tree from `bundleFacts.evidence['scope.files']` and edges (if available); include severity badges (missing/zombie/drift/legacy/hotspot).
  - `getBundleData`: send bundle facts summary + top findings (incompleteness/drift/legacy/hotspots).
  - `updateFrame` messages: respond to zoom requests (bundle/file/symbol) with scoped slices of facts (filter evidence by path/symbol_id).
- Remove mock explorer data in `SuperWebview`; render using real payloads. Keep legacy UI disabled.
- Keep legacy state updates but add comments/guards where unused.

### Phase 2: Unify state/store
- Choose one path: use the new store/effects everywhere.
- Update commands (analyze, selection, bundle controls) to dispatch store actions (`ANALYSIS_REQUESTED`, `SELECTION_*`, etc.) instead of `orchestrator.updateState`.
- Update `reportService` to dispatch `ANALYSIS_STARTED/COMPLETED/FAILED` actions rather than legacy `updateState`; or bridge via a single adapter that translates pipeline events into store actions.
- Remove/disable deprecated `update*State` helpers; keep `updateContexts` minimal (context keys only).
- Prune legacy orchestrator APIs not used by the new store.

### Phase 3: Feature parity in SuperWebview
- Implement tabs/panels for:
  - Timeline: commits touching scope with symbol/edge deltas + snippets.
  - Incompleteness: missing/zombies tables with links.
  - Drift: naming/import/file drift with links/suggestions.
  - Legacy: dead/legacyUsed/replacedLeftovers.
  - Unresolved callers/imports.
  - Hotspots/moved blocks.
- Add scope controls (symbol/file/connected/bundle), degree slider, depth selector, include-neighbors toggle.
- Enable “Export current view” (facts-only markdown/JSON).

### Phase 4: LLM on-demand
- Add “Ask LLM” action per scope; build scoped context (visible facts/evidence/snippets) and call LLM; render as addendum.
- Keep LLM off by default; no auto-run in pipeline.

### Phase 5: Cleanup & remove legacy UI
- Remove or gate legacy Cockpit components/routes.
- Delete unused legacy state/effects/commands; update docs.
- Keep super report command as standalone and integrated into SuperWebview.

## Immediate Actions
- Implement `getExplorerTree`/`getBundleData` in `CockpitProvider` and wire `SuperWebview` to real data (replace mocks).
- Dispatch store actions in analyze/selection paths; bridge `reportService` pipeline events to store (`ANALYSIS_COMPLETED` with facts/summary/history).
- Ensure `SuperWebview` initial render gracefully handles “no facts” with a prompt to run Analyze.

## Future Work & Technical Debt (MVP hardening)
- Blast radius edges: replace regex import scan with Tree-sitter (start with JS/TS), resolve tsconfig/path aliases, and emit incoming + outgoing edges into bundleFacts; UI shows per-file incoming/outgoing lists before graphing.
- Drift profiles: add language-aware naming rules by extension; allow overrides in `.git-context.json`; surface length/complexity/arg-count warnings as low-severity drift.
- Symbol history: use symbol DNA to follow symbols across commits; persist per-symbol evolution snapshots; fall back to `git log -L` only when DNA missing.
- Virtual commits: compute real +/- line counts for staged/unstaged diffs and include in bundleFacts so “virtual commit” cards show stats.
- Graph UI: swap blast radius circles for React Flow (pan/zoom, double-click to center, link to file view); keep basic list fallback.
- Bundle heatmap: replace card grid with treemap (size=file size, color=churn/hotspot score).
- Navigation: add breadcrumbs (Bundle > File > Symbol) and “Jump to File”/“Analyze last N” quick actions wired to store.
- Performance: cache `getHotspots` keyed by HEAD; lazy-load large file contents/symbols; debounce scope graph renders on large bundles.
- Observability: keep generateReport/selection logs; add pipeline start/finish logs (sha counts, workspace flags); surface selection-empty/pipeline errors as webview toasts.
- LLM on-demand: keep LLM off by default; scoped “Ask LLM” uses visible facts/evidence/snippets only, no auto-run.

## Testing Checklist
- Load extension → no auto-run; SuperWebview loads; “no facts” prompt shows.
- Run Analyze on selection → `isAnalyzing` true, completes, bundle facts appear; SuperWebview shows timeline/findings; status clears.
- Scope switch (all files vs specific file) filters tables.
- Super report command works from current facts.
- LLM does not run unless explicitly invoked.
