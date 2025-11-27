# 🚀 Git Context - Comprehensive Code Cleanup Plan

## Executive Summary

This document combines the **deprecated code cleanup** from the new hotspot/moved block features with **ESLint warning categorization** to create a comprehensive cleanup plan. The refactor has introduced superior functionality, rendering significant portions of legacy code obsolete while introducing new code quality issues.

**Total cleanup items:** 131 items across 4 categories  
**Estimated effort:** 2-3 weeks  
**Risk level:** Medium (with proper testing)  
**Business impact:** High (performance + maintainability improvements)

---

## 📊 Cleanup Overview

| Category | Items | Description | Risk Level |
|----------|-------|-------------|------------|
| 🗑️ **REMOVE** | 91 | Dead code from old architecture | Low |
| 🔧 **FIX** | 10 | Logic issues requiring fixes | Medium |
| 📝 **TODO** | 3 | Future feature placeholders | Low |
| 🏗️ **ARCHITECTURAL** | 27 | Legacy systems superseded by new features | Medium-High |

---

## 🎯 Phase 1: Immediate Wins (Week 1) - LOW RISK

### 1.1 ESLint REMOVE Category (Dead Code - 91 items)

#### A. CLI Legacy Imports (src/cli/analyze.ts - 13 items)
```bash
# Remove unused imports in src/cli/analyze.ts
- getGitRoot, GitOperations, SymbolExtractor, DependencyExtractor
- RiskDetector, LLMSummarizer, getDifftasticIntegration
- getDatabaseManager, ensureDatabaseInitialized, AnalysisResult
- SymbolInfo, SymbolDelta, detectNamingConvention, analyzeConventionDrift
- extractImportPaths, analyzeImportPathDrift, detectFileNamingConvention, detectLanguage
```

#### B. Legacy Analysis Types (9 items)
```typescript
// Files to clean up:
src/analysis/pipeline.ts:23:3 → Remove 'EdgeInfo' import
src/analysis/semanticChanges.ts:1:35 → Remove 'ChangeType' import
src/analysis/dependencies.ts:1:32 → Remove 'EdgeDelta' import
src/analysis/commitIndexer.ts:2:27 → Remove 'FileSnapshot' import
src/analysis/commitIndexer.ts:3:33 → Remove 'StructuralDiffMetrics' import
src/analysis/facts/legacyAudit.ts:1:25 → Remove 'EdgeContext' import
src/analysis/contextExporter.ts:3:84 → Remove 'RiskItem' import
src/analysis/snapshotManager.ts:5:24 → Remove 'computeBodyHash' import
src/analysis/bundleStoryEngine.ts:2:10 → Remove 'WorkspaceFacts' import
```

#### C. Unused Imports Across Files (42 items)
```bash
# Pattern: Find and remove these unused imports
src/analysis/workspaceIndexer.ts:8:13 'path'
src/analysis/git.ts:2:13 'path'
src/analysis/liveAnalysis.ts:1:13 'vscode'
src/analysis/heuristics.ts:14:5 'edges'
src/analysis/dependencies.ts:3:10 'getDatabaseManager'
src/analysis/difftastic.ts:199:35 'line'
# ... (39 more items - see ESLINT_WARNINGS_CATEGORIZED.md)
```

**Verification:** Run `npm run lint` after each file - warning count should decrease by 91.

### 1.2 Quick Architectural Cleanup (8 items)

#### A. Remove SymbolDnaEngine Class
```bash
# Already completed - verify removal
- src/analysis/symbolDna.ts - SymbolDnaEngine class removed
- src/analysis/symbols.ts - import and usage removed
- Updated to use assignDNAIds() function directly
```

#### B. Legacy Database Queries (4 items)
```sql
-- Remove these functions from src/storage/index.ts
DROP FUNCTION getStoredSymbols()     -- Uses old symbols table
DROP FUNCTION getSymbolDrift()       -- Superseded by hotspot detection
DROP FUNCTION calculateSymbolMetrics() -- Superseded by blast radius
DROP FUNCTION storeSymbolVersions()  -- Superseded by symbol_history
```

