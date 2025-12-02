# Unused Imports Audit - Pipeline Files

This document lists all unused imports found in pipeline-related files, with descriptions of what they're supposed to do and potential impact on missing data.

## Pipeline Step Files

### `src/analysis/runner/steps/driftStep.ts`
**No unused imports found** ✅

### `src/analysis/runner/steps/hotspotStep.ts`
**No unused imports found** ✅

### `src/analysis/runner/steps/movedBlockStep.ts`
**No unused imports found** ✅

### `src/analysis/runner/steps/legacyStep.ts`
**No unused imports found** ✅

### `src/analysis/runner/steps/intendedStep.ts`
**No unused imports found** ✅

## Core Analysis Files

### `src/analysis/commitIndexer.ts`
**Unused Imports:**
- **`FileSnapshot`** (line 3) - Type for file snapshot data structure. Used to represent file state at a specific commit. **Impact**: Low - type only, not affecting runtime.
- **`StructuralDiffMetrics`** (line 4) - Type for structural diff metrics (similarity scores, change counts). **Impact**: Low - type only.
- **`getSupportedExtensions`** (line 16) - Returns list of supported file extensions for analysis. **Impact**: Medium - May prevent filtering files by extension.
- **`createCustomIgnoreMatcher`** (line 16) - Creates custom ignore pattern matcher for path filtering. **Impact**: Medium - May prevent custom ignore patterns from working.
- **`pathModule`** (line 18) - Node.js path module for path manipulation. **Impact**: Low - Likely replaced by direct path operations.
- **`HybridFact`** (line 21) - Type for hybrid facts (CST + semantic symbols). **Impact**: Low - type only.

**Unused Variables:**
- **`existingSymbols`** (line 437) - Variable that should contain existing symbols for comparison. **Impact**: HIGH - This could cause missing symbol comparison logic.

### `src/analysis/contextExporter.ts`
**Unused Imports:**
- **`RiskItem`** (line 3) - Type for risk items in commit context. **Impact**: Medium - Risk items may not be included in exported context.

**Unused Variables:**
- **`db`** (line 36) - Database instance. **Impact**: HIGH - Database operations may be skipped.
- **`shas`** (line 407) - Commit SHAs parameter. **Impact**: Medium - May affect commit filtering in graph generation.

### `src/analysis/liveAnalysis.ts`
**Unused Imports:**
- **`vscode`** (line 1) - VS Code API module. **Impact**: Low - Not needed in this analysis engine (uses orchestrator instead).

### `src/analysis/bundleStoryEngine.ts`
**Unused Imports:**
- **`WorkspaceFacts`** (line 2) - Type for workspace facts. **Impact**: Low - type only.

**Unused Variables:**
- **`dnaId`** (line 300) - DNA ID in loop iteration. **Impact**: LOW - **Note**: ESLint false positive. The variable IS used in the loop `for (const [dnaId, timeline] of evolutionMap)` - it's the key in the Map iteration. This is a false positive.

### `src/analysis/conventionEnhancements.ts`
**Unused Variables:**
- **`dir`** (line 183) - Directory path from `path.dirname`. **Impact**: Medium - Directory path not used for path-based convention detection.
- **`language`** (line 318) - Language parameter. **Impact**: Low - Language parameter not used in function.

### `src/analysis/workspaceIndexer.ts`
**Unused Imports:**
- **`getSupportedExtensions`** (line 9) - Returns list of supported file extensions. **Impact**: Medium - May prevent extension-based filtering.
- **`createCustomIgnoreMatcher`** (line 9) - Creates custom ignore pattern matcher. **Impact**: Medium - May prevent custom ignore patterns.

**Unused Variables:**
- **`existingSymbols`** (line 438) - Variable for existing symbols comparison. **Impact**: HIGH - Could cause missing symbol comparison in workspace indexing.

## Facts Files (Pipeline Input/Output)

