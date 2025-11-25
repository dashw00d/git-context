# Cockpit Data Orchestrator — Unified Plan (with Context + Cleanup)

## Why We’re Changing It
- Siloed providers: `CommitsProvider.exportCommitsDto()`, `ActiveBundleProvider.getBundleChildNodes()`, LiveTracker all compute independently with no shared cache.
- Polling merge: `syncCockpitState()` (extension.ts:27-232) polls and posts; async races create stale UI.
- Orphaned/duplicated data: `bundleFacts` vs `reportsProvider`; symbols from working vs staged; health/debt divergences.
- Legacy UI mix: `src/ui/` blends data providers, trees, and webview logic → confusing ownership.
- Root cause: no single source of truth; consumers query directly and drift.

## Target Model: Single Source of Truth
- `CockpitOrchestrator` singleton (`src/state/cockpitOrchestrator.ts`) holds `CockpitState`.
- Push-based: providers/trackers push partial updates; consumers subscribe.
- Typed/stateful: strict `CockpitState` schema (defaults, nullability, version field).
- Memoized computed metrics: derived from facts/symbols once, reused everywhere.
- Debounced emits: coalesce bursts; optional pagination/chunking for large payloads.
- Observability: structured logs for update source + duration; counters for dropped events.

## Data Inventory (what we must own/de-duplicate)
- Commits DTOs: history, staged, working diffs.
- Bundles/bundleFacts: active bundle, children, reports.
- Symbols/facts: working vs staged snapshots; symbol history for debt/health.
- Live deltas: diff-as-you-go symbols, progress %, thresholds crossed.
- Metrics: debt/health/coverage (derived).
- UI state sent to Cockpit webview: selected bundle, filters, pinned commits.
- Legacy trees (if any remain) should source from orchestrator or be removed.

## Directory/Ownership Layout (torch legacy confusion)
```
src/
  state/         # SSOT
    cockpitOrchestrator.ts
  providers/     # Data fetchers/exporters only (no trees/UI)
    commitsProvider.ts
    bundleProvider.ts   # ex-activeBundle
    symbolsProvider.ts
    liveTracker.ts
    reportsProvider.ts  # replaces scattered report.ts usage
    legacy/             # temporary quarantine; scheduled for deletion
  webview/
    cockpit/            # React/Vue/Svelte UI (postMessage listener)
    reports/
  commands/             # VSCode command registrations (imports providers/state)
  analysis/, facts/     # unchanged
```

## Execution Plan (phased, focused)
### Phase 0 — Contract + Inventory (0.5d)
- Lock `CockpitState` schema (fields, defaults, nullability, version). Document in this file and `src/state/types`.
- Catalog all producers/consumers: commits, bundleFacts, symbols, liveTracker, reports, DebtMeter, trees, webview. Mark each as keep/move/delete.
- Identify orphaned/duplicate data paths and decide the winner (e.g., staged vs working symbols).

### Phase 1 — Orchestrator Core (0.5d)
- Implement `CockpitOrchestrator` with `updatePartial`, `batchUpdate`, subscription API, memoized metrics getter, debounced emit, and simple in-mem cache.
- Add minimal tests for merge semantics and emit ordering.

### Phase 2 — Provider Rewire (1d)
- Move providers to `src/providers/` and strip tree/UI logic.
- Providers push into orchestrator (no direct postMessage). Example: `orchestrator.updatePartial('commits', await exportCommitsDto());`
- LiveTracker hook publishes deltas/progress; optional `batchUpdate` for liveFacts when thresholds hit.
- Add structured logging around provider pushes (source + duration).

### Phase 3 — Webview + Metrics (0.5d)
- Cockpit webview subscribes to orchestrator; postMessage `stateUpdate` diffs.
- DebtMeter/metrics read from orchestrator computed getters; remove local recomputes.
- Add pagination/chunking if payloads exceed threshold.

### Phase 4 — Legacy Cleanup (0.5d)
- Torch `syncCockpitState()` polling path.
- Remove or quarantine legacy trees and any UI-in-provider code under `providers/legacy/` with delete plan + timeline.
- Update imports/barrels post-move; fix open references (`diff-as-you-go-plan.md`, `refactor-idea.md`, `src/ui/report.ts`).

### Phase 5 — Hardening (0.5d)
- Debounce tuning; ensure no event storms.
- Regression tests for live updates, commits/bundle changes, and webview render paths.
- Perf check on JSON size; add guardrails/telemetry for dropped or oversized messages.

## Decision Reminders
- Cache strategy: start in-memory; consider SQLite only if profiling shows need.
- State changes are push-only; no consumer should fetch directly from providers.
- Version `CockpitState` to allow non-breaking evolution.

## Validation/Exit Criteria
- Single orchestration path for commits/bundles/symbols/live; no duplicate fetches.
- Cockpit webview state updates only via orchestrator events.
- No remaining references to `syncCockpitState()` polling or legacy UI-in-provider code.
- Tests cover merge semantics and key data flows; telemetry shows bounded event volume.
