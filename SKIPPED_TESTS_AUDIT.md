# Skipped Tests Audit Report
Generated: 2025-01-24

## Summary
- **Total Skipped Tests**: 8
- **Test Files Affected**: 4
- **Categories**: Database Integration, Invalidation, Quick Scan, Parser Limitations

## Detailed Analysis

### 1. Database Integration Tests (2 skipped)

#### 1.1 `should write file changes to database`
**File**: `tests/integration/databaseIntegration.test.ts:149`
**Status**: Skipped
**Reason**: `files` table is not being populated by current pipeline

**Test Expectation**:
- After indexing a commit, the `files` table should contain file change records
- Should verify that `src/ts/math.ts` is present in the files table

**Current Behavior**:
- Pipeline indexes commits and stores symbols/edges
- File changes are tracked in `commitFacts` but not persisted to `files` table

**Impact**: Medium
- File change tracking is available in memory but not queryable from database
- May affect features that need to query file history

**Recommendation**:
- Review if `files` table population is needed for production features
- If needed, add file change persistence in `CommitIndexer` or `DatabaseWriteQueue`
- Consider if file changes should be stored during `indexCommits` step

---

#### 1.2 `should track symbol versions`
**File**: `tests/integration/databaseIntegration.test.ts:188`
**Status**: Skipped
**Reason**: `symbol_versions` table is not being populated by current pipeline

**Test Expectation**:
- After indexing multiple commits, `symbol_versions` table should track symbol evolution
- Should contain entries for symbols across different commit SHAs

**Current Behavior**:
- Pipeline stores symbols in `symbols` table with SHA
- `symbol_versions` table exists but is not populated

**Impact**: Medium
- Symbol version tracking across commits is not queryable
- May affect features that need symbol evolution history

**Recommendation**:
- Review if `symbol_versions` table is used by any production features
- If needed, add version tracking in `CommitIndexer.storeSymbolHistory()` or similar
- Consider if this should be part of the `indexCommits` step

---

### 2. Invalidation Integration Tests (3 skipped)

#### 2.1 `should invalidate symbols when file changes`
**File**: `tests/integration/invalidationIntegration.test.ts:141`
**Status**: Skipped
**Reason**: Database isolation issues - `invalidateFileSymbols` uses `prepare()` which gets the global database, not the test's injected database

**Test Expectation**:
- After modifying a file, calling `invalidateFileSymbols()` should delete symbols from database
- Should verify symbols are removed (count goes to 0)

**Current Behavior**:
- Invalidation service uses global database singleton
- Test injects a test database, but invalidation service doesn't use it
- Test cannot verify invalidation works correctly

**Impact**: High
- Cannot verify file invalidation functionality works correctly
- May indicate production invalidation has similar isolation issues

**Recommendation**:
- Refactor `invalidationService` to accept database as parameter (dependency injection)
- Or ensure test database is properly set as singleton before invalidation calls
- Consider using `setDatabaseManagerForTesting()` pattern consistently

**Code Location**: `src/analysis/invalidation/invalidationService.ts`

---

#### 2.2 `should invalidate edges when symbols are invalidated`
**File**: `tests/integration/invalidationIntegration.test.ts:231`
**Status**: Skipped
**Reason**: Same database isolation issue as 2.1

**Test Expectation**:
- When symbols are invalidated, associated edges should also be invalidated
- Should verify edge count goes to 0 after symbol invalidation

**Current Behavior**:
- Same isolation issue prevents proper testing
- Edge invalidation logic may work but cannot be verified

**Impact**: High
- Cannot verify cascade invalidation of edges
- May indicate production edge invalidation has issues

**Recommendation**:
- Same as 2.1 - fix database isolation
- Ensure edge invalidation is tested once isolation is fixed

---

#### 2.3 `should invalidate all symbols for a commit`
**File**: `tests/integration/invalidationIntegration.test.ts:371`
**Status**: Skipped
**Reason**: Same database isolation issue as 2.1

**Test Expectation**:
- When a commit is invalidated, all symbols for that commit should be removed
- Should verify symbol count goes to 0 after commit invalidation

**Current Behavior**:
- Same isolation issue prevents proper testing
- Commit invalidation logic may work but cannot be verified

**Impact**: High
- Cannot verify commit-level invalidation works correctly
- Critical for cache invalidation workflows

**Recommendation**:
- Same as 2.1 - fix database isolation
- Ensure commit invalidation is tested once isolation is fixed

---

### 3. Quick Scan vs Full Scan Tests (2 skipped)

#### 3.1 `should produce identical symbol structures for same file`
**File**: `tests/integration/quickScanFullScan.test.ts:132`
**Status**: Skipped
**Reason**: DNA IDs may differ between quick scan and full scan due to different AST parsing contexts (single file vs commit context). This is expected behavior.

