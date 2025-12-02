# Providers Module (`providers/`)

## Purpose

The `providers/` module implements VS Code tree view providers that display Git Context data in the VS Code sidebar. These providers bridge the gap between the extension's internal data models and VS Code's tree view API, following strict invariants for tree item identity and structure.

## Key Components

### Commits Provider (`commitsProvider.ts`)

Manages the commit history tree view, displaying analyzed commits with their metadata.

```typescript
export class CommitsProvider {
  public workspaceScope: 'workspace' | 'staged' | 'unstaged' = 'workspace';
  public loadMoreOffset = 0;
  public manualCommits: Set<string>;
  public PAGE_SIZE = 50;

  constructor(
    private context: vscode.ExtensionContext,
    private activeBundleProvider: ActiveBundleProvider
  ) {
    this.branchManager = new BranchManager();
    this.manualCommits = new Set(
      context.workspaceState.get<string[]>('commit-tracker.manualCommits', [])
    );
  }

  async refresh(): Promise<void> {
    await this.updateBranchCursor();
  }

  async getChildren(element?: CommitTreeItem): Promise<CommitTreeItem[]> {
    if (!element) {
      // Root level - return workspace items and commits
      return [...this.getWorkspaceItems(), ...(await this.getRecentCommits())];
    }

    // Child items based on parent type
    switch (element.type) {
      case 'workspace':
        return this.getWorkspaceChildren(element);
      case 'commit':
        return this.getCommitChildren(element);
      default:
        return [];
    }
  }
}
```

**Key Features:**

- **Workspace Integration**: Shows staged/unstaged workspace changes alongside commits
- **Pagination**: Loads commits in pages for performance
- **Branch Awareness**: Tracks current branch and commit relationships
- **Manual Commit Tracking**: Allows users to mark specific commits for analysis

### Active Bundle Provider (`activeBundleProvider.ts`)

Displays the currently active analysis bundle with summary information.

```typescript
export class ActiveBundleProvider {
  public lastBundleFacts: RefactorBundleFacts | null = null;
  private bundleExpandedState = vscode.TreeItemCollapsibleState.Expanded;

  constructor(private context: vscode.ExtensionContext) {
    this.loadBundleFacts();
  }

  private async loadBundleFacts() {
    try {
      const gitRoot = getGitRoot();
      if (!gitRoot) return;

      const factsPath = path.join(gitRoot, '.git/commit-tracker/last-bundle-facts.json');
      if (fs.existsSync(factsPath)) {
        const factsContent = fs.readFileSync(factsPath, 'utf8');
        this.lastBundleFacts = JSON.parse(factsContent);
      }
    } catch (error) {
      logDebug(`Failed to load bundle facts: ${error}`);
    }
  }

  refresh(): void {
    this.loadBundleFacts();
  }

  exportBundleFacts(): RefactorBundleFacts | null {
    return this.lastBundleFacts;
  }
}
```

**Key Features:**

- **Persistent State**: Loads last analysis results from disk
- **Bundle Summary**: Shows key metrics and findings
- **Auto-refresh**: Updates when new analysis completes

### Symbol History Provider (`symbolHistoryProvider.ts`)

Provides searchable symbol history and evolution tracking.

```typescript
export class SymbolHistoryProvider {
  private searchQuery: string = '';

  constructor(private context: vscode.ExtensionContext) {}

  refresh(): void {
    // TreeView removed - data access methods remain
  }

  async exportRecentSymbols(
    limit = 20,
    filterText?: string,
    filterKind?: string | 'all',
    filterChange?: 'all' | 'added' | 'modified' | 'removed'
  ): Promise<SymbolHistoryItem[]> {
    try {
      await ensureDatabaseInitialized();

      let query = `
        SELECT s.path, s.name, s.kind, s.change_type, c.date, s.sha
        FROM symbols s
        JOIN commits_metadata c ON s.sha = c.sha
      `;

      const conditions: string[] = [];
      const params: any[] = [];

      // Apply filters
      if (filterText?.trim()) {
        conditions.push(`(s.name LIKE ? OR s.path LIKE ?)`);
        const searchTerm = `%${filterText.trim()}%`;
        params.push(searchTerm, searchTerm);
      }

      if (filterKind && filterKind !== 'all') {
        conditions.push('s.kind = ?');
        params.push(filterKind);
      }

      if (filterChange && filterChange !== 'all') {
        conditions.push('s.change_type = ?');
        params.push(filterChange);
      }

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      query += ' ORDER BY c.date DESC LIMIT ?';
      params.push(limit);

      const stmt = prepare(query);
      return stmt.all(...params) as SymbolHistoryItem[];
    } catch (error) {
      logError('Failed to export recent symbols', error);
      return [];
    }
  }
}
```

**Key Features:**

- **Advanced Filtering**: Filter by text, symbol kind, and change type
- **Historical Tracking**: Shows symbol evolution across commits
- **Export Functionality**: Provides data for external consumption

## Architecture

### Tree View Invariants

The providers follow strict architectural invariants to ensure stability:

#### 1. Unique Tree Item IDs

**Every tree item ID must be globally unique** and stable across refreshes.

- **Rule**: IDs must be derived from primary keys or deterministic hashes, never display names.
- **Example**: Use `commit:${sha}` instead of commit message

#### 2. Tree Children Structure

**Tree children are either pre-populated OR dynamic; never both.**

- **Rule**: If `children` is defined, `getChildren()` must not re-fetch for that node type.
- **Implementation**: Use `getTreeItem()` for static children, `getChildren()` for dynamic loading

#### 3. Node Type Discrimination

**Node types use discriminated unions, not regex patterns.**

