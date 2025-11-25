## 🎛️ **Header Section**

The header contains the main controls and status information:

### **Title & Status**
- **Repo/Branch Info**: Shows current repository name and branch from git
- **Error Display**: Shows error messages with a "Dismiss" button that clears errors
- **Status Pill**: Shows either:
  - "Analyzing — [Step] ([Progress]%))" when `isAnalyzing: true`
  - Bundle summary text when idle (e.g., "3 commits, 15 files, 42 symbols")

### **Action Buttons** (Right side)
1. **"Analyze"** - `generateReport(mode: 'selection')` - Analyzes currently selected commits/files
2. **"Analyze staged"** - `generateReport(mode: 'staged')` - Analyzes all staged files 
3. **"Analyze unstaged"** - `generateReport(mode: 'unstaged')` - Analyzes all unstaged files
4. **"Analyze last N"** - `generateReport(mode: 'lastN')` - Prompts for commit count, analyzes recent commits
5. **"Export bundle"** - `bundleExport` - Exports current bundle facts to JSON
6. **"Reset all"** - `resetAll` - Clears all selections, bundles, and cached data
7. **"Cancel"** (conditional) - `cancelAnalysis` - Appears only when `isAnalyzing: true`

## 📊 **Status Cards Section**

Four small cards showing overview stats:

1. **Selection Card**: 
   - Shows `selectedCommitShas.length` commits
   - Shows `selectedStagedPaths.length + selectedUnstagedPaths.length` files  
   - Shows `workspaceScope` ("workspace"/"staged"/"unstaged")

2. **Bundle Card**:
   - Shows bundle summary text (commit/file/symbol counts)
   - Shows latest commit SHA (first 8 chars)

3. **Symbols Card**: Shows `symbols.length` rows

4. **Reports Card**: Shows `reports.length` saved

## 📂 **Accordion Sections**

### **1. Commits & Selection Section**

**Controls:**
- **"Select all staged"** - `selectAllStaged` - Bulk select all staged files
- **"Select all unstaged"** - `selectAllUnstaged` - Bulk select all unstaged files  
- **"Clear selection"** - `clearSelection` - Deselect all commits and files
- **"Add commit by SHA"** - `addCommitBySha` - Prompt for SHA/ref, add to selection
- **Filter Input** - `setCommitsFilterText` (debounced) - Text search in commit messages/SHAs
- **Scope Toggles** - `setCommitsFilterScopes` - Show/hide staged/unstaged/history commits
- **"Load more"** (conditional) - `loadMoreCommits` - Fetch next page of commits

**Display:**
- Shows selected commits (SHAs listed)
- Shows selected staged files (paths listed) 
- Shows selected unstaged files (paths listed)
- **Commit List**: Clickable commit rows showing:
  - Short SHA, author, date, commit message
  - "In bundle" badge if commit is in active bundle
  - File change count
  - Highlighted if selected (`selectedCommitShas.includes(sha)`)

### **2. Active Bundle Section**

**Controls:**
- **"Regenerate"** - `bundleRegenerate` - Re-run analysis on same commit set
- **"Export JSON"** - `bundleExport` - Export bundle facts to JSON file
- **"Open full report"** - `openActiveReport` - Open detailed report webview
- **"Clear bundle"** - `bundleClear` - Remove active bundle
- **"Cancel analysis"** (conditional) - `cancelAnalysis` - Stop running analysis

**Quick Links** (only when bundle exists):
- **"Overview"**, **"Incompleteness"**, **"Drift"**, **"Legacy"**, **"Timeline"** - `scrollReportToSection(sectionId)` - Jump to sections in full report

**Display:**
- Shows bundle details: commit count, file count, symbol count, creation date
- Or "No active bundle yet" message

### **3. Symbols Section**

**Filters:**
- **Search Input** - `setSymbolFilterText` (debounced) - Filter by symbol name/path
- **Kind Dropdown** - `setSymbolKindFilter` - Filter by type (function/class/method/component/all)
- **Change Dropdown** - `setSymbolChangeFilter` - Filter by change type (added/modified/removed/all)

**Display:**
- **Symbol List**: Shows symbol rows with:
  - Icon for symbol kind (function/class/method etc.)
  - Symbol name and change badge (➕/✏️/➖)
  - Symbol kind and last changed date
  - File path
  - **"Open history"** - `openSymbolHistory(symbolId)` - Show symbol change timeline
  - **"Open latest"** - `openSymbolInEditor(symbolId)` - Jump to current definition

### **4. Reports Section**

**Filters:**
- **Search Input** - `setReportsFilterText` (debounced) - Filter by title/summary
- **Branch Dropdown** - `setReportsBranchFilter` - Filter by branch or show all
- **"Pinned only" Checkbox** - `setReportsShowPinnedOnly` - Show only pinned reports

**Display:**
- **Report List**: Clickable report rows showing:
  - Title and branch badge (🌿)
  - Creation date and pin status (📌)
  - **Click** - `openReport(reportId)` - Open full report webview
  - **"Regenerate"** - `regenerateReport(reportId)` - Re-analyze same bundle
  - **"Pin/Unpin"** - `togglePinReport(reportId)` - Toggle favorite status  
  - **"Delete"** - `deleteReport(reportId)` - Remove report (with confirmation)

---

## 🔄 **Exact Flow Architecture**

### **Initialization Flow**
1. **Extension loads** → `CockpitProvider` created with empty state
2. **Webview opens** → React app mounts and sends `{'ready'}`
3. **Provider receives ready** → Calls `sendState()` with initial empty state
4. **State sync triggered** → `syncCockpitState()` fetches data from providers
5. **State sent to React** → `{type: 'updateState', payload: fullState}`

### **Analysis Flow**
1. **User clicks analyze button** → `generateReport(mode)` message sent
2. **Provider receives message** → Calls `vscode.commands.executeCommand('git-context.analyze')`
3. **Command execution** → `generateRefactorBundleReport()` with selected commits/files
4. **Analysis starts** → `updateAnalysisProgress(isAnalyzing: true)` sent to React
5. **Progress updates** → `analysisProgress` messages stream step/progress
6. **Analysis completes** → `syncCockpitState()` called, new bundle data sent
7. **UI updates** → Status pill changes, bundle section shows results

### **Selection Flow**
1. **User clicks commit** → `toggleCommit(sha)` message sent
2. **Provider receives** → `commitsProvider.toggleCommitSelection(sha)`
3. **Selection updated** → `syncCockpitState()` called to refresh state
4. **UI updates** → Commit highlighting changes, selection counts update

### **Filtering Flow**
1. **User types in filter** → `setCommitsFilterText(text)` sent (debounced)
2. **Provider updates state** → `cockpitProvider.updateState({commitsFilterText: text})`
3. **State sync triggered** → `syncCockpitState()` called
4. **React filters locally** → `renderCommits()` filters `state.commits` array by text/scopes
5. **UI updates** → Filtered commit list shown

### **State Synchronization**
- **Triggers**: Provider changes (bundle updates, commits loaded, etc.)
- **Process**: `syncCockpitState()` → Gather data from all providers → Build `CockpitState` → `sendState()`
- **React receives** → `setState({...prev, ...payload})` → Re-renders with merged state
- **Preserves UI state**: Filters, active sections, local selections maintained

This architecture ensures the cockpit is always synchronized with the underlying data while preserving user interface state and providing real-time feedback during operations.