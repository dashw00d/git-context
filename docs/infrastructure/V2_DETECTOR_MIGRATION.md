# V2 Detector Migration Documentation

## Overview

This document describes the complete migration of all detectors to V2 versions that extend `BaseDetector`, providing unified configuration injection, enhanced caching, consistent logging, and robust utility methods.

## Migration Date

Completed: 2025-01-XX

## What Changed

### 1. BaseDetector Enhancements

The `BaseDetector` abstract class (`src/analysis/detectors/BaseDetector.ts`) was enhanced with:

- **Configuration Injection**: Detectors now automatically load thresholds from `ExtensionConfig.detectorThresholds` (VS Code settings or `.git-context.config.json`)
- **Logger Injection**: Consistent logging via `DetectorLogger` interface
- **Enhanced Caching**: Content-addressed keys using `computeFingerprint()` for stable, collision-resistant hashing
- **Robust Utilities**: Null guards, error handling, and normalized scoring in utility methods
- **Extensibility Hooks**: `postProcess()` method for output filtering/transformation

### 2. Detector Migrations

#### HotspotDetectorV2
- **File**: `src/analysis/hotspotDetector.ts`
- **Changes**:
  - Added operational methods that delegate to legacy `HotspotDetector`:
    - `updateFileHotspot()`
    - `batchUpdateSymbols()`
    - `getTopFileHotspots()`
    - `getTopSymbolHotspots()`
    - `calculateHotspotScore()`
    - `classifyRiskLevel()`
    - `createSnapshot()`
  - Maintains `detect()` method for `CommitFacts[]` input (future use)

#### MovedBlockDetectorV2
- **File**: `src/analysis/movedBlockDetector.ts`
- **Changes**:
  - Changed input type from `SymbolInfo[]` to `MovedBlockDetectorInput`:
    ```typescript
    interface MovedBlockDetectorInput {
      commitSha: string;
      deletedSymbols: SymbolInfo[];
      addedSymbols: SymbolInfo[];
    }
    ```
  - Added operational methods:
    - `detectMovedBlocks()`
    - `matchByDna()`
    - `setSimilarityThreshold()`
  - Implemented `detect()` to call `detectMovedBlocks()` with input

#### DriftDetector (V2)
- **File**: `src/facts/driftDetector.ts`
- **Changes**:
  - Changed input type from `ScopeSet` to `DriftDetectorInput`:
    ```typescript
    interface DriftDetectorInput {
      intended: Map<string, IntendedState>;
      working: WorkingSnapshot;
      commitShas?: string[];
    }
    ```
  - Wraps existing `detectDrift()` function

#### LegacyDetector (V2)
- **File**: `src/facts/legacyAudit.ts`
- **Changes**:
  - Changed input type from `ScopeSet` to `LegacyDetectorInput`:
    ```typescript
    interface LegacyDetectorInput {
      intended: Map<string, IntendedState>;
      working: WorkingSnapshot;
      scope: ScopeSet;
    }
    ```
  - Wraps existing `auditLegacy()` function

### 3. Pipeline Step Updates

All pipeline steps now use V2 detectors:

- **hotspotStep.ts**: Uses `HotspotDetectorV2`
- **movedBlockStep.ts**: Uses `MovedBlockDetectorV2`
- **driftStep.ts**: Uses `DriftDetector`
- **legacyStep.ts**: Uses `LegacyDetector`
- **intendedStep.ts**: Uses `HotspotDetectorV2` for fallback seeding

### 4. Core Component Updates

- **CommitIndexer** (`src/analysis/commitIndexer.ts`):
  - Constructor now accepts `HotspotDetectorV2` and `MovedBlockDetectorV2`
  - All method calls work via delegation

- **Extension** (`src/extension.ts`):
  - `getRefactorPipeline()` instantiates V2 detectors

- **CLI** (`src/cli/index.ts`):
  - Uses V2 detectors for commit indexing

- **Benchmarks** (`benchmarks/pipeline_diagnostics.ts`):
  - Uses V2 detectors for diagnostics

### 5. Metrics & Adapters

- **hotspotCalculator.ts**: Uses `HotspotDetectorV2` for score calculations
- **movedBlockAdapter.ts**: Uses `MovedBlockDetectorV2` for moved block detection

### 6. Configuration Updates

- **ExtensionConfig** (`src/types/index.ts`):
  - Added `detectorThresholds` interface with:
    - `similarityMin` (default: 0.7)
    - `confidenceMin` (default: 0.5)
    - `changeThreshold` (default: 3)
    - `maxGroupSize` (default: 1000)
    - `scoreWeight` (default: 1.0)

