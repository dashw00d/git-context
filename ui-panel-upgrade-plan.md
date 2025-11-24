Compiling the full plan with context. Reviewing the current plan and related files:


[4 tools called]


# Enhanced CommitTracker Sidebar — Full Implementation Plan

## Overview

Transform the CommitTracker sidebar into a granular, actionable dashboard with:
- Workspace state selector (Full/Staged/Unstaged) at the top
- Bundle pinned immediately after workspace nodes
- Deep drilldowns under bundle categories (symbols/files/diffs/stories/hotspots)
- Action buttons on all relevant nodes (copy/diff/LLM/MD scroll/open)
- Markdown navigation sync (tree → MD sections)
- Performance optimizations (lazy loading, caching)

## Current State Analysis

### What Works Today

**Existing Infrastructure:**
- Tree structure exists (`src/ui/commitTracker.ts` - `CommitTrackerProvider`)
- Bundle node appears at ≥2 selections (lines 503-522)
- Bundle expands to 5 categories: Net Effect, Incompleteness, Drift, Legacy, Timeline (lines 39-138)
- Commits expand to files/symbols (lines 635-827)
- Basic bundle buttons (refresh/clear) exist (lines 414-419)
- Database integration with SQLite (`src/storage/database.ts`)
- Git operations wrapper (`src/analysis/git.ts`)
- Facts engine exists (`src/facts/` directory)
- Report generation pipeline (`src/ui/report.ts`)

**Current Tree Structure:**
```
Root
├── Refactor Bundle (N commits) [if ≥2 selected]
│   ├── Net Effect vs Working Tree
│   ├── Incompleteness
│   ├── Pattern Drift
│   ├── Legacy / Dead
│   └── Timeline Rewind
└── Recent Commits (20 most recent)
    └── commit nodes (expandable)
```

### What's Missing

**Layout & Organization:**
- No workspace state selector
- Bundle not pinned at top (appears mixed with commits)
- No commit grouping (selected vs unselected)
- No HEAD as selectable commit

