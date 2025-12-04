# Hybrid Drift Detection Optimization Plan

## Overview
Optimize hybrid drift detection to use parallel processing patterns consistent with other pipeline steps, and implement missing fact detection that was previously skipped.

## Current Issues

### 1. Sequential Processing
- **Location**: `src/analysis/runner/steps/driftStep.ts` (lines 33-58)
- **Problem**: Files processed one-by-one in a `for` loop
- **Impact**: For 1000 files × 50ms = ~50 seconds sequential time

### 2. Missing Fact Detection Incomplete
- **Location**: `src/analysis/hybridDriftDetector.ts` (lines 29-39)
- **Problem**: Missing facts are detected but skipped because fact object isn't available
- **Impact**: Missing facts (expected present but not found) are not reported

### 3. No Batch Database Queries
- **Location**: `src/analysis/cstTimeline.ts`
- **Problem**: Each file requires separate DB query for `getPriorFacts()`
- **Impact**: N database queries for N files

## Optimization Strategy

### Phase 1: Add Batch Retrieval Method
**File**: `src/analysis/cstTimeline.ts`

Add method to retrieve facts for multiple files in a single query:
```typescript
async getPriorFactsBatch(
  filePaths: string[],
  version: string
): Promise<Map<string, HybridFact[]>>
```

**Benefits**:
- Reduces database round-trips from N to 1
- Better SQLite query planner utilization
- Lower overhead for large file sets

### Phase 2: Implement Missing Fact Detection
**File**: `src/analysis/hybridDriftDetector.ts`

**Approach**:
1. For facts in `intended` with `expect: 'present'` but not in `currentFacts`:
   - Retrieve the fact from prior version using `lastSha` from `IntendedState`
   - Create drift entry with fact from prior version
   - Mark as `type: 'missing'`

**Key Changes**:
- Modify `detectHybridDrift()` to accept prior version SHA
- Query timeline for missing facts using `lastSha` from intended state
- Construct drift entry even when fact object isn't in current facts

### Phase 3: Parallelize File Processing
**File**: `src/analysis/runner/steps/driftStep.ts`

**Pattern**: Use `pLimit` (same as `commitIndexer.ts`)

**Changes**:
1. Filter eligible files first (synchronous, fast)
2. Use `pLimit(8)` for parallel processing
3. Batch retrieve facts for all files
4. Process drift detection in parallel
5. Aggregate results

**Concurrency**: 8 workers (same as commit indexing)

### Phase 4: Error Handling & Progress
**Enhancements**:
- Isolated error handling per file (one failure doesn't block others)
- Optional progress tracking for large file sets
- Logging for performance metrics

## Implementation Steps

### Step 1: Add Batch Retrieval
- [ ] Add `getPriorFactsBatch()` to `CstTimelineManager`
- [ ] Use SQL `IN` clause for multiple file paths
- [ ] Group results by file path in Map
- [ ] Add unit tests

### Step 2: Enhance Missing Fact Detection
- [ ] Modify `detectHybridDrift()` signature to accept prior SHA
- [ ] Query timeline for missing facts using `lastSha`
- [ ] Construct `HybridDrift` entries for missing facts
- [ ] Handle edge cases (no prior version, fact deleted)

### Step 3: Refactor driftStep.ts
- [ ] Import `pLimit`
- [ ] Filter eligible files upfront
- [ ] Batch retrieve facts using new method
- [ ] Process drift detection in parallel with `pLimit(8)`
- [ ] Aggregate results

### Step 4: Testing & Validation
- [ ] Test with small file set (< 10 files)
- [ ] Test with medium file set (100-500 files)
- [ ] Test with large file set (1000+ files)
- [ ] Verify missing facts are detected
- [ ] Verify performance improvement (should be ~8x faster)
- [ ] Verify no regressions in existing functionality

## Expected Performance Improvements

### Before Optimization
- **Sequential**: 1000 files × 50ms = 50 seconds
- **Database queries**: 1000 queries
- **Missing facts**: Not detected

### After Optimization
- **Parallel (8 workers)**: 1000 files ÷ 8 × 50ms = ~6.25 seconds
- **Database queries**: 1 batch query + N individual queries (or all batch)
- **Missing facts**: Fully detected
- **Overall speedup**: ~8x for large codebases

## Code Patterns to Follow

### Pattern 1: pLimit Usage (from commitIndexer.ts)
```typescript
import pLimit = require('p-limit');
const limit = pLimit(8);
const promises = items.map(item => 
  limit(async () => {
    // async work
  })
);
await Promise.all(promises);
```

### Pattern 2: Batch Database Query
```typescript
const placeholders = filePaths.map(() => '?').join(',');
const stmt = db.prepare(`
  SELECT file_path, serialized_fact 
  FROM hybrid_facts
  WHERE file_path IN (${placeholders}) AND version = ?
`);
```

### Pattern 3: Missing Fact Detection (from driftDetector.ts)
```typescript
for (const [symbolKey, expected] of intended) {
  if (expected.expect === 'present') {
    const found = currentFacts.find(f => f.id === symbolKey);
    if (!found) {
      // Retrieve from prior version using expected.lastSha
      const priorFact = await getFactFromVersion(symbolKey, expected.lastSha);
      if (priorFact) {
        drifts.push({ fact: priorFact, type: 'missing', expected });
      }
    }
  }
}
```

## Risk Assessment

### Low Risk
- Batch retrieval method (isolated, well-tested pattern)
- Parallel processing (proven pattern in codebase)

### Medium Risk
- Missing fact detection (requires timeline queries, edge cases)
- Error handling in parallel context

### Mitigation
- Comprehensive error handling per file
- Fallback to sequential if batch fails
- Extensive testing with various file set sizes

## Success Criteria

1. ✅ All files processed in parallel (8 workers)
2. ✅ Missing facts detected and reported
3. ✅ Performance improvement: 5-10x faster for large codebases
4. ✅ No regressions in existing drift detection
5. ✅ Error handling prevents one failure from blocking others
6. ✅ Code follows existing patterns (pLimit, batch queries)

## Dependencies

- `p-limit` package (already in use)
- `CstTimelineManager` (already exists)
- Database access patterns (already established)

## Timeline Estimate

- Step 1 (Batch retrieval): 30 minutes
- Step 2 (Missing facts): 45 minutes
- Step 3 (Parallelization): 30 minutes
- Step 4 (Testing): 45 minutes
- **Total**: ~2.5 hours

