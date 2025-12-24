# Quick Scan / Full Scan Architecture Documentation

## Overview

This document describes the unified architecture for three analysis modes:
1. **Quick Scan Init** - Initial sidebar population with shallow data
2. **Full Scan** - Complete pipeline analysis with all facts
3. **Quick Scan Click** - Priority single-file analysis triggered by user clicks

All three modes share the same persistence layer, ID structure, and pipeline infrastructure, ensuring consistency and preventing data duplication.

## Architecture Principles

### 1. Unified Persistence Layer
- All scans write to the same database tables via `DatabaseWriteQueue`
- Same ID structure (`path:sha:symbol_id`) across all modes
- Database uses `INSERT OR REPLACE` to handle overwrites correctly

### 2. Path+SHA ID Structure
- **Purpose**: Represents a "place in time" - a symbol at a specific path in a specific commit
- **Format**: `${filePath}:${sha}:${dnaId}`
- **Benefits**:
  - Centralizes path resolution at origin
  - Prevents path normalization issues
  - Represents temporal state (path+sha = point in time)

### 3. Completeness Markers
- **Quick Scan**: `complete: false` - Shallow, incomplete data
- **Full Scan**: `complete: true` - Complete analysis
- **Click Scan**: `complete: true` - Complete single-file analysis
- **Purpose**: Allows UI to distinguish incomplete placeholder data from complete analysis

### 4. Priority Worker Allocation
- **Reserved Workers**: 2 workers reserved for on-demand (click) requests
- **Background Workers**: Remaining workers (CPU count - 1 - 2) for background processing
- **Quick Scan Init**: Uses background workers (`priority: false`)
- **Full Scan**: Uses background workers (`priority: false`)
- **Click Scan**: Uses reserved workers (`priority: true`)

## Database Schema

### Symbols Table
```sql
CREATE TABLE symbols (
  sha TEXT NOT NULL,
  path TEXT NOT NULL,
  symbol_id TEXT NOT NULL,
  dna_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  signature TEXT,
  change_type TEXT NOT NULL,  -- 'quick_scan', 'added', 'modified', 'priority_click', etc.
  diff_snippet_pre TEXT,
  diff_snippet_post TEXT,
  confidence REAL,
  PRIMARY KEY (sha, path, symbol_id)
);
```

**Key Points**:
- Primary key: `(sha, path, symbol_id)` ensures one symbol per commit+path+id
- `change_type` indicates source: `'quick_scan'`, `'priority_click'`, `'added'`, `'modified'`, etc.
- `INSERT OR REPLACE` ensures full scan overwrites quick scan data

### Symbol DNA Table
```sql
CREATE TABLE symbol_dna (
  dna_id TEXT PRIMARY KEY,
  first_seen_sha TEXT NOT NULL,
  first_seen_path TEXT NOT NULL
);
```

**Purpose**: Tracks stable DNA identifiers across renames/moves

## Three Scan Modes

### 1. Quick Scan Init

**Trigger**: Initial sidebar population when Cockpit opens

**Flow**:
```
User Opens Cockpit
  ↓
AnalysisController.resolveSkeleton()
  ↓
AnalysisController.generatePartialFacts()
  ↓
workspaceIndexer.quickScanSymbols(files, { persist: true, priority: false })
  ↓
For each file:
  - Read file content
  - Parse with tree-sitter (background workers)
  - Extract symbols (shallow - no edges, no full analysis)
  - Compute DNA IDs
  - Queue DB writes (changeType: 'quick_scan')
  ↓
DatabaseWriteQueue.flushAll()
  ↓
Return symbols to UI with complete: false
```

**Code Location**: `src/analysis/workspaceIndexer.ts:816`

**Key Characteristics**:
- **Concurrency**: 50 files in parallel (`pLimit(50)`)
- **Workers**: Background workers (`priority: false`)
- **Persistence**: `changeType: 'quick_scan'`
- **Completeness**: `complete: false`
- **Data**: Symbols only (no edges, no drift analysis)
- **Purpose**: Fast sidebar population (2-3 seconds for large repos)

**Symbol Object Structure**:
```typescript
{
  id: string,           // DNA hash
  name: string,
  kind: string,
  signature: string,
  location: Location,
  filePath: string,
  sha: string,          // HEAD SHA
  complete: false      // Marked incomplete
}
```

### 2. Full Scan

**Trigger**: Background analysis after quick scan completes

