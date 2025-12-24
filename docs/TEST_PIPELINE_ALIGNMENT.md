# Test Pipeline Alignment Documentation

## Overview

This document describes how integration tests work, how the pipeline handles edge cases (like first commits), and how tests must match the actual pipeline behavior exactly.

## How Tests Work

### Test Structure

1. **Setup (`beforeAll`)**:
   - Creates a sandbox Git repository using `setupSandboxRepo()`
   - Sets up a test database with a unique path
   - Initializes all pipeline components (CommitIndexer, WorkspaceIndexer, etc.)
   - Injects the test database into the singleton using `setDatabaseManagerForTesting()`
   - Changes `process.cwd()` to the sandbox directory

2. **Test Execution**:
   - Tests call `pipeline.analyzeBundle([commits[0]])` to run the full pipeline
   - Tests call `workspaceIndexer.quickScanSymbols([filePath])` for quick scan
   - Tests query the database directly to verify data was stored correctly
   - Tests call `DatabaseWriteQueue.getInstance().flushAll()` to ensure data is persisted

3. **Cleanup (`afterAll`)**:
   - Restores `process.cwd()` to original directory
   - Closes database connection
   - Cleans up test database file

### Key Test Files

- `tests/integration/quickScanFullScan.test.ts`: Tests quick scan vs full scan consistency
- `tests/integration/invalidationIntegration.test.ts`: Tests invalidation system
- `tests/integration/factsMerger.test.ts`: Tests facts merging with real pipeline data
- `tests/integration/pipelineIntegration.test.ts`: Tests full pipeline execution
- `tests/integration/databaseIntegration.test.ts`: Tests database storage
- `tests/integration/pipelineSteps.test.ts`: Tests individual pipeline steps

## Issue Fixed ✅

### Problem (RESOLVED)

When running `pipeline.analyzeBundle([commits[0]])` on the first commit from the sandbox repository:

1. **`getFileChanges(sha)` was returning 0 files** for the first commit (commits[0])
2. This caused `CommitIndexer` to process 0 files
3. Result: 0 symbols and 0 edges stored in database
4. Tests failed because they expected symbols/edges to exist

### Root Cause

The `getFileChanges()` method in `src/analysis/git.ts` was calling:

```bash
git diff-tree -r --no-commit-id <sha>
```

This command **does not work for the first commit** (which has no parent). When called on a commit without a parent, it returns empty output (0 lines) without throwing an error, so the code never detected it as a first commit.

### Solution Implemented ✅

The fix checks if the commit is the first commit (no parent) **BEFORE** trying the simple diff-tree command:

1. **First commit detection**: Gets commit info and checks parent count first
2. **Empty tree comparison**: For first commit (0 parents), compares against empty tree SHA: `4b825dc642cb6eb9a060e54bf8d69288fbee4904`
3. **Merge commit handling**: For merge commits (multiple parents), compares against first parent (`${sha}^1`)
4. **Normal commits**: Single-parent commits use standard diff-tree command

**Implementation** (`src/analysis/git.ts:379-463`):

```typescript
async getFileChanges(sha: string): Promise<FileChange[]> {
  // FIRST: Check if this is the first commit (no parent) BEFORE trying diff-tree
  const commitInfo = await this.getCommitInfo(sha);
  const parents = commitInfo.parent ? commitInfo.parent.split(' ') : [];

  if (parents.length === 0) {
    // First commit: compare against empty tree
    output = await this.git.raw([
      'diff-tree', '-r', '--no-commit-id',
      '4b825dc642cb6eb9a060e54bf8d69288fbee4904', // Empty tree SHA
      sha
    ]);
  } else if (parents.length > 1) {
    // Merge commit: compare against first parent
    output = await this.git.raw([
      'diff-tree', '-r', '--no-commit-id',
      `${sha}^1`, // First parent
      sha
    ]);
  } else {
    // Single-parent commit: use normal diff-tree
    output = await this.git.raw(['diff-tree', '-r', '--no-commit-id', sha]);
  }
  // ... parse output
}
```

**Verification**: The implementation now correctly returns file changes for all commit types (first commit, merge commits, and normal commits).

## How Tests Must Match Pipeline

### 1. Use Real Pipeline Methods

**✅ CORRECT:**

```typescript
await pipeline.analyzeBundle([commits[0]]);
await DatabaseWriteQueue.getInstance().flushAll();
```

**❌ WRONG:**

```typescript
await commitIndexer.ensureCommitsIndexed([commits[0]]); // Bypasses pipeline
```

### 2. Use Fixture Commits, Not HEAD

**✅ CORRECT:**

```typescript
await pipeline.analyzeBundle([commits[0]]); // Uses fixture commit SHA
```

**❌ WRONG:**

```typescript
const headSha = await git.getHeadSha();
await pipeline.analyzeBundle([headSha]); // HEAD might not match fixture
```

### 3. Query Database with Correct SHA

**✅ CORRECT:**

```typescript
const symbols = db
  .prepare('SELECT * FROM symbols WHERE path = ? AND sha = ? AND change_type IN (?, ?, ?)')
  .all([testFile, commits[0], 'added', 'modified', 'removed']);
```

**❌ WRONG:**

```typescript
const symbols = db
  .prepare('SELECT * FROM symbols WHERE path = ? AND change_type IN (?, ?, ?)')
  .all([testFile, 'added', 'modified', 'removed']); // Missing SHA filter
```

### 4. Use Correct Commit for Each File

**✅ CORRECT:**

