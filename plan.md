## FINAL COHESIVE PLAN – Commit Tracker v2 “Refactor Intelligence Engine”

You now have a working prototype that already does **90% of the hard parts** (Tree-sitter + Difftastic + per-commit DB + LLM summaries).  
What’s missing is the **“facts-first + LLM-as-analyst + scoped working-tree bundle + zero-legacy cockpit”** vision we iterated on.

Below is the **single, start-to-finish, file-by-file plan** that turns your current code into exactly the tool you described – with concrete tasks, acceptance criteria, and UI mockups.

### North-Star Goal (the loop that must feel magical)
1. Select any number of commits in the Commit Tracker  
2. Press **“Generate Refactor Bundle”**  
3. Get a **Facts JSON** (pure data) + a **beautiful webview report** that:
   - Shows net intended state vs working tree
   - Highlights incompleteness, zombies, drift, dead/legacy/replaced
   - Gives an ordered cleanup checklist (LLM analyst)
   - Has clickable evidence → file + line
   - Updates a **Refactor Debt Meter** in status bar
4. Clean → re-run → meter goes to 0 → you’re done.

### Current State vs Target (quick audit of your code)

| Feature | Already exists | Still broken / missing | Fix needed |
|---------|----------------|------------------------|------------|
| Per-commit symbol/edge capture | Yes | – | Keep |
| Difftastic highlights | Yes | – | Keep |
| Bundle-vs-working drift detection | Partial (`src/ui/report.ts`) | Zombie bug, mismatched IDs, fake widening | Phase 0 fixes |
| Semantic ID consistency | No | Working snapshot uses different extractor → everything looks missing | Critical |
| Real rename tracking | No | Only heuristic in report | Phase 2 |
| Scoped analysis + lazy widening | Stub only | Blast radius & widening are placeholders | Phase 1 |
| Facts JSON layer | No | Only markdown | Phase 1 |
| Multi-pass LLM analyst with evidence links | No | Only one summary | Phase 3 |
| Webview cockpit UI + debt meter | No | Only markdown | Phase 4 |
| Git-hook auto-analysis | No | Manual only | Phase 5 |

### PHASE 0 – Stop the Lies (1 day – do this first)

| Task | File | Change | Acceptance |
|------|------|--------|------------|
| 0.1 Persist selection | `src/ui/commitTrackerProvider.ts` | Remove `clearSelection()` after bundle or guard with config | Checkboxes stay checked |
| 0.2 Fix semantic ID mismatch | `src/ui/report.ts` → `getScopedWorkingTreeSnapshot` | Replace `extractSymbolsFromContent` with **exact same SymbolExtractor** used in commit analysis (`new SymbolExtractor(git)`) | Missing-additions drop from 60+ → <10 |
| 0.3 Kill fake zombies | `detectRefactorDrift` | Delete the loop that adds every non-intended symbol as zombie | Zombies = only symbols with `expect: 'absent'` |
| 0.4 Include removed symbols in graphs | `ContextExporter.generateGraphs` | Add removed/renamed symbols to `allSymbols` | Graph shows old names |
| 0.5 Keep full-confidence edges | `ContextExporter.applyContextBudget` | Remove early low-confidence truncation for legacy audit | Dead-code detection works |

### PHASE 1 – Facts Engine (pure JSON truth) – 4 days

Create `src/facts/` – **this becomes the single source of truth**.

```ts
src/facts/
  scope.ts              → ScopeSet (commit files + working changed + blast radius)
  workingSnapshot.ts    → uses real SymbolExtractor + DependencyExtractor
  intendedMap.ts        → fold commits oldest→newest, respect renames
  driftDetector.ts      → pure comparison (no LLM)
  legacyAudit.ts        → dead, legacy_used, replaced_leftovers (scoped reachability)
  factsAssembler.ts     → emits RefactorBundleFacts JSON
```

**Facts JSON v2 schema** (save as `.git/commit-tracker/last-bundle-facts.json`)

```json
{
  "version": "2.0",
  "bundle": { "oldestSha": "...", "shas": ["...", "..."] },
  "scope": { "files": 42, "blastRadius": 8 },
  "intended": { "present": 124, "absent": 18, "renamed": 6 },
  "working": { "symbols": 312, "edges": 842 },
  "findings": {
    "incompleteness": { "missing": 7, "zombies": 4, "divergent": 3 },
    "patternDrift": { "mixedTargets": 5, "oldNamespaces": 2 },
    "legacyAudit": {
      "dead": 9,
      "legacyUsed": 4,
      "replacedLeftovers": [{ "old": "...", "new": "...", "confidence": 0.92 }]
    }
  },
  "evidence": { "snippets": { "symbol_123": "..." }, "difftastic": { "path": "..." } }
}
```