**Flow**:
```
Quick Scan Completes
  ↓
ReportService.generateReport()
  ↓
RefactorPipeline.analyzeBundle()
  ↓
Pipeline Steps (in dependency order):
  1. init (Quick Scan Data Gathering)
     - Gather file changes for commits
     - Warm caches
     - Fetch blob content
  2. index_commits
     - Process each commit with CommitIndexer
     - For each file: processFile(priority: false)
       - Parse with tree-sitter (background workers)
       - Extract symbols + edges
       - Compute diffs
       - Queue DB writes (changeType: 'added'|'modified'|'removed')
  3. scope
     - Calculate analysis scope
  4. working
     - Build WorkingSnapshot from DB
  5. intended
     - Build intended state map
  6. drift
     - Detect drift (missing/zombie/divergent symbols)
  7. legacy
     - Detect legacy code
  8. bundle_facts
     - Assemble RefactorBundleFacts
     - getWorkingLists() adds complete: true to symbols
  ↓
DatabaseWriteQueue.flushAll()
  ↓
Return complete facts to UI
```

**Code Locations**:
- Pipeline: `src/analysis/refactorPipeline.ts`
- Steps: `src/analysis/runner/steps/`
- Commit processing: `src/analysis/commitIndexer.ts:processFile`

**Key Characteristics**:
- **Concurrency**: 8 commits in parallel (configurable)
- **Workers**: Background workers (`priority: false`)
- **Persistence**: `changeType: 'added'|'modified'|'removed'`
- **Completeness**: `complete: true`
- **Data**: Complete analysis (symbols, edges, drift, legacy, hotspots)
- **Purpose**: Full analysis for accurate refactoring insights

**Symbol Object Structure**:
```typescript
{
  id: string,           // symbol_id from DB
  name: string,
  kind: string,
  signature: string,
  location: Location,
  filePath: string,
  sha: string,          // Commit SHA
  complete: true        // Marked complete
}
```

**Database Overwrite Behavior**:
- Full scan symbols overwrite quick scan symbols (same `sha, path, symbol_id`)
- `INSERT OR REPLACE` ensures no duplicates
- Full scan data is authoritative

### 3. Quick Scan Click

**Trigger**: User clicks on a file in the sidebar

**Flow**:
```
User Clicks File
  ↓
FrameAnalyzer.analyzeTier1()
  ↓
If no symbols available:
  - Parse with tree-sitter (priority: true - reserved workers)
  - Extract symbols
  - Compute DNA IDs
  - Queue DB writes (changeType: 'priority_click')
  - DatabaseWriteQueue.flushAll() immediately
  ↓
OR AnalysisCoordinator.requestFileAnalysis()
  ↓
CommitIndexer.processFile(fileChange, sha, null, undefined, priority: true)
  ↓
- Parse with tree-sitter (priority: true - reserved workers)
- Extract symbols + edges
- Queue DB writes (changeType: 'priority_click')
- DatabaseWriteQueue.flushAll()
  ↓
Return symbols to UI
```

**Code Locations**:
- FrameAnalyzer: `src/webview/cockpit/services/FrameAnalyzer.ts:150`
- AnalysisCoordinator: `src/services/analysisCoordinator.ts:183`

**Key Characteristics**:
- **Concurrency**: Single file (user-initiated)
- **Workers**: Reserved on-demand workers (`priority: true`)
- **Persistence**: `changeType: 'priority_click'`
- **Completeness**: `complete: true` (implicit - no explicit field, but treated as complete)
- **Data**: Complete single-file analysis
- **Purpose**: Instant file analysis when user clicks

**Priority Queue Behavior**:
- Reserved workers only process high-priority queue
- Background workers only process low-priority queue
- Click requests jump the queue and process immediately

## Worker Allocation

### Tree-Sitter Parser Workers

**Configuration**: `src/analysis/tree-sitter.ts`

```typescript
totalWorkers = Math.max(2, os.cpus().length - 1)
reservedForOnDemand = Math.max(1, Math.min(2, Math.floor(totalWorkers / 3)))
backgroundWorkers = totalWorkers - reservedForOnDemand
```

**Example** (8 CPU cores):
- Total workers: 7
- Reserved for on-demand: 2
- Background workers: 5

**Queue System**:
- **High Priority Queue**: On-demand workers only
- **Low Priority Queue**: Background workers only
- **Dispatch Logic**: High priority tasks jump the queue

## Database Write Queue

### Batching Strategy

**Location**: `src/storage/databaseWriteQueue.ts`

**Batch Size**: 1000 operations
**Flush Interval**: 2 seconds (auto-flush)
**Transaction**: All queues flushed in single transaction

**Write Operations**:
```typescript
type WriteOperation =
  | { type: 'symbol'; data: { sha, path, symbol, changeType, isDna } }
  | { type: 'edge'; data: { ... } }
  | { type: 'snapshot'; data: { ... } }
  // ... etc
```

