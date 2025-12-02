# Pipeline Diagnostics CST/Hybrid Facts Integration Plan

## Overview
Integrate all new CST/hybrid facts features into the primary pipeline diagnostics test (`benchmarks/pipeline_diagnostics.ts`) to ensure comprehensive test coverage and validation.

## Current State Analysis

### Existing Test Coverage
- ✅ Semantic symbol extraction and tracking
- ✅ Drift detection (missing/zombie/divergent)
- ✅ Legacy audit
- ✅ Hotspot detection
- ✅ Workspace overlay analysis
- ✅ Bundle facts assembly
- ❌ **Missing**: Hybrid facts (CST) extraction
- ❌ **Missing**: Hybrid drift detection
- ❌ **Missing**: CST timeline tracking
- ❌ **Missing**: Batch retrieval performance metrics
- ❌ **Missing**: Missing fact detection validation

### Test Fixtures
- `sample.js` - JavaScript with semantic symbols
- `sample.json` - JSON file (CST-only)
- `sample.md` - Markdown file (CST-only)
- Need: More CST-only test files (YAML, CSS)

## Integration Plan

### Phase 1: Update Test Summaries
**File**: `benchmarks/pipeline_diagnostics.ts`

**Changes**:
1. **Update `summarizeStep()` function**:
   - Add hybrid drift metrics to `drift` step summary
   - Add hybrid facts count to `bundle_facts` step summary
   - Add CST facts count to `index_commits` step summary
   - Add hybrid facts to `workspace_overlay` summary

**Example Output**:
```typescript
case 'drift':
  return `missing=${data.missing_symbols?.length || 0}, zombies=${data.zombie_symbols?.length || 0}, divergent=${data.divergent_symbols?.length || 0}, hybrid=${data.hybridDrifts?.length || 0}`;

case 'bundle_facts':
  const hybridCount = Object.keys(data.hybridFacts || {}).reduce((sum, key) => sum + (data.hybridFacts[key]?.length || 0), 0);
  return `intended.present=${data.intended?.present || 0}, hybridFacts=${hybridCount}`;
```

### Phase 2: Update Snapshot Serialization
**File**: `benchmarks/mocks/framework/snapshot.ts`

**Changes**:
1. **Update `serializeStepState()` function**:
   - Include `hybridDrifts` in drift serialization
   - Include `hybridFacts` in bundle_facts serialization
   - Ensure stable hashing includes hybrid facts

**Example**:
```typescript
case 'drift':
  return state.drift ? {
    missing_symbols: state.drift.missing_symbols,
    zombie_symbols: state.drift.zombie_symbols,
    divergent_symbols: state.drift.divergent_symbols,
    hybridDrifts: state.drift.hybridDrifts || [], // NEW
    // ... existing fields
  } : null;

case 'bundle_facts':
  return state.bundleFacts ? {
    // ... existing fields
    hybridFacts: state.bundleFacts.hybridFacts || {} // NEW
  } : null;
```

### Phase 3: Add CST Test Fixtures
**Location**: `benchmarks/fixtures/`

**New Files**:
1. **`sample.yaml`** - YAML configuration file
   ```yaml
   # Sample YAML for CST extraction
   services:
     api:
       port: 3000
       env: production
   ```

2. **`sample.css`** - CSS stylesheet
   ```css
   /* Sample CSS for CST extraction */
   .container {
     display: flex;
     margin: 10px;
   }
   ```

3. **`sample.php`** - PHP with hybrid augmentation
   ```php
   <?php
   /**
    * Sample PHP file for hybrid augmentation
    * Tests doc comments + semantic symbols
    */
   function processData($input) {
     return $input;
   }
   ```

### Phase 4: Add Hybrid Facts Validation
**File**: `benchmarks/pipeline_diagnostics.ts`

**New Function**: `validateHybridFacts(state: PipelineState)`