- **package.json**:
  - Added `git-context.detectorThresholds` VS Code setting schema

- **config.ts**:
  - `getExtensionConfig()` now reads `detectorThresholds` from workspace config

### 7. Utility Enhancements

- **fingerprint.ts**:
  - Added `computeFingerprint()` function for stable object hashing
  - Handles circular references and sorts keys for deterministic output

## Benefits

1. **Unified Configuration**: All detectors use centralized thresholds from VS Code settings
2. **Enhanced Caching**: Content-addressed keys prevent collisions and improve performance
3. **Consistent Logging**: All detectors use the same logging interface
4. **Robust Utilities**: Null guards and error handling prevent runtime errors
5. **Backward Compatibility**: Legacy detectors remain as internal implementation details
6. **No Breaking Changes**: All existing APIs work via delegation

## Future Cleanup Opportunities

### 1. Remove Legacy Detector Dependencies

Currently, V2 detectors delegate to legacy detectors internally. Once we're confident V2 is stable:

1. **Move legacy implementation into V2**: Copy the actual implementation from `HotspotDetector` and `MovedBlockDetector` into their V2 counterparts
2. **Remove legacy classes**: Delete `HotspotDetector` and `MovedBlockDetector` classes
3. **Update internal references**: Any remaining internal uses of legacy detectors should be updated

**Files to clean up**:
- `src/analysis/hotspotDetector.ts` - Remove `HotspotDetector` class, keep only `HotspotDetectorV2`
- `src/analysis/movedBlockDetector.ts` - Remove `MovedBlockDetector` class, keep only `MovedBlockDetectorV2`

### 2. Simplify V2 Detector Implementation

Once legacy classes are removed, V2 detectors can:

1. **Remove delegation pattern**: No need for `this.legacyDetector` references
2. **Direct implementation**: Move all logic directly into V2 classes
3. **Remove wrapper methods**: Methods like `detect()` can directly implement the logic instead of wrapping

### 3. Consolidate Input Types

Some detectors have similar input patterns that could be unified:

- `DriftDetectorInput` and `LegacyDetectorInput` both use `intended` and `working`
- Consider a shared base interface for common patterns

### 4. Remove Unused Exports

After migration is complete and stable:

1. Check for any remaining imports of legacy detector classes
2. Remove exports of legacy classes if they're no longer used
3. Update any documentation that references legacy classes

### 5. Enhance BaseDetector Documentation

- Add more examples in JSDoc
- Create a migration guide for future detector implementations
- Document best practices for using BaseDetector utilities

### 6. Performance Optimization

Once legacy code is removed:

1. **Direct method calls**: Remove the delegation overhead
2. **Optimize caching**: Fine-tune cache sizes and TTLs based on usage patterns
3. **Batch operations**: Consider batching similar operations for better performance

## Testing Recommendations

1. **Run pipeline diagnostics**: Ensure all steps work correctly
2. **Verify caching**: Check that cache hits are occurring in logs
3. **Test configuration**: Verify that threshold overrides work via VS Code settings
4. **Performance testing**: Ensure no regressions in detection performance
5. **Integration testing**: Test full pipeline runs with V2 detectors

## Rollback Plan

If issues arise, the legacy detectors are still available. To rollback:

1. Revert pipeline step changes to use legacy detectors
2. Revert CommitIndexer constructor types
3. Revert extension.ts and benchmarks instantiation

However, note that some configuration changes (like `detectorThresholds` in ExtensionConfig) are additive and won't break existing functionality.

## Migration Checklist

- [x] Enhance BaseDetector with configuration injection
- [x] Add operational methods to HotspotDetectorV2
- [x] Add operational methods to MovedBlockDetectorV2
- [x] Update DriftDetector to V2
- [x] Update LegacyDetector to V2
- [x] Update all pipeline steps
- [x] Update CommitIndexer
- [x] Update extension.ts
- [x] Update benchmarks
- [x] Update CLI
- [x] Update metrics/adapters
- [x] Add configuration schema
- [x] Add fingerprint utility
- [x] Verify no linting errors
- [ ] Remove legacy detector classes (future)
- [ ] Consolidate input types (future)
- [ ] Performance optimization (future)

## Notes

- All V2 detectors currently delegate to legacy implementations for backward compatibility
- No breaking changes were introduced - all existing APIs continue to work
- The migration is complete and functional, but legacy code remains for safety
- Future cleanup can remove legacy dependencies once V2 is proven stable