**Symbol Write Flow**:
1. Queue symbol_dna insert (`isDna: true`)
2. Queue symbols insert (`isDna: false`)
3. Batch flush (up to 1000 operations)
4. Single transaction executes all writes

**Overwrite Behavior**:
- `INSERT OR REPLACE` for symbols table
- Same `(sha, path, symbol_id)` overwrites previous entry
- Full scan overwrites quick scan
- Click scan overwrites both (if same commit)

## Merge Logic

### Facts Merger

**Location**: `src/facts/factsMerger.ts`

**Purpose**: Merge quick scan data with full scan data in UI

**Key Structure**: `path:sha:id`
- Ensures symbols from same file+commit are merged correctly
- Prevents cross-file collisions

**Merge Rules**:
1. **Completeness Priority**: Always prefer `complete: true` over `complete: false`
2. **ChangeType Priority** (when completeness equal):
   - `priority_click`: 3 (highest)
   - `added`: 2
   - `modified`: 1
   - `quick_scan`: 0 (lowest)
3. **Newer Wins**: If same completeness and priority, newer symbol replaces older

**Merge Algorithm**:
```typescript
const getSymbolKey = (s: any) => `${s.filePath}:${s.sha}:${s.id}`;

for (const sym of newSymbols) {
  const key = getSymbolKey(sym);
  const existing = symbolMap.get(key);

  if (!existing) {
    symbolMap.set(key, sym);
  } else {
    const existingComplete = existing.complete !== false;
    const newComplete = sym.complete !== false;

    // Prefer complete over incomplete
    if (newComplete && !existingComplete) {
      symbolMap.set(key, sym);
    } else if (newComplete === existingComplete) {
      // Same completeness - use changeType priority
      if (getPriority(sym.changeType) > getPriority(existing.changeType)) {
        symbolMap.set(key, sym);
      }
    }
    // If existing is complete and new is incomplete, keep existing
  }
}
```

## Pipeline Steps

### Step Dependencies

**Location**: `src/analysis/runner/pipelineManifest.ts`

```
init (Quick Scan Data Gathering)
  ├─ workspace_overlay (depends on: init)
  ├─ scope (depends on: init)
  └─ index_commits (depends on: init)
      ├─ intended (depends on: index_commits)
      ├─ hotspots (depends on: index_commits)
      └─ moved_blocks (depends on: index_commits)
scope
  ├─ size (depends on: scope)
  └─ working (depends on: scope, size)
intended + working + scope + index_commits + workspace_overlay
  ├─ drift (depends on: intended, working, scope, index_commits, workspace_overlay)
  └─ legacy (depends on: intended, working, scope, index_commits, workspace_overlay)
scope + intended + working + drift + legacy + hotspots + index_commits + moved_blocks
  └─ bundle_facts (depends on: scope, intended, working, drift, legacy, hotspots, index_commits, moved_blocks)
bundle_facts
  ├─ embedding_index (depends on: bundle_facts)
  └─ retrieve_history (depends on: bundle_facts, embedding_index)
bundle_facts + retrieve_history + embedding_index
  └─ llm_story (depends on: bundle_facts, retrieve_history, embedding_index)
```

### Step Execution

**Location**: `src/analysis/runner/pipelineRunner.ts`

**Execution Model**:
- Topological sort of steps by dependencies
- Steps run in parallel when dependencies are satisfied
- Progress events emitted for UI updates

## Data Flow Examples

### Example 1: Quick Scan → Full Scan

```
Time 0s: User opens Cockpit
  → Quick scan starts (background workers)
  → Parses 1000 files in parallel
  → Writes symbols to DB (changeType: 'quick_scan', complete: false)
  → UI shows sidebar with symbols

Time 3s: Quick scan completes
  → Full scan starts (background workers)
  → Processes commits sequentially
  → For each commit, processes files in parallel
  → Writes symbols to DB (changeType: 'added'|'modified', complete: true)
  → Overwrites quick scan data (same sha, path, symbol_id)

Time 30s: Full scan completes
  → UI merges facts (prefers complete: true)
  → Sidebar updates with complete data
```

### Example 2: Click During Background Analysis

```
Time 5s: Full scan running (background workers busy)
  → User clicks file "src/utils/helper.ts"
  → FrameAnalyzer.analyzeTier1() called
  → High priority task queued
  → Reserved workers (2) process immediately
  → Background workers continue processing
  → File parsed and persisted (changeType: 'priority_click')
  → UI updates instantly
```

### Example 3: Database Overwrite

