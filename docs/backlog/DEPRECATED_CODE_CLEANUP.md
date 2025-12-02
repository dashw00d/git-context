# Deprecated/Legacy Code Cleanup Plan

This document identifies code that has been superseded by the new **Hotspot Detection** and **Moved Block Detection** implementations, and can now be safely removed.

## Overview

The implementation of **Phase 1: Hotspot Detection** and **Phase 2: Moved Block Detection** from HOTSPOT_AND_MOVED_BLOCKS.md has introduced several new features and architectural improvements. This has rendered certain existing code obsolete.

## 📊 Database Schema (Legacy Tables to Remove)

### 1. Old Symbol Analysis Tables (Superseded by DNA-based system)

**Remove these tables after migration:**
```sql
-- These tables are no longer needed with the new DNA-based symbol tracking
DROP TABLE IF EXISTS symbol_dna;           -- Superseded by dnaId in SymbolInfo
DROP TABLE IF EXISTS symbol_versions;      -- Superseded by symbol_history
DROP TABLE IF EXISTS symbol_drift;         -- Functionality moved to hotspot detection
```

### 2. Legacy Indexes (Consolidated into new schema)

**Remove these redundant indexes:**
```sql
-- Old indexes replaced by comprehensive new indexing strategy
DROP INDEX IF EXISTS idx_symbol_dna_dna_id;
DROP INDEX IF EXISTS idx_symbol_versions_dna;
-- Keep new indexes: idx_file_hotspots_*, idx_symbol_hotspots_*, idx_moved_blocks_*
```

## 🔧 Analysis Engine (Legacy Methods)

### 1. Old Symbol Comparison Logic (`symbolDna.ts`)

**Deprecated functions (keep for compatibility):**
```typescript
// src/analysis/symbolDna.ts - LEGACY
export class SymbolDnaEngine {
  // This entire class is now legacy
  // DNA computation moved to inline functions
  // Symbol resolution moved to snapshotManager
}
```

**Migration path:** Replace with direct `computeSymbolDNA()` calls.

### 2. Old Pipeline Analysis Methods (`pipeline.ts`)

**Deprecated methods:**
```typescript
// src/analysis/pipeline.ts - LEGACY METHODS
private getStoredSymbols(sha: string) // Uses old symbols table without dnaId
private analyzeSymbolChanges()        // Superseded by commitIndexer
private detectCodeDrift()            // Functionality moved to hotspot detection
private calculateRiskMetrics()       // Superseded by hotspot scoring
```

**Migration path:** Use `CommitIndexer` and `HotspotDetector` instead.

### 3. Old Tree-Sitter Symbol Creation (`tree-sitter.ts`)

**Deprecated patterns:**
```typescript
// Old way - missing dnaId
return {
  id: `function_${name}`,
  name,
  kind: 'function',
  signature,
  location: { start, end }
};

// New way - includes dnaId (already implemented)
// This pattern is used throughout tree-sitter.ts
```

**Migration path:** All tree-sitter symbol creation already updated with dnaId.

## 🗄️ Storage Layer (Legacy Database Operations)

### 1. Old Symbol Storage Methods (`index.ts`)

**Deprecated database operations:**
```typescript
// src/storage/index.ts - LEGACY QUERIES
private storeSymbolVersions()     // Superseded by symbol_history table
private getSymbolDrift()          // Superseded by hotspot detection
private calculateSymbolMetrics()  // Superseded by blast radius calculation
```

### 2. Legacy Report Generation (`reportManager.ts`)

**Deprecated report features:**
```typescript
// Methods that don't use new hotspot/moved block data
private generateLegacyRiskReport()    // Use hotspot data instead
private calculateOldComplexity()      // Use structural change scores
private detectOldCodeSmells()         // Use hotspot classification
```

## 🎨 UI Components (Legacy Features)

### 1. Old Risk Visualization (`Cockpit.tsx`)

**Deprecated UI elements:**
```typescript
// Legacy risk indicators without hotspot data
<RiskHeatmap />              // Update to use hotspot scores
<ComplexityChart />          // Update to use structural change scores
<CodeSmellList />           // Update to use hotspot classifications
```

### 2. Old Commit Detail Views

**Deprecated commit information:**
```typescript
// Old commit details without moved block information
<CommitChanges />           // Add moved block visualization
<SymbolModifications />     // Add hotspot indicators
<RiskIndicators />          // Update to use hotspot data
```

## 🧪 Test Code (Legacy Test Cases)

### 1. Old Pipeline Tests (`test_pipeline_integration.ts`)

**Deprecated test sections (remove after verification):**
```typescript
// Legacy test methods that test old functionality
testOldSymbolAnalysis()      // Test DNA-based analysis instead
testLegacyRiskMetrics()      // Test hotspot scoring instead
testOldCodeDrift()          // Test moved block detection instead
```

**Keep these new tests:**
```typescript
// NEW tests to keep
testHotspotDetection()       // Test hotspot scoring and classification
testMovedBlockDetection()    // Test block move identification
testSymbolHistoryStorage()   // Test symbol lineage tracking
testEmbeddingIndexer()       // Test semantic indexing
```

