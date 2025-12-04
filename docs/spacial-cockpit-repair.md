# Audit Report: Spacial Cockpit UI Features Post-Middleware Refactor

## Executive Summary

**Status**: All UI components from the spacial cockpit plan are **fully implemented and present** in the codebase, but the data pipeline that connects backend analysis to the UI is **partially broken**. The middleware refactor successfully moved from controller-based to Redux-based architecture, but introduced a critical gap where frame analysis data doesn't reliably reach the webview after analysis completes.

**Impact**: Users see empty code views, no gutter visualization, no portals, and disabled time scrubbers despite all the visual components being correctly implemented.

---

## What Was Lost During the Refactor

### Deleted Components (Intentional - Part of Tab → Stage Migration)

The following components were **deliberately removed** as part of the architectural shift:

1. **Tab-based navigation system**:
   - `BundleTabContent.tsx`
   - `CommitsTabContent.tsx`
   - `SymbolsTabContent.tsx`
   - `LiveTabContent.tsx`
   - `ReportsTabContent.tsx`
   - `Tabs.tsx` - The tab navigation UI

2. **Controller layer** (moved to Redux middleware):
   - `services/AnalysisController.ts` - DELETED
   - `services/MessageController.ts` - HEAVILY REFACTORED
   - `services/ExplorerController.ts` - MODIFIED (reduced)

3. **Supporting components**:
   - `CommitList.tsx`
   - `SymbolList.tsx`
   - `Header.tsx` (old navigation header)

**Replacement**: All replaced by unified Stage-based UI (`CodeMicroscope`, `StageHeader`, etc.)

---

## What Still Exists (Fully Implemented)

### ✅ Phase 1: Data Foundation - **COMPLETE**

**File**: [src/types/cockpit.ts](src/types/cockpit.ts)

- ✅ `NodeMetrics` interface (lines 120-129)
  - riskScore, churnScore, lastModified, driftCount
  - incomingRefs, outgoingRefs, authors, ageDays
- ✅ `CockpitState.nodeMetrics` (line 169)
- ✅ `CockpitState.currentTimeFilter` - **NOT IMPLEMENTED** (see issue below)

**File**: [src/services/metricsService.ts](src/services/metricsService.ts)

- ✅ Aggregates all metrics from database
- ✅ Computes risk formula: `churnScore * 0.4 + driftCount * 10 + incomingRefs * 0.5`
- ✅ Called by `CockpitProvider.showCockpit()` (line 104-113)

### ✅ Phase 2: Smart Sidebar - **COMPLETE**

**File**: [src/webview/cockpit/components/RichTreeItem.tsx](src/webview/cockpit/components/RichTreeItem.tsx)

- ✅ Sentinel strip (4px color bar): green=today, blue=week, gray=older
- ✅ Risk dot: color-coded by score (green <40, yellow 40-70, red >70)
- ✅ Traffic badge: shows incoming ref count if >5
- ✅ Drift icon: ghost emoji (👻) when driftCount > 0

**File**: [src/webview/cockpit/components/Sidebar.tsx](src/webview/cockpit/components/Sidebar.tsx)

- ✅ Renders RichTreeItem for each node
- ✅ Looks up NodeMetrics from cockpitState

### ✅ Phase 3: Unified Stage Layout - **COMPLETE** (but disconnected)

**File**: [src/webview/cockpit/components/CodeMicroscope.tsx](src/webview/cockpit/components/CodeMicroscope.tsx)

- ✅ Main container with flex layout
- ✅ Orchestrates: StageHeader + SedimentGutter + CodeEditor + PortalsRail + TimeScrubber

**Components**:

1. **StageHeader.tsx** (lines 1-159) - ✅ COMPLETE
   - Health bar gradient based on riskScore
   - Bus factor (top 3 authors)
   - Neighbor navigation (sibling files)

2. **SedimentGutter.tsx** (lines 1-112) - ✅ COMPLETE
   - 12px fixed width gutter
   - Color gradient: green (new) → blue (medium) → gray (old)
   - Maps lines to commit age via `lineToCommitIndex`
   - Time travel aware (hides lines from future commits)

3. **CodeEditor.tsx** (lines 1-272) - ✅ COMPLETE
   - Renders code line-by-line with syntax highlighting
   - Inline drift warnings with severity colors
   - Focus mode: 120% font, dim surroundings
   - Symbol click handlers

