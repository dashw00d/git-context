# Pipeline Dependency Audit Guide

## Overview

This document describes how to identify and fix pipeline dependency issues where steps run before their required data is available, causing incorrect or empty results.

## Critical Bug Discovery (2024)

### Issue Summary

Several pipeline steps were marked as "independent" but actually required data from `index_commits` to complete. This caused them to return empty results (0 symbols, 0 hotspots, etc.) because they queried the database before commits were indexed.

### Root Cause

The pipeline uses topological sorting to determine execution order. Steps with no dependencies (`deps: []`) can run immediately, potentially before `index_commits` populates the database. This led to:

- Empty intended maps (no symbols found)
- Zero hotspot scores (no symbols to analyze)
- Missing moved block detections (no symbol data)

### Affected Steps

1. **`intendedStep`** - Queries `symbols` table via `buildIntendedMap()`
   - **Status**: Fixed in test pipeline, needs fix in production
   - **Fix**: Add `deps: ['index_commits']`

2. **`hotspotStep`** - Queries `symbols` and `symbol_versions` tables
   - **Status**: Fixed in test pipeline, needs fix in production
   - **Fix**: Add `deps: ['index_commits']`

3. **`movedBlockStep`** - Queries `symbols` table
   - **Status**: Already correct (`deps: ['index_commits']`)

4. **`driftStep`** - Uses `state.scope` but not declared
   - **Status**: Needs fix
   - **Fix**: Add `'scope'` to deps array

5. **`legacyStep`** - Uses `state.drift` but not declared
   - **Status**: Needs fix
   - **Fix**: Add `'drift'` to deps array

6. **`bundleFactsStep`** - Uses `state.commitFacts` and `state.movedLineage` but not declared
   - **Status**: Partially fixed (user removed explicit deps, relies on transitive)
   - **Note**: Should explicitly include `'index_commits'` and `'moved_blocks'` for clarity

## How to Identify Dependency Issues

### Step 1: Read Step Implementation

For each step, examine what `state` properties it accesses:

```typescript
// Example: Check what state properties are used
async run(state: PipelineState) {
  // Look for: state.scope, state.intended, state.working, etc.
  if (!state.scope?.allPaths) { ... }
  const drift = detectDrift(state.intended, state.working, ...);
}
```

### Step 2: Check Database Queries

Look for database queries that depend on data from other steps:

```typescript
// Example: This queries symbols table
const symbolsStmt = db.prepare(`
  SELECT symbol_id FROM symbols WHERE sha IN (...)
`);
```

**Key Question**: Does this data exist in the database yet, or does it need `index_commits` to run first?

### Step 3: Compare Dependencies vs Usage

Create a checklist for each step:

| Step | Declared Dependencies | Actual Usage | Missing? |
|------|---------------------|--------------|----------|
| `intended` | `[]` | Queries `symbols` table | `index_commits` |
| `hotspot` | `[]` | Queries `symbols` table | `index_commits` |
| `drift` | `['intended', 'working']` | Uses `state.scope` | `scope` |
| `legacy` | `['intended', 'working', 'scope']` | Uses `state.drift` | `drift` |
| `bundleFacts` | `['scope', 'intended', 'working', 'drift', 'legacy', 'hotspots']` | Uses `state.commitFacts`, `state.movedLineage` | `index_commits`, `moved_blocks` |

### Step 4: Use grep to Find State Access

```bash
# Find all state property accesses in a step file
grep -n "state\." src/analysis/runner/steps/driftStep.ts

# Find all state property accesses across all steps
grep -rn "state\." src/analysis/runner/steps/
```

### Step 5: Check for Database Table Dependencies

```bash
# Find database queries in step files
grep -rn "db\.prepare\|db\.exec\|SELECT.*FROM" src/analysis/runner/steps/

# Check which tables are queried
# Common tables: symbols, symbol_versions, edges, file_snapshots, structural_diffs
```

