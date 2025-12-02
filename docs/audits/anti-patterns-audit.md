# Architecture Anti-Patterns Audit

**Date**: 2025-12-01  
**Purpose**: Identify code that violates established architecture patterns and should be refactored.

---

## Summary

After auditing the codebase against our documented architecture patterns, I've identified the following major violations:

| Anti-Pattern | Occurrences | Priority | Estimated Effort |
|--------------|-------------|----------|------------------|
| Direct postMessage instead of actions | Reduced to ~3 (assistant + legacy state) | High | Medium |
| orchestrator.updateState() instead of store.dispatch() | ~15 (mostly reportService, CockpitProvider bridging) | High | Medium |
| Direct db.prepare() instead of statement wrapper | ~50+ in services | Medium | Medium |
| Monolithic methods without tiering | 1-2 methods | Medium | Low |
| Missing error handling | Various | Low | Low |

---

## 1. Direct postMessage Anti-Pattern

### Issue
**CockpitProvider** sends 20+ direct `postMessage` calls instead of dispatching actions through the store.

### Violations
```typescript
// ❌ ANTI-PATTERN
this.view.webview.postMessage({
  type: 'updateBundle',
  payload: { hotspots, summary }
});

// ✅ SHOULD BE
getStore().dispatch({
  type: 'BUNDLE_DATA_UPDATED',
  payload: { hotspots, summary }
});
```

### Files Affected
- `src/webview/cockpit/CockpitProvider.ts` (Lines: 172, 187, 390, 393, 533, 548, 642, 652, 764, 820, 992, 1063)
- `src/webview/cockpit/services/ExplorerController.ts` (Line 26)

### Impact
- React components can't use Redux selectors
- No centralized state management
- Harder to test and debug
- Bypasses state history/time-travel debugging

### Recommended Fix
1. Define actions in `actions.ts` for each message type
2. Add reducers to handle the actions
3. Create an effect that listens for actions and sends postMessages (dual mode during migration)
4. Replace direct postMessage calls with dispatch

### Status
- **Fixed**: CockpitProvider now dispatches `BUNDLE_VIEW_UPDATED`/`FRAME_DATA_UPDATED` for skeleton/hybrid/semantics bundle updates and uses `EXPLORER_UPDATED` for tree data. ExplorerController no longer calls `postMessage` directly.
- **Fixed**: All `postMessage` calls in `CockpitProvider` replaced with Redux actions. `sendState` remains for legacy state hydration but uses store state.

### Effort
**Medium** - ~40 call sites to refactor

---

## 2. orchestrator.updateState() Anti-Pattern

### Issue
40+ places still use `orchestrator.updateState()` instead of `store.dispatch()`.

### Violations
Most common offenders:
- `src/providers/commitsProvider.ts` (5 calls)
- `src/features/coreFeatures.ts` (12 calls)
- `src/commands/commands.ts` (15 calls)
- `src/services/reportService.ts` (8 calls)

### Example
```typescript
// ❌ ANTI-PATTERN
orchestrator.updateState(
  { selectedCommitShas: Array.from(selected) },
  'provider:toggleCommit'
);

// ✅ SHOULD BE
getStore().dispatch({
  type: 'SELECTION_TOGGLED',
  payload: { sha: commitSha }
});
```

### Impact
- Two state systems running in parallel
- State can get out of sync
- Orchest rator will be removed in Phase 4, causing breaking changes

### Recommended Fix
**Priority Files (Most calls)**:
1. `src/commands/commands.ts` - Replace all 15 orchestrator calls
2. `src/features/coreFeatures.ts` - Replace all 12 calls
3. `src/services/reportService.ts` - Replace 8 calls (especially in pipeline events)
4. `src/providers/commitsProvider.ts` - Replace 5 calls

### Status
- **Fixed**: All orchestrator calls replaced with `store.dispatch` in `src/commands/commands.ts`, `src/features/coreFeatures.ts`, and `src/providers/commitsProvider.ts` (selection, bundle clear/cancel). New `ANALYSIS_PROGRESS_UPDATED` action covers progress updates.
- **Fixed**: `CockpitProvider` fully migrated to Redux actions. Removed `orchestrator` dependency entirely from `CockpitProvider`.
- **Remaining**: `src/services/reportService.ts` still mutates state via `orchestrator.updateState()` during pipeline events.