Acceptance: `generateRefactorBundleReport` writes valid facts JSON with realistic counts.

### PHASE 2 – Real Rename + Full Legacy Audit (4 days)

| Task | Change |
|------|--------|
| 2.1 Persist real renames | Add `renames` table + store `old_symbol_id → new_symbol_id` during commit analysis |
| 2.2 IntendedMap respects renames | In `intendedMap.ts` treat rename as continuity |
| 2.3 Scoped dead-code | Build inbound graph from working edges → seed roots (controllers, commands, Livewire components, exported symbols) → unreachable = dead |
| 2.4 Replaced leftovers | Symbol intended absent + similar name/signature + low inbound count → pair with new symbol |
| 2.5 Populate `legacyAudit` in facts JSON | Full buckets |

### PHASE 3 – LLM as Analyst (not summarizer) – 3 days

Create `src/analysis/`

```ts
src/analysis/
  prompts.ts         → 3 fixed prompts (intent, drift verification, cleanup plan)
  runner.ts          → sequential passes over facts JSON
  blocks.ts          → typed evidence-linked blocks
  renderer.ts        → final interwoven Markdown
```

**Prompt 1 – Intent & Story**
> “You are a senior engineer reviewing a refactor bundle. Using only the attached facts JSON, describe in 2–3 paragraphs what refactor this series of commits was attempting and what the intended end-state is.”

**Prompt 2 – Drift Verification**
> “Validate every incompleteness and drift flag. Which are real? Which are scoping artifacts? List confirmed issues with evidence paths.”

**Prompt 3 – Cleanup Plan**
> “Produce an ordered checklist of exact deletions/migrations needed to reach zero legacy in the scoped area. Every item must cite a JSON evidence path.”

Output contract:
```ts
interface LlmAnalysis {
  markdown: string;
  blocks: { id: string; title: string; claims: { text: string; evidence: string[] }[]; actions: string[] }[];
}
```

### PHASE 4 – Refactor Cockpit Webview (5–7 days)

Replace markdown → **webview panel** (`src/webview/RefactorReportView.tsx`)

**Layout**

```
┌─────────────────┬────────────────────────────────────┬─────────────────┐
│ Left Sidebar    │             Main Panel             │ Right JSON      │
│ • Overview      │  LLM Analyst Report                │  Inspector      │
│ • Net Effect    │  • collapsible evidence blocks     │  (filtered)     │
│ • Incompleteness│  • "Open file" buttons             │                 │
│ • Drift         │  • Mermaid graphs                  │                 │
│ • Legacy/Dead   │                                    │                 │
│ • Timeline      │                                    │                 │
└─────────────────┴────────────────────────────────────┴─────────────────┘
```

**Commit Tracker Tree Upgrade**

When ≥2 commits selected:
```
Refactor Bundle (5 commits)
  ├─ Net vs Working
  ├─ Incompleteness (7 missing · 4 zombies)
  ├─ Pattern Drift (5 hotspots)
  ├─ Legacy / Dead / Replaced (13 items)
  └─ Timeline Rewind
       ├─ Working State
       ├─ abc123 → Add BuilderOrchestrator
       └─ ...
```

**Refactor Debt Meter** (status bar)
```
Refactor: 87% | 4 zombies | 5 drift | 9 dead
```

### PHASE 5 – Perfect Auto-Tracker (3 days)

Ship tiny CLI + git hooks:

```bash
# One-time install
node dist/cli.js install-hooks
# → writes .git/hooks/post-commit:
node /path/to/extension/dist/cli.js analyze-commit HEAD
```

Extension only watches DB file changes → auto-refresh UI.

### Final File Layout (after plan)

```
src/
  facts/              ← pure data pipeline
  analysis/           ← LLM analyst + prompts
  webview/            ← React/Vue webview cockpit
  cli/                ← analyze-commit, install-hooks
  ui/
    commitTrackerProvider.ts
    refactorDebtMeter.ts
  storage/
    database.ts
    schema.sql
  core/
    symbolExtractor.ts
    dependencyExtractor.ts
    difftastic.ts
    git.ts
```

### You Are Done When…