4. **PortalsRail.tsx** (lines 1-221) - ✅ COMPLETE
   - 220px right rail
   - Groups references by folder/module
   - Incoming/outgoing reference sections
   - Symbol-focused filtering

### ✅ Phase 4: Semantic Zoom - **COMPLETE**

**File**: [src/webview/cockpit/components/CodeMicroscope.tsx](src/webview/cockpit/components/CodeMicroscope.tsx:55-62)

- ✅ Three zoom levels: overview (0), normal (1), focus (2)
- ✅ Overview: Shows only signatures, collapses bodies
- ✅ Normal: Standard editor view
- ✅ Focus: Selected symbol at 120% font, others dimmed
- ✅ Zoom controls in StageHeader

### ✅ Phase 5: Time Scrubber - **COMPLETE** (but disabled due to empty data)

**File**: [src/webview/cockpit/components/stages/TimeScrubber.tsx](src/webview/cockpit/components/stages/TimeScrubber.tsx)

- ✅ Horizontal slider with play/pause button
- ✅ Commit info display (SHA, message, date)
- ✅ Playback with 500ms interval
- ✅ Connected to `currentCommitIndex` state

---

## The Critical Disconnection

### Problem: Frame Analysis Data Never Reaches UI

**Root Cause**: The middleware refactor moved analysis from `AnalysisController` to `AnalysisService` + Redux, but the synchronization between Redux state and webview state is **unreliable**.

### Data Flow (Expected vs Actual)

**Expected Flow**:

```
1. User clicks file in Sidebar
2. CockpitProvider.navigateToFrame() sets activeFrame (status: 'scanning')
3. CockpitProvider._update() sends frame to webview (empty data)
4. AnalysisService.analyzeFrame() runs in background
5. Tier 1 completes → Redux dispatch → CockpitProvider notified
6. CockpitProvider._update() sends updated frame to webview ✅
7. UI receives frame.data with content, symbols, lineCommits, etc.
```

**Actual Flow**:

```
1. User clicks file in Sidebar ✅
2. CockpitProvider.navigateToFrame() sets activeFrame (status: 'scanning') ✅
3. CockpitProvider._update() sends frame to webview (empty data) ✅
4. AnalysisService.analyzeFrame() runs in background ✅
5. Tier 1 completes → Redux dispatch ✅
6. ❌ CockpitProvider._update() NOT reliably called
7. ❌ UI never receives frame.data
```

### Why Synchronization Fails

**File**: [src/webview/cockpit/CockpitProvider.ts](src/webview/cockpit/CockpitProvider.ts:202-230)

```typescript
store.subscribe((state, action) => {
  if (state.activeFrame && state.activeFrame !== this._activeFrame) {
    this._activeFrame = state.activeFrame;
    this._update(); // Should work but unreliable
  }
});
```

**Issues**:

1. JavaScript object reference equality (`!==`) only triggers if activeFrame reference changes
2. When tier data merges: `{ ...activeFrame, data: { ...tierData } }`, the reference MAY change
3. Redux store is separate from CockpitProvider state
4. No explicit callback after `FRAME_ANALYSIS_TIER_*_COMPLETE` actions

### Impact on UI Components

**File**: [src/webview/cockpit/components/CodeMicroscope.tsx](src/webview/cockpit/components/CodeMicroscope.tsx:58-88)

```typescript
const frameData = frame.data || {};
const content = frameData.content || ''; // EMPTY STRING
const symbols = frameData.symbols || []; // EMPTY ARRAY
const lineCommits = frameData.lineCommits || []; // EMPTY ARRAY
const blastRadius = frameData.blastRadius; // UNDEFINED
const driftIssues = frameData.drift || []; // EMPTY ARRAY
```

**Result**:

- CodeEditor renders nothing (no content)
- SedimentGutter shows blank divs (no lineCommits)
- PortalsRail shows "No references" (no blastRadius)
- TimeScrubber disabled (no commits)
- Drift warnings never trigger (no driftIssues)
- Focus mode doesn't work (no symbols)

---

## Specific Code Locations to Fix

### 1. CockpitProvider Analysis Callback

**File**: [src/webview/cockpit/CockpitProvider.ts](src/webview/cockpit/CockpitProvider.ts:367-395)

**Current code**:

```typescript
private _handleNavigateToFrame(msg: any) {
  // ... navigation logic
  if (frame.status === 'scanning') {
    this._triggerAnalysis(frame.id);  // Fire and forget ❌
  }
}
```