### Effort
**High** - 40+ call sites, need to ensure actions exist for each case

---

## 3. Direct Database Access Anti-Pattern

### Issue
Services use `db.prepare()` directly instead of the statement wrapper.

### Violations
```typescript
// ❌ ANTI-PATTERN
const stmt = db.prepare('SELECT * FROM symbols WHERE sha = ?');
const result = stmt.get(sha);
stmt.finalize(); // Often forgotten!

// ✅ SHOULD BE
import { prepare } from '../storage/statement-wrapper';
const stmt = prepare('SELECT * FROM symbols WHERE sha = ?');
const result = stmt.get(sha);
stmt.finalize(); // Wrapper ensures this happens
```

### Files Affected
- `src/services/commitService.ts` (8 calls)
- `src/services/symbolService.ts` (10 calls)
- `src/services/databaseService.ts` (20 calls)
- `src/services/reportService.ts` (5 calls)

### Impact
- Memory leaks (unfinalizedstatements)
- No query instrumentation/logging
- Inconsistent error handling

### Recommended Fix
1. Import `prepare` from `statement-wrapper.ts`
2. Replace all `db.prepare()` calls
3. Add automated linter rule to catch this

### Status
- **Fixed**: All services (`commitService`, `symbolService`, `databaseService`, `reportService`) now use the `prepare` wrapper from `statement-wrapper.ts`. No direct `db.prepare()` calls found.

### Effort
**Completed**

---

## 4. Monolithic Methods Anti-Pattern

### Issue
Methods that should use tiered loading don't follow the pattern.

### Violations

#### `updateBundleData()` (CockpitProvider.ts:566-660)
**Problem**: Single try-catch, no progressive loading  
**Should be**: Tier 1 (facts), Tier 2 (hotspots), Tier 3 (treemap)

**Status**: Now publishes structure/hybrid/semantic tiers via `BUNDLE_VIEW_UPDATED` + `FRAME_DATA_UPDATED` instead of direct `postMessage`. Remaining work: extract treemap/hotspot builders into services and further decompose logic.

```typescript
// ❌ CURRENT: Monolithic
async updateBundleData() {
  try {
    const hotspots = ...; // Many operations
    const treemap = ...;
    this.view.postMessage({ hotspots, treemap });
  } catch (error) {
    // All or nothing
  }
}

// ✅ SHOULD BE: Tiered
async updateBundleData() {
  // Tier 1: Facts
  const facts = this.state.bundleFacts;
  dispatch({ type: 'BUNDLE_TIER_1', payload: { facts } });
  
  // Tier 2: Hotspots (best effort)
  try {
    const hotspots = await this.computeHotspots(facts);
    dispatch({ type: 'BUNDLE_TIER_2', payload: { hotspots } });
  } catch (error) {
    logError('[Tier 2] Hotspots failed', error);
  }
  
  // Tier 3: Treemap (optional)
  try {
    const treemap = this.buildTreemap(hotspots);
    dispatch({ type: 'BUNDLE_TIER_3', payload: { treemap } });
  } catch (error) {
    logError('[Tier 3] Treemap failed', error);
  }
}
```

#### `updateSkeleton()` (CockpitProvider.ts:514-564)
**Problem**: Direct postMessage, no action dispatch  
**Should be**: Dispatch `SKELETON_UPDATED` action

### Effort
**Low** - Only 2-3 methods need refactoring

---

## 5. Error Handling Anti-Patterns

### Issue
Some methods throw errors instead of using best-effort mode.

### Violations

