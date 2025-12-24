# Integration Test Audit Report

Generated: 2025-01-24

## Summary

- **Total Tests**: 126 (19 failed, 106 passed, 1 skipped)
- **Test Files**: 11 (6 failed, 5 passed)
- **Duration**: 12.83s

## Critical Failures by Category

### 1. BundleFacts Structure Issues (5 failures)

#### 1.1 Missing `intended.map` in evidence

**Test**: `bundleFacts.test.ts > should have intended.map in evidence`
**Issue**: Tests expect `evidence['intended.map']` but code only creates:

- `evidence['intended.present']`
- `evidence['intended.absent']`
- `evidence['intended.renamed']`

**Location**: `src/facts/factsAssembler.ts:236-238`
**Fix Required**: Add `'intended.map': intended` to evidence object

#### 1.2 Missing `legacySummary` in findings

**Test**: `bundleFacts.test.ts > should have legacySummary in findings`
**Issue**: Tests expect `findings.legacySummary` but code creates `findings.legacyAudit`

**Location**: `src/facts/factsAssembler.ts:196-204`
**Fix Required**: Add `legacySummary` alias or rename `legacyAudit` to `legacySummary`

#### 1.3 `incompleteness.missing` type mismatch

**Test**: `bundleFacts.test.ts > should have incompleteness in findings`
**Issue**: Test expects `findings.incompleteness.missing` to be an array, but code creates it as a number

**Location**: `src/facts/factsAssembler.ts:164-168`
**Current**: `missing: drift.missing_symbols.length` (number)
**Expected**: `missing: drift.missing_symbols` (array)

#### 1.4 Data consistency - file list mismatch

**Test**: `bundleFacts.test.ts > should have consistent file lists`
**Issue**: Symbol files not found in scope files (undefined values in symbol paths)

**Location**: `src/facts/factsAssembler.ts:240` - working.symbols structure may have wrong path field

### 2. Database Integration Issues (6 failures)

#### 2.1 Commits not stored in database

**Test**: `pipelineIntegration.test.ts > should index commits and store in database`
**Issue**: `commits_metadata` table empty after indexing

**Possible Causes**:

- `DatabaseWriteQueue` not flushing commit metadata
- Commit metadata writes queued but not executed
- Transaction rollback or error

**Location**: `src/storage/databaseWriteQueue.ts:558-577`

#### 2.2 Symbols not stored in database

**Test**: `pipelineIntegration.test.ts > should detect symbols in database after indexing`
**Issue**: `symbols` table empty after indexing

**Possible Causes**:

- Symbol writes queued but not flushed
- Wrong SHA used in queries
- Transaction issues

**Location**: `src/storage/databaseWriteQueue.ts:430-480`

#### 2.3 Edges not stored in database

**Test**: `pipelineIntegration.test.ts > should detect edges in database after indexing`
**Issue**: `edges` table empty after indexing

**Location**: `src/storage/databaseWriteQueue.ts:506-556`

#### 2.4 File changes not stored

**Test**: `databaseIntegration.test.ts > should write file changes to database`
**Issue**: `files` table empty

#### 2.5 Symbol versions not tracked

**Test**: `databaseIntegration.test.ts > should track symbol versions`
**Issue**: `symbol_versions` table empty

### 3. Facts Merger Issues (1 failure)

#### 3.1 Symbols not marked as complete

**Test**: `factsMerger.test.ts > should prefer complete symbols over incomplete`
**Issue**: Symbols from full scan not marked with `complete: true`

**Location**: Symbol processing in commit indexer or facts merger

### 4. Invalidation Issues (3 failures)

#### 4.1 File invalidation not working

**Test**: `invalidationIntegration.test.ts > should invalidate symbols when file changes`
**Issue**: Symbols remain in database after file invalidation (expected 0, got 5)

#### 4.2 Edge invalidation not working

**Test**: `invalidationIntegration.test.ts > should invalidate edges when symbols are invalidated`
**Issue**: No edges found before invalidation (expected > 0, got 0)

#### 4.3 Commit invalidation not working

**Test**: `invalidationIntegration.test.ts > should invalidate all symbols for a commit`
**Issue**: Symbols remain after commit invalidation (expected 0, got 25)

### 5. Quick Scan vs Full Scan Issues (4 failures)

#### 5.1 Symbol structure mismatch

**Test**: `quickScanFullScan.test.ts > should produce identical symbol structures`
**Issue**: Quick scan symbols not found in full scan map (DNA ID mismatch?)

#### 5.2 No edges in full scan

**Test**: `quickScanFullScan.test.ts > should have edges only in full scan`
**Issue**: No edges found in full scan (expected > 0, got 0)

#### 5.3 Completeness flags missing

**Test**: `quickScanFullScan.test.ts > should mark full scan symbols as complete`
**Issue**: No edges found (expected > 0, got 0) - related to edge storage

#### 5.4 DNA ID format mismatch

**Test**: `quickScanFullScan.test.ts > should use same DNA ID format`
**Issue**: DNA IDs are short hex (`9780191b73844aca`) instead of full format (`dna:[64-char-hex]`)

**Expected**: `/^dna:[a-f0-9]{64}$/`
**Actual**: `9780191b73844aca` (16 chars, no `dna:` prefix)

## Root Cause Analysis

### Primary Issues:

1. **Evidence structure mismatch**: Code creates different keys than tests expect
2. **Database write queue not flushing**: Data queued but not persisted before test assertions
3. **DNA ID format inconsistency**: Short hex IDs instead of full `dna:` prefixed format
4. **Type mismatches**: Numbers vs arrays in findings structure

### Secondary Issues:

1. **Invalidation logic**: Not properly removing symbols/edges from database
2. **Symbol completeness flags**: Not set during indexing
3. **File path extraction**: Wrong field name in symbol objects

## Recommended Fixes (Priority Order)

### High Priority (Blocking Tests)

1. Add `intended.map` to evidence in `factsAssembler.ts`
2. Add `legacySummary` alias or rename to match tests
3. Fix `incompleteness.missing` to be array instead of number
4. Ensure `DatabaseWriteQueue.flushAll()` is called before test assertions
5. Fix DNA ID format to use full `dna:` prefix with 64-char hex

### Medium Priority

6. Fix file path extraction in working symbols
7. Fix symbol completeness flags during indexing
8. Fix invalidation logic to properly remove records

### Low Priority

9. Add better error handling for database write failures
10. Add diagnostic logging for database state

## Test Environment Notes

- All tests run with `CI=true` (CI mode)
- Tests use sandbox repositories in `tests/fixtures/sandbox-repo/`
- Database is in-memory SQLite for tests
- Pipeline runs with full steps including embedding_index and retrieve_history