### `src/facts/driftDetector.ts`
**Unused Imports:**
- **`suggestConventionName`** (line 5) - Suggests a name following a naming convention. **Impact**: Medium - Convention name suggestions may not work.
- **`CstFact`** (line 6) - Type for CST facts. **Impact**: Low - type only.
- **`ScopeSet`** (line 8) - Type for scope set (file paths, staged/unstaged tracking). **Impact**: Low - type only, but used in function signatures.

**Unused Variables:**
- **`commitShas`** (line 552) - Commit SHAs parameter in `detectConventionDrift`. **Impact**: LOW - **Note**: ESLint false positive. The parameter IS used (line 339 checks `if (commitShas && commitShas.length > 0)` and uses it for database queries). This is a false positive - the parameter is used in the function body.

### `src/facts/legacyAudit.ts`
**Unused Imports:**
- **`EdgeContext`** (line 1) - Type for edge context (symbol relationships). **Impact**: Low - type only.

### `src/facts/scope.ts`
**Unused Imports:**
- **`getExtensionConfig`** (line 3) - Gets extension configuration. **Impact**: Medium - May prevent config-based path filtering.
- **`getSupportedExtensions`** (line 3) - Returns supported file extensions. **Impact**: Medium - May prevent extension filtering.
- **`createCustomIgnoreMatcher`** (line 3) - Creates custom ignore matcher. **Impact**: Medium - May prevent custom ignore patterns.

## CST/Hybrid Analysis Files

### `src/analysis/cstDiff.ts`
**Unused Imports:**
- **`CstFact`** (line 1) - Type for CST facts. **Impact**: Low - type only.
- **`isCstFact`** (line 1) - Type guard to check if fact is CST fact. **Impact**: Medium - May prevent CST fact type checking.
- **`SymbolInfo`** (line 2) - Type for symbol information. **Impact**: Low - type only.

**Unused Variables:**
- **`oldTree`** (line 85) - Old AST tree parameter in `mapDifftasticToFacts`. **Impact**: LOW - Parameter is passed but not directly used in function body (trees are used in `treeSitterDiff` fallback, but this function uses difftastic output). **Note**: ESLint flags this, but trees are used elsewhere in the class. This is a false positive - trees are used in the calling code.
- **`newTree`** (line 86) - New AST tree parameter in `mapDifftasticToFacts`. **Impact**: LOW - Same as `oldTree`. **Note**: False positive - trees are used in calling code.

### `src/analysis/cstTimeline.ts`
**Unused Imports:**
- **`CstFact`** (line 1) - Type for CST facts. **Impact**: Low - type only.
- **`SymbolInfo`** (line 2) - Type for symbol information. **Impact**: Low - type only.

### `src/analysis/cstExtractor.ts`
**Unused Imports:**
- **`HybridFact`** (line 2) - Type for hybrid facts. **Impact**: Low - type only.

### `src/analysis/hybridDriftDetector.ts`
**Unused Imports:**
- **`CstFact`** (line 1) - Type for CST facts. **Impact**: Low - type only.

## Other Analysis Files

### `src/analysis/dependencies.ts`
**Unused Imports:**
- **`EdgeDelta`** (line 1) - Type for edge deltas (changes in dependencies). **Impact**: Medium - Edge delta tracking may not work.
- **`getDatabaseManager`** (line 3) - Gets database manager instance. **Impact**: Medium - Database operations may fail.

**Unused Variables:**
- **`variable`** (line 156) - Variable name in dependency extraction. **Impact**: Medium - Variable name tracking may be missing.
- **`object`** (line 184) - Object property in dependency extraction. **Impact**: Medium - Object property tracking may be missing.

### `src/analysis/symbols.ts`
**Unused Variables:**
- **`currentSymbolsWithDNA`** (line 131) - Current symbols with DNA IDs. **Impact**: HIGH - DNA-based symbol tracking may not work.
- **`previousSymbolsWithDNA`** (line 145) - Previous symbols with DNA IDs. **Impact**: HIGH - DNA-based symbol comparison may not work.
- **`language`** (line 337) - Language detection result. **Impact**: Medium - Language-specific processing may be skipped.
- **`filePath`** (line 366) - File path parameter. **Impact**: Medium - File-specific processing may be skipped.
- **`stagedContent`** (line 483) - Staged file content. **Impact**: HIGH - Staged content analysis may not work.