- **Rule**: `node.type` determines collapsibility, not ID patterns.
- **Example**: Use `type: 'workspace' | 'commit' | 'symbol'` instead of parsing IDs

### Provider Lifecycle

```
VS Code Registration → Provider Creation → Tree Data Provision → User Interaction
                           ↓
                    State Updates → Refresh Calls
```

### Data Flow

```
Database/Service Layer → Provider Methods → Tree Items → VS Code UI
                              ↑
                       User Actions/Refreshes
```

## Key Concepts

### Tree Item Creation

Providers create tree items with consistent structure:

```typescript
private createCommitItem(commit: CommitMetadata): CommitTreeItem {
  const item = new vscode.TreeItem(
    `${commit.sha.substring(0, 8)} - ${commit.message.split('\n')[0]}`,
    vscode.TreeItemCollapsibleState.Collapsed
  );

  item.id = `commit:${commit.sha}`; // Unique, stable ID
  item.tooltip = `${commit.author} - ${new Date(commit.date).toLocaleString()}`;
  item.contextValue = 'commit';
  item.command = {
    command: 'git-context.selectCommit',
    arguments: [commit.sha],
    title: 'Select Commit'
  };

  return item;
}
```

### Lazy Loading

Large datasets are loaded incrementally:

```typescript
async getChildren(element?: TreeItem): Promise<TreeItem[]> {
  if (!element) {
    // Root level - load first page only
    return this.loadInitialItems();
  }

  if (element.type === 'loadMore') {
    // Load next page
    return this.loadMoreItems();
  }

  // Load children for specific item
  return this.loadItemChildren(element);
}
```

### State Persistence

Provider state is persisted in VS Code workspace storage:

```typescript
// Save state
this.context.workspaceState.update('workspaceScope', this.workspaceScope);
this.context.workspaceState.update('loadMoreOffset', this.loadMoreOffset);

// Load state
this.workspaceScope = context.workspaceState.get('workspaceScope', 'workspace');
this.loadMoreOffset = context.workspaceState.get('loadMoreOffset', 0);
```

### Error Handling

Providers handle errors gracefully without crashing:

```typescript
async getChildren(element?: TreeItem): Promise<TreeItem[]> {
  try {
    return await this.loadChildren(element);
  } catch (error) {
    logError('Failed to load tree children', error);

    // Return error item
    const errorItem = new vscode.TreeItem('Error loading data');
    errorItem.tooltip = String(error);
    return [errorItem];
  }
}
```

## Dependencies

- **storage/** - Database access for historical data
- **services/** - Business logic services
- **state/** - State management integration
- **utils/** - Configuration and helper functions

## Usage Examples

### Basic Provider Registration

```typescript
import { CommitsProvider } from './providers/commitsProvider';
import { ActiveBundleProvider } from './providers/activeBundleProvider';

export function activate(context: vscode.ExtensionContext) {
  const commitsProvider = new CommitsProvider(context, activeBundleProvider);
  const bundleProvider = new ActiveBundleProvider(context);

  // Register with VS Code
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('gitContextCommits', commitsProvider),
    vscode.window.registerTreeDataProvider('gitContextBundle', bundleProvider)
  );
}
```

### Implementing a Custom Provider

```typescript
export class CustomProvider {
  getTreeItem(element: TreeItem): vscode.TreeItem {
    // Return VS Code tree item for display
    return new vscode.TreeItem(element.label, element.collapsibleState);
  }

  getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (!element) {
      // Return root items
      return this.getRootItems();
    }

    // Return children based on parent
    return this.getChildItems(element);
  }

  private async getRootItems(): Promise<TreeItem[]> {
    // Load data from services
    const data = await someService.getData();

    return data.map(item => ({
      id: `item:${item.id}`, // Unique ID
      label: item.name,
      type: 'item',
      collapsibleState: vscode.TreeItemCollapsibleState.None,
    }));
  }
}
```

### Handling User Interactions

```typescript
// Register command for tree item clicks
context.subscriptions.push(
  vscode.commands.registerCommand('gitContext.selectCommit', async (sha: string) => {
    // Handle commit selection
    await commitsProvider.selectCommit(sha);

    // Update state
    store.dispatch({
      type: 'SELECTION_SET',
      payload: { shas: [sha] },
    });

    // Trigger analysis
    await runAnalysis([sha]);
  })
);
```

## Performance Characteristics

- **Lazy Loading**: Only load visible tree items
- **Pagination**: Large datasets loaded in chunks
- **Caching**: Database query results cached where appropriate
- **Incremental Updates**: Refresh only affected portions of tree

## Error Handling

- **Graceful Degradation**: Show error items instead of crashing
- **Logging**: Comprehensive error logging for debugging
- **Recovery**: Automatic retry for transient failures
- **User Feedback**: Clear error messages in tree view

## Invariant Compliance

### ID Stability

```typescript
// ✅ Good: Stable, unique IDs
item.id = `commit:${commit.sha}`;

// ❌ Bad: Unstable display names
item.id = commit.message;
```

### Type Discrimination

```typescript
// ✅ Good: Discriminated union
type TreeItemType = 'workspace' | 'commit' | 'symbol';

// ❌ Bad: String parsing
if (item.id.startsWith('commit:')) {
  /* ... */
}
```

### Children Consistency

```typescript
// ✅ Good: Either pre-populated OR dynamic
class StaticItem {
  children?: TreeItem[]; // Pre-populated
  // No getChildren implementation
}

class DynamicItem {
  // No children property
  // Implements getChildren()
}
```

## Related Documentation

- [Extension Module](extension.md) - Provider registration
- [State Module](state.md) - State integration
- [Services Module](services.md) - Data access layer
- [Storage Module](storage.md) - Database persistence