#### C. Old UI Components (3 items)
```typescript
// Update these components to use hotspot data
src/webview/Cockpit.tsx:
- Update <RiskHeatmap /> to use hotspot scores
- Update <ComplexityChart /> to use structural change scores
- Update <CodeSmellList /> to use hotspot classifications
```

**Verification:** Full test suite passes, UI loads without errors.

---

## 🔧 Phase 2: Logic Fixes (Week 1-2) - MEDIUM RISK

### 2.1 ESLint FIX Category (Logic Issues - 10 items)

#### A. Bundle Story Engine Variables (2 items)
```typescript
// src/analysis/bundleStoryEngine.ts
// These variables are assigned but never used - investigate why
101:5 'bundleFacts' - check if needed for LLM context
102:5 'commitFacts' - check if needed for story generation
```

#### B. Context Exporter Issues (2 items)
```typescript
// src/analysis/contextExporter.ts
36:11 'db' - assigned but never used - remove or use
413:58 'shas' - defined but never used - remove or use
```

#### C. Dependencies Analysis (2 items)
```typescript
// src/analysis/dependencies.ts
156:15 'variable' - assigned but never used - check logic
184:15 'object' - assigned but never used - check logic
```

#### D. Convention Enhancements (1 item)
```typescript
// src/analysis/conventionEnhancements.ts
181:9 'dir' - assigned but never used - check if needed
```

#### E. Symbol Processing (2 items)
```typescript
// src/analysis/symbols.ts
454:17 'stagedContent' - assigned but never used - check logic
// src/analysis/facts/factsAssembler.ts
243:15 'symbolId' - assigned but never used - check logic
// src/analysis/facts/intendedMap.ts
57:15 'prev' - assigned but never used - check logic
```

**Approach:** For each item, determine if it's:
- **Dead code** → Remove
- **Incomplete logic** → Complete the implementation
- **Debug code** → Remove or convert to proper logging

**Verification:** Each fix should either remove the warning or make the variable used meaningfully.

### 2.2 Architectural Migration Verification (6 items)

#### A. Symbol History Population
```typescript
// Verify implementation in src/analysis/commitIndexer.ts
- storeSymbolHistory() method exists and is called
- symbol_history table gets populated with dna_id, file_path, etc.
- Compound index idx_symbol_history_dna_sha exists
```

#### B. Hotspot Detection Integration
```typescript
// Verify new hotspot features work
- HotspotDetector.calculateHotspotScore() implemented
- File and symbol hotspots stored in database
- UI displays hotspot information
```

#### C. Moved Block Detection
```typescript
// Verify moved block features work
- MovedBlockDetector.detectMovedBlocks() implemented
- Block moves stored in moved_blocks table
- Symbol lineage tracked in symbol_lineage table
```

**Verification:** Run integration tests for new features.

---

## 📝 Phase 3: Future Features (Week 2) - LOW RISK

### 3.1 ESLint TODO Category (3 items)

#### A. LLM Integration (3 items)
```typescript
// src/analysis/bundleStoryEngine.ts
204:17 'dnaId' - assigned but never used - future LLM context?

// src/analysis/llmAnalyst/blocks.ts
219:13 'section' - assigned but never used - future block analysis?

// src/analysis/llmAnalyst/renderer.ts
16:12 '_' - assigned but never used - future feature placeholder?
```

**Approach:** These appear to be placeholders for future LLM features. Options:
- **Implement now** if they're critical for current functionality
- **Document as TODO** with clear requirements
- **Remove** if no longer needed

**Decision:** Leave as TODO for now - document requirements for future implementation.

---

## 🏗️ Phase 4: Database Schema Migration (Week 2-3) - HIGH RISK

### 4.1 Legacy Table Removal (Database Schema)