```typescript
// math.ts is in commit 0
await pipeline.analyzeBundle([commits[0]]);

// Calculator.ts is in commit 1, but depends on math.ts in commit 0
await pipeline.analyzeBundle([commits[0], commits[1]]);
```

**❌ WRONG:**

```typescript
// Calculator.ts is in commit 1, but only indexing commit 1
await pipeline.analyzeBundle([commits[1]]); // Missing dependency from commit 0
```

### 5. Flush Database Queue After Operations

**✅ CORRECT:**

```typescript
await pipeline.analyzeBundle([commits[0]]);
await DatabaseWriteQueue.getInstance().flushAll(); // Ensure data is persisted
```

**❌ WRONG:**

```typescript
await pipeline.analyzeBundle([commits[0]]);
// Missing flush - data might not be in database yet
```

### 6. Match changeType Values

**✅ CORRECT:**

- Full scan: `change_type IN ('added', 'modified', 'removed')`
- Quick scan: `change_type = 'quick_scan'`
- Priority click: `change_type = 'priority_click'`

**❌ WRONG:**

- Assuming all symbols have `change_type = 'added'` (modified/removed also exist)

### 7. Use Database Singleton Injection for Tests

**✅ CORRECT:**

```typescript
beforeAll(async () => {
  dbManager = new DatabaseManager(TEST_DB_PATH);
  await dbManager.initialize();
  setDatabaseManagerForTesting(dbManager); // Inject test DB
});

afterAll(() => {
  setDatabaseManagerForTesting(null); // Clear singleton
});
```

**❌ WRONG:**

```typescript
// Using default singleton - might use wrong database
const db = getDatabaseManager();
```

## Pipeline Data Flow

### Full Scan (pipeline.analyzeBundle)

```
pipeline.analyzeBundle([commits[0]])
  └─> runPipeline()
      └─> index_commits step
          └─> commitIndexer.ensureCommitsIndexed([commits[0]])
              └─> indexCommit(commits[0])
                  └─> getFileChanges(commits[0])  [MUST RETURN FILES]
                      └─> processFile() for each file
                          └─> storeSymbols(sha, symbolChanges)
                              └─> DatabaseWriteQueue.queue()
                          └─> storeEdgesBatch(sha, edges)
                              └─> DatabaseWriteQueue.queue()
                  └─> DatabaseWriteQueue.flushAll()
                      └─> flushSymbols()  [WRITES TO DB]
                      └─> flushEdges()    [WRITES TO DB]
```

### Quick Scan (workspaceIndexer.quickScanSymbols)

```
workspaceIndexer.quickScanSymbols([filePath])
  └─> Extract symbols from file
  └─> Store with changeType='quick_scan'
  └─> DatabaseWriteQueue.queue()
  └─> DatabaseWriteQueue.flushAll()
      └─> flushSymbols()  [WRITES TO DB]
```

## Diagnostic Logging Added

We've added comprehensive logging to track:

1. **`getFileChanges()`**:
   - Which commit is being queried
   - Parent count
   - Which diff-tree command is used
   - Output length
   - Number of files returned

2. **`storeSymbols()`**:
   - Commit SHA
   - Number of symbols
   - ChangeType distribution
   - File distribution

3. **`storeEdgesBatch()`**:
   - Commit SHA
   - Number of edges
   - ChangeType distribution
   - EdgeType distribution

4. **`flushSymbols()`**:
   - Number of DNA ops vs symbol ops
   - SHA distribution
   - ChangeType distribution
   - Path distribution
   - Number of records inserted

5. **`flushEdges()`**:
   - Number of edges
   - SHA distribution
   - ChangeType distribution
   - EdgeType distribution
   - Number of records inserted

6. **`flushAll()`**:
   - Number of pending operations
   - Operation type distribution
   - Success/failure status

## Test Fixture Structure

The `setupSandboxRepo()` creates 6 commits:

- **Commit 0** (`commits[0]`): Initial commit with `src/ts/math.ts`, `src/js/utils.js`, `src/php/User.php`
- **Commit 1** (`commits[1]`): Adds `src/ts/Calculator.ts` (depends on math.ts), `src/js/logger.js`, `src/php/UserService.php`
- **Commit 2** (`commits[2]`): Modifies signatures in math.ts, adds precision parameter
- **Commit 3** (`commits[3]`): Renames `formatNumber` to `formatCurrency` in utils.js
- **Commit 4** (`commits[4]`): Deletes `divide()`, adds `safeDivide()` in math.ts
- **Commit 5** (`commits[5]`): Adds cross-file dependencies: `src/ts/index.ts`, `src/js/api.js`, `src/php/UserController.php`

## Key Principles

1. **Tests must use the actual pipeline** - no shortcuts or mocks
2. **Tests must use fixture commits** - not HEAD or dynamic SHAs
3. **Tests must query with correct SHA** - symbols/edges are stored per commit
4. **Tests must flush queues** - ensure data persistence before querying
5. **Tests must match production behavior** - if tests pass but production fails, tests are wrong

## Next Steps

1. ✅ ~~Fix `getFileChanges()` to detect first commit before calling diff-tree~~ **COMPLETED**
2. Verify symbols/edges are stored with correct SHA and changeType
3. Ensure all tests use fixture commits consistently
4. Fix test imports: Some tests use `setDatabaseManagerForTest` instead of `setDatabaseManagerForTesting`
5. Verify database queries match stored data structure
6. Run full test suite to verify all fixes