**Critical Tables**:
- `symbols` - Populated by `index_commits`
- `symbol_versions` - Populated by `index_commits`
- `edges` - Populated by `index_commits`
- `file_snapshots` - Populated by `index_commits` or `workspace_overlay`
- `structural_diffs` - Populated by `index_commits` or `workspace_overlay`

## How to Fix Dependency Issues

### Method 1: Override Dependencies in Pipeline (Recommended)

When the step creator doesn't have the dependency, override it in the pipeline:

```typescript
// In refactorPipeline.ts
const steps = [
  // ...
  (() => {
    const step = createIntendedStep();
    step.deps = ['index_commits'];  // Override empty deps
    return step;
  })(),
  // ...
];
```

**Pros**: 
- Doesn't require changing step definitions
- Pipeline controls execution order
- Easy to see dependencies in one place

**Cons**:
- Dependencies scattered between step files and pipeline
- Can be missed when adding new steps

### Method 2: Update Step Definition (Better Long-term)

Update the step creator function to include correct dependencies:

```typescript
// In intendedStep.ts
export function createIntendedStep(): PipelineStep {
  return {
    id: 'intended',
    label: 'Build intended state map',
    deps: ['index_commits'],  // Add dependency here
    // ...
  };
}
```

**Pros**:
- Dependencies declared where step is defined
- Self-documenting
- Prevents reuse issues

**Cons**:
- Requires updating step files
- May need to update multiple pipelines if step is reused

### Method 3: Hybrid Approach (Best Practice)

1. **Update step definitions** with correct dependencies
2. **Override in pipeline** only when pipeline-specific ordering is needed

```typescript
// Step definition has base dependencies
export function createIntendedStep(): PipelineStep {
  return {
    id: 'intended',
    label: 'Build intended state map',
    deps: ['index_commits'],  // Base dependency
    // ...
  };
}

// Pipeline can override for specific needs
const step = createIntendedStep();
step.deps = ['index_commits', 'workspace_overlay'];  // Pipeline-specific
```

## Verification Checklist

After fixing dependencies, verify:

- [ ] Step runs after all its dependencies complete
- [ ] Step has access to required `state` properties
- [ ] Database tables queried by step are populated
- [ ] No runtime errors about missing state/data
- [ ] Step produces non-empty results (not all zeros)
- [ ] Pipeline execution order matches dependency graph

## Testing for Dependency Issues

### Test 1: Empty Results Check

If a step consistently returns empty results, check if it's running too early:

```typescript
// Add logging to verify data availability
async run(state: PipelineState) {
  console.log(`[StepName] Dependencies completed:`, state.completedSteps);
  console.log(`[StepName] Required data available:`, {
    scope: !!state.scope,
    intended: !!state.intended,
    commitFacts: !!state.commitFacts,
  });
  
  // Check database state
  const count = db.prepare('SELECT COUNT(*) FROM symbols').get();
  console.log(`[StepName] Symbols in DB:`, count);
}
```

### Test 2: Dependency Graph Validation

The pipeline runner validates dependencies, but you can manually check:

```typescript
// In pipelineRunner.ts, topological sort will fail if:
// 1. Circular dependencies exist
// 2. Dependencies reference non-existent steps
// 3. Steps run before dependencies complete
```

### Test 3: Compare Test vs Production Pipeline

Compare step ordering between `pipeline_diagnostics.ts` and `refactorPipeline.ts`:

```bash
# Extract step definitions
grep -A 5 "create.*Step" benchmarks/pipeline_diagnostics.ts > test_steps.txt
grep -A 5 "create.*Step" src/analysis/refactorPipeline.ts > prod_steps.txt
diff test_steps.txt prod_steps.txt
```

## Common Patterns

### Pattern 1: Database-Dependent Steps

**Symptom**: Step queries database but has no dependencies

**Fix**: Add `'index_commits'` or `'workspace_overlay'` dependency

**Examples**:
- `intendedStep` - queries `symbols` table
- `hotspotStep` - queries `symbols` and `symbol_versions` tables
- `movedBlockStep` - queries `symbols` table

### Pattern 2: State Property Access

**Symptom**: Step uses `state.X` but `X` not in dependencies