#### A. Tables to Drop (3 tables)
```sql
-- Execute after data migration verification
DROP TABLE IF EXISTS symbol_dna;       -- Superseded by dnaId in SymbolInfo
DROP TABLE IF EXISTS symbol_versions;  -- Superseded by symbol_history
DROP TABLE IF EXISTS symbol_drift;     -- Functionality moved to hotspot detection
```

#### B. Legacy Indexes to Remove (2 indexes)
```sql
-- Remove redundant indexes
DROP INDEX IF EXISTS idx_symbol_dna_dna_id;
DROP INDEX IF EXISTS idx_symbol_versions_dna;
-- Keep new indexes: idx_file_hotspots_*, idx_symbol_hotspots_*, etc.
```

#### C. Migration Verification
```bash
# Before dropping tables:
- Verify all data migrated to new tables
- Test symbol history queries work
- Test hotspot queries work
- Run full analysis pipeline
- Backup database

# After dropping tables:
- Verify system still works
- Check performance improvements
- Validate data integrity
```

**Risk Mitigation:** Full database backup + rollback script ready.

### 4.2 Configuration Cleanup

#### A. VS Code Settings (package.json)
```json
{
  // Remove these deprecated settings
  "git-context.legacy.symbolAnalysis.enabled": true,    // REMOVE
  "git-context.old.riskMetrics.enabled": true,         // REMOVE
  "git-context.legacy.codeDrift.enabled": true,        // REMOVE
}
```

#### B. Configuration Options (src/utils/config.ts)
```typescript
// Remove these legacy config options
legacySymbolAnalysis: boolean    // REMOVE
oldRiskCalculation: boolean      // REMOVE
legacyDriftDetection: boolean    // REMOVE
```

---

## 🧪 Phase 5: Test Suite Cleanup (Week 3) - LOW RISK

### 5.1 Legacy Test Removal

#### A. Old Test Files to Delete
```
tests/legacy_symbol_analysis.test.ts    // Superseded by DNA tests
tests/old_risk_metrics.test.ts          // Superseded by hotspot tests
tests/legacy_pipeline.test.ts          // Superseded by new pipeline tests
```

#### B. Test Method Updates
```typescript
// Update test_pipeline_integration.ts
- Remove testOldSymbolAnalysis()      // Replace with DNA-based tests
- Remove testLegacyRiskMetrics()      // Replace with hotspot scoring tests
- Remove testOldCodeDrift()          // Replace with moved block tests

// Keep new tests:
+ testHotspotDetection()       // Test hotspot scoring and classification
+ testMovedBlockDetection()    // Test block move identification
+ testSymbolHistoryStorage()   // Test symbol lineage tracking
+ testEmbeddingIndexer()       // Test semantic indexing
```

---

## 🔄 Phase 6: Migration Utilities Removal (Week 3) - MEDIUM RISK

### 6.1 Temporary Code Removal

#### A. Data Migration Scripts
```typescript
// Remove after successful migration
migrateSymbolDataToDna()        // Run once, then remove
migrateRiskDataToHotspots()     // Run once, then remove
migrateDriftDataToMoves()       // Run once, then remove
```

#### B. Compatibility Layers
```typescript
// Remove after full adoption
legacySymbolApi()               // Remove after transition
oldRiskApi()                    // Remove after transition
legacyDriftApi()                // Remove after transition
```

---

## ✅ Verification & Testing Strategy

### Pre-Cleanup Verification
```bash
# Before any cleanup
npm run compile                    # Ensure builds
npm run lint                      # Baseline warning count
npm test                          # Full test suite passes
# Manual testing of all features
```

### Phase-by-Phase Verification
```bash
# After each phase
npm run lint                      # Warning count decreases
npm run test                      # Tests still pass
# Manual feature verification
```

### Final Verification
```bash
# After all cleanup
npm run compile                   # Still builds
npm run lint                      # Major warning reduction
npm run test                      # All tests pass
npm run build:cockpit            # UI builds
# Performance benchmarking
# Full integration testing
```