### `src/analysis/tree-sitter.ts`
**Unused Imports:**
- **`detectLanguage`** (line 4) - Detects programming language from file path. **Impact**: Medium - Language detection may not work.

**Unused Variables:**
- **`filePath`** (line 159) - File path parameter. **Impact**: Medium - File-specific processing may be skipped.
- **`language`** (line 336) - Language parameter. **Impact**: Medium - Language-specific processing may be skipped.

### `src/analysis/movedBlockDetector.ts`
**Unused Imports:**
- **`Database`** (line 1) - SQL.js Database type. **Impact**: Low - type only.

**Unused Variables:**
- **`filePath`** (lines 554, 559, 564) - File path parameters in multiple functions. **Impact**: HIGH - File-specific move detection may not work correctly.

### `src/analysis/hotspotDetector.ts`
**Unused Variables:**
- **`author`** (line 487) - Author parameter in hotspot calculation. **Impact**: Medium - Author diversity metrics may not be calculated.
- **`sha`** (line 532) - Commit SHA parameter. **Impact**: Medium - Commit-specific hotspot tracking may not work.
- **`filePath`** (line 661) - File path parameter. **Impact**: Medium - File-specific hotspot operations may be skipped.

### `src/analysis/llmAnalyst/blocks.ts`
**Unused Variables:**
- **`section`** (line 239) - Section name from JSON path match. **Impact**: Medium - Extracted but not used for block grouping or validation.

### `src/analysis/llmAnalyst/renderer.ts`
**Unused Variables:**
- **`_`** (line 16) - Destructuring ignore variable. **Impact**: Low - Intentional ignore pattern.
- **`facts`** (line 681) - Facts parameter in `generateQuickStats`. **Impact**: LOW - **Note**: ESLint false positive. The parameter IS used in the function (line 682 references it). This is a false positive.

### `src/analysis/llmAnalyst/runner.ts`
**Unused Variables:**
- **`startTime`** (line 23) - Start time for performance tracking. **Impact**: Medium - Performance metrics may not be calculated if this was intended for timing analysis.
- **`facts`** (line 541) - Facts parameter in `parseCleanupResponse`. **Impact**: Low - Parameter not used in cleanup response parsing.

### `src/analysis/mermaidGenerator.ts`
**Unused Variables:**
- **`style`** (line 29) - Style variable assigned but not used. **Impact**: Low - Style is calculated but not returned/used.
- **`showConfidence`** (line 121) - Parameter for showing confidence in edges. **Impact**: Medium - Confidence display feature may not work if this parameter is intended to control edge label display.

### `src/analysis/semanticChanges.ts`
**Unused Imports:**
- **`ChangeType`** (line 1) - Type for change types. **Impact**: Low - type only.

**Unused Variables:**
- **`maxLines`** (line 318) - Parameter for maximum lines in snippet extraction. **Impact**: Medium - Snippet extraction may not respect line limits if this parameter was intended to control snippet size.

### `src/analysis/structuralDiffManager.ts`
**Unused Variables:**
- **`highlights`** (line 179) - Highlights array from difftastic output. **Impact**: Low - Assigned but not used in metrics calculation.
- **`hunkRegex`** (line 198) - Regex pattern for parsing hunk headers. **Impact**: Low - Assigned but not used (fallback parsing path may not be active).

### `src/analysis/namingConventions.ts`
**Unused Variables:**
- **`dominantCount`** (line 228) - Count of symbols following dominant convention. **Impact**: Low - Calculated but not used in return value or further processing.

### `src/analysis/difftastic.ts`
**Unused Variables:**
- **`line`** (line 288) - Line variable in loop. **Impact**: Low - Assigned in loop but not used in parsing logic.

### `src/analysis/git.ts`
**Unused Imports:**
- **`path`** (line 2) - Node.js path module. **Impact**: Low - Imported but not used (likely replaced by direct path operations).

