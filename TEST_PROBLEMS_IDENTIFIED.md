# Test Problems Identified

## Summary

Analysis of failing integration tests reveals several issues preventing symbols from being found in the database:

1. **Path Normalization Inconsistency** (CRITICAL)
2. **Potential Missing Symbol Writes** (NEEDS VERIFICATION)
3. **Database Query Mismatches** (POSSIBLE)

---

## Problem 1: Path Normalization Inconsistency ⚠️ CRITICAL

### Issue

The `CommitIndexer.storeSymbols()` method does NOT normalize file paths before storing them, while `WorkspaceIndexer.quickScanSymbols()` DOES normalize paths using `GitOperations.normalizePath()`.

### Evidence

**CommitIndexer** (`src/analysis/commitIndexer.ts:890-945`):

```typescript
private async storeSymbols(
  sha: string,
  symbolChanges: Map<string, { type: string; symbol: any; filePath: string }>
): Promise<void> {
  // ...
  for (const [dnaId, { type, symbol, filePath }] of symbolChanges) {
    writeQueue.queue({
      type: 'symbol',
      data: { sha, path: filePath, symbol, changeType: type, isDna: false },
      // ❌ filePath used directly without normalization
    });
  }
}
```

**WorkspaceIndexer** (`src/analysis/workspaceIndexer.ts:911`):

```typescript
// Normalize path for consistency with full scan
const normalizedPath = GitOperations.normalizePath(filePath);

writeQueue.queue({
  type: 'symbol',
  data: {
    sha: headSha,
    path: normalizedPath, // ✅ Path is normalized
    symbol: s as any,
    changeType: 'quick_scan',
    isDna: false,
  },
});
```

### Impact

- Tests query with normalized paths like `'src/ts/math.ts'`
- Full scan may store paths as `'./src/ts/math.ts'` or other variations
- Queries fail to find symbols even though they exist in the database

### Affected Tests

- `invalidationIntegration.test.ts`: All 4 failing tests
- `quickScanFullScan.test.ts`: Both failing tests (DNA ID matching fails due to path mismatch)

### Fix Required

Normalize paths in `CommitIndexer.storeSymbols()` before storing:

```typescript
import { GitOperations } from '../git';

private async storeSymbols(...) {
  // ...
  for (const [dnaId, { type, symbol, filePath }] of symbolChanges) {
    const normalizedPath = GitOperations.normalizePath(filePath);
    writeQueue.queue({
      type: 'symbol',
      data: { sha, path: normalizedPath, symbol, changeType: type, isDna: false },
    });
  }
}
```

---

## Problem 2: Potential Missing Symbol Writes (Needs Verification)

### Issue

Need to verify that `storeSymbols()` is actually being called and that symbols are being written to the database.

### Investigation Points

1. Check if `symbolChanges` map is populated correctly in `indexCommit()`
2. Verify `DatabaseWriteQueue.flushAll()` is called after `analyzeBundle()`
3. Check for errors in `flushSymbols()` that might be silently failing

### Evidence from Tests

- Test output shows pipeline runs successfully
- But queries return 0 symbols
- This suggests either:
  - Symbols aren't being written (most likely)
  - Path mismatch prevents finding them (see Problem 1)

### Debugging Steps

1. Add logging to verify `storeSymbols()` is called with non-empty `symbolChanges`
2. Add logging in `flushSymbols()` to verify symbols are actually inserted
3. Run a test query to check if symbols exist with different path formats

---

## Problem 3: Database Query Mismatches (Possible)

### Issue

Tests query symbols using `WHERE path = ? AND sha = ?`, but the unique constraint is `UNIQUE(sha, dna_id)`, not `(sha, path)`.

### Schema

```sql
CREATE TABLE IF NOT EXISTS symbols (
  -- ...
  UNIQUE(sha, dna_id)  -- Not (sha, path)
);
```

### Impact

- Multiple symbols with same `sha` and `path` but different `dna_id` can exist (this is correct)
- But if path normalization is wrong, queries won't find them

### Status

