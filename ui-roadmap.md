## Cockpit + Pipeline Refactor Roadmap

Goal: fully switch the sidebar UX to the React cockpit, keep the report webview as the deep-reading surface, and wire analysis pipelines (commits, staged/unstaged, bundles) so progress and actions feel native. Use the new contracts in `src/types/cockpit.ts` as the single source of truth.

---

### 1) Contracts & Types
- Make `src/types/cockpit.ts` canonical. Kill ad-hoc shapes in provider/UI. Keep DTOs tight to actual data.
- Extend commit DTO with scope flags and stats:
  ```ts
  export interface CommitDTO {
    sha: string;
    shortSha: string;
    message: string;
    author: string;
    authoredAt: string;
    changes: number;
    inBundle: boolean;
    scope: 'staged' | 'unstaged' | 'history'; // derive from source
    analyzed?: boolean;
  }
  ```
- Add analysis-progress message contract:
  ```ts
  export type CockpitHostMessage =
    | { type: 'updateState'; payload: CockpitState }
    | { type: 'analysisProgress'; payload: { isAnalyzing: boolean; step?: string; progress?: number } }
    | { type: 'focusSection'; payload: { section: CockpitSectionKey } };
  ```
- Symbol DTOs should carry `changeType` for filter fidelity; reports should include `bundleSummary`, `branch`, `pinned`.

### 2) Host Synchronization
- Centralize state assembly in `syncCockpitState`:
  - Pull commits from DB (`exportCommitsDto`), enrich with `scope` and `analyzed` flags.
  - Build `bundleSummary` from `RefactorBundleFacts` (commitCount, fileCount, symbolCount, createdAt).
  - Add report metadata (branch/pin/bundleSummary).
  - Map staged/unstaged files to DTOs with statuses; split selected paths into staged vs unstaged.
  - Preserve UI filters/open section from current state to avoid resets.
- Emit progress messages from orchestration (see section 4); hook `onDidChangeTreeData` to fire state updates, but avoid spamming full payload when only progress changes.

### 3) Command Routing (CockpitProvider)
- Expand message handler to cover all contract messages:
  - `generateReport` modes: selection | lastN | staged | unstaged → existing commands.
  - `cancelAnalysis` → cancel pipeline token + set `isAnalyzing=false`.
  - `setActiveSection`, filters (`setCommitsFilterText/Scopes`, `setSymbol*`, `setReports*`) → mutate state locally for snappy UI, then persist.
  - `openActiveReport`, `scrollReportToSection` → bridge to report webview command (`git-context.scrollToReportSection`).
  - Symbol actions: `openSymbolHistory`, `openSymbolInEditor`.
  - Report actions: open/regenerate/delete/pin.
- Add `git-context.scrollToReportSection` command (in `commands.ts`) that posts to the report webview:
  ```ts
  const scrollToReportSectionCmd = vscode.commands.registerCommand(
    'git-context.scrollToReportSection',
    async (sectionId: string) => {
      refactorReportProvider?.postMessage({ type: 'scrollToSection', sectionId });
    }
  );
  ```

### 4) Analysis Progress Integration
- In `generateRefactorBundleReport`, emit progress via CockpitProvider:
  ```ts
  cockpitProvider?.updateState({ isAnalyzing: true, analysisStep: 'scope', analysisProgress: 0.1 });
  // ... after symbols
  cockpitProvider?.updateState({ analysisStep: 'symbols', analysisProgress: 0.4 });
  // ... after edges/risks
  cockpitProvider?.updateState({ analysisStep: 'risks', analysisProgress: 0.6 });
  // ... after LLM
  cockpitProvider?.updateState({ analysisStep: 'llm', analysisProgress: 0.9 });
  // done
  cockpitProvider?.updateState({ isAnalyzing: false, analysisStep: undefined, analysisProgress: undefined });
  ```
- Do the same in `analyzeCommits` batch:
  - Track per-commit index; report percent = i / total.
  - Set `isAnalyzing=true` at start, reset when done/cancelled.
- For staged/unstaged analysis, wrap with the same progress messages.

### 5) Pipeline Enhancements
- **Staged analysis**: replace placeholder with real diff-based pass.
  ```ts
  const files = git.getStagedFiles(); // returns FileChange[]
  const symbols = await symbolExtractor.extractWorkingTreeSymbols(files, { staged: true });
  const edges = await dependencyExtractor.extractWorkingTreeEdges(files, symbols);
  const risks = riskDetector.detectRisks(files, symbols, edges);
  const blastRadius = dependencyExtractor.calculateBlastRadius([...symbols.added, ...symbols.modified.map(m => m.symbol)], edges.added);
  ```