**Validations**:
1. **CST Facts Extraction**:
   - Verify CST facts are extracted for CST-only files (markdown, json, yaml, css)
   - Verify hybrid facts are extracted for augmented languages (php, js/ts)
   - Check that facts are saved to timeline manager

2. **Hybrid Drift Detection**:
   - Verify hybrid drifts are detected (missing, zombie, divergent, modified)
   - Check that missing facts are properly detected
   - Validate drift counts match expected values

3. **Timeline Tracking**:
   - Verify facts are stored in `hybrid_facts` table
   - Check that timeline entries are created correctly
   - Validate delta computation works

4. **Batch Retrieval**:
   - Measure performance improvement (should be ~8x faster)
   - Verify batch queries work correctly
   - Check that all files are processed

### Phase 5: Add Performance Metrics
**File**: `benchmarks/pipeline_diagnostics.ts`

**New Metrics**:
1. **Hybrid Facts Metrics**:
   - Total hybrid facts extracted
   - CST-only facts count
   - Hybrid augmentation facts count
   - Average facts per file

2. **Drift Detection Metrics**:
   - Hybrid drift count
   - Missing facts count
   - Performance timing (before/after optimization)

3. **Database Metrics**:
   - Hybrid facts table row count
   - Timeline entries count
   - Batch query performance

**Output Format**:
```typescript
diagnostics.hybridFacts = {
  total: hybridFactsCount,
  cstOnly: cstOnlyCount,
  augmented: augmentedCount,
  filesWithFacts: filesWithFactsCount
};

diagnostics.hybridDrifts = {
  total: driftCount,
  missing: missingCount,
  zombies: zombieCount,
  divergent: divergentCount,
  modified: modifiedCount
};

diagnostics.performance = {
  driftDetectionTime: driftTime,
  batchRetrievalTime: batchTime,
  speedup: batchTime > 0 ? (sequentialTime / batchTime) : 1
};
```

### Phase 6: Add CLI Options
**File**: `benchmarks/pipeline_diagnostics.ts`

**New Options**:
1. `--enable-cst` - Enable CST tracking (default: true)
2. `--enable-augment` - Enable hybrid augmentation (default: false)
3. `--cst-languages` - Comma-separated list of CST-only languages
4. `--test-hybrid` - Focus on hybrid facts testing
5. `--validate-timeline` - Validate timeline entries

**Example Usage**:
```bash
# Test with CST tracking enabled
npx ts-node benchmarks/pipeline_diagnostics.ts --commit-count=3 --enable-cst --test-hybrid

# Test hybrid augmentation
npx ts-node benchmarks/pipeline_diagnostics.ts --commit-count=3 --enable-augment --focus=drift

# Validate timeline
npx ts-node benchmarks/pipeline_diagnostics.ts --commit-count=3 --validate-timeline
```

### Phase 7: Add Database Validation
**File**: `benchmarks/pipeline_diagnostics.ts`

**New Function**: `validateHybridFactsDatabase(db: any, commitShas: string[])`

**Validations**:
1. **Schema Validation**:
   - Verify `hybrid_facts` table exists
   - Check table structure matches schema
   - Validate indexes are created

2. **Data Validation**:
   - Verify facts are stored for each commit
   - Check timeline entries are correct
   - Validate file hash computation
   - Verify delta computation

3. **Performance Validation**:
   - Measure batch query performance
   - Compare with sequential queries
   - Verify speedup is ~8x

### Phase 8: Update Test Output
**File**: `benchmarks/pipeline_diagnostics.ts`

**Enhanced Console Output**:
```
✅ drift :: hash=abc12345 matches baseline :: missing=5, zombies=2, divergent=1, hybrid=3
✅ bundle_facts :: hash=def67890 matches baseline :: intended.present=50, hybridFacts=15
📊 Hybrid Facts: total=15, cstOnly=10, augmented=5, files=8
📊 Hybrid Drifts: total=3, missing=1, zombies=0, divergent=1, modified=1
⚡ Performance: driftDetection=125ms, batchRetrieval=15ms, speedup=8.3x
```