**Test Expectation**:
- Quick scan and full scan should produce identical symbol structures for the same file
- Symbols should have matching DNA IDs, names, kinds, etc.

**Current Behavior**:
- Quick scan parses files in isolation (workspace context)
- Full scan parses files in commit context (with parent/child relationships)
- Different contexts may produce different AST structures
- DNA IDs are context-dependent, so they may legitimately differ

**Impact**: Low
- This is documented expected behavior, not a bug
- Different contexts producing different results is acceptable

**Recommendation**:
- Consider updating test to verify symbols are semantically equivalent rather than structurally identical
- Or document that DNA ID differences are expected and acceptable
- May want to test that both scans produce valid, usable symbols even if IDs differ

---

#### 3.2 `should use same DNA ID format for quick scan and full scan`
**File**: `tests/integration/quickScanFullScan.test.ts:386`
**Status**: Skipped
**Reason**: DNA IDs may differ between quick scan and full scan due to different AST parsing contexts. This test expects deterministic DNA generation which is not guaranteed.

**Test Expectation**:
- DNA IDs should follow same format (`dna:[64-char-hex]`) for both quick and full scan
- Format should be consistent even if values differ

**Current Behavior**:
- DNA ID format may not be consistent between scan types
- Quick scan may produce short hex IDs without `dna:` prefix
- Full scan may produce full format IDs

**Impact**: Medium
- Inconsistent DNA ID format may cause issues when merging quick scan and full scan results
- May affect symbol matching and tracking

**Recommendation**:
- Standardize DNA ID format generation across all scan types
- Ensure both quick scan and full scan use same format: `dna:[64-char-hex]`
- Update DNA ID generation to always use consistent format
- Consider normalizing existing DNA IDs in database

**Code Location**: DNA ID generation in symbol extraction/processing

---

### 4. Parser Limitation Test (1 skipped)

#### 4.1 `should extract interface from types.ts`
**File**: `tests/integration/sandboxPipeline.test.ts:164`
**Status**: Skipped
**Reason**: Tree-sitter parser extracts only function/method/class declarations, not interfaces or type aliases. This is expected behavior - interfaces are type-only constructs with no runtime representation.

**Test Expectation**:
- Parser should extract TypeScript interfaces from `types.ts`
- Interface symbols should be available in symbol list

**Current Behavior**:
- Tree-sitter parser focuses on runtime symbols (functions, methods, classes)
- Type-only constructs (interfaces, type aliases) are not extracted
- This is intentional design choice

**Impact**: Low
- This is documented limitation, not a bug
- Type-only constructs don't have runtime impact
- May affect type-aware refactoring features

**Recommendation**:
- Document this limitation in user-facing documentation
- Consider if type-aware parsing is needed for future features
- If needed, add TypeScript-specific parser or augment Tree-sitter with type information
- For now, this is acceptable limitation

---

## Priority Recommendations

### High Priority (Blocking Test Verification)
1. **Fix Database Isolation in Invalidation Service** (3 tests)
   - Refactor `invalidationService` to use dependency injection for database
   - Or ensure test database singleton is properly set
   - Enables verification of critical invalidation functionality

### Medium Priority (Feature Completeness)
2. **Standardize DNA ID Format** (1 test)
   - Ensure consistent `dna:[64-char-hex]` format across all scan types
   - May require database migration for existing data

3. **Populate `files` Table** (1 test)
   - Add file change persistence during commit indexing
   - Review if needed for production features

4. **Populate `symbol_versions` Table** (1 test)
   - Add symbol version tracking across commits
   - Review if needed for production features

### Low Priority (Documentation/Expected Behavior)
5. **Update Quick Scan Test Expectations** (1 test)
   - Document that DNA ID differences are expected
   - Update test to verify semantic equivalence rather than structural identity

6. **Document Parser Limitations** (1 test)
   - Document that interfaces/type aliases are not extracted
   - Consider if type-aware parsing is needed for future features

## Test Coverage Impact

### Current Coverage
- **Active Tests**: 118 passing
- **Skipped Tests**: 8
- **Coverage Gaps**:
  - File invalidation verification
  - Edge invalidation verification
  - Commit invalidation verification
  - File change persistence
  - Symbol version tracking
  - DNA ID format consistency

### Risk Assessment
- **High Risk**: Invalidation functionality cannot be verified (3 tests)
- **Medium Risk**: Database tables not populated may affect production features (2 tests)
- **Low Risk**: Expected behavior differences (3 tests)

## Next Steps

1. **Immediate**: Fix database isolation in invalidation service to enable 3 critical tests
2. **Short-term**: Standardize DNA ID format and populate missing database tables
3. **Long-term**: Document expected behavior differences and consider feature enhancements