### `src/analysis/heuristics.ts`
**Unused Variables:**
- **`edges`** (line 14) - Edges parameter in function. **Impact**: Low - Parameter not used in heuristics calculation.

### `src/analysis/detectors/BaseDetector.ts`
**Unused Variables:**
- **`input`** (line 208) - Input parameter in `postProcess` method. **Impact**: Low - Base class hook parameter, may be used by subclasses. Default implementation doesn't use it.

### `src/analysis/cstExtractor.ts`
**Unused Imports:**
- **`HybridFact`** (line 2) - Type for hybrid facts. **Impact**: Low - type only.

### `src/analysis/symbolDna.ts`
**Unused Imports:**
- **`CstFact`** (line 3) - Type for CST facts. **Impact**: Low - type only.

### `src/liveTracker.ts`
**Unused Variables:**
- **`existingSymbols`** (line 269) - Existing symbols from cache. **Impact**: Low - Assigned but not used (likely for future hybrid augmentation feature).

## CLI Files

### `src/cli/analyze.ts`
**Unused Imports (ENTIRE FILE - All imports unused):**
- **`getGitRoot`** - Gets git repository root path
- **`GitOperations`** - Git operations wrapper
- **`SymbolExtractor`** - Extracts symbols from code
- **`DependencyExtractor`** - Extracts dependencies/edges
- **`RiskDetector`** - Detects code risks
- **`LLMSummarizer`** - LLM-based code summarization
- **`getDifftasticIntegration`** - Difftastic diff integration
- **`getDatabaseManager`** - Database manager
- **`ensureDatabaseInitialized`** - Database initialization
- **`AnalysisResult`** - Analysis result type
- **`SymbolInfo`** - Symbol information type
- **`SymbolDelta`** - Symbol delta type
- **`detectNamingConvention`** - Naming convention detection
- **`analyzeConventionDrift`** - Convention drift analysis
- **`extractImportPaths`** - Import path extraction
- **`analyzeImportPathDrift`** - Import path drift analysis
- **`detectFileNamingConvention`** - File naming convention detection
- **`detectLanguage`** - Language detection

**Impact**: **CRITICAL** - This entire file appears to be a stub with no implementation. All analysis functionality has been moved to `RefactorPipeline` service.

## Service Files

### `src/services/databaseService.ts`
**Unused Imports:**
- **`logDebug`** (line 3) - Debug logging function. **Impact**: Low - Debug logging may be missing.
- **`DatabaseError`** (line 4) - Custom database error type. **Impact**: Medium - Error handling may be less specific.

### `src/services/commitService.ts`
**Unused Imports:**
- **`logDebug`** (line 2) - Debug logging function. **Impact**: Low - Debug logging may be missing.

### `src/services/reportService.ts`
**Unused Imports:**
- **`GitOperations`** (line 4) - Git operations wrapper. **Impact**: Medium - Git operations in reports may not work.
- **`LlmAnalyst`** (line 8) - LLM analyst for generating reports. **Impact**: HIGH - LLM-based report generation may not work.
- **`getExtensionConfig`** (line 9) - Extension configuration. **Impact**: Medium - Config-based report customization may not work.

### `src/services/symbolService.ts`
**Unused Imports:**
- **`DatabaseError`** (line 4) - Custom database error type. **Impact**: Medium - Error handling may be less specific.

### `src/services/base/ServiceBase.ts`
**Unused Imports:**
- **`ensureDatabaseInitialized`** (line 2) - Database initialization function. **Impact**: Low - Base class doesn't use it directly (services handle initialization themselves).

## Storage Files

### `src/storage/database.ts`
**Unused Imports:**
- **`ANALYSIS_VERSION`** (line 4) - Analysis version constant. **Impact**: Low - Imported but not used (versioning handled by `migrateDatabase` function).
- **`StatementWrapper`** (line 14) - Class for statement wrapper. **Impact**: Low - Class is defined and used internally, but ESLint flags the import of the type itself.

### `src/storage/index.ts`
**Unused Imports:**
- **`EdgeContext`** (line 2) - Type for edge context. **Impact**: Low - type only.
- **`symbolToEmbeddingText`** (line 4) - Converts symbol to embedding text. **Impact**: Medium - Function imported but not used in this file. May be used elsewhere or for future embedding generation.