- **Unstaged analysis**: mirror staged, but include untracked via `getUnstagedFiles` and `safeGetWorkingContent`.
- **Idempotent analysis**: keep the early return (already analyzed) but allow `forceReanalyze` to bypass; refresh metadata (`files_changed`) even if analysis is reused.
- **Symbol extractor**: add working-tree variant that diffs staged/unstaged vs HEAD without SHA.

### 6) UX: Cockpit Webview (src/webview/cockpit/index.tsx)
- Header:
  - Context line `{repo} • {branch}`; status pill shows bundle summary or “Analyzing — {step} ({%})”; Cancel button when running.
  - Analyze dropdown: selection / staged / unstaged / last N; keep last-N sticky.
- Commits & Selection accordion:
  - Filter input and scope toggles that actually filter list based on `scope`.
  - “Select all staged/unstaged”, “Clear selection”, “Add commit by SHA”.
  - Show selected staged/unstaged paths separately.
  - Virtualize long lists (future) or at least cap height with scroll (already partially done).
  - “Load more” when `hasMoreCommits` is true.
- Bundle accordion:
  - Summary card with commits/files/symbols/debt/created.
  - Actions: regenerate, export JSON, open full report, clear, cancel if running.
  - Quick links: Overview, Incompleteness, Drift, Legacy, Timeline → `scrollReportToSection`.
- Symbols accordion:
  - Filters: text, kind, change (added/modified/removed).
  - Row actions: open history, open in editor.
- Reports accordion:
  - Filters: text, branch dropdown, pinned-only checkbox.
  - Row actions: open, regenerate, pin/unpin, delete; show summary + date.
- Layout:
  - Keep header sticky, allow main panel + accordions to scroll; lists have `overflow-y:auto` caps.

### 7) Data Fidelity
- Commit scopes:
  - When building commit DTOs, tag `scope` based on source: staged list, unstaged list, or history. Use this to filter in UI.
  - Add `hasMoreCommits` from the provider (based on DB paging).
- Symbols:
  - Include `changeType` from DB (`change_type` in `symbols` table).
  - `lastChangedAt` should be commit date of that symbol row.
- Reports:
  - Attach `branch` and `bundleSummary` (commitCount/fileCount/symbolCount) if available.
- Bundle:
  - Derive `bundleReportId` (last generated report) so `openActiveReport` can focus it.

### 8) Commands & Navigation
- Add `git-context.scrollToReportSection` command and use it in cockpit `scrollReportToSection`.
- Keep `openActiveReport` focused on the last report ID; set it when a new report is generated.
- Ensure `cancelAnalysis` actually cancels the progress token in `generateRefactorBundleReport` (thread token into pipeline).

### 9) Testing / QA
- Unit:
  - Progress emission: mock pipeline and assert `updateState` calls.
  - Commit DTO mapping: scope and inBundle flags based on inputs.
  - Symbol DTO mapping: changeType and dates.
- Manual:
  - Run `npm run build:cockpit`; open cockpit webview, verify filters/actions.
  - Analyze staged/unstaged paths and confirm progress pill + cancel behavior.
  - Generate report, then use quick links to scroll sections.
  - Large commit list: “Load more” increments visible count, preserves filters.

### 10) Cleanup & Migration
- Once cockpit has parity, feature-flag removal of old tree views; update README/PROJECT to describe cockpit-first workflow.
- Remove unused message handlers and legacy UI state once the new contract is stable.

### Implementation Phasing (suggested)
1. **Contract enforcement**: tighten provider/UI to use `CockpitState` only; map DTOs with scope/changeType.
2. **Progress plumbing**: add `analysisProgress` messages and consume in UI; add cancel wiring.
3. **Staged/unstaged analysis**: implement working-tree symbol/diff passes; hook commands.
4. **Deep-links**: add `scrollToReportSection` command and wire quick links.
5. **UX polish**: virtualization/perf, sticky header, refined status pills, empty states.
6. **Docs + cleanup**: README/PROJECT updates, remove deprecated paths.

Use this file as the execution checklist; keep commits small and focused per phase.