### 2. Legacy Integration Tests

**Remove these test files:**
```
tests/legacy_symbol_analysis.test.ts    // Superseded by DNA tests
tests/old_risk_metrics.test.ts          // Superseded by hotspot tests
tests/legacy_pipeline.test.ts          // Superseded by new pipeline tests
```

## ⚙️ Configuration (Legacy Settings)

### 1. Old VS Code Settings (`package.json`)

**Deprecated settings (remove or repurpose):**
```json
{
  "git-context.legacy.symbolAnalysis.enabled": true,    // Remove
  "git-context.old.riskMetrics.enabled": true,         // Remove
  "git-context.legacy.codeDrift.enabled": true,        // Remove
  // Keep new settings for hotspots and moved blocks
}
```

### 2. Legacy Configuration Options

**Remove these config options:**
```typescript
// src/utils/config.ts - LEGACY CONFIG
legacySymbolAnalysis: boolean    // Remove
oldRiskCalculation: boolean      // Remove
legacyDriftDetection: boolean    // Remove
```

## 🔄 Migration Utilities (Temporary - Remove After Migration)

### 1. Data Migration Scripts

**Remove after migration completes:**
```typescript
// Temporary migration utilities
migrateSymbolDataToDna()        // Run once, then remove
migrateRiskDataToHotspots()     // Run once, then remove
migrateDriftDataToMoves()       // Run once, then remove
```

### 2. Compatibility Layers

**Remove after full adoption:**
```typescript
// Temporary compatibility functions
legacySymbolApi()               // Maintain during transition
oldRiskApi()                    // Maintain during transition
legacyDriftApi()                // Maintain during transition
```

## 🚨 Breaking Changes (API Changes)

### 1. SymbolInfo Interface Changes

**Breaking change:** `dnaId` field is now required
```typescript
// Before (optional)
interface SymbolInfo {
  dnaId?: string;  // Was optional
}

// After (required)
interface SymbolInfo {
  dnaId: string;   // Now required
}
```

**Impact:** All SymbolInfo creation must include dnaId

### 2. Pipeline API Changes

**Breaking change:** Old pipeline methods removed
```typescript
// These methods no longer exist
pipeline.analyzeSymbolChanges()    // Use CommitIndexer instead
pipeline.detectCodeDrift()         // Use HotspotDetector + MovedBlockDetector
pipeline.calculateRiskMetrics()    // Use HotspotDetector.calculateHotspotScore()
```

## 📋 Cleanup Checklist

### Phase 1: Immediate Cleanup (Safe to Remove)
- [ ] Remove `SymbolDnaEngine` class usage
- [ ] Remove old symbol analysis database queries
- [ ] Remove legacy risk calculation functions
- [ ] Remove old UI components without hotspot support

### Phase 2: After Migration (Remove Legacy Tables)
- [ ] Drop `symbol_dna`, `symbol_versions`, `symbol_drift` tables
- [ ] Remove legacy indexes
- [ ] Remove migration utility functions

### Phase 3: Full Cleanup (After Adoption)
- [ ] Remove all legacy test files
- [ ] Remove deprecated VS Code settings
- [ ] Remove compatibility layer functions
- [ ] Update documentation to remove legacy references

## 🔍 Verification Steps

### Before Removing Code:
1. **Run full test suite** - Ensure new functionality works
2. **Check database migration** - Verify all data migrated correctly
3. **Test UI components** - Ensure new features work in UI
4. **Verify API compatibility** - Check no breaking changes for users

### After Removing Code:
1. **Run integration tests** - Verify system still works
2. **Check performance** - Ensure improvements maintained
3. **Validate data integrity** - Confirm all data preserved
4. **Update documentation** - Reflect new architecture

## 📈 Benefits of Cleanup

### Performance Improvements:
- **Reduced bundle size** - Remove unused legacy code
- **Faster startup** - Less code to load and parse
- **Lower memory usage** - Remove redundant data structures

### Maintainability:
- **Cleaner codebase** - Remove technical debt
- **Simpler architecture** - Single source of truth
- **Easier debugging** - Less code to understand

### Developer Experience:
- **Clearer APIs** - No legacy method confusion
- **Better TypeScript** - Strict types without legacy workarounds
- **Focused codebase** - Code matches current architecture

## ⚠️ Risk Assessment

### Low Risk Removals:
- Legacy test files (no production impact)
- Old UI components (gradually replaced)
- Deprecated configuration (fallback to defaults)

### Medium Risk Removals:
- Legacy database tables (requires successful migration)
- Old API methods (may break extensions)
- Legacy pipeline methods (requires full adoption of new pipeline)

### High Risk Removals:
- Core legacy functionality (only after full verification)
- Breaking API changes (requires user communication)
- Database schema changes (requires backup and rollback plan)

---

## 📝 Implementation Notes

This cleanup plan was generated after implementing **Hotspot Detection** and **Moved Block Detection** features. The new architecture provides superior functionality while maintaining backward compatibility during the transition period.

**Total estimated cleanup effort:** 2-3 weeks  
**Risk level:** Medium (with proper testing)  
**Business impact:** Positive (performance and maintainability improvements)
