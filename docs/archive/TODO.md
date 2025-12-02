# TODO - Future Implementation Items

This document tracks all TODO comments added during the unused imports/variables cleanup. These represent features that were identified as incomplete or placeholders that need proper implementation.

## High Priority - Core Functionality

### 1. Staged Content Extraction
**File**: `src/analysis/symbols.ts` (line 483)  
**Context**: `extractStagedSymbols()` method  
**Issue**: Staged content is detected but symbols are not extracted from staged changes  
**Current State**: Method logs that staged changes exist but doesn't extract symbols  
**Implementation Required**:
1. Get staged diff for the file: `this.git.getStagedDiff(file.path)`
2. Parse diff to extract staged content (handle unified diff format)
3. Extract symbols from staged content using `extractSymbolsFromContent()`
4. Compare with working tree symbols to detect changes
5. Return proper `SymbolDelta[]` for staged modifications

**Impact**: Staged file analysis is currently incomplete - files are marked as modified but symbol changes aren't tracked

**Related Code**:
```typescript
// Current implementation just logs:
logDebug(`[SymbolExtractor] Staged changes in ${file.path} - symbol extraction not yet implemented`);
```

---

### 2. Multiple Moves to Same File Detection
**File**: `src/analysis/movedBlockDetector.ts` (line 559)  
**Context**: `hasMultipleMovesToSameFile()` method in `classifyMoveReason()`  
**Issue**: Method is a placeholder that always returns `false`  
**Current State**: Used to detect consolidation patterns (multiple blocks moved to same destination file)  
**Implementation Required**:
1. Track destination files during `detectMovedBlocks()` execution
2. Pass move tracking context to `classifyMoveReason()` or make it a class-level tracker
3. Count moves per destination file
4. Return `true` if destination file has multiple source blocks moved to it

**Impact**: Consolidation move patterns are not detected, affecting move reason classification

**Related Code**:
```typescript
// Consolidation: multiple similar blocks moved to same file
if (this.hasMultipleMovesToSameFile(destBlock.file)) {
  return 'consolidation';
}
```

---

### 3. File Size Detection for Large Files
**File**: `src/analysis/movedBlockDetector.ts` (line 577)  
**Context**: `isLargeFile()` method in `classifyMoveReason()`  
**Issue**: Method uses path heuristics instead of actual file size  
**Current State**: Uses pattern matching on file paths (e.g., `/generated/`, `/vendor/`)  
**Implementation Required**:
1. Read file content using `this.git.getFileContent()` or `getWorkingContent()`
2. Count lines: `content.split('\n').length`
3. Or use git to get file size: `git ls-files -s <filePath>` or similar
4. Return `true` if file exceeds threshold (e.g., > 1000 lines)

**Impact**: Large file detection for module split patterns is inaccurate - relies on path patterns instead of actual size

**Related Code**:
```typescript
// Module split: moving from large file to new smaller file
if (this.isNewFile(destBlock.file) && this.isLargeFile(sourceBlock.file)) {
  return 'module_split';
}
```

---

## Medium Priority - Feature Enhancements

### 4. Hybrid Augmentation with Existing Symbols
**File**: `src/liveTracker.ts` (line 269)  
**Context**: `onDidChangeTextDocument()` method  
**Issue**: `existingSymbols` are retrieved from cache but not used for hybrid fact augmentation  
**Current State**: Symbols are cached but not used when extracting hybrid facts  
**Implementation Required**:
1. Use `existingSymbols` to augment hybrid facts with semantic symbol information
2. Merge CST facts with existing semantic symbols to create true hybrid facts
3. Update symbol cache with augmented hybrid facts
4. This enables CST+semantic hybrid fact tracking in live analysis

**Impact**: Live analysis doesn't create true hybrid facts (CST + semantic) - only CST facts are tracked

**Related Code**:
```typescript
// Get existing symbols for hybrid augmentation (future use)
// TODO: Use existingSymbols for hybrid augmentation when implementing CST+semantic hybrid facts
// const existingSymbols = this.symbolCache.get(doc.uri.toString()) || [];
```

---

## Implementation Notes

### Staged Content Extraction
- **Complexity**: Medium - requires diff parsing
- **Dependencies**: `GitOperations.getStagedDiff()`, `extractSymbolsFromContent()`
- **Testing**: Test with staged modifications, additions, and deletions
- **Edge Cases**: Handle binary files, very large diffs, merge conflicts

### Multiple Moves Detection
- **Complexity**: Low - requires state tracking
- **Dependencies**: Modify `detectMovedBlocks()` to track moves
- **Testing**: Test with multiple blocks moved to same file in one commit
- **Edge Cases**: Same file moves (in-file refactoring), cross-file moves