## Implementation Steps

### Step 1: Update Summaries (30 min)
- [ ] Update `summarizeStep()` for drift step
- [ ] Update `summarizeStep()` for bundle_facts step
- [ ] Add hybrid facts metrics to console output

### Step 2: Update Serialization (30 min)
- [ ] Update `serializeStepState()` for drift
- [ ] Update `serializeStepState()` for bundle_facts
- [ ] Test snapshot stability with hybrid facts

### Step 3: Add Test Fixtures (15 min)
- [ ] Create `sample.yaml`
- [ ] Create `sample.css`
- [ ] Create `sample.php`
- [ ] Ensure fixtures are in git repository

### Step 4: Add Validation Functions (45 min)
- [ ] Implement `validateHybridFacts()`
- [ ] Implement `validateHybridFactsDatabase()`
- [ ] Add performance measurement utilities

### Step 5: Add CLI Options (30 min)
- [ ] Parse new CLI flags
- [ ] Update `CliOptions` type
- [ ] Integrate options into test flow

### Step 6: Add Performance Metrics (30 min)
- [ ] Add timing measurements
- [ ] Calculate speedup ratios
- [ ] Output performance summary

### Step 7: Update Diagnostics Output (30 min)
- [ ] Add hybrid facts to diagnostics JSON
- [ ] Add performance metrics to diagnostics
- [ ] Update console output formatting

### Step 8: Testing & Validation (45 min)
- [ ] Run full pipeline with CST enabled
- [ ] Verify hybrid facts are extracted
- [ ] Validate drift detection works
- [ ] Check performance improvements
- [ ] Update baseline snapshots

## Expected Test Output

### Before Integration
```
✅ drift :: hash=abc12345 :: missing=5, zombies=2, divergent=1
✅ bundle_facts :: hash=def67890 :: intended.present=50
```

### After Integration
```
✅ drift :: hash=abc12345 :: missing=5, zombies=2, divergent=1, hybrid=3
✅ bundle_facts :: hash=def67890 :: intended.present=50, hybridFacts=15
📊 Hybrid Facts: total=15, cstOnly=10, augmented=5, files=8
📊 Hybrid Drifts: total=3, missing=1, divergent=1, modified=1
⚡ Performance: driftDetection=125ms (8.3x faster with batching)
```

## Success Criteria

1. ✅ Hybrid facts are extracted for CST-only files
2. ✅ Hybrid drifts are detected and reported
3. ✅ Timeline entries are created correctly
4. ✅ Batch retrieval shows ~8x performance improvement
5. ✅ Missing facts are detected correctly
6. ✅ Test snapshots include hybrid facts
7. ✅ Performance metrics are tracked
8. ✅ Database validation passes
9. ✅ All existing tests still pass

## Risk Assessment

### Low Risk
- Updating summaries (isolated changes)
- Adding test fixtures (no code changes)

### Medium Risk
- Snapshot serialization (may affect baseline hashes)
- Database validation (requires test data)

### Mitigation
- Update baseline snapshots after changes
- Add feature flags to enable/disable hybrid facts testing
- Comprehensive validation before merging

## Timeline Estimate

- Step 1 (Summaries): 30 minutes
- Step 2 (Serialization): 30 minutes
- Step 3 (Fixtures): 15 minutes
- Step 4 (Validation): 45 minutes
- Step 5 (CLI Options): 30 minutes
- Step 6 (Performance): 30 minutes
- Step 7 (Output): 30 minutes
- Step 8 (Testing): 45 minutes
- **Total**: ~4.5 hours

## Dependencies

- All CST/hybrid facts features must be implemented (✅ Done)
- Database schema must be migrated (✅ Done)
- Test fixtures must be available (✅ Partially done)

## Next Steps

1. Review and approve plan
2. Implement changes step by step
3. Run tests and validate results
4. Update documentation
5. Merge to main branch

