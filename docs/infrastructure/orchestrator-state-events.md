# Orchestrator State Changes (Sources & Receivers)

This documents each orchestrator state change we emit, what triggers it, and which consumers react to it (Cockpit webview, providers, commands).

## Notation
- **Source**: where the update is issued (command/feature).
- **State change**: fields set on the orchestrator.
- **Reason tag**: reason string passed to `updateState`/`updatePartial`.
- **Receivers**: webview (CockpitProvider), providers (commits/bundle/symbol history), and any effects.

## Analyze Flow
- **command:analyze:start**
  - Source: `git-context.analyze` (cockpitFeatures) at start.
  - State: `isAnalyzing: true`, `analysisStep: 'Starting analysis...'`.
  - Receivers: Cockpit webview (status pill), any UI bound to `isAnalyzing`.

- **command:analyze:error**
  - Source: `git-context.analyze` catch block.
  - State: `isAnalyzing: false`, `error: message`.
  - Receivers: Cockpit webview shows error; UI clears analyzing flag.

- **command:analyze:complete**
  - Source: `git-context.analyze` finally block.
  - State: `isAnalyzing: false`.
  - Receivers: Cockpit webview clears analyzing flag.

- **command:analyzeLastN**
  - Source: `git-context.analyzeLastCommits`.
  - State: `selectedCommitShas` (updated with N commits).
  - Receivers: Cockpit webview (commits list), then triggers `command:analyze`.

- **report:cached**
  - Source: `reportService.generateReport` when cache hit.
  - State: `bundleFacts`, `bundleSummary`, `bundleReportId`, `retrievedHistory`, `isAnalyzing: false`, `analysisStep: undefined`, `pipelineErrors: []`.
  - Receivers: Cockpit webview state update (Bundle tab); providers via `updateContexts`.

- **report:complete**
  - Source: pipeline event `finished` in `reportService.generateReport`.
  - State: `bundleFacts`, `retrievedHistory`, `isAnalyzing: false`, `analysisStep: undefined`, `pipelineErrors: []`.
  - Receivers: Cockpit webview (Bundle tab), downstream UI consuming `bundleFacts`.

- **report:generated**
  - Source: `reportService.generateReport` after saving report.
  - State: `bundleFacts`, `bundleSummary`, `bundleReportId`, `isAnalyzing: false`.
  - Receivers: Cockpit webview (Bundle tab).

- **report:start / step updates**
  - Source: pipeline events (`onEvent` in `reportService.generateReport`).
  - State: `analysisStep`, `analysisProgress` (optional), `isAnalyzing` as set by caller.
  - Receivers: Cockpit status pill.

## Selection & Commits
- **command:toggleCommit**
  - Source: `git-context.toggleCommitSelection`.
  - State: `selectedCommitShas`.
  - Receivers: Cockpit webview commits list, context updates.

- **command:clearSelection**
  - Source: `git-context.clearSelection`.
  - State: `selectedCommitShas`, `selectedStagedPaths`, `selectedUnstagedPaths` reset.
  - Receivers: Cockpit webview (Selection card), context.

- **command:addCommitBySha**
  - Source: `git-context.addCommitBySha`.
  - State: `selectedCommitShas` (add).
  - Receivers: Cockpit webview.

- **command:selectAllStaged / selectAllUnstaged**
  - Source: respective commands.
  - State: `selectedStagedPaths` / `selectedUnstagedPaths`.
  - Receivers: Cockpit webview (Selection).

- **command:addMoreCommits**
  - Source: `git-context.addMoreCommits`.
  - State: none direct; refresh providers and Cockpit state via `refreshCockpitState`.
  - Receivers: CommitsProvider, Cockpit webview updated after refresh.

## Bundle Controls
- **command:bundle.regenerate**
  - Source: command triggers `git-context.analyze`.
  - State: see Analyze Flow.

- **command:bundle.clear**
  - Source: `git-context.bundle.clear`.
  - State: `bundleFacts: null`, `bundleSummary: null`.
  - Receivers: Cockpit webview (Bundle tab clears).

- **command:bundle.cancel**
  - Source: `git-context.bundle.cancel`.
  - State: `isAnalyzing: false`.
  - Receivers: Cockpit webview (status pill).

- **command:bundle.export**
  - Source: `git-context.bundle.export`.
  - State: none; writes `bundleFacts` to file.
  - Receivers: none (UI toast).

## Reports
- **command:openReport / regenerateReport / deleteReport / togglePinReport**
  - Source: respective commands.
  - State: depends on report manager; regenerates calls Analyze; delete/pin update saved reports; Cockpit updated via `refreshCockpitState`.
  - Receivers: Cockpit webview Reports tab after refresh.

## Super Report (facts-first)
- **openSuperReport**
  - Source: webview message → `git-context.superReport`.
  - State: none; opens webview using `bundleFacts` or last-bundle-facts.json.
  - Receivers: separate webview panel.

## UI State (Filters & Sections)
- **ui:setActiveSection**
- **ui:setCommitsFilterText**
- **ui:setCommitsFilterScopes**
- **ui:setSymbolFilterText**
- **ui:setSymbolKindFilter**
- **ui:setSymbolChangeFilter**
- **ui:setReportsFilterText**
- **ui:setReportsBranchFilter**
- **ui:setReportsShowPinnedOnly**
  - Source: Cockpit webview messages.
  - State: updates corresponding filter/section fields.
  - Receivers: Cockpit webview (re-render with new filters).

## Context Updaters / Effects
- `updateContexts` / `refreshCockpitState`: invoked after analyze/selection changes to sync context keys and provider data to orchestrator; webview receives `updateState` messages via `CockpitProvider`.
- Registered effects (in AppShell features) may react to `bundleFacts` changes (e.g., auto-update contexts).

## Notes
- Auto-index on activation is disabled; no state changes on activation other than provider initialization.
- `isAnalyzing` is set true at analyze start and reset on complete/error. Pipeline events adjust `analysisStep`/`analysisProgress`.