**Functionality:**
- No workspace scoping (staged/unstaged filtering)
- Limited drilldowns under bundle categories (only top-level categories)
- Missing action buttons on commits/files/symbols
- No MD sync (can't jump from tree to markdown sections)
- No grouping options when HEAD + commit selected

**Performance:**
- No lazy loading (all children computed upfront)
- No caching of expensive operations
- No "Load more..." for long lists

## Implementation Phases

---

## Phase 1: Root Layout + Workspace State Selector

**Goal:** Add workspace scoping UI at the top and reorganize tree layout

### Files to Modify

1. `src/ui/commitTracker.ts` - Main tree provider
2. `src/ui/commands.ts` - Command handlers
3. `src/facts/scope.ts` - Scope computation
4. `src/ui/report.ts` - Report generation

### Detailed Changes

#### 1.1 Add Workspace State Property

**File:** `src/ui/commitTracker.ts`

**Location:** After line 21 (after `private isInitialized: boolean = false;`)

**Add:**
```typescript
// Workspace scoping state
public workspaceParts: Set<'staged' | 'unstaged'> = new Set(['staged', 'unstaged']); // default full
```

**Context:** This tracks which parts of the workspace to include in analysis. Default is both staged and unstaged (full workspace).

#### 1.2 Add Workspace State Nodes Method

**File:** `src/ui/commitTracker.ts`

**Location:** Add new private method after `clearSelection()` (around line 37)

**Add:**
```typescript
private getWorkspaceStateNodes(): TreeNode[] {
  const { GitOperations } = require('../analysis/git');
  const git = new GitOperations();
  
  const staged = git.getWorkingDirectoryChanges().filter(f => {
    // Parse git status to determine if staged
    // git status --porcelain shows staged files with status in first column
    const status = git.execGit(['status', '--porcelain', f.path]);
    return status.charAt(0) !== ' ' && status.charAt(0) !== '?';
  });
  
  const unstaged = git.getWorkingDirectoryChanges().filter(f => {
    const status = git.execGit(['status', '--porcelain', f.path]);
    return status.charAt(1) !== ' ' && status.charAt(1) !== '?';
  });
  
  const includeStaged = this.workspaceParts.has('staged');
  const includeUnstaged = this.workspaceParts.has('unstaged');
  const isFull = includeStaged && includeUnstaged;
  
  const nodes: TreeNode[] = [
    {
      id: 'workspace-group',
      type: 'category' as const,
      categoryType: 'added' as const,
      parentId: 'root',
      count: 1,
      label: '🔄 Workspace State',
      description: 'Scope control for analysis',
      tooltip: 'Control which parts of workspace to include in bundle analysis',
      contextValue: 'workspace-group',
      collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
    },
    {
      id: 'workspace-full',
      type: 'category' as const,
      categoryType: 'added' as const,
      parentId: 'workspace-group',
      count: 1,
      label: `☑ Full Workspace ${isFull ? '(active)' : ''}`,
      description: `${staged.length + unstaged.length} files`,
      tooltip: 'Include staged + unstaged (default)',
      contextValue: 'workspace-full',
      command: {
        command: 'git-context.toggleWorkspaceFull',
        title: 'Toggle Full Workspace'
      }
    }
  ];
  
  // Add staged/unstaged sub-nodes
  if (staged.length > 0) {
    nodes.push({
      id: 'workspace-staged',
      type: 'category' as const,
      categoryType: 'added' as const,
      parentId: 'workspace-group',
      count: staged.length,
      label: `Staged Changes (${staged.length}) ${includeStaged ? '☑' : '☐'}`,
      description: staged.slice(0, 3).map(f => f.path.split('/').pop()).join(', '),
      contextValue: 'workspace-staged',
      command: {
        command: 'git-context.toggleWorkspacePart',
        title: 'Toggle Staged',
        arguments: ['staged']
      },
      collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
    });
  }
  
  if (unstaged.length > 0) {
    nodes.push({
      id: 'workspace-unstaged',
      type: 'category' as const,
      categoryType: 'added' as const,
      parentId: 'workspace-group',
      count: unstaged.length,
      label: `Unstaged Changes (${unstaged.length}) ${includeUnstaged ? '☑' : '☐'}`,
      description: unstaged.slice(0, 3).map(f => f.path.split('/').pop()).join(', '),
      contextValue: 'workspace-unstaged',
      command: {
        command: 'git-context.toggleWorkspacePart',
        title: 'Toggle Unstaged',
        arguments: ['unstaged']
      },
      collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
    });
  }
  
  return nodes;
}
```

**Note:** You'll need to add a helper method to `GitOperations` to get staged/unstaged files separately. Current `getWorkingDirectoryChanges()` returns all changes.

#### 1.3 Update getRecentCommits() to Include Workspace Nodes

**File:** `src/ui/commitTracker.ts`

**Location:** Modify `getRecentCommits()` method (starts at line 444)

**Change:** Insert workspace nodes at the beginning:

```typescript
private async getRecentCommits(): Promise<TreeNode[]> {
  const startTime = Date.now();
  console.log('[COMMIT-TRACKER] getRecentCommits() called');

  // If database is not initialized, show placeholder
  if (!this.isInitialized) {
    // ... existing placeholder code ...
  }

  try {
    // 0. Workspace scope always first
    const result: TreeNode[] = [];
    result.push(...this.getWorkspaceStateNodes());

    // 1. Bundle pinned if >=2 selected (immediately after workspace)
    if (this.selectedCommits.size >= 2) {
      const selectedCount = this.selectedCommits.size;
      result.push({
        id: 'refactor-bundle',
        type: 'category' as const,
        categoryType: 'added' as const,
        parentId: 'root',
        count: selectedCount,
        label: `🔥 Refactor Bundle (${selectedCount})`,
        description: 'vs working tree',
        tooltip: `Generate comprehensive refactor analysis for ${selectedCount} selected commits`,
        contextValue: 'activeBundle',
        command: {
          command: 'git-context.generateReport',
          title: 'Generate Refactor Bundle Report'
        }
      });
    }

    // 2. Selected commits group
    if (this.selectedCommits.size > 0) {
      result.push({
        id: 'selected-commits-group',
        type: 'category' as const,
        categoryType: 'added' as const,
        parentId: 'root',
        count: this.selectedCommits.size,
        label: '✅ Selected for Bundle',
        description: `${this.selectedCommits.size} commits selected`,
        tooltip: 'Commits currently selected for bundle analysis',
        contextValue: 'selected-commits-group',
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
      });
    }

    // 3. Recent commits group
    result.push({
      id: 'recent-commits-group',
      type: 'category' as const,
      categoryType: 'added' as const,
      parentId: 'root',
      count: 0,
      label: '📜 Recent Commits',
      description: 'Recent commit history',
      tooltip: 'Browse recent commits',
      contextValue: 'recent-commits-group',
      collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
    });

    // ... rest of existing commit loading code ...
    // Modify commit nodes to be children of groups
  }
}
```

#### 1.4 Add HEAD as Selectable Commit

**File:** `src/ui/commitTracker.ts`

**Location:** In `getRecentCommits()`, before loading database commits

**Add:**
```typescript
// Add HEAD as first selectable commit
const { GitOperations } = await import('../analysis/git');
const git = new GitOperations();
const headSha = git.getHeadSha();
const isHeadSelected = this.selectedCommits.has(headSha);

// Get HEAD commit info
const headCommit = git.getCommitInfo(headSha);

const headNode: TreeNode = {
  id: headSha,
  type: 'commit' as const,
  sha: headSha,
  message: headCommit.message,
  author: headCommit.author,
  date: headCommit.date,
  isSelected: isHeadSelected,
  label: `${isHeadSelected ? '☑ ' : '☐ '}HEAD - ${headCommit.message.split('\n')[0]}`,
  description: `${headCommit.author} · ${new Date(headCommit.date).toLocaleDateString()}`,
  tooltip: `HEAD (${headSha.substring(0, 8)})\n\n${headCommit.message}\n\nClick to expand\nRight-click to toggle selection`,
  contextValue: isHeadSelected ? 'commit inRefactorBundle head' : 'commit head'
};

// Add HEAD to appropriate group
if (isHeadSelected && this.selectedCommits.size > 0) {
  // Will be added as child of selected-commits-group
} else {
  // Add to recent commits
}
```

#### 1.5 Handle Workspace File Children

**File:** `src/ui/commitTracker.ts`

**Location:** Modify `getChildren()` method (starts at line 424)

**Add handling for workspace nodes:**
```typescript
async getChildren(element?: TreeNode): Promise<TreeNode[]> {
  if (!element) {
    return this.getRecentCommits();
  }

  // Handle workspace staged/unstaged file children
  if (element.id === 'workspace-staged') {
    const { GitOperations } = await import('../analysis/git');
    const git = new GitOperations();
    const staged = git.getStagedFiles(); // Need to add this method
    return staged.map(f => ({
      id: `workspace-staged-${f}`,
      type: 'file' as const,
      path: f,
      label: f.split('/').pop() || f,
      description: f,
      tooltip: `Staged file: ${f}`,
      contextValue: 'workspace-file',
      command: {
        command: 'vscode.open',
        title: 'Open File',
        arguments: [vscode.Uri.file(path.join(workspaceRoot, f))]
      }
    }));
  }

  if (element.id === 'workspace-unstaged') {
    // Similar to staged
  }

  // Handle selected-commits-group children
  if (element.id === 'selected-commits-group') {
    const selectedShas = Array.from(this.selectedCommits);
    // Load commit nodes for selected commits
    // ... (similar to existing commit loading)
  }

  // Handle recent-commits-group children
  if (element.id === 'recent-commits-group') {
    // Load unselected commits
    // ... (existing commit loading logic)
  }

  // ... rest of existing getChildren logic
}
```

#### 1.6 Add Workspace Toggle Commands

**File:** `src/ui/commands.ts`

**Location:** In `registerCommands()` function, add after existing commands

**Add:**
```typescript
// Toggle workspace full
const toggleWorkspaceFullCmd = vscode.commands.registerCommand(
  'git-context.toggleWorkspaceFull',
  () => {
    const full = commitTracker.workspaceParts.size === 2;
    commitTracker.workspaceParts.clear();
    if (!full) {
      commitTracker.workspaceParts.add('staged');
      commitTracker.workspaceParts.add('unstaged');
    }
    commitTracker.persistState();
    commitTracker.refresh();
  }
);

// Toggle workspace part
const toggleWorkspacePartCmd = vscode.commands.registerCommand(
  'git-context.toggleWorkspacePart',
  (part: 'staged' | 'unstaged') => {
    if (commitTracker.workspaceParts.has(part)) {
      commitTracker.workspaceParts.delete(part);
    } else {
      commitTracker.workspaceParts.add(part);
    }
    commitTracker.persistState();
    commitTracker.refresh();
  }
);

// Add to context.subscriptions.push() at end
```

#### 1.7 Thread Workspace Parts into Scope

**File:** `src/facts/scope.ts`

**Location:** Modify `computeScope()` function signature and implementation (starts at line 85)

**Change:**
```typescript
export async function computeScope(
  commitShas: string[],
  workspaceParts?: Set<'staged' | 'unstaged'>
): Promise<ScopeSet> {
  // ... existing initialization ...

  // 2. Files changed in working tree (filtered by workspaceParts)
  const workingChanges = git.getWorkingDirectoryChanges();
  
  if (workspaceParts) {
    const includeStaged = workspaceParts.has('staged');
    const includeUnstaged = workspaceParts.has('unstaged');
    
    workingChanges.forEach(f => {
      // Determine if file is staged or unstaged
      const status = git.execGit(['status', '--porcelain', f.path]);
      const isStaged = status.charAt(0) !== ' ' && status.charAt(0) !== '?';
      const isUnstaged = status.charAt(1) !== ' ' && status.charAt(1) !== '?';
      
      if ((includeStaged && isStaged) || (includeUnstaged && isUnstaged)) {
        scope.workingChanged.add(f.path);
      }
    });
  } else {
    // Default: include all working changes
    workingChanges.forEach(f => scope.workingChanged.add(f.path));
  }

  // ... rest of existing logic ...
}
```

#### 1.8 Update Report Generation to Pass Workspace Parts

**File:** `src/ui/report.ts`

**Location:** In `generateRefactorBundleReport()` function (around line 99)

**Change:**
```typescript
const scope = await computeScope(commitShas, commitTracker?.workspaceParts);
```

#### 1.9 Persist Workspace Parts

**File:** `src/ui/commitTracker.ts`

**Location:** Modify `persistState()` method (starts at line 363)

**Add:**
```typescript
public persistState(): void {
  const selectedShas = Array.from(this.selectedCommits);
  this.context.workspaceState.update('commit-tracker.selectedShas', selectedShas);
  this.context.workspaceState.update('commit-tracker.workspaceParts', Array.from(this.workspaceParts));

  if (selectedShas.length >= 2) {
    this.context.workspaceState.update('commit-tracker.lastBundleShas', selectedShas);
  }
}
```

**Location:** Modify `restoreState()` method (starts at line 376)

**Add:**
```typescript
private restoreState(): void {
  const selectedShas = this.context.workspaceState.get<string[]>('commit-tracker.selectedShas', []);
  this.selectedCommits = new Set(selectedShas);
  
  const workspaceParts = this.context.workspaceState.get<string[]>('commit-tracker.workspaceParts', ['staged', 'unstaged']);
  this.workspaceParts = new Set(workspaceParts as ('staged' | 'unstaged')[]);
}
```

### Acceptance Criteria

- Workspace selector always visible at top of tree
- Default is Full (both staged and unstaged checked)
- Toggling staged/unstaged affects bundle scope
- Bundle pinned immediately after workspace nodes
- Selected and unselected commits grouped separately
- HEAD appears as first selectable commit
- Workspace state persists across sessions

---

## Phase 2: Deep Drilldowns Under Bundle Categories

**Goal:** Expand bundle categories to show real, actionable data (symbols, files, diffs)

### Files to Modify

1. `src/ui/commitTracker.ts` - Enhance `getBundleChildDetails()` method

### Detailed Changes

#### 2.1 Expand Incompleteness → Missing Symbols

**File:** `src/ui/commitTracker.ts`

**Location:** In `getBundleChildDetails()` method, `case 'incompleteness-missing':` (around line 218)

**Current:** Only shows count
**Change to:**
```typescript
case 'incompleteness-missing': {
  const missing = this.lastBundleFacts?.evidence?.['findings.incompleteness.missing'] || [];
  const top = missing.slice(0, 10); // Limit to top 10
  
  // Group by file path
  const byFile = new Map<string, typeof top>();
  for (const item of top) {
    // Extract file path from symbol_id (format: "path/to/file.ts:SymbolName")
    const filePath = item.symbol_id.split(':')[0];
    if (!byFile.has(filePath)) {
      byFile.set(filePath, []);
    }
    byFile.get(filePath)!.push(item);
  }
  
  const children: TreeNode[] = [];
  for (const [filePath, items] of byFile) {
    const fileName = path.basename(filePath);
    children.push({
      id: `missing-file-${filePath}`,
      type: 'file' as const,
      path: filePath,
      label: `${fileName} (${items.length})`,
      description: filePath,
      tooltip: `${items.length} missing symbols in ${filePath}`,
      contextValue: 'bundle-file',
      collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
      // Children will be resolved in getChildren()
    });
  }
  
  return children;
}
```

**Then add in `getChildren()`:**
```typescript
if (element.id?.startsWith('missing-file-')) {
  const filePath = element.id.replace('missing-file-', '');
  const missing = this.lastBundleFacts?.evidence?.['findings.incompleteness.missing'] || [];
  const fileItems = missing.filter(m => m.symbol_id.startsWith(filePath + ':'));
  
  return fileItems.map(item => {
    const symbolName = item.symbol_id.split(':')[1];
    return {
      id: `missing-${item.symbol_id}`,
      type: 'symbol' as const,
      symbolId: item.symbol_id,
      name: symbolName,
      path: filePath,
      label: symbolName,
      description: `Expected: ${item.expected.expect}`,
      tooltip: `Missing symbol: ${symbolName}\nExpected: ${item.expected.expect}\nLast seen in: ${item.expected.lastSha}`,
      contextValue: 'bundle-symbol',
      command: {
        command: 'git-context.openSymbol',
        title: 'Open Symbol',
        arguments: [item.expected.lastSha, filePath, undefined]
      }
    };
  });
}
```

#### 2.2 Expand Incompleteness → Zombies

**File:** `src/ui/commitTracker.ts`

**Location:** Similar pattern for `case 'incompleteness-zombies':`

**Add:**
```typescript
case 'incompleteness-zombies': {
  const zombies = this.lastBundleFacts?.evidence?.['findings.incompleteness.zombies'] || [];
  const top = zombies.slice(0, 10);
  
  // Group by file (extract from found.path or symbol_id)
  const byFile = new Map<string, typeof top>();
  for (const item of top) {
    const filePath = item.found?.path || item.symbol_id.split(':')[0];
    if (!byFile.has(filePath)) {
      byFile.set(filePath, []);
    }
    byFile.get(filePath)!.push(item);
  }
  
  return Array.from(byFile.entries()).map(([filePath, items]) => ({
    id: `zombie-file-${filePath}`,
    type: 'file' as const,
    path: filePath,
    label: `${path.basename(filePath)} (${items.length} zombies)`,
    description: filePath,
    tooltip: `${items.length} zombie symbols in ${filePath}`,
    contextValue: 'bundle-file',
    collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
  }));
}
```

#### 2.3 Expand Drift → Hotspots

**File:** `src/ui/commitTracker.ts`

**Location:** `case 'drift-hotspots':` or add new case for `'drift-hotspots'`

**Add:**
```typescript
case 'drift-hotspots': {
  const hotspots = this.lastBundleFacts?.evidence?.['findings.drift.hotspots'] || [];
  const top = hotspots.slice(0, 10);
  
  return top.map(h => ({
    id: `hotspot-${h.path}`,
    type: 'file' as const,
    path: h.path,
    label: `${path.basename(h.path)} (${h.drift_count} drift issues)`,
    description: `${h.drift_count} drift issues`,
    tooltip: `Drift hotspot: ${h.path}\n${h.drift_count} drift issues detected`,
    contextValue: 'bundle-hotspot-file',
    collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
  }));
}
```

**Then in `getChildren()` for hotspot files:**
```typescript
if (element.id?.startsWith('hotspot-')) {
  const filePath = element.id.replace('hotspot-', '');
  // Load drift symbols for this file
  // Could query evidence or compute from drift findings
  // Return symbol nodes with diff hunks as children
}
```

#### 2.4 Expand Legacy → Dead Code

**File:** `src/ui/commitTracker.ts`

**Location:** `case 'legacy-dead':`

**Add:**
```typescript
case 'legacy-dead': {
  const dead = this.lastBundleFacts?.evidence?.['findings.legacyAudit.dead'] || [];
  const top = dead.slice(0, 20);
  
  // Group by file
  const byFile = new Map<string, typeof top>();
  for (const item of top) {
    const filePath = item.path || item.symbol_id.split(':')[0];
    if (!byFile.has(filePath)) {
      byFile.set(filePath, []);
    }
    byFile.get(filePath)!.push(item);
  }
  
  return Array.from(byFile.entries()).map(([filePath, items]) => ({
    id: `dead-file-${filePath}`,
    type: 'file' as const,
    path: filePath,
    label: `${path.basename(filePath)} (${items.length} dead)`,
    description: filePath,
    tooltip: `${items.length} dead symbols in ${filePath}`,
    contextValue: 'bundle-file',
    collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
  }));
}
```

#### 2.5 Expand Timeline → Stories

**File:** `src/ui/commitTracker.ts`

**Location:** `case 'refactor-bundle-timeline':` (already exists, enhance it)

**Current:** Shows commits in timeline
**Enhance:** Add story nodes that expand to show commit diffs and detailed changes

**Note:** Timeline structure already exists (lines 159-216), but you may want to add story grouping if `facts.timeline.stories` exists in evidence.

### Acceptance Criteria

- All bundle categories expand into real data (not just counts)
- Symbols/files are clickable to open editor
- Lazy loading with caps (top 10-20 items per category)
- File grouping makes navigation easier
- No noticeable lag on expand

---

## Phase 3: Action Buttons Everywhere

**Goal:** Add actionable buttons to all relevant nodes

### Files to Modify

1. `src/ui/commitTracker.ts` - Enhance `getTreeItem()` method
2. `src/ui/commands.ts` - Add new commands

### Detailed Changes

#### 3.1 Add HEAD as Selectable Commit (if not done in Phase 1)

See Phase 1.4 above.

#### 3.2 Add Commit Node Buttons

**File:** `src/ui/commitTracker.ts`

**Location:** `getTreeItem()` method (starts at line 381)

**Modify commit nodes:**
```typescript
if (element.contextValue === 'commit' || element.contextValue?.includes('commit')) {
  const treeItem = toVSCodeTreeItem(element, collapsibleState);
  
  // Add buttons for commits
  (treeItem as any).buttons = [
    {
      iconPath: new vscode.ThemeIcon(element.isSelected ? 'check' : 'circle-outline'),
      tooltip: element.isSelected ? 'Remove from bundle' : 'Add to bundle',
      command: 'git-context.toggleCommitSelection',
      arguments: [element.id]
    },
    {
      iconPath: new vscode.ThemeIcon('copy'),
      tooltip: 'Copy SHA',
      command: 'git-context.copySha',
      arguments: [element.sha]
    },
    {
      iconPath: new vscode.ThemeIcon('diff'),
      tooltip: 'View diff vs active workspace',
      command: 'git-context.viewDiffVsWorkspace',
      arguments: [element.sha]
    }
  ];
  
  return treeItem;
}
```

#### 3.3 Detect HEAD + Commit Selection for Grouping

**File:** `src/ui/commitTracker.ts`

**Location:** In `getTreeItem()` or add helper method

**Add:**
```typescript
private hasHeadAndCommitSelected(): boolean {
  const { GitOperations } = require('../analysis/git');
  const git = new GitOperations();
  const headSha = git.getHeadSha();
  
  const hasHead = this.selectedCommits.has(headSha);
  const hasOther = this.selectedCommits.size > (hasHead ? 1 : 0);
  
  return hasHead && hasOther;
}
```

**Then in commit node buttons, add grouping options:**
```typescript
if (this.hasHeadAndCommitSelected() && element.sha !== git.getHeadSha()) {
  // Add grouping option buttons
  (treeItem as any).buttons.push({
    iconPath: new vscode.ThemeIcon('compare-changes'),
    tooltip: 'Compare HEAD vs this commit',
    command: 'git-context.compareHeadVsCommit',
    arguments: [element.sha]
  });
}
```

#### 3.4 Add Bundle Category Buttons

**File:** `src/ui/commitTracker.ts`

**Location:** `getTreeItem()` for bundle category nodes

**Add:**
```typescript
if (element.contextValue === 'refactor-bundle-item' || element.contextValue === 'refactor-finding') {
  const treeItem = toVSCodeTreeItem(element, collapsibleState);
  
  (treeItem as any).buttons = [
    {
      iconPath: new vscode.ThemeIcon('go-to-file'),
      tooltip: 'Scroll to MD section',
      command: 'git-context.scrollToMDSection',
      arguments: [this.getMDSectionId(element.id)]
    },
    {
      iconPath: new vscode.ThemeIcon('copy'),
      tooltip: 'Copy section JSON',
      command: 'git-context.copySectionJson',
      arguments: [element.id]
    },
    {
      iconPath: new vscode.ThemeIcon('sparkle'),
      tooltip: 'Generate LLM context',
      command: 'git-context.generateLlmContext',
      arguments: [element.id]
    }
  ];
  
  return treeItem;
}
```

#### 3.5 Add File/Symbol Node Buttons

**File:** `src/ui/commitTracker.ts`

**Location:** `getTreeItem()` for file/symbol nodes

**Add:**
```typescript
if (element.type === 'file' || element.type === 'symbol') {
  const treeItem = toVSCodeTreeItem(element, collapsibleState);
  
  (treeItem as any).buttons = [
    {
      iconPath: new vscode.ThemeIcon('go-to-file'),
      tooltip: 'Open in editor',
      command: element.type === 'file' ? 'vscode.open' : 'git-context.openSymbol',
      arguments: element.type === 'file' 
        ? [vscode.Uri.file(path.join(workspaceRoot, element.path))]
        : [element.sha, element.path, element.loc]
    },
    {
      iconPath: new vscode.ThemeIcon('sparkle'),
      tooltip: 'Copy LLM context',
      command: 'git-context.copyLlmContext',
      arguments: [element]
    },
    {
      iconPath: new vscode.ThemeIcon('diff'),
      tooltip: 'View diff',
      command: 'git-context.viewDiff',
      arguments: [element.sha, element.path]
    }
  ];
  
  return treeItem;
}
```

#### 3.6 Add Commands for New Actions

**File:** `src/ui/commands.ts`

**Add new command handlers:**
```typescript
// Copy SHA
const copyShaCmd = vscode.commands.registerCommand(
  'git-context.copySha',
  async (sha: string) => {
    await vscode.env.clipboard.writeText(sha);
    vscode.window.showInformationMessage(`Copied SHA: ${sha.substring(0, 8)}`);
  }
);

// View diff vs workspace
const viewDiffVsWorkspaceCmd = vscode.commands.registerCommand(
  'git-context.viewDiffVsWorkspace',
  async (sha: string) => {
    const { GitOperations } = await import('../analysis/git');
    const git = new GitOperations();
    const diff = git.execGit(['diff', sha, '--']);
    
    const doc = await vscode.workspace.openTextDocument({
      content: diff,
      language: 'diff'
    });
    await vscode.window.showTextDocument(doc);
  }
);

// Compare HEAD vs commit
const compareHeadVsCommitCmd = vscode.commands.registerCommand(
  'git-context.compareHeadVsCommit',
  async (commitSha: string) => {
    const { GitOperations } = await import('../analysis/git');
    const git = new GitOperations();
    const headSha = git.getHeadSha();
    const diff = git.execGit(['diff', `${headSha}..${commitSha}`, '--']);
    
    const doc = await vscode.workspace.openTextDocument({
      content: diff,
      language: 'diff'
    });
    await vscode.window.showTextDocument(doc);
  }
);

// Scroll to MD section (see Phase 4)
const scrollToMDSectionCmd = vscode.commands.registerCommand(
  'git-context.scrollToMDSection',
  async (sectionId: string) => {
    // Implementation in Phase 4
  }
);

// Copy section JSON
const copySectionJsonCmd = vscode.commands.registerCommand(
  'git-context.copySectionJson',
  async (sectionId: string) => {
    if (!commitTracker.lastBundleFacts) {
      vscode.window.showWarningMessage('No bundle facts available');
      return;
    }
    
    // Extract relevant section from facts
    const sectionData = extractSectionFromFacts(commitTracker.lastBundleFacts, sectionId);
    await vscode.env.clipboard.writeText(JSON.stringify(sectionData, null, 2));
    vscode.window.showInformationMessage('Copied section JSON');
  }
);

// Generate LLM context
const generateLlmContextCmd = vscode.commands.registerCommand(
  'git-context.generateLlmContext',
  async (elementId: string) => {
    // Generate focused LLM context for this element
    // Could use ContextExporter or similar
  }
);
```

### Acceptance Criteria

- Buttons appear on all relevant nodes (commits, bundle categories, files, symbols)
- "View diff vs active workspace" compares to working directory (not HEAD)
- HEAD appears as first selectable commit
- Grouping options appear when HEAD + another commit are selected
- All commands execute correctly
- UI remains responsive

---

## Phase 4: MD Sync & Navigation

**Goal:** Enable navigation from tree to markdown report sections

### Files to Modify

1. `src/ui/report.ts` - Add stable anchors to markdown
2. `src/ui/commands.ts` - Add `scrollToMDSection()` command

### Detailed Changes

#### 4.1 Add Stable Anchors to Markdown

**File:** `src/ui/report.ts`

**Location:** In `AnalysisRenderer.renderAnalysis()` or wherever markdown is generated

**Add anchors:**
```typescript
// In markdown generation
markdown += `## Incompleteness {#incompleteness}\n\n`;
markdown += `### Missing Additions {#incompleteness-missing}\n\n`;
markdown += `### Zombie Removals {#incompleteness-zombies}\n\n`;

markdown += `## Pattern Drift {#drift}\n\n`;
markdown += `### Hotspots {#drift-hotspots}\n\n`;

markdown += `## Legacy Audit {#legacy}\n\n`;
markdown += `### Dead Code {#legacy-dead}\n\n`;

markdown += `## Timeline {#timeline}\n\n`;
```

**Important:** Markdown links need to be decoded - they are currently coming out encoded in the markdown plan. Use proper markdown anchor syntax: `{#anchor-id}` or `## Heading {#anchor-id}`.

#### 4.2 Implement scrollToMDSection()

**File:** `src/ui/commands.ts`

**Location:** Complete the `scrollToMDSection` command handler

**Implementation:**
```typescript
const scrollToMDSectionCmd = vscode.commands.registerCommand(
  'git-context.scrollToMDSection',
  async (sectionId: string) => {
    // Find open markdown document (could be the report)
    const openDocs = vscode.workspace.textDocuments.filter(doc => 
      doc.languageId === 'markdown' && 
      doc.fileName.includes('refactor') || doc.fileName.includes('bundle')
    );
    
    if (openDocs.length === 0) {
      // Try to open the last report
      const { getGitRoot } = await import('../utils/config');
      const gitRoot = getGitRoot();
      if (gitRoot) {
        const reportPath = path.join(gitRoot, '.git', 'commit-tracker', 'last-bundle-analysis.md');
        if (fs.existsSync(reportPath)) {
          const doc = await vscode.workspace.openTextDocument(reportPath);
          await vscode.window.showTextDocument(doc);
          openDocs.push(doc);
        }
      }
    }
    
    if (openDocs.length === 0) {
      vscode.window.showWarningMessage('No markdown report found. Generate a report first.');
      return;
    }
    
    const doc = openDocs[0];
    const editor = await vscode.window.showTextDocument(doc);
    
    // Find anchor in document
    const anchorPattern = new RegExp(`{#${sectionId}}|##+.*${sectionId}`, 'i');
    const text = doc.getText();
    let lineNumber = 0;
    
    for (let i = 0; i < doc.lineCount; i++) {
      const line = doc.lineAt(i);
      if (anchorPattern.test(line.text)) {
        lineNumber = i;
        break;
      }
    }
    
    if (lineNumber > 0) {
      const range = new vscode.Range(lineNumber, 0, lineNumber, 0);
      editor.selection = new vscode.Selection(range.start, range.end);
      editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    } else {
      vscode.window.showWarningMessage(`Section ${sectionId} not found in report`);
    }
  }
);
```

#### 4.3 Map Tree IDs to MD Section IDs

**File:** `src/ui/commitTracker.ts`

**Location:** Add helper method

**Add:**
```typescript
private getMDSectionId(treeId: string): string {
  const mapping: Record<string, string> = {
    'refactor-bundle-incompleteness': 'incompleteness',
    'incompleteness-missing': 'incompleteness-missing',
    'incompleteness-zombies': 'incompleteness-zombies',
    'refactor-bundle-drift': 'drift',
    'drift-hotspots': 'drift-hotspots',
    'refactor-bundle-legacy': 'legacy',
    'legacy-dead': 'legacy-dead',
    'refactor-bundle-timeline': 'timeline',
  };
  
  return mapping[treeId] || treeId;
}
```

### Acceptance Criteria

- Clicking bundle categories jumps to correct MD section
- Anchors stable across report regenerations
- Links properly decoded when navigating (not encoded)
- Works even if report is in different editor tab

---

## Phase 5: Debt Meter Integration

**Goal:** Integrate debt meter with sidebar refresh

### Files to Modify

1. `src/ui/refactorDebtMeter.ts` - Add refresh/reveal behavior
2. `src/ui/commitTracker.ts` - Auto-refresh on facts update

### Detailed Changes

#### 5.1 Add Refresh/Reveal on Debt Meter Click

**File:** `src/ui/refactorDebtMeter.ts`

**Location:** Modify `update()` method or add click handler

**Current:** Status bar item has command `'git-context.showRefactorReport'`
**Enhance:** Also refresh tree and reveal bundle

**In `commands.ts`, modify `showRefactorReportCmd`:**
```typescript
const showRefactorReportCmd = vscode.commands.registerCommand(
  'git-context.showRefactorReport',
  async () => {
    // Refresh tree
    commitTracker.refresh();
    
    // Reveal/expand bundle if exists
    if (commitTracker.selectedCommits.size >= 2) {
      // Could use tree view reveal API if available
      vscode.commands.executeCommand('commitTracker.focus');
    }
    
    // Show report (existing logic)
    // ... existing code ...
    
    vscode.window.showInformationMessage('Sidebar updated');
  }
);
```

#### 5.2 Auto-Refresh Tree on Facts Update

**File:** `src/ui/commitTracker.ts`

**Location:** In `generateRefactorBundleReport()` callback or wherever facts are stored

**Already exists:** Line 210-212 shows facts are stored and refresh is called
**Verify:** Ensure `commitTracker.refresh()` is called after facts update

### Acceptance Criteria

- Debt meter click refreshes tree and reveals bundle
- Tree stays in sync with facts
- Info toast shows "Sidebar updated"

---

## Phase 6: Performance & Polish

**Goal:** Optimize performance and polish UI

### Files to Modify

1. `src/ui/commitTracker.ts` - Add lazy loading and caching

### Detailed Changes

#### 6.1 Implement Lazy Loading

**File:** `src/ui/commitTracker.ts`

**Location:** `getChildren()` method - only compute children when expanded

**Current:** Some children are pre-computed
**Change:** Always compute lazily, add "Load more..." nodes for long lists

**Example:**
```typescript
if (element.id === 'recent-commits-group') {
  // Only load first 10 commits, add "Load more..." if more exist
  const limit = 10;
  const commits = await this.loadCommitsFromDB(limit);
  
  const children: TreeNode[] = commits.map(/* ... */);
  
  // Check if more exist
  const totalCount = await this.getTotalCommitCount();
  if (totalCount > limit) {
    children.push({
      id: 'load-more-commits',
      label: `Load more... (${totalCount - limit} remaining)`,
      contextValue: 'load-more',
      command: {
        command: 'git-context.loadMoreCommits',
        title: 'Load More'
      }
    });
  }
  
  return children;
}
```

#### 6.2 Add Caching

**File:** `src/ui/commitTracker.ts`

**Location:** Add cache properties to class

**Add:**
```typescript
private commitSummaryCache = new Map<string, string>();
private driftLookupCache = new Map<string, any>();
```

**Use in methods:**
```typescript
private async getCommitSummary(sha: string): Promise<string> {
  if (this.commitSummaryCache.has(sha)) {
    return this.commitSummaryCache.get(sha)!;
  }
  
  // ... existing logic ...
  const summary = /* ... */;
  this.commitSummaryCache.set(sha, summary);
  return summary;
}
```

#### 6.3 UI Polish

**File:** `src/ui/commitTracker.ts`

**Location:** `getTreeItem()` method

**Add:**
```typescript
// Bold selected commits
if (element.isSelected) {
  treeItem.label = `$(check) **${element.label}**`; // Markdown bold
  // Or use resource state for visual emphasis
}

// Better icons
if (element.type === 'commit') {
  treeItem.iconPath = new vscode.ThemeIcon('git-commit');
} else if (element.type === 'file') {
  treeItem.iconPath = vscode.ThemeIcon.File;
}

// Better tooltips with more context
treeItem.tooltip = new vscode.MarkdownString(`
  **${element.label}**
  
  ${element.description}
  
  ${element.tooltip || ''}
`);
```

**Sticky expand state:**
```typescript
// Persist expand state
private expandedNodes = new Set<string>();

// In getTreeItem, check persisted state
if (this.expandedNodes.has(element.id)) {
  collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
}

// Track expand/collapse events (if VS Code API supports)
```

### Acceptance Criteria

- Root render < 500ms
- Expands feel instant for normal sizes (< 100 items)
- Large repos degrade gracefully (pagination, "Load more...")
- Selected commits visually distinct
- Icons and tooltips improve clarity
- Expand state persists where possible

---

## Testing Strategy

### Unit Tests

1. Workspace selector default state
2. Workspace toggle commands
3. Scope filtering logic
4. HEAD detection and selection
5. Grouping detection (HEAD + commit)

### Integration Tests

1. Bundle pinned after workspace nodes
2. Commit grouping (selected vs unselected)
3. All bundle dropdowns expand correctly
4. Button commands execute
5. MD sync and stable anchors
6. Scope correctness (staged only, unstaged only, full default)

### Performance Tests

1. Root render time with 100+ commits
2. Expand time for large symbol lists
3. Memory usage with caching
4. Large repo handling (1000+ files)

### User Acceptance Tests

1. Select commits → bundle appears → generate report
2. Toggle workspace parts → regenerate → scope changes
3. Click bundle category → MD scrolls to section
4. Click commit button → diff opens
5. Select HEAD + commit → grouping options appear
6. Debt meter click → sidebar updates

---

## File Change Summary

### Primary Files

**`src/ui/commitTracker.ts`**
- Add `workspaceParts` state
- Add `getWorkspaceStateNodes()` method
- Modify `getRecentCommits()` for new layout
- Enhance `getBundleChildDetails()` for drilldowns
- Enhance `getTreeItem()` for buttons
- Add `getMDSectionId()` helper
- Add caching properties
- Modify `persistState()` and `restoreState()`

**`src/ui/commands.ts`**
- Add `toggleWorkspaceFull` command
- Add `toggleWorkspacePart` command
- Add `copySha` command
- Add `viewDiffVsWorkspace` command
- Add `compareHeadVsCommit` command
- Add `scrollToMDSection` command
- Add `copySectionJson` command
- Add `generateLlmContext` command
- Modify `showRefactorReportCmd` for refresh/reveal

**`src/facts/scope.ts`**
- Modify `computeScope()` to accept `workspaceParts`
- Filter `workingChanged` by workspace parts

**`src/ui/report.ts`**
- Pass `workspaceParts` to `computeScope()`
- Add stable anchors to markdown

### Supporting Files

**`src/analysis/git.ts`**
- May need `getStagedFiles()` method
- May need `getUnstagedFiles()` method
- `getDiffVsWorkspace()` method (or use existing `diff` command)

**`src/ui/refactorDebtMeter.ts`**
- Verify refresh behavior (may already be correct)

---

## Implementation Order

1. Phase 1 (Workspace State) - Foundation for everything else
2. Phase 2 (Drilldowns) - Makes bundle useful
3. Phase 3 (Buttons) - Makes it actionable
4. Phase 4 (MD Sync) - Connects tree to report
5. Phase 5 (Debt Meter) - Quick integration
6. Phase 6 (Performance) - Optimize as needed

---

## Notes

- Markdown links must be decoded - they are currently coming out encoded. Use proper markdown anchor syntax.
- HEAD should be selectable like any other commit, appearing first in the list.
- "View diff vs HEAD" should be changed to "View diff vs active workspace" - compare to working directory.
- When HEAD + another commit are selected, show grouping options (compare HEAD vs commit, etc.).
- Workspace state affects bundle scope - ensure `computeScope()` respects `workspaceParts`.
- All buttons should have clear tooltips and execute quickly.
- Performance is critical - lazy load everything possible, cache expensive operations.

This plan transforms the CommitTracker sidebar into a granular, actionable dashboard that integrates with the refactor analysis workflow.