```
Quick Scan writes:
  INSERT OR REPLACE INTO symbols (sha='abc123', path='src/file.ts', symbol_id='dna456', change_type='quick_scan', ...)

Full Scan writes:
  INSERT OR REPLACE INTO symbols (sha='abc123', path='src/file.ts', symbol_id='dna456', change_type='added', ...)
  → Overwrites quick_scan entry (same primary key)

Click Scan writes:
  INSERT OR REPLACE INTO symbols (sha='abc123', path='src/file.ts', symbol_id='dna456', change_type='priority_click', ...)
  → Overwrites previous entry (same primary key)
```

## Key Implementation Details

### 1. ID Structure Consistency

**Quick Scan** (`workspaceIndexer.ts:908`):
```typescript
results.push({
  id: s.id,              // DNA hash
  filePath: filePath,
  sha: headSha,          // HEAD SHA
  complete: false
});
```

**Full Scan** (`factsAssembler.ts:421`):
```typescript
allSymbols.push({
  id: s.symbol_id,       // From DB (DNA hash)
  filePath: s.filePath || filePath,
  sha: newestSha,        // Commit SHA
  complete: true
});
```

**Merge Key** (`factsMerger.ts:28`):
```typescript
const getSymbolKey = (s: any) => {
  return `${s.filePath}:${s.sha}:${s.id}`;
};
```

### 2. Priority Propagation

**processFile** (`commitIndexer.ts:476`):
```typescript
async processFile(
  file: FileChange,
  sha: string,
  parentSha: string | null,
  plan?: PlanData,
  priority: boolean = false  // Propagates to parser
): Promise<FileProcessingResult | null>
```

**Parser Call** (`commitIndexer.ts:864`):
```typescript
const hybridFacts = await this.parser.extractHybridFacts(
  content,
  filePath,
  language,
  existingSymbols,
  priority  // Uses reserved workers if true
);
```

### 3. Persistence Consistency

**Quick Scan** (`workspaceIndexer.ts:921`):
```typescript
writeQueue.queue({
  type: 'symbol',
  data: {
    sha: headSha,
    path: filePath,
    symbol: s,
    changeType: 'quick_scan',
    isDna: true
  }
});
```

**Click Scan** (`FrameAnalyzer.ts:188`):
```typescript
writeQueue.queue({
  type: 'symbol',
  data: {
    sha: headSha,
    path: normalizedTargetPath,
    symbol: s,
    changeType: 'priority_click',
    isDna: true
  }
});
```

**Full Scan** (`commitIndexer.ts:820`):
```typescript
writeQueue.queue({
  type: 'symbol',
  data: {
    sha,
    path: filePath,
    symbol,
    changeType: type,  // 'added'|'modified'|'removed'
    isDna: true
  }
});
```

## Performance Characteristics

### Quick Scan Init
- **Speed**: 2-3 seconds for 1000 files
- **Concurrency**: 50 files parallel
- **Workers**: Background (5 workers on 8-core system)
- **Data**: Symbols only (no edges, no analysis)

### Full Scan
- **Speed**: 20-60 seconds for 5 commits
- **Concurrency**: 8 commits parallel, 8 files per commit
- **Workers**: Background (5 workers on 8-core system)
- **Data**: Complete analysis (symbols, edges, drift, legacy)

### Click Scan
- **Speed**: < 100ms per file
- **Concurrency**: Single file
- **Workers**: Reserved (2 workers on 8-core system)
- **Data**: Complete single-file analysis

## Error Handling

### Quick Scan
- Errors are logged but don't stop processing
- Failed files are skipped
- Partial results returned

### Full Scan
- Errors in one commit don't stop others
- Failed files are logged and skipped
- Pipeline continues with available data

### Click Scan
- Errors are logged and returned to UI
- User sees error message
- No partial results

## Future Considerations

### Potential Improvements
1. **Incremental Updates**: Only re-analyze changed files
2. **Smart Caching**: Cache parsed ASTs for unchanged files
3. **Progressive Enhancement**: Show quick scan, enhance with full scan
4. **Priority Queue Refinement**: More granular priority levels
5. **Complete Field in DB**: Store completeness in database schema

### Current Limitations
1. Quick scan doesn't include edges
2. Full scan must complete before showing complete data
3. Click scan doesn't trigger full re-analysis of related files
4. No incremental updates (always full re-analysis)

## Summary

The unified architecture ensures:
- ✅ Consistent ID structure (`path:sha:id`)
- ✅ Proper data overwriting (full scan overwrites quick scan)
- ✅ Priority handling (click requests use reserved workers)
- ✅ Completeness tracking (UI knows what's complete)
- ✅ Shared persistence (all modes use same DB tables)
- ✅ No data duplication (primary keys prevent duplicates)

All three modes work together seamlessly, providing fast initial UI population while ensuring accurate, complete analysis data.