**Problem**: No callback after analysis completes to push updated frame to UI.

**Suggested fix**:

- Add callback parameter to `_triggerAnalysis()`
- Call `_update()` after each tier completes
- OR: Subscribe to Redux tier complete actions explicitly

### 2. Redux Reducer Tier Actions

**File**: [src/state/reducers.ts](src/state/reducers.ts:323-370)

**Current behavior**:

- Tier data cached in `cachedTierResults` if frame ID ≠ activeFrame.id
- OR merged into `activeFrame.data` if IDs match
- But NO message sent to webview

**Suggested fix**:

- Emit side effect after tier actions to notify CockpitProvider
- OR: Add middleware in `effects.ts` to handle tier complete actions

### 3. Store Subscription Reliability

**File**: [src/webview/cockpit/CockpitProvider.ts](src/webview/cockpit/CockpitProvider.ts:202-230)

**Current code**:

```typescript
if (state.activeFrame && state.activeFrame !== this._activeFrame) {
  this._activeFrame = state.activeFrame;
  this._update();
}
```

**Problem**: Reference comparison unreliable when objects are spread.

**Suggested fix**:

- Deep equality check on `activeFrame.data`
- OR: Track `activeFrame.id` + `activeFrame.status` separately
- OR: Subscribe to specific tier complete actions instead

### 4. Time Scrubber Implementation (Correct as-is)

**File**: [src/types/cockpit.ts](src/types/cockpit.ts:169)

**Status**: ✅ CORRECTLY IMPLEMENTED with commit-based approach

**Current**:

- TimeScrubber uses `currentCommitIndex` (array index) ✅
- State has `selectedCommitShas` (array of commit SHAs) ✅
- Scrubbing goes back through commit history, not time deltas ✅

**Note**: The original spacial cockpit plan mentioned `currentTimeFilter` (timestamp-based), but this was intentionally changed to commit-based scrubbing, which is much more intuitive and functional. This is the correct implementation.

---

## Architecture Changes Summary

### Old (Pre-refactor)

- Tab-based UI (5 separate tab components)
- Controller-based analysis (`AnalysisController`)
- Message handling with controller dispatch
- UI driven by controller state

### New (Current)

- Unified Stage-based UI (single pane with layers)
- Service-based analysis (`AnalysisService`)
- Message handling with Redux dispatch
- UI driven by Redux state + CockpitProvider bridge

### The Gap

- Redux receives analysis data ✅
- CockpitProvider subscribes to Redux ✅
- But synchronization unreliable ❌
- Webview doesn't receive updated frames ❌

---

## Recommended Fix Strategy: Explicit Tier Callbacks

**User Decision**: Use Option 1 - avoid Redux complexity until everything is stable

### Implementation Plan

#### Step 1: Modify AnalysisService to Accept Callback

**File**: [src/services/analysisService.ts](src/services/analysisService.ts)

Add optional callback parameter that fires after each tier completes:

```typescript
async analyzeFrame(
  frameId: string,
  view: vscode.Webview,
  onTierComplete?: (tier: number, updatedFrame: any) => void
) {
  // ... existing tier 1 logic
  await tier1Analysis();
  if (onTierComplete) onTierComplete(1, currentFrame);

  // ... existing tier 2 logic
  await tier2Analysis();
  if (onTierComplete) onTierComplete(2, currentFrame);

  // ... existing tier 3 logic
  await tier3Analysis();
  if (onTierComplete) onTierComplete(3, currentFrame);
}
```

#### Step 2: Update CockpitProvider to Pass Callback

**File**: [src/webview/cockpit/CockpitProvider.ts](src/webview/cockpit/CockpitProvider.ts)

Modify `_triggerAnalysis()` to pass callback:

```typescript
private async _triggerAnalysis(frameId: string) {
  const { getAnalysisService } = await import('../../services/analysisService');

  await getAnalysisService().analyzeFrame(
    frameId,
    this._view!,
    (tier: number, updatedFrame: any) => {
      // Update local state
      this._activeFrame = updatedFrame;

      // Push to webview immediately after each tier
      this._update();

      // Optional: Log for debugging
      console.log(`[CockpitProvider] Tier ${tier} complete for ${frameId}`);
    }
  );
}
```

#### Step 3: Ensure Redux Still Gets Updates

**Keep existing Redux dispatches** in AnalysisService - they're useful for state tracking and don't interfere with the callback approach. The callback is **additive**, not replacing Redux.

#### Step 4: Test Each Tier

After implementing, verify:

- **Tier 1**: CodeEditor shows content, symbols visible
- **Tier 2**: SedimentGutter colors appear, PortalsRail shows references, TimeScrubber enabled
- **Tier 3**: Any AI-driven insights appear (if applicable)

### Why This Works

1. **Direct path**: AnalysisService → callback → CockpitProvider → webview
2. **No Redux dependency**: Callbacks fire regardless of Redux state
3. **Incremental updates**: UI updates after each tier, not just at the end
4. **Easy to debug**: Clear call stack, no middleware indirection
5. **Redux coexistence**: Keep Redux for state tracking without relying on it for UI updates

---

## Critical Files for Fix

| File                                                         | Lines   | Issue                                     | Priority |
| ------------------------------------------------------------ | ------- | ----------------------------------------- | -------- |
| [CockpitProvider.ts](src/webview/cockpit/CockpitProvider.ts) | 367-395 | navigateToFrame doesn't wait for analysis | HIGH     |
| [CockpitProvider.ts](src/webview/cockpit/CockpitProvider.ts) | 202-230 | Store subscription unreliable             | HIGH     |
| [reducers.ts](src/state/reducers.ts)                         | 323-370 | Tier actions don't notify webview         | HIGH     |
| [analysisService.ts](src/services/analysisService.ts)        | N/A     | No callback after tier complete           | MEDIUM   |
| [effects.ts](src/state/effects.ts)                           | N/A     | No tier complete effect handlers          | MEDIUM   |

---

## Success Criteria

After fix, the following should work:

1. ✅ User clicks file → CodeEditor shows content immediately after Tier 1
2. ✅ SedimentGutter colors appear after Tier 2 (lineCommits available)
3. ✅ PortalsRail shows references after Tier 2 (blastRadius available)
4. ✅ TimeScrubber enabled after Tier 2 (commits array populated)
5. ✅ Drift warnings appear inline after Tier 2 (driftIssues available)
6. ✅ Focus mode works (symbols array populated)
7. ✅ All features from spacial cockpit plan visible and functional

---

## Additional Notes

### What Works Correctly

1. **Sidebar metrics** - Shows risk dots, traffic badges, drift icons ✅
2. **Bundle view** - Hotspots, treemap, evidence sections ✅
3. **Navigation** - Forward/back/neighbor navigation ✅
4. **Zoom controls** - UI buttons functional ✅
5. **Layout** - Responsive 3-pane design ✅

### Minor Issues Found

1. **TODO in RichTreeItem** (line 1):

   ```
   // TODO: Trigger highlight in tree (requires state lift)
   ```

2. **currentTimeFilter not implemented**:
   - Exists in CockpitState schema
   - Not used anywhere
   - TimeScrubber uses currentCommitIndex instead

3. **Inspector removed**:
   - Comments in SuperWebview mention Inspector removal
   - Not clear if this was intentional or should be replaced

---

## Implementation Steps Summary

### 1. Modify AnalysisService

- **File**: [src/services/analysisService.ts](src/services/analysisService.ts)
- **Action**: Add `onTierComplete` callback parameter
- **Result**: Fire callback after tier 1, 2, and 3 complete

### 2. Update CockpitProvider

- **File**: [src/webview/cockpit/CockpitProvider.ts](src/webview/cockpit/CockpitProvider.ts:140-154)
- **Action**: Pass callback to `analyzeFrame()` in `_triggerAnalysis()`
- **Result**: Update `_activeFrame` and call `_update()` after each tier

### 3. Keep Redux As-Is

- **Action**: No changes to Redux reducers or effects
- **Reason**: Redux caused issues, avoid until stable
- **Note**: Keep existing Redux dispatches for state tracking

### 4. Test UI Features

- Open file → see content immediately (Tier 1)
- See gutter colors + portals + scrubber (Tier 2)
- Verify all spacial cockpit features work

---

## Conclusion

All UI components from the spacial cockpit plan are **present and correctly implemented**. The middleware refactor successfully modernized the architecture from controllers to Redux. The critical gap is in the **synchronization point** where tier analysis completes but doesn't reliably notify the webview.

The fix is well-scoped: add explicit callbacks from AnalysisService to CockpitProvider to push updated frames to the webview after each tier. This is a **plumbing issue**, not a UI component issue, and avoids Redux complexity.

**Implementation approach**: Explicit callbacks (Option 1) - direct, predictable, and Redux-independent.