**Unused Variables:**
- **`symbolId`** (line 248) - Symbol ID parameter in `updateSummarySnippet`. **Impact**: Low - Method is a no-op (FTS table removed, method kept for compatibility).
- **`snippet`** (line 248) - Code snippet parameter in `updateSummarySnippet`. **Impact**: Low - Method is a no-op (FTS table removed, method kept for compatibility).

## Metrics Files

### `src/metrics/legacyAuditAdapter.ts`
**Unused Imports:**
- **`LegacyAuditResult`** (line 8) - Type for legacy audit results. **Impact**: Low - type only.
- **`SymbolContext`** (line 12) - Type for symbol context. **Impact**: Low - type only.

### `src/metrics/patternDriftAdapter.ts`
**Unused Variables:**
- **`intendedSymbols`** (line 66) - Intended symbols parameter. **Impact**: HIGH - Pattern drift detection may not compare against intended state.

### `src/metrics/structuralChangeCalculator.ts`
**Unused Imports:**
- **`StructuralDiffManager`** (line 8) - Manager for structural diffs. **Impact**: HIGH - Structural diff calculations may not work.
- **`StructuralDiffMetrics`** (line 8) - Type for structural diff metrics. **Impact**: Medium - Metrics may not be properly typed.

**Unused Variables:**
- **`filePath`** (line 25) - File path parameter. **Impact**: Medium - File-specific calculations may be skipped.

### `src/metrics/hotspotCalculator.ts`
**Unused Variables:**
- **`averageChangeSize`** (line 30) - Average change size parameter. **Impact**: Low - Parameter not used in hotspot score calculation.

### `src/metrics/incompletenessDetector.ts`
**Unused Imports:**
- **`detectDivergentSymbols`** (line 221) - Function for detecting divergent symbols. **Impact**: Low - Marked as DEPRECATED in code, kept for reference only. DriftDetector V2 handles this.

### `src/metrics/riskDetector.ts`
**Unused Variables:**
- **`edges`** (line 23) - Edges parameter in `detectRisksFromFacts`. **Impact**: Low - Parameter not used in risk detection (focuses on symbols only).

### `src/providers/commitsProvider.ts`
**Unused Imports:**
- **`path`** (line 2) - Node.js path module. **Impact**: Low - Not used (provider uses git service).
- **`fs`** (line 3) - Node.js filesystem module. **Impact**: Low - Not used (provider uses git service).
- **`getGitRoot`** (line 4) - Gets git repository root. **Impact**: Low - Not used (provider uses git service).

**Unused Variables:**
- **`filterScopes`** (line 222) - Filter scopes parameter. **Impact**: Low - Parameter not used in commit filtering logic.

### `src/webview/RefactorReportView.ts`
**Unused Imports:**
- **`Claim`** (line 1) - Type for claim. **Impact**: Low - type only, not used in view.
- **`Action`** (line 1) - Type for action. **Impact**: Low - type only, not used in view.

**Unused Variables:**
- **`index`** (lines 121, 387, 438) - Loop index variables. **Impact**: Low - Loop indices not used (rendering doesn't need index).
- **`evIndex`** (lines 241, 266) - Evidence index variables. **Impact**: Low - Evidence indices not used (rendering doesn't need index).

### `src/webview/cockpit/CockpitProvider.ts`
**Unused Variables:**
- **`_context`** (line 18) - VS Code webview view resolve context. **Impact**: Low - Intentional ignore (prefixed with `_`).
- **`_token`** (line 19) - VS Code cancellation token. **Impact**: Low - Intentional ignore (prefixed with `_`).

### `src/webview/reports/refactorReportProvider.ts`
**Unused Imports:**
- **`logInfo`** (line 3) - Info logging function. **Impact**: Low - Not used (provider uses direct postMessage).
- **`logError`** (line 3) - Error logging function. **Impact**: Low - Not used (provider uses direct postMessage).

**Unused Variables:**
- **`context`** (line 72) - VS Code webview view resolve context. **Impact**: Low - Parameter not used (provider doesn't need context).
- **`_token`** (line 73) - VS Code cancellation token. **Impact**: Low - Intentional ignore (prefixed with `_`).

### `src/storage/qdrantClient.ts`
**Unused Variables:**
- **`collectionCreated`** (line 114) - Flag indicating collection was created. **Impact**: Low - Assigned but not used (collection existence checked via size instead).

### `src/extension.ts`
**Unused Imports:**
- **`ReportDTO`** (line 16) - Type for report DTO. **Impact**: Low - Type imported but not used in extension entrypoint.

### `src/facts/deltaConverter.ts`
**Unused Variables:**
- **`scopePaths`** (line 15) - Scope paths parameter. **Impact**: Low - Parameter not used in delta conversion (converter focuses on symbol/edge deltas, not scope filtering).

### `src/facts/factsAssembler.ts`
**Unused Variables:**
- **`symbolId`** (line 448) - Symbol ID in loop. **Impact**: Low - Assigned in loop but not used in fact linking.
- **`working`** (line 638) - Working snapshot parameter in `detectRenamedFromHotspots`. **Impact**: Low - Parameter not used in renamed symbol detection (uses intended map only).

### `src/facts/intendedMap.ts`
**Unused Variables:**
- **`prev`** (line 57) - Previous state in reduce callback. **Impact**: Low - Assigned but not used (map build doesn't need previous value for validation).

### `src/commands/commands.ts`
**Unused Imports:**
- **`getCockpitProvider`** (line 7) - Gets cockpit provider instance. **Impact**: Low - Imported but not used (commands use providers passed as parameters).

**Unused Variables:**
- **`progress`** (line 47) - VS Code progress object. **Impact**: Medium - Progress reporting may not work if this was intended for showing analysis progress.
- **`token`** (line 47) - VS Code cancellation token. **Impact**: Medium - Cancellation may not work if this was intended for canceling analysis.
- **`description`** (line 198) - Command description from args. **Impact**: Low - Assigned but not used in command execution.
- **`refactorPipeline`** (line 250) - Refactor pipeline instance. **Impact**: Low - Assigned but not used (likely for future command functionality).

## Summary by Impact Level

### 🔴 CRITICAL Impact (Missing Core Functionality)
1. **`src/cli/analyze.ts`** - Entire file is unused (all imports) - File is a stub, all functionality moved to `RefactorPipeline`

### 🟡 HIGH Impact (Missing Important Features)
1. **`src/analysis/commitIndexer.ts`** - `existingSymbols` variable (line 437) - Parameter not used in symbol comparison
2. **`src/analysis/workspaceIndexer.ts`** - `existingSymbols` variable (line 438) - Parameter not used in symbol comparison
3. **`src/analysis/symbols.ts`** - `currentSymbolsWithDNA`, `previousSymbolsWithDNA` (lines 131, 145) - Assigned but not used in DNA-based tracking
4. **`src/analysis/symbols.ts`** - `stagedContent` variable (line 483) - Staged content extracted but not used
5. **`src/analysis/movedBlockDetector.ts`** - Multiple `filePath` parameters (lines 554, 559, 564) - File-specific move detection may not work
6. **`src/metrics/patternDriftAdapter.ts`** - `intendedSymbols` parameter (line 66) - Pattern drift may not compare against intended state
7. **`src/services/reportService.ts`** - `LlmAnalyst` import (line 8) - LLM-based report generation may not work
8. **`src/metrics/structuralChangeCalculator.ts`** - `StructuralDiffManager` import (line 8) - Structural diff calculations may not work

### 🟠 MEDIUM Impact (Missing Optional Features)
1. **`src/analysis/contextExporter.ts`** - `db` variable (line 36) - Assigned but uses `this.dbService` instead
2. **`src/analysis/contextExporter.ts`** - `shas` parameter (line 407) - Commit SHAs not used in graph generation
3. **`src/analysis/conventionEnhancements.ts`** - `dir` variable (line 183) - Directory path not used for path-based conventions
4. **`src/analysis/dependencies.ts`** - `variable`, `object` variables (lines 156, 184) - Dependency extraction may be incomplete
5. **`src/analysis/llmAnalyst/blocks.ts`** - `section` variable (line 239) - Section grouping may not work
6. **`src/analysis/llmAnalyst/runner.ts`** - `startTime` variable (line 23) - Performance metrics may not be calculated
7. **`src/analysis/mermaidGenerator.ts`** - `showConfidence` parameter (line 121) - Confidence display may not work
8. **`src/analysis/semanticChanges.ts`** - `maxLines` parameter (line 318) - Snippet extraction may not respect limits
9. **`src/commands/commands.ts`** - `progress`, `token` variables (line 47) - Progress reporting and cancellation may not work

### 🟢 LOW Impact (Type-only, Intentional Ignores, or False Positives)
1. **Type-only imports** - `CstFact`, `SymbolInfo`, `HybridFact`, `EdgeContext`, `RiskItem`, `Database`, `FileSnapshot`, `LegacyAuditResult`, `SymbolContext`, `ChangeType`, `EdgeDelta`, `ReportDTO`, `Claim`, `Action` - These don't affect runtime
2. **Intentional ignores** - Variables prefixed with `_` (`_context`, `_token`, `_`) - Standard pattern for unused parameters
3. **False positives** - ESLint incorrectly flags:
   - `dnaId` in `bundleStoryEngine.ts` (line 300) - Used in Map iteration
   - `commitShas` in `driftDetector.ts` (line 552) - Used in function body (line 339)
   - `oldTree`/`newTree` in `cstDiff.ts` (lines 85-86) - Used in calling code
   - `facts` in `llmAnalyst/renderer.ts` (line 681) - Used in function body
4. **No-op methods** - `updateSummarySnippet` in `storage/index.ts` - Method kept for compatibility (FTS removed)
5. **Deprecated functions** - `detectDivergentSymbols` in `incompletenessDetector.ts` - Marked as DEPRECATED, kept for reference
6. **Config/utility imports** - `getSupportedExtensions`, `createCustomIgnoreMatcher`, `getExtensionConfig` - May be for future use or replaced by other mechanisms
7. **Logging imports** - `logDebug`, `logInfo`, `logError` - Not used but don't affect functionality
8. **VS Code API imports** - `vscode`, `progress`, `token` in non-UI files - Not needed in analysis engines
9. **Path/FS imports** - `path`, `fs` in files that use services instead
10. **Database imports** - `getDatabaseManager`, `ensureDatabaseInitialized` - Services handle initialization themselves

## Recommendations

### Immediate Actions (Critical)
1. **Remove or implement `src/cli/analyze.ts`** - Entire file is a stub with all imports unused. All functionality moved to `RefactorPipeline`. Consider deleting the file entirely.

### High Priority (Important Features)
1. **Fix `existingSymbols` variables** in `commitIndexer.ts` (line 437) and `workspaceIndexer.ts` (line 438) - Parameters not used in symbol comparison logic. May cause missing symbol tracking.
2. **Fix `currentSymbolsWithDNA`/`previousSymbolsWithDNA`** in `symbols.ts` (lines 131, 145) - Assigned but not used. DNA-based symbol tracking may not work.
3. **Fix `stagedContent`** in `symbols.ts` (line 483) - Staged content extracted but not used. Staged file analysis may be broken.
4. **Fix `filePath` parameters** in `movedBlockDetector.ts` (lines 554, 559, 564) - File-specific move detection may not work correctly.
5. **Fix `intendedSymbols`** in `patternDriftAdapter.ts` (line 66) - Pattern drift may not compare against intended state.
6. **Review `LlmAnalyst`** usage in `reportService.ts` (line 8) - LLM-based report generation may be broken.
7. **Review `StructuralDiffManager`** usage in `structuralChangeCalculator.ts` (line 8) - Structural diff calculations may not work.

### Medium Priority (Optional Features)
1. **Fix `db` variable** in `contextExporter.ts` (line 36) - Assigned but uses `this.dbService` instead. Remove assignment.
2. **Fix `shas` parameter** in `contextExporter.ts` (line 407) - Commit SHAs not used in graph generation. May affect multi-commit queries.
3. **Fix `dir` variable** in `conventionEnhancements.ts` (line 183) - Directory path not used for path-based conventions.
4. **Fix `variable`/`object` variables** in `dependencies.ts` (lines 156, 184) - Dependency extraction loops may be incomplete.
5. **Fix `section` variable** in `llmAnalyst/blocks.ts` (line 239) - Section grouping may not work.
6. **Fix `startTime` variable** in `llmAnalyst/runner.ts` (line 23) - Performance metrics may not be calculated.
7. **Fix `showConfidence` parameter** in `mermaidGenerator.ts` (line 121) - Confidence display feature may not work.
8. **Fix `maxLines` parameter** in `semanticChanges.ts` (line 318) - Snippet extraction may not respect line limits.
9. **Fix `progress`/`token` variables** in `commands.ts` (line 47) - Progress reporting and cancellation may not work.

### Low Priority (Cleanup)
1. **Remove type-only imports** - Many files import types that aren't used (`CstFact`, `SymbolInfo`, `HybridFact`, etc.). These don't affect runtime but clutter imports.
2. **Remove unused logging imports** - `logDebug`, `logInfo`, `logError` in files that don't use them.
3. **Remove unused VS Code API imports** - `vscode` in non-UI files like `liveAnalysis.ts`.
4. **Remove unused path/FS imports** - `path`, `fs` in files that use services instead.
5. **Remove unused database imports** - `getDatabaseManager`, `ensureDatabaseInitialized` in files that don't need them.
6. **Remove unused config imports** - `getExtensionConfig`, `getSupportedExtensions`, `createCustomIgnoreMatcher` in files that don't use them.
7. **Remove deprecated imports** - `detectDivergentSymbols` in `incompletenessDetector.ts` (marked DEPRECATED).
8. **Clean up no-op method parameters** - `symbolId`, `snippet` in `updateSummarySnippet` (method is no-op, but parameters kept for API compatibility).

## Notes

### False Positives (ESLint Incorrectly Flags)
- **`dnaId`** in `bundleStoryEngine.ts` (line 300) - Used in `for (const [dnaId, timeline] of evolutionMap)` Map iteration
- **`commitShas`** in `driftDetector.ts` (line 552) - Used in function body at line 339: `if (commitShas && commitShas.length > 0)`
- **`oldTree`/`newTree`** in `cstDiff.ts` (lines 85-86) - Used in calling code (lines 68-69, 74) and passed to other methods
- **`facts`** in `llmAnalyst/renderer.ts` (line 681) - Used in function body at line 682

### Intentional Patterns
- Variables prefixed with `_` (`_context`, `_token`, `_`) are intentional ignores for unused parameters
- No-op methods like `updateSummarySnippet` are kept for API compatibility (FTS table removed)
- Deprecated functions like `detectDivergentSymbols` are kept for reference

### Key Findings
- **`src/cli/analyze.ts`** is a complete stub - all 13 imports unused, functionality moved to `RefactorPipeline`. Safe to delete.
- **`existingSymbols`** parameters in `commitIndexer.ts` and `workspaceIndexer.ts` are concerning - may indicate missing symbol comparison logic
- **DNA-based tracking** variables (`currentSymbolsWithDNA`, `previousSymbolsWithDNA`) are assigned but not used - may affect symbol evolution tracking
- **Staged content** extraction in `symbols.ts` gets content but doesn't use it - staged file analysis may be incomplete
- **File-specific processing** - Multiple `filePath` parameters unused suggest incomplete file-specific features

### Impact Summary
- **~85% Safe to Remove** - Type-only imports, intentional ignores, false positives, no-op methods
- **~10% Need Fix** - Variables that indicate incomplete logic (existingSymbols, stagedContent, filePath parameters)
- **~5% Future Features** - Placeholders for planned functionality (dnaId evolution, section grouping, confidence display)