### File Size Detection
- **Complexity**: Low - straightforward file reading
- **Dependencies**: `GitOperations.getFileContent()` or `getWorkingContent()`
- **Testing**: Test with files of various sizes, handle missing files gracefully
- **Edge Cases**: Binary files, very large files, files not in git

### Hybrid Augmentation
- **Complexity**: High - requires merging CST and semantic facts
- **Dependencies**: Symbol cache, hybrid fact merging logic
- **Testing**: Test with files that have both CST and semantic symbols
- **Edge Cases**: Symbol conflicts, cache invalidation, large symbol sets

## Related Issues

These TODOs are related to the unused variables/imports cleanup:
- `stagedContent` in `symbols.ts` - now has TODO for implementation
- `filePath` parameters in `movedBlockDetector.ts` - now have TODOs for proper implementation
- `existingSymbols` in `liveTracker.ts` - now has TODO for hybrid augmentation

## Priority Order

1. **Staged Content Extraction** - Affects staged file analysis (HIGH impact)
2. **Multiple Moves Detection** - Affects move pattern classification (MEDIUM impact)
3. **File Size Detection** - Affects module split detection (MEDIUM impact)
4. **Hybrid Augmentation** - Enhances live analysis (LOW impact, but valuable feature)

## Estimated Effort

- Staged Content Extraction: 4-6 hours
- Multiple Moves Detection: 2-3 hours
- File Size Detection: 1-2 hours
- Hybrid Augmentation: 6-8 hours

**Total Estimated Effort**: 13-19 hours

---

## Additional TODOs Found in Codebase

### 5. Add change_type to EdgeInfo Interface
**File**: `src/analysis/contextExporter.ts` (line 116)  
**Context**: `buildCommitContext()` method, edge mapping  
**Issue**: `change_type` is hardcoded as `'added'` with type assertion  
**Current State**: EdgeInfo interface doesn't have `change_type` field, so it's cast as `any`  
**Implementation Required**:
1. Add `change_type?: 'added' | 'modified' | 'removed'` to `EdgeInfo` interface in `src/types/index.ts`
2. Update edge queries to include change_type from database
3. Remove type assertion and use proper typing

**Impact**: Edge change tracking is incomplete - all edges are marked as 'added' regardless of actual change type

**Related Code**:
```typescript
change_type: 'added' as any, // TODO: Add change_type to EdgeInfo interface
```

---

### 6. Determine Actual Change Type in Hotspot Detection
**File**: `src/analysis/hotspotDetector.ts` (line 320)  
**Context**: `updateFileHotspot()` method  
**Issue**: Change type is hardcoded as `'modified'`  
**Current State**: Always uses 'modified' regardless of actual symbol change type  
**Implementation Required**:
1. Determine actual change type from symbol delta (added/modified/removed)
2. Pass change type from caller or infer from symbol state
3. Use actual change type instead of hardcoded 'modified'

**Impact**: Hotspot tracking may not accurately reflect symbol change types

**Related Code**:
```typescript
'modified', // TODO: Determine actual change type
```

---

### 7. Resolve Caller Names in Blast Radius Graph
**File**: `src/analysis/mermaidGenerator.ts` (line 80)  
**Context**: `generateBlastRadiusGraph()` method  
**Issue**: Caller names are not resolved, using placeholder `Caller${count}`  
**Current State**: Graph shows generic caller nodes instead of actual symbol names  
**Implementation Required**:
1. Resolve caller symbol IDs to actual symbol names
2. Query database or use symbol map to get names
3. Display actual caller names in graph nodes

**Impact**: Blast radius visualization is less informative - can't see which symbols are calling

**Related Code**:
```typescript
// Note: In a full implementation, we'd resolve caller names
mermaid += `    Caller${callers.length} --> ${sourceId}\n`;
```

---

### 8. Resolve Dependency Names in Blast Radius Graph
**File**: `src/analysis/mermaidGenerator.ts` (line 87)  
**Context**: `generateBlastRadiusGraph()` method  
**Issue**: Dependency names are not resolved, using placeholder `Dep${count}`  
**Current State**: Graph shows generic dependency nodes instead of actual symbol names  
**Implementation Required**:
1. Resolve dependency symbol IDs to actual symbol names
2. Query database or use symbol map to get names
3. Display actual dependency names in graph nodes

**Impact**: Blast radius visualization is less informative - can't see which symbols are dependencies

**Related Code**:
```typescript
// Note: In a full implementation, we'd resolve dependency names
mermaid += `    ${targetId} --> Dep${dependencies.length}\n`;
```

---

### 9. Reuse Embedding from Searches in Reranking
**File**: `src/storage/index.ts` (line 566)  
**Context**: `searchSimilarFacts()` method  
**Issue**: Embedding is generated separately for reranking instead of reusing search embeddings  
**Current State**: Embedding generation may be duplicated  
**Implementation Required**:
1. Cache or reuse embeddings from initial similarity searches
2. Pass embeddings through to reranking step
3. Avoid regenerating embeddings for the same query