This is likely not the root cause, but worth verifying after fixing Problem 1.

---

## Recommended Fix Order

1. **Fix Path Normalization** (Problem 1)
   - Add `GitOperations.normalizePath()` in `CommitIndexer.storeSymbols()`
   - Also normalize in `processFile()` when creating `symbolChanges` entries
   - Verify normalization is consistent across all code paths

2. **Add Diagnostic Logging**
   - Log actual paths being stored vs. paths being queried
   - Log symbol counts before/after writes
   - Log any errors in `flushSymbols()`

3. **Verify Symbol Writes**
   - Run a test that queries all symbols (no path filter) to verify they exist
   - Check if symbols exist with different path formats

4. **Re-run Tests**
   - After fixes, re-run failing tests
   - If still failing, investigate Problem 2 more deeply

---

## Test-Specific Issues

### `invalidationIntegration.test.ts`

**Test: "should mark symbols as stale when markStale is true"**

- **Line 183**: `expect(beforeSymbols.length).toBeGreaterThan(0);`
- **Issue**: No symbols found after `pipeline.analyzeBundle([commits[0]])`
- **Likely Cause**: Path normalization mismatch

**Test: "should invalidate edges when symbols are invalidated"**

- **Line 236**: `expect(beforeEdges.count).toBeGreaterThan(0);`
- **Issue**: No edges found
- **Likely Cause**: No symbols = no edges (depends on Problem 1)

**Test: "should mark dependent symbols as stale when cascade is true"**

- **Line 273**: `expect(dependentSymbol).toBeDefined();`
- **Issue**: Dependent symbol not found
- **Likely Cause**: Path mismatch or symbols not written

**Test: "should detect stale files correctly"**

- **Line 326**: `expect(symbolCount.count).toBeGreaterThan(0);`
- **Issue**: No symbols found
- **Likely Cause**: Path normalization mismatch

### `quickScanFullScan.test.ts`

**Test: "should produce identical symbol structures for same file"**

- **Line 197**: `expect(fullSymbol).toBeDefined();`
- **Issue**: Full scan symbols don't match quick scan symbols by DNA ID
- **Likely Cause**: Path mismatch prevents finding full scan symbols, or DNA IDs computed differently

**Test: "should use same DNA ID format for quick scan and full scan"**

- **Line 433**: `expect(matchingDnaIds.length).toBeGreaterThan(0);`
- **Issue**: No matching DNA IDs found
- **Likely Cause**: Path mismatch or different DNA computation

---

## Next Steps

1. ✅ **COMPLETED**: Fixed path normalization in `CommitIndexer.storeSymbols()`, `storeSymbolHistory()`, and `storeFiles()`
2. **IN PROGRESS**: Tests still failing - need to verify if symbols are actually being written
3. **TODO**: Add diagnostic query to check if ANY symbols exist (regardless of path)
4. **TODO**: Add comprehensive logging to trace symbol write path
5. **TODO**: Verify `DatabaseWriteQueue.flushAll()` is working correctly

## Update: After Path Normalization Fix

After implementing path normalization in:

- `CommitIndexer.storeSymbols()`
- `CommitIndexer.storeSymbolHistory()`
- `CommitIndexer.storeFiles()`

Tests are still failing, suggesting the issue may not be path normalization alone. Possible causes:

1. **Symbols not being written**: `storeSymbols()` may not be called, or `symbolChanges` may be empty
2. **DatabaseWriteQueue not flushing**: `flushAll()` may not be executing writes
3. **Transaction/commit issues**: Writes may be queued but not committed
4. **Different issue entirely**: Path normalization may not have been the root cause

### Diagnostic Steps Needed

1. Add logging to verify `storeSymbols()` is called with non-empty `symbolChanges`
2. Add logging in `DatabaseWriteQueue.flushSymbols()` to verify symbols are inserted
3. Run query: `SELECT COUNT(*) FROM symbols WHERE sha = ?` (no path filter) to see if ANY symbols exist
4. Check if `DatabaseWriteQueue.getInstance()` returns the same instance used in tests