**Fix**: Add missing dependency to `deps` array

**Examples**:
- `driftStep` uses `state.scope` → add `'scope'`
- `legacyStep` uses `state.drift` → add `'drift'`
- `bundleFactsStep` uses `state.commitFacts` → add `'index_commits'`

### Pattern 3: Transitive Dependencies

**Symptom**: Step depends on step that depends on another step

**Fix**: Pipeline runner handles transitive deps, but be explicit for clarity

**Example**:
- `bundleFactsStep` depends on `hotspots`
- `hotspots` depends on `index_commits`
- `bundleFactsStep` should also explicitly depend on `index_commits` (for clarity and if `hotspots` is optional)

## Prevention Guidelines

1. **Always declare dependencies** - Even if pipeline runner handles transitive deps
2. **Document data requirements** - Comment what state properties and DB tables are needed
3. **Test with empty database** - Ensures steps fail gracefully if data missing
4. **Use TypeScript** - Type checking helps catch missing state properties
5. **Review step order** - When adding new steps, verify dependency chain
6. **Compare test and production** - Keep pipelines in sync

## Related Files

- `src/analysis/refactorPipeline.ts` - Main production pipeline
- `benchmarks/pipeline_diagnostics.ts` - Test/diagnostic pipeline
- `src/analysis/runner/pipelineRunner.ts` - Pipeline execution engine
- `src/analysis/runner/steps/*.ts` - Individual step definitions

## Quick Reference: Current Step Dependencies

### Production Pipeline (`refactorPipeline.ts`) - Status

```typescript
// LEVEL 0: Independent (but some need fixes)
workspace_overlay: []                    // ✅ Independent
scope: []                                 // ✅ Independent
intended: []                              // ❌ Should be ['index_commits']
hotspot: []                               // ❌ Should be ['index_commits']
moved_blocks: ['index_commits']          // ✅ Correct

// LEVEL 1: After workspace/scope
index_commits: []                         // ✅ Independent
working: ['scope']                        // ✅ Correct

// LEVEL 2: After commits indexed
drift: ['intended', 'working']           // ❌ Should include 'scope'
legacy: ['intended', 'working', 'scope'] // ❌ Should include 'drift'

// LEVEL 3: Final assembly
bundle_facts: ['scope', 'intended', 'working', 'drift', 'legacy', 'hotspots']
// ⚠️ Should include 'index_commits' and 'moved_blocks' for clarity
```

### Test Pipeline (`pipeline_diagnostics.ts`) - Fixed

```typescript
// ✅ Correctly fixed:
intended: ['index_commits']
hotspot: ['index_commits']
moved_blocks: ['index_commits']
```

### Step Dependency Matrix

| Step | Needs DB Tables | Needs State | Current Deps | Should Have |
|------|----------------|-------------|--------------|-------------|
| `intended` | `symbols` | - | `[]` | `['index_commits']` |
| `hotspot` | `symbols`, `symbol_versions` | - | `[]` | `['index_commits']` |
| `moved_blocks` | `symbols` | - | `['index_commits']` | ✅ |
| `working` | - | `scope` | `['scope']` | ✅ |
| `drift` | - | `intended`, `working`, `scope` | `['intended', 'working']` | `['intended', 'working', 'scope']` |
| `legacy` | - | `intended`, `working`, `scope`, `drift` | `['intended', 'working', 'scope']` | `['intended', 'working', 'scope', 'drift']` |
| `bundle_facts` | - | `scope`, `intended`, `working`, `drift`, `legacy`, `hotspots`, `commitFacts`, `movedLineage` | `['scope', 'intended', 'working', 'drift', 'legacy', 'hotspots']` | Add `['index_commits', 'moved_blocks']` for clarity |

## References

- Pipeline execution uses topological sort (Kahn's algorithm)
- Steps can run in parallel if they have no dependencies on each other
- Dependencies are validated at pipeline start (throws error if missing step referenced)
- Transitive dependencies are handled automatically, but explicit deps improve clarity and maintainability