#### Missing error boundaries in message handlers
```typescript
// ❌ ANTI-PATTERN (CockpitProvider.ts:240-250)
case 'updateBundleConfig':
  if (msg.config) {
    // No try-catch - if updateSkeleton throws, entire handler crashes
    await this.updateSkeleton(msg.config);
    await this.updateBundleData();
  }
  break;

// ✅ SHOULD BE
case 'updateBundleConfig':
  if (msg.config) {
    try {
      await this.updateSkeleton(msg.config);
    } catch (error) {
      logError('[Config] Skeleton update failed', error);
      // Continue to updateBundleData anyway
    }
    
    try {
      await this.updateBundleData();
    } catch (error) {
      logError('[Config] Bundle data update failed', error);
      // Show error in UI but don't crash
    }
  }
  break;
```

### Recommended Fix
Add try-catch blocks with best-effort continuation in:
- Message handlers (`handleMessage`)
- Public methods in services
- Provider methods

### Effort
**Low** - Add defensive error handling where missing

---

## 6. Service Layer Violations

### Issue
Some business logic is still in CockpitProvider instead of services.

### Examples

#### `buildTreemap()` and `buildRisk()` should be services
```typescript
// ❌ CURRENT: In CockpitProvider
private buildTreemap(hotspots: any[]) { ... }
private buildRisk(path: string, ...) { ... }

// ✅ SHOULD BE: Separate service
// src/services/visualizationService.ts
export class VisualizationService {
  buildTreemap(hotspots: Hotspot[]): TreemapData { ... }
  buildRisk(file: FileInfo): RiskData { ... }
}
```

### Recommended Fix
Extract to services:
- `TreemapService` or `VisualizationService`
- `RiskAnalysisService`

### Effort
**Low** - Simple extraction, improves testability

---

## Migration Priority

### Phase 1: High Impact, Medium Effort (Do First)
1. **Replace orchestrator.updateState() in commands** (commands.ts, features/)
   - Most visible to users
   - Consolidates state management
   - Enables orchestrator removal
   - **Progress**: commands.ts, coreFeatures.ts, commitsProvider now dispatch store actions
   
2. **Add action dispatch to CockpitProvider message handlers**
   - Prevents dual-state issues
   - Enables React to use Redux properly

### Phase 2: Medium Impact, Medium Effort
3. **Replace db.prepare() with statement wrapper**
   - Prevents memory leaks
   - Improvedebugger observability

4. **Convert updateBundleData to tiered loading**
   - Better UX (progressive updates)
   - Follows established pattern
   - **Progress**: Tier 1 (skeleton) and Tier 2 (hybrid churn) now flow through `BUNDLE_VIEW_UPDATED`; semantics still combined in `updateBundleData`

### Phase 3: Low Hanging Fruit
5. **Extract services from CockpitProvider**
   - Better testability
   - Cleaner separation of concerns

6. **Add error boundaries to message handlers**
   - Defensive programming
   - Better error messages

---

## Automated Detection

### Recommended ESLint Rules

```json
{
  "rules": {
    "no-restricted-syntax": [
      "error",
      {
        "selector": "MemberExpression[object.name='db'][property.name='prepare']",
        "message": "Use 'prepare' from statement-wrapper instead of db.prepare()"
      },
      {
        "selector": "MemberExpression[object.property.name='webview'][property.name='postMessage']",
        "message": "Dispatch actions instead of direct postMessage (migration to Redux)"
      },
      {
        "selector": "CallExpression[callee.property.name='updateState'][callee.object.name='orchestrator']",
        "message": "Use store.dispatch() instead of orchestrator.updateState()"
      }
    ]
  }
}
```

---

## Summary Metrics

| Metric | Current | Goal |
|--------|---------|------|
| Direct postMessage calls | ~1 (assistant only) | 0 |
| orchestrator.updateState calls | ~8 (reportService) | 0 |
| Direct db.prepare calls | 0 | 0 |
| Monolithic methods | 1-2 | 0 |
| Methods without error handling | ~10 | 0 |

**Total Refactoring Effort**: ~2-3 weeks for full compliance

---

## Next Steps

1. Review this audit with the team
2. Prioritize Phase 1 items
3. Create tracking issues for each violation category
4. Set up ESLint rules to prevent new violations
5. Schedule refactoring sprints
