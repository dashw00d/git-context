# Comprehensive Cockpit Refactor Plan: Ultimate Unified UI
 
## Context & Motivation
**Current State** (from scouting):

**Hybrid UI**: Cockpit React webview (accords/lists/filters/actions) + 4 TreeDataProviders (Commits/Bundle/Symbols/Reports) + DebtMeter bar + MD reports.
**Data Flow**: Providers compute/export DTOs → syncCockpitState() → Cockpit. Trees duplicate (e.g., ActiveBundle categories mirror Cockpit bundle).
**Strengths**: DTO contracts solid (CockpitState), progress sync, filters/actions.
**Pain Points**:
Fragmented: Glance metrics scattered (trees/Cockpit/debt/reports).
Trees verbose/static (no charts/search), Cockpit lists lack depth (no previews/metrics).
"All in reports": Deep findings (symbols/evidence) → MD previews.
Maintenance: Dual impl (trees + Cockpit).
 
**Vision**: **Cockpit 2.0** = single dynamic pane. Absorb trees/debt → rich tabs/charts/drilldowns. "Everything at glance" via metrics + inline previews. React-native (Recharts/AgGrid), 90% info without reports (reports = export/print).
 
**Goals**:
**Unified**: Cockpit-only (trees → DTO exporters).
**Glanceable**: Top metrics/charts (health/debt pie), badges everywhere.
**Deep**: Inline tables/graphs/modals (no MD hops).
**Reactive**: Live filters/charts, bulk actions.
**Zero-Dependency**: Client-side search/charts (Fuse.js/Recharts).
 

## High-Level Architecture
textCockpit Webview (React 18)
├── Header: Status/Metrics Row/Analyze Toolbar
├── Tabs: Commits | Bundle | Symbols | Reports
│ ├── Sub-Views: Lists/Tables/Charts
│ └── Inline Actions/Modals
└── Data: Enhanced DTOs from Providers (no trees)
 
**DTO Evolution** (src/types/cockpit.ts):
TypeScriptinterface CockpitMetrics {
health: number; // 0-100 from LLM
debt: { zombies: number, drift: number, dead: number, total: number };
bundle: { commits: number, files: number, symbols: number };
}
interface CommitDTO & { preview?: { snippet: string, risks: string[] } }
interface SymbolDTO & { callers: string[], snippet: string }
 
**Providers Refactor**:

Remove TreeDataProvider impl.
Add exportMetrics(), exportPreviews().
 

## Phased Roadmap (with Todos/Examples)
 
### Phase 1: Data Foundation (2 days)
**Context**: DTOs carry basics; add previews/metrics.
**Todos**:

Enhance syncCockpitState(): Compute/pull metrics (debt from facts, health from LLM).
Providers: exportPreviews(limit=50) (snippet/risks).
New: MetricsProvider class (singleton, debt calc).
 
**Example DTO**:

TypeScript// extension.ts sync
cockpitState.metrics = {
health: bundleFacts?.analysis?.metadata?.healthScore ?? 100,
debt: calculateDebt(bundleFacts),
...
};
 
### Phase 2: Layout & Tabs (3 days)
**Context**: Cockpit accords → tabs (react-tabs), metrics row (Recharts pie).
**Todos**:

npm i recharts react-tabs ag-grid-react fuse.js react-window
Header: <DebtPie debt={state.metrics.debt} />
Tabs: Commits (CommitTable), Bundle (CategoryGrid), etc.
 
**Mermaid Tab Mock**:

Invalid diagram syntax.
 
**JSX Example** (Bundle Tab):
tsx<TabPanel value="bundle">
<MetricsRow metrics={state.metrics} />
<SummaryCard bundle={state.bundleSummary} />
<CategoryAccordion categories={state.bundleCategories} />
<TopIssuesTable issues={state.topFindings} />
</TabPanel>
 
### Phase 3: Absorb Trees/Debt (2 days)
**Context**: Trees duplicate Cockpit lists; debt → metrics.
**Todos**:

Providers: Impl-only export*Dto(), remove trees (extension.ts unregister).
DebtMeter: → Cockpit metrics row.
Commands: All postMessage to Cockpit handlers.
 
**Pre/Post Metrics**:
| | Trees/Debt | Cockpit 2.0 |
|--|------------|-------------|
| Debt | Status bar % | Pie + table |
| Bundle | Category counts | Charts + top-N |
 

### Phase 4: Rich Components (4 days)
**Context**: Lists → tables/charts.
**Todos**:

AgGrid: CommitTable (filter/sort/group), SymbolTable (graph tooltip).
Recharts: Drift pie, symbol timeline (line/commit dots).
Fuse.js: Global search (commits/symbols/reports).
Modals: Evidence (diff viewer), Timeline (commits graph).
 
**Symbol Table Example**:

tsx<AgGrid
rowData={state.symbols}
columnDefs={[
{ field: 'name', filter: true },
{ field: 'changeType', cellRenderer: Badge },
{ field: 'callers', tooltip: true }
]}
/>
 
### Phase 5: Actions/Polish (2 days)
**Todos**:

Bulk: Select-all/export/diff.
Perf: Virtual rows, lazy tabs.
Theming: VSCode colors.
Feature Flag: cockpitV2: true (toggle trees).
 

### Risks & Migration

**Risks**: React perf (long lists → virtualize), DTO bloat (paginate).
**Migration**: Parallel trees (hide via context), user pref toggle.
**Testing**: Storybook components, Vitest DTOs.
**Effort**: 13 days; MVP (Phases 1-3) 1 week.
 