**Impact**: Potential performance improvement - avoids duplicate embedding generation

**Related Code**:
```typescript
// Note: In a real implementation, we'd reuse the embedding from the searches above
// but for now we'll rely on the initial similarity score
```

---

### 10. Integrate BaseDetector Cache with Global Cache
**File**: `src/analysis/detectors/BaseDetector.ts` (line 418)  
**Context**: `getCached()` method  
**Issue**: Each detector has its own cache, not integrated with global snapshotManager cache  
**Current State**: Detectors use isolated LRU caches  
**Implementation Required**:
1. Integrate with SnapshotManager's global cache
2. Share cache across detectors for common inputs
3. Coordinate cache invalidation across detectors

**Impact**: Potential performance improvement and memory efficiency - shared cache reduces duplication

**Related Code**:
```typescript
* Note: Key should already include namespace prefix (use generateCacheKey)
* Future: Could integrate with global cache (snapshotManager) for cross-detector caching
```

---

### 11. Enhanced Edge Diff Calculation
**File**: `src/analysis/commitIndexer.ts` (line 282)  
**Context**: Edge diff calculation  
**Issue**: Edge diff is marked as "simplified"  
**Current State**: Basic edge comparison, may not handle all edge change scenarios  
**Implementation Required**:
1. Review edge diff logic for completeness
2. Handle edge property changes (type, confidence, etc.)
3. Detect edge moves/renames

**Impact**: Edge change tracking may miss some edge modifications

**Related Code**:
```typescript
// Edge diff (simplified)
```

---

### 12. Calculate Actual Debt Score
**File**: `src/services/reportService.ts` (line 249)  
**Context**: Report generation, bundle summary  
**Issue**: Debt score is hardcoded as `0` (placeholder)  
**Current State**: No debt score calculation implemented  
**Implementation Required**:
1. Define debt score calculation algorithm
2. Consider factors: technical debt, legacy code, drift, incompleteness
3. Calculate and include in bundle summary

**Impact**: Debt score metric is not available in reports

**Related Code**:
```typescript
debtScore: 0 // Placeholder
```

---

### 13. Handle Placeholder SymbolInfo in Dependencies
**File**: `src/analysis/dependencies.ts` (line 407)  
**Context**: Dependency extraction  
**Issue**: Placeholder SymbolInfo created with just ID when symbol not found  
**Current State**: Incomplete symbol information for unresolved dependencies  
**Implementation Required**:
1. Resolve placeholder symbols from database
2. Or mark as unresolved and handle gracefully
3. Provide better error handling for missing symbols

**Impact**: Dependency graph may have incomplete symbol information

**Related Code**:
```typescript
// We create a placeholder SymbolInfo with just the ID
```

---

## Deprecated/Reference-Only Code

### 14. detectDivergentSymbols Function (DEPRECATED)
**File**: `src/metrics/incompletenessDetector.ts` (line 221)  
**Context**: Divergent symbol detection  
**Status**: **DEPRECATED** - No longer used, kept for reference  
**Reason**: DriftDetector V2 handles divergent symbol detection  
**Action**: Can be removed in future cleanup

**Related Code**:
```typescript
/**
 * DEPRECATED: This function is no longer used - DriftDetector V2 handles divergent symbol detection.
 * Kept for reference only.
 */
```

---

## Summary

**Total TODOs**: 14 items
- **High Priority**: 2 items (staged content, multiple moves)
- **Medium Priority**: 11 items (various enhancements)
- **Deprecated**: 1 item (can be removed)

**Estimated Total Effort**: 25-35 hours (including original 4 items)

## Quick Reference by File

- `src/analysis/symbols.ts`: 1 TODO (staged content)
- `src/analysis/movedBlockDetector.ts`: 2 TODOs (multiple moves, file size)
- `src/liveTracker.ts`: 1 TODO (hybrid augmentation)
- `src/analysis/contextExporter.ts`: 1 TODO (change_type interface)
- `src/analysis/hotspotDetector.ts`: 1 TODO (change type determination)
- `src/analysis/mermaidGenerator.ts`: 2 notes (caller/dependency resolution)
- `src/storage/index.ts`: 1 note (embedding reuse)
- `src/analysis/detectors/BaseDetector.ts`: 1 note (global cache integration)
- `src/analysis/commitIndexer.ts`: 1 note (edge diff simplification)
- `src/services/reportService.ts`: 1 placeholder (debt score)
- `src/analysis/dependencies.ts`: 1 note (placeholder symbols)
- `src/metrics/incompletenessDetector.ts`: 1 deprecated function

