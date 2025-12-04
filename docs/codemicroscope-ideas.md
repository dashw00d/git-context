# CodeMicroscope – Cohesive Improvement Roadmap

**Goal:** Turn all the rich analysis data that already exists in `bundleFacts` (moved blocks, legacy/dead symbols, convention drift, historical edges, hotspots, unresolved callers, etc.) into clear, actionable visual feedback while time-traveling through commits.

## Final Prioritized Feature List (Consolidated & Deduped)

| Priority | Feature                                                              | Impact | Effort      | Quick Win? | Target Component(s)              |
| -------- | -------------------------------------------------------------------- | ------ | ----------- | ---------- | -------------------------------- |
| 1        | Dead / Legacy Symbol Indicators                                      | ★★★★★  | Low         | Yes        | CodeEditor, StageHeader          |
| 1        | Moved Block Visualization + Click-to-Navigate                        | ★★★★★  | Low         | Yes        | CodeEditor, new MovedBlockGutter |
| 1        | Pipeline Findings Badges (missing/zombies/unresolved) in StageHeader | ★★★★☆  | Very Low    | Yes        | StageHeader                      |
| 2        | Drift Event Markers on TimeScrubber                                  | ★★★★☆  | Low-Medium  | Yes        | TimeScrubber                     |
| 2        | Historical Portal Connections (time-aware filtering)                 | ★★★★★  | Medium      |            | PortalsRail                      |
| 2        | Convention Drift Underline + Tooltip                                 | ★★★★☆  | Low         | Yes        | CodeEditor                       |
| 2        | Unresolved Callers / Missing Symbols Indicators                      | ★★★★☆  | Low         | Yes        | CodeEditor                       |
| 3        | Symbol Lineage / Evolution Panel                                     | ★★★★★  | Medium-High |            | New LineagePanel in PortalsRail  |
| 3        | Connection Timeline Mini-View                                        | ★★★★☆  | High        |            | New ConnectionTimeline           |
| 4        | Full Connection Overlay (animated lines)                             | ★★★★☆  | High        |            | New ConnectionOverlay            |
| 4        | Hotspot Highlighting & Badges                                        | ★★★☆☆  | Medium      |            | CodeEditor, StageHeader          |

**Recommended starting order (next 1–2 weeks):** Priority 1 → Priority 2 → one Priority 3 feature as MVP.

## Phase 1 – Quick Wins (High Impact / Low Effort)

### 1. Dead & Legacy Symbol Indicators

```tsx
// hooks/useFileAnalysisData.ts (new central hook)
const deadSymbolIds = new Set(
  bundleFacts?.findings?.legacyAudit?.dead?.map((s: any) => s.symbol_id || s.id) || []
);
const legacyUsedIds = new Set(bundleFacts?.findings?.legacyAudit?.legacyUsed || []);
```

In CodeEditor:

- Opacity 0.4 + strikethrough for dead symbols
- Orange wavy underline + ⚠️ for legacy-used
- 👻 icon + tooltip “Dead symbol – removed but still referenced”
- 💀 badge in StageHeader: `{deadCount} dead • {legacyCount} legacy`

### 2. Moved Block Visualization

```tsx
// In CodeMicroscope.tsx
const movedBlocks = React.useMemo(
  () =>
    (cockpitState?.bundleFacts?.bundle?.movedLineage || []).filter(
      m => m.destVersion === renderFrame.id || m.sourceVersion === renderFrame.id
    ),
  [cockpitState?.bundleFacts, renderFrame.id]
);
```

New component: `MovedBlockGutter.tsx`

- Purple left border (3px solid) on moved line ranges
- Tooltip: “Moved from FileA.tsx:42–56 (commit abc123)”
- Click → `vscode.postMessage({ type: 'navigateToFrame', frame: { id: sourceVersion } })`

### 3. StageHeader Findings Summary

```tsx
{
  findings?.incompleteness?.missing > 0 && <Badge>⚠️ {missing} missing</Badge>;
}
{
  findings?.incompleteness?.zombies > 0 && <Badge>👻 {zombies} zombies</Badge>;
}
{
  findings?.legacyAudit?.dead?.length > 0 && <Badge>💀 {dead.length} dead</Badge>;
}
{
  findings?.unresolvedCallers?.total > 0 && <Badge>❓ {total} unresolved</Badge>;
}
```

## Phase 2 – Time-Aware Enhancements

### 4. Drift Event Markers on TimeScrubber

```tsx
const driftCommits = driftSymbols
  .map(s => lineCommits.find(lc => lc.symbolId === s.symbolId)?.commitSha)
  .filter(Boolean);
```

→ Render small red vertical ticks with tooltip “Convention drift introduced here”

### 5. Historical PortalsRail

```tsx
const historicalRefs = React.useMemo(() => {
  if (currentCommitIndex === undefined) return filteredBlastRadius;
  const commitSha = orderedCommits[currentCommitIndex];
  const edgeHistory = bundleFacts?.evidence?.['edge.history'] || {};
  const filterEdge = (ref: any) => {
    const key = `${ref.from}->${ref.to}`;
    const hist = edgeHistory[key];
    return hist && hist.createdAt <= commitSha;
  };
  return {
    incoming: filteredIncoming.filter(filterEdge),
    outgoing: filteredOutgoing.filter(filterEdge),
  };
}, [...]);
```

→ Fade out connections that didn’t exist yet (30% opacity + “future” label)

### 6. Convention Drift + Unresolved Indicators

In CodeEditor symbol rendering:

```tsx
{
  driftIssue && (
    <span className="drift-underline" title={`Should be ${suggestedName}`}>
      ⚠️
    </span>
  );
}
{
  isUnresolved && <span title={`${callerCount} unresolved callers`}>❓</span>;
}
```

## Phase 3 – Rich Temporal Visualizations

1. **Symbol Lineage Panel** (PortalsRail tab when symbol focused)
   - Vertical timeline of renames/moves/refactors
   - Click any point → jump to that commit + file

2. **ConnectionTimeline** (mini component)
   - Shows when each outgoing/incoming edge was created
   - Active vs inactive based on currentCommitIndex

## Recommended Code Structure Changes

```ts
// hooks/useFileAnalysisData.ts  ← single source of truth
export const useFileAnalysisData = (fileId: string, bundleFacts: any, commitIdx?: number) => {
  return React.useMemo(
    () => ({
      movedBlocks,
      deadSymbols: Set<string>,
      legacySymbols: Set<string>,
      driftIssues: Array<DriftIssue>,
      unresolvedCallers: Array<Unresolved>,
      historicalEdges: Map<string, EdgeHistory>,
      hotspots: Array<Hotspot>,
    }),
    [fileId, bundleFacts, commitIdx]
  );
};
```

New atomic indicator components (easy to style/test):

- `DeadSymbolMarker.tsx`
- `MovedBlockIndicator.tsx`
- `DriftUnderline.tsx`
- `LegacyBadge.tsx`

## Final Recommendation – What to Do Right Now

**Start today with Phase 1 (all are <1 day each):**

1. Create `useFileAnalysisData` hook
2. Add dead/legacy styling + StageHeader badges
3. Add moved block gutter + navigation
4. Add StageHeader findings summary

These four changes alone will make the tool feel dramatically more useful and “alive” with the data that’s already being computed.

After that → Phase 2 (drift markers + historical portals) → then pick the Lineage Panel as the big differentiating feature.

You’ll have a massively improved CodeMicroscope in under two weeks, with a clear path to the full temporal refactoring microscope vision.

Ready to start coding Phase 1? I can give you the exact PR-ready snippets for any of the four quick wins first. Just say which one you want to tackle first!