**Next**: Fetch create_mode if custom mode needed; else prototype Phase 1 DTOs.
 

# Ultimate Cockpit Refactor Plan (w/ Diff-As-You-Go Integration)
 
## Updated Context
**New Req**: Fold in [diff-as-you-go-plan.md](diff-as-you-go-plan.md) "Live Change Tracker":

Real-time onDidChangeTextDocument tracking, debounce thresholds (lines/symbols).
Incremental parse (symbols.ts, difftastic), auto-summary (facts/LLM/report).
Sidebar "Working Changes", config (liveThreshold), reset on save/commit.
**Cockpit Fit**: Dedicated "Live" tab/section, metrics (progress/files), auto-trigger analysis.
 
**Vision Unchanged**: Cockpit absorbs all (trees + debt + live). Live = dynamic "Working Bundle".
 

## Goals (Expanded)

**Live-First**: Threshold → auto-bundle/symbols/charts.
**Proactive**: Notifications/modals on threshold, inline suggestions.
 

## Architecture (w/ Live)
textCockpit
├── Header + Metrics Row [Health/Debt + Live Progress%]
├── Tabs: Live | Commits | Bundle | Symbols | Reports
└── Live Tab: Threshold Config | File Deltas Table | Auto-Summary Preview
 
**DTOs + Live**:
TypeScriptinterface LiveState {
pendingFiles: number;
progress: number; // 0-100
deltas: SymbolDelta[]; // Incremental added/mod/removed
liveFacts?: Partial<RefactorBundleFacts>;
threshold: { lines: number, symbols: number };
}
CockpitState & { live: LiveState }
 
**LiveTracker Integration** (src/liveTracker.ts from plan):

Instance in extension.ts, postMessage on threshold/change.
Cockpit handlers: updateLiveDeltas, generateLiveSummary.
 

## Phased Roadmap (Incorporating Live)
 
### Phase 0: Prep LiveTracker (1 day, from plan)

Implement LiveDiffTracker class (src/liveTracker.ts).
DTO: exportLiveDeltas() → Cockpit.
Activate: extension.ts → liveTracker.onThreshold(() => postMessage('liveThreshold')).
 
**Example**:

TypeScript// liveTracker.ts (condensed from plan)
class LiveDiffTracker {
// ... handleChange, debouncedCheck
onThreshold(cb: () => void) { this.thresholdCallbacks.add(cb); }
}
 
### Phase 1: Data Foundation (2 days)

DTOs + live: LiveState.
Providers: exportLivePreviews() (deltas/snippets).
syncCockpitState(): state.live = liveTracker.exportLiveState().
 

### Phase 2: Layout & Tabs (3 days)

Tabs: Add "Live Changes" (first tab).
Metrics Row: + Live progress bar (<ProgressBar value={state.live.progress} />).
 
**Live Tab Mock**:

tsx<TabPanel value="live">
<ConfigPanel threshold={state.live.threshold} />
<DeltaTable deltas={state.live.deltas} /> // AgGrid: file/symbol/change/snippet
{state.live.liveFacts && <LiveSummaryPreview facts={state.live.liveFacts} />}
<Actions: Force Summary | Reset />
</TabPanel>
 
### Phase 3: Absorb Trees/Debt/Live (2 days)

Trees/Debt → Cockpit.
Live: Threshold notify → modal "Generate Live Report?" → generateLiveSummary() (plan Step 3).
 

### Phase 4: Rich Components (4 days)

Live: Incremental chart (lines/symbols over time), difftastic highlights inline.
Global: Search indexes live deltas too.
 
**Live Metrics Example**:

tsx<MetricsRow>
<LiveProgress progress={state.live.progress} files={state.live.pendingFiles} />
<DebtPie debt={state.metrics.debt} />
</MetricsRow>
 
### Phase 5: Polish/Auto (2 days)

Config: Cockpit form → vscode.workspace.getConfiguration('commitTracker.liveThreshold').
Auto: Threshold → auto-post 'generateLiveReport'.
Reset: Save/commit → clear live state.
 

## Examples
### Full CockpitState Snippet
TypeScript{
// Existing...
live: {
pendingFiles: 3,
progress: 75,
deltas: [{ file: 'src/UserService.php', added: 2, mod: 5 }],
threshold: { lines: 50, symbols: 5 }
},
metrics: { health: 85, debt: { zombies: 2, ... }, liveProgress: 75 }
}
 
### Live Tab JSX Mock
tsxfunction LiveTab({ state, vscode }: { state: CockpitState }) {
return (
<div>
<ThresholdConfig threshold={state.live.threshold} onUpdate={updateThreshold} />
<DeltaChart deltas={state.live.deltas} />
<SymbolDeltaTable data={state.live.deltas.flatMap(d => d.symbols)} />
{state.live.liveFacts && <LiveBundlePreview facts={state.live.liveFacts} />}
</div>
);
}
 
### Threshold Handler (Cockpit)
tsx// index.tsx message handler
if (msg.type === 'liveThreshold') {
vscode.postMessage({ type: 'generateLiveReport' });
}
 
## Risks/Migration (Updated)

**Live Perf**: Cap buffers (plan: slice(-1000)), incremental parse.
**Migration**: Flag cockpit.liveMode, fallback trees.
**Testing**: Mock edits, Vitest LiveDiffTracker.
 
**Total**: 14 days. **MVP (Live + Tabs)**: 5 days. Ready for code mode?