- [ ] Selecting 5 commits → bundle report shows <10 real incompleteness items  
- [ ] Zombies only appear for symbols explicitly removed  
- [ ] Renames are shown as continuity (no delete+add)  
- [ ] Dead/legacy audit finds real candidates with file links  
- [ ] LLM report cites JSON paths (`findings.legacyAudit.dead[2]`)  
- [ ] Clicking evidence opens file at correct line  
- [ ] Debt meter exists and hits 0 after cleanup  
- [ ] New commits auto-analyzed via git hook  
- [ ] Older commit selection correctly widens the refactor window

Start **Phase 0 tomorrow** – it unblocks everything else.  
I can now deliver the exact file-by-file patch list with code skeletons if you want.

This is the final, executable plan. Let’s ship the best refactor intelligence tool that has ever existed.


## SECTION: FULL UI OVERHAUL – Turn the current “barely usable” sidebar into a real Refactor Cockpit

Your current File Explorer integration (`src/ui/commitTrackerProvider.ts` + tree view) is the #1 UX pain point right now:

- Tiny icons, no hierarchy when multiple commits selected  
- Checkboxes disappear after report  
- No way to cancel a running analysis  
- No “Regenerate” button  
- No visual feedback during long runs  
- No bundle concept visible  
- Looks like a generic tree instead of a first-class tool

**Goal:** Make Commit Tracker feel like **Source Control + GitLens + Copilot Chat had a baby** — a full-featured, always-on sidebar panel that you live in during refactors.

### FINAL UI VISION (the sidebar you’ll actually use)

```
┌─────────────────────────────────────────────────────────────┐
│  Commit Tracker  (full sidebar tab)                     │
│  ───────────────────────────────────────────────────────────│
│  Search commits / symbols...                            │
│                                                             │
│  Refactor Bundle (5 commits)  [Regenerate] [Clear]     │
│   ├─ Net Effect vs Working Tree                         │
│   ├─ Incompleteness      7 missing · 4 zombies          │
│   ├─ Pattern Drift        5 hotspots                    │
│   ├─ Legacy / Dead         9 dead · 4 replaced           │
│   └─ Timeline Rewind                                    │
│        ├─ Working State                                 │
│        ├─ abc123 → Introduce BuilderOrchestrator       │
│        ├─ def456 → Migrate Controllers                  │
│        └─ ...                                           │
│                                                             │
│  Recent Commits                                             │
│   ○ abc123  Add new workflow shell (2m ago)             │
│   ○ def456  Migrate old Livewire calls (5m ago)         │
│   ○ ghi789  Remove legacy helpers (12m ago)             │
│   ○ jkl012  Fix BuilderOrchestrator edge case (1h ago)  │
│                                                             │
│  Refactor Debt Meter: 87% │ 4 zombies │ 5 drift │ 9 dead   │
└─────────────────────────────────────────────────────────────┘
```

### NEW SIDEBAR FEATURES (in order of priority)

| Feature | Why it matters | Implementation |
|-------|----------------|----------------|
| 1. Full dedicated sidebar tab (not just tree view) | Feels like a real tool, not a hidden view | Use `vscode.window.createTreeView` with `showCollapseAll: true` + custom view container |
| 2. Bundle node with actions | Instantly see you’re in “refactor mode” | Top-level node when ≥2 commits selected, with `[Regenerate]`, `[Clear]`, `[Export Context]` buttons |
| 3. Regenerate button | Critical for iterative cleanup | Calls same `generateRefactorBundleReport` with persisted SHAs |
| 4. Cancel running analysis | Currently you’re stuck for minutes | Use `vscode.Progress` with `CancellationToken` + abortable promises |
| 5. Progress + inline status | No more “ghost” operations | Show spinning icon + “Analyzing 42 files…” inside bundle node |
| 6. Persisted selection | Checkboxes disappearing is maddening | Store `selectedShas: string[]` on provider, restore on refresh |
| 7. Refactor Debt Meter in status bar | Instant feedback loop | `vscode.window.createStatusBarItem` updated after every bundle |
| 8. Right-click → “Add to Current Bundle” | Fast selection | Context menu on commit nodes |
| 9. Drag-select multiple commits | Feels natural | Enable multi-select in tree view |
| 10. “Analyze Last N Commits” quick action | One-click bootstrap | Button at top of view |

### IMPLEMENTATION PLAN – 4 days total

#### Day 1: Convert to Full Sidebar Tab + Bundle Node

1. Create new view container in `package.json`
```json
"viewsContainers": {
  "activitybar": [
    {
      "id": "commit-tracker",
      "title": "Commit Tracker",
      "icon": "resources/icons/git-commit.svg"
    }
  ]
},
"views": {
  "commit-tracker": [
    {
      "id": "commitTracker.explorer",
      "name": "Refactor Intelligence",
      "type": "tree"
    }
  ]
}
```

2. Replace current `CommitTrackerProvider` with new structure:
```ts
// Root nodes when bundle active
if (this.selectedShas.length >= 2) {
  return [{
    id: 'active-bundle',
    label: `Refactor Bundle (${this.selectedShas.length} commits)`,
    description: 'vs working tree',
    icon: 'package',
    collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
    contextValue: 'activeBundle',
    command: { command: 'commit-tracker.regenerateBundle', title: 'Regenerate' }
  },
  ...recentCommitsNode];
}
```

3. Add top-level actions via `contextValue` + `when` clauses in `package.json`

#### Day 2: Regenerate, Cancel, Progress, Persistence

```ts
// In provider
private runningTask?: { cancel: () => void };
private selectedShas: string[] = [];     // ← persisted
private lastBundleShas?: string[];       // ← fallback for export

// New commands
'commit-tracker.regenerateBundle': async () => {
  if (this.runningTask) {
    vscode.window.showWarningMessage('Analysis already running');
    return;
  }
  await this.runBundleAnalysis(this.selectedShas);
},

'commit-tracker.clearBundle': () => {
  this.selectedShas = [];
  this.lastBundleShas = undefined;
  this.refresh();
},

'commit-tracker.cancelAnalysis': () => {
  if (this.runningTask) {
    this.runningTask.cancel();
    this.runningTask = undefined;
    this.refresh();
  }
}
```

Use `withProgress` + `CancellationToken`:
```ts
await vscode.window.withProgress({
  location: { viewId: 'commitTracker.explorer' },
  title: 'Analyzing refactor bundle...',
  cancellable: true
}, async (progress, token) => {
  token.onCancellationRequested(() => cancel());
  // pass token down to facts engine
});
```

#### Day 3: Refactor Debt Meter + Status Bar

```ts
// src/ui/debtMeter.ts
export class RefactorDebtMeter {
  private statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left, 100
  );

  update(findings: FactsJson['findings']) {
    const { incompleteness, legacyAudit } = findings;
    const total = incompleteness.missing + incompleteness.zombies + 
                  legacyAudit.dead.length + legacyAudit.legacyUsed.length;
    const percent = total === 0 ? 100 : Math.round(100 - (total / 50) * 100);

    this.statusBar.text = `Refactor: ${percent}% | ${incompleteness.zombies} zombies | ${legacyAudit.dead.length} dead`;
    this.statusBar.tooltip = 'Click to open Refactor Bundle report';
    this.statusBar.command = 'commit-tracker.openLatestReport';
    this.statusBar.show();
  }
}
```

Call after every bundle generation.

#### Day 4: Polish & Context Menus

```json
// package.json menus
"menus": {
  "view/item/context": [
    {
      "command": "commit-tracker.addToBundle",
      "when": "view == commitTracker.explorer && viewItem == commit",
      "group": "inline"
    },
    {
      "command": "commit-tracker.removeFromBundle",
      "when": "view == commitTracker.explorer && viewItem == commit && inRefactorBundle"
    }
  ]
}
```

Add inline buttons on bundle node:
```ts
// In getTreeItem for bundle node
item.contextValue = 'activeBundle';
item.buttons = [
  { iconPath: new vscode.ThemeIcon('refresh'), tooltip: 'Regenerate', command: 'commit-tracker.regenerateBundle' },
  { iconPath: new vscode.ThemeIcon('clear-all'), tooltip: 'Clear Bundle', command: 'commit-tracker.clearBundle' }
];
```

### Final Result – User Experience

You now:
- Open VS Code → see **Commit Tracker** tab in activity bar
- Click recent commits → instantly build a bundle
- See **Regenerate** button → iterate 10× faster
- See **Debt Meter** go from 62% → 100% as you clean
- Never lose selection
- Cancel long runs
- Feel like you’re using a professional-grade tool

This UI upgrade is **80% of the perceived improvement** for zero new analysis logic.

**Do this after Phase 0 (bug fixes), before Phase 3 (LLM analyst)** — because once the facts are trustworthy, people will live in this panel.

Want me to generate the complete `package.json` contribution points + full `CommitTrackerProvider` rewrite with all buttons/status tomorrow? Just say the word.