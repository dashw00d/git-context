# Cockpit State & Webview Audit (Dec 2025)

## TL;DR
- Legacy partial updates and orchestrator guessing keep two sources of truth, causing races, stale renders, and schema drift. Kill `LEGACY_STATE_UPDATED`, wire explicit actions, and drop orchestrator-based partial guessing for UI.
- Bundle progressive loading can downgrade data (skeleton/hybrid overwrites semantics). Add a monotonic `bundleViewVersion` and single source of truth for skeleton/hybrid publishing.
- Store dispatch currently double-reduces and misreports `prevState`. Fix to a single reduce, then append `actionHistory`.
- Hotspot cache key is unstable; treemap build is heavy; skeleton is duplicated; Tier 3 live parsing hides pipeline gaps; error boundaries are absent.

## Critical Issues
1) **Legacy partials + reducer bypass**  
   - `LEGACY_STATE_UPDATED` merges arbitrary partials (`src/state/reducers.ts:321-323`). Used in production paths: `CockpitProvider.updateState` (`src/webview/cockpit/CockpitProvider.ts:217-236`), `effects.refreshBundle` (`src/state/effects.ts:152-176`), `LiveTracker` (`src/liveTracker.ts:165-171`), orchestrator helpers (`src/state/cockpitOrchestrator.ts:116-149`).  
   - Hydration uses real `BUNDLE_FACTS_UPDATED`, but refresh paths use legacy, giving split state semantics and missed rerenders.
   - **Fix**: Remove `LEGACY_STATE_UPDATED` from production flows. Add explicit actions (`BUNDLE_FACTS_HYDRATED`, `BUNDLE_SUMMARY_UPDATED`, etc.) and migrate all callers. Keep legacy action only for dev/debug injection behind a guard.

2) **Orchestrator partial guessing / duplicate buses**  
   - Orchestrator fabricates partials (`src/state/cockpitOrchestrator.ts:47-83`) and debounces; CockpitProvider subscribes directly to the store and diffs manually, bypassing orchestrator. Two parallel buses mean inconsistent partials and lost updates.  
   - **Fix**: Either remove orchestrator for UI (use selectors/hooks only) or make provider subscribe to orchestrator and delete manual diffs. If keeping orchestrator, stop guessing partials—emit full state or reducer-derived deltas only.

3) **Progressive bundle races (downgrades)**  
   - Multiple writers to bundle view: `updateSkeleton` (`112-158`), `sendSkeletonProgress` (`453-499`), `sendHybridProgress` (`506-565`), persisted hydration (`435-445`), and `updateBundleData` (`164-294`) all call `pushBundleView` without ordering. A later hybrid/skeleton can overwrite a hydrated semantic view.  
   - **Fix**: Add `bundleViewVersion: number` in state; every bundle view publish must carry `version`, reducer only applies if newer. Consolidate skeleton/hybrid into one pathway.

4) **Store double-reduce + wrong prevState**  
   - `CockpitStore.dispatch` runs `cockpitReducer` twice and logs with the first reduction as “prevState.” `_prevState` unused; `actionHistory` injected via second reduce.  
   - **Fix**: Single reduce: capture `prevState`, compute `baseNextState = reducer(prevState, action)`, append `actionHistory` (cap 50), assign `nextState`, then log/emit.

5) **Hotspot cache key collision + unbounded growth**  
   - Cache key is `facts?.bundle?.newestSha || 'workspace'` (`updateBundleData` line ~178). Different bundles after rebase collide; workspace entries never expire beyond FIFO >20.  
   - **Fix**: Key by bundle id or SHA set (`bundle.id` or `shas.join(',')`), and enforce LRU (e.g., max 10 entries).

6) **Treemap cost + lack of guardrails**  
   - `buildTreemap` walks nested objects O(n²) worst-case and can throw; no error boundary in webview to contain it.  
   - **Fix**: Add error boundary at cockpit root; consider iterative/streaming treemap or limit depth/size before building.

## High / Medium Issues
- **Tier 3 live parsing masks pipeline gaps**: `FrameAnalyzer.analyzeTier3` falls back to live Tree-sitter when facts lack symbols (`src/webview/cockpit/services/FrameAnalyzer.ts:196-258`). Prefer surfacing “Not analyzed / out of scope” when bundle facts are missing symbols in-scope.  
- **Duplicate bundle view dispatches**: `pushBundleView` dispatches both `BUNDLE_VIEW_UPDATED` and `FRAME_DATA_UPDATED` for root (`src/webview/cockpit/services/AnalysisController.ts:296-299`). Stage already reads `bundleView`; consider a single action to avoid dual copies.  
- **Effects context staleness**: `updateContexts` only on `ANALYSIS_COMPLETED`/`BUNDLE_CLEARED`; selection changes don’t refresh VS Code contexts. Add selection actions to the switch and remove stray double `break` in `effects.ts`. Replace `mapScope` with proper `parseWorkspaceSha`.  
- **Schema mismatch**: `CockpitStateSchema` requires `liveAnalysis.facts` non-null, but `initialState.liveAnalysis.facts` is `null`, causing validation errors every send (`CockpitProvider.sendState`). Make schema `.nullable()` or initialize `{}`.  
- **Skeleton duplication**: `updateSkeleton` vs `sendSkeletonProgress` do the same job via different services and both push bundle views; they can diverge and stomp each other.

## Recommended Remediation Plan
1) **State normalization (stop the bleed)**
   - Remove production uses of `LEGACY_STATE_UPDATED`; add explicit actions for bundle facts/summary/live analysis. Migrate `CockpitProvider`, `effects.refreshBundle`, `LiveTracker`, orchestrator helpers.
   - Decide on orchestrator role: either retire for UI or make provider consume orchestrator events and stop partial guessing. Prefer standard Redux selectors/hooks.
   - Align schema with initial state (`liveAnalysis.facts`).

2) **Progressive loading correctness**
   - Introduce `bundleViewVersion` and require all bundle view updates to carry and compare versions.
   - Collapse skeleton/hybrid publishing into one path with clear precedence; ensure hydration and semantic updates can’t be overwritten by lower-tier data.
   - Deduplicate bundle view dispatch (pick `BUNDLE_VIEW_UPDATED` or frame data, not both).

3) **Store correctness & instrumentation**
   - Fix `dispatch` to single reduce + proper `prevState` + `actionHistory` append.
   - Add throttled validation logging in `sendState` (optional strict dev mode).

4) **Performance & safety**
   - Fix hotspot cache key + LRU.
   - Add webview error boundary; consider guarding `buildTreemap` with try/catch and size/depth limits.
   - Remove Tier 3 live parsing fallback when facts should exist; surface “not analyzed” instead.

5) **Polish**
   - Update `effects` contexts on selection actions; clean double `break`; replace `mapScope`.
   - Remove unused `isBundle/isFile/isSymbol` flags in `Inspector` or put them to use.

## Quick Code References
- Legacy spread reducer: `src/state/reducers.ts:321-323`
- Legacy action union: `src/state/actions.ts:105-112`
- Orchestrator partial guessing: `src/state/cockpitOrchestrator.ts:47-83`
- Bundle view multi-sources: `src/webview/cockpit/services/AnalysisController.ts:112-565`
- Store double-reduce: `src/state/store.ts`
- Schema mismatch: `src/state/schemas.ts` vs `initialState` in `src/state/reducers.ts`
- Effects context gaps: `src/state/effects.ts`