### Rollback Plan
- **Database:** Full backup before schema changes
- **Code:** Git branches for each phase
- **Config:** Backup of all settings files
- **Tests:** Baseline test results documented

---

## 📈 Success Metrics & Benefits

### Quantitative Metrics
- **ESLint warnings:** 104 → target <20
- **Bundle size:** 10-20% reduction expected
- **Build time:** 15-25% improvement expected
- **Test runtime:** 10-15% faster expected
- **Type safety:** 100% strict TypeScript compliance

### Qualitative Benefits
- **Maintainability:** Single source of truth for each feature
- **Developer Experience:** Clearer APIs, better TypeScript
- **Performance:** Faster startup, lower memory usage
- **Architecture:** Clean separation of concerns
- **Testability:** Focused, independent components

### Business Impact
- **Development velocity:** Faster feature development
- **Bug reduction:** Less legacy code confusion
- **User experience:** More responsive extension
- **Technical debt:** Major reduction
- **Competitive advantage:** Modern, maintainable codebase

---

## 🚨 Risk Assessment & Mitigation

### Risk Levels

| Risk Level | Description | Mitigation |
|------------|-------------|------------|
| **LOW** | Dead code removal, test cleanup | Automated testing, git branches |
| **MEDIUM** | Logic fixes, config changes | Manual testing, feature verification |
| **HIGH** | Database schema changes | Full backup, migration verification |

### Critical Path Items
1. **Database migration** - Must be verified before dropping tables
2. **Symbol history functionality** - Critical for new features
3. **Hotspot/moved block integration** - Core new functionality
4. **UI component updates** - User-facing changes

### Contingency Plans
- **Rollback:** Git branches allow instant rollback to any phase
- **Partial cleanup:** Can stop at any phase if issues arise
- **Incremental deployment:** Each phase can be deployed separately
- **Feature flags:** Can disable new features if needed

---

## 📋 Implementation Timeline

| Week | Phase | Tasks | Risk | Verification |
|------|-------|-------|------|--------------|
| 1 | Immediate Wins | ESLint REMOVE (91 items) + Quick Architectural (8 items) | Low | Lint count -91 |
| 1-2 | Logic Fixes | ESLint FIX (10 items) + Architecture Verification (6 items) | Medium | Tests pass |
| 2 | Future Features | ESLint TODO (3 items) | Low | Documented |
| 2-3 | Database Migration | Schema changes + Legacy table removal | High | Data integrity |
| 3 | Test Cleanup | Legacy test removal + Method updates | Low | Tests pass |
| 3 | Final Cleanup | Migration utilities removal | Medium | Full system |

**Total timeline:** 3 weeks  
**Critical path:** Database migration (Week 2-3)  
**Parallel work:** ESLint cleanup can happen throughout

---

## 🎯 Go/No-Go Criteria

### Go Criteria (All Must Be Met)
- [ ] Full test suite passes after each phase
- [ ] All new features (hotspots, moved blocks) work correctly
- [ ] Database migration successful with data integrity preserved
- [ ] UI loads and functions properly
- [ ] Performance benchmarks meet or exceed expectations
- [ ] ESLint warnings reduced by >80%

### No-Go Criteria (Any Stops Migration)
- [ ] Critical functionality broken
- [ ] Data loss or corruption
- [ ] Performance regression >10%
- [ ] Build failures
- [ ] User-facing regressions

---

## 📝 Post-Cleanup Activities

### Documentation Updates
- Update README.md to reflect new architecture
- Update API documentation
- Remove references to legacy features
- Document new hotspot/moved block features

### Communication
- Release notes highlighting improvements
- Migration guide for any breaking changes
- Performance improvement announcements

### Monitoring
- Monitor for any issues post-cleanup
- Track performance improvements
- Collect user feedback on new features

---

**Ready to execute:** This plan transforms the codebase from a legacy system with accumulated technical debt into a modern, maintainable, high-performance codebase with world-class AI-powered features.

**Success will deliver:** Faster development, fewer bugs, better user experience, and a solid foundation for future growth.
