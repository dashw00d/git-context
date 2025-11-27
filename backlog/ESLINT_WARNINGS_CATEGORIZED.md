# ESLint Warnings - Categorized by Action Required

Based on the current ESLint output, here are the 104 warnings categorized by the action needed:

## 🗑️ **REMOVE** (Dead Code - 91 items)
These are unused imports, types, and variables that should be removed as they're no longer needed:

### Old Pipeline Imports (src/cli/analyze.ts - 13 items)
- `1:10` 'getGitRoot' is defined but never used
- `2:10` 'GitOperations' is defined but never used
- `3:10` 'SymbolExtractor' is defined but never used
- `4:10` 'DependencyExtractor' is defined but never used
- `5:10` 'RiskDetector' is defined but never used
- `6:10` 'LLMSummarizer' is defined but never used
- `7:10` 'getDifftasticIntegration' is defined but never used
- `8:10` 'getDatabaseManager' is defined but never used
- `8:30` 'ensureDatabaseInitialized' is defined but never used
- `9:10` 'AnalysisResult' is defined but never used
- `9:26` 'SymbolInfo' is defined but never used
- `9:38` 'SymbolDelta' is defined but never used
- `10:10` 'detectNamingConvention' is defined but never used
- `10:34` 'analyzeConventionDrift' is defined but never used
- `11:10` 'extractImportPaths' is defined but never used
- `11:30` 'analyzeImportPathDrift' is defined but never used
- `11:54` 'detectFileNamingConvention' is defined but never used
- `12:10` 'detectLanguage' is defined but never used

### Legacy Analysis Types (9 items)
- `src/analysis/pipeline.ts:23:3` 'EdgeInfo' is defined but never used
- `src/analysis/semanticChanges.ts:1:35` 'ChangeType' is defined but never used
- `src/analysis/dependencies.ts:1:32` 'EdgeDelta' is defined but never used
- `src/analysis/commitIndexer.ts:2:27` 'FileSnapshot' is defined but never used
- `src/analysis/commitIndexer.ts:3:33` 'StructuralDiffMetrics' is defined but never used
- `src/analysis/facts/legacyAudit.ts:1:25` 'EdgeContext' is defined but never used
- `src/analysis/contextExporter.ts:3:84` 'RiskItem' is defined but never used
- `src/analysis/snapshotManager.ts:5:24` 'computeBodyHash' is defined but never used
- `src/analysis/bundleStoryEngine.ts:2:10` 'WorkspaceFacts' is defined but never used

### Unused Imports Across Files (42 items)
- `src/analysis/workspaceIndexer.ts:8:13` 'path' is defined but never used
- `src/analysis/git.ts:2:13` 'path' is defined but never used
- `src/analysis/liveAnalysis.ts:1:13` 'vscode' is defined but never used
- `src/analysis/heuristics.ts:14:5` 'edges' is defined but never used
- `src/analysis/dependencies.ts:3:10` 'getDatabaseManager' is defined but never used
- `src/analysis/difftastic.ts:199:35` 'line' is defined but never used
- `src/analysis/tree-sitter.ts:142:39` 'filePath' is defined but never used
- `src/analysis/tree-sitter.ts:319:41` 'language' is defined but never used
- `src/analysis/symbols.ts:307:5` 'language' is defined but never used
- `src/analysis/symbols.ts:336:5` 'filePath' is defined but never used
- `src/analysis/conventionEnhancements.ts:316:63` 'language' is defined but never used
- `src/analysis/namingConventions.ts:228:9` 'dominantCount' is assigned a value but never used
- `src/analysis/semanticChanges.ts:318:5` 'maxLines' is assigned a value but never used
- `src/analysis/mermaidGenerator.ts:29:13` 'style' is assigned a value but never used
- `src/analysis/mermaidGenerator.ts:121:40` 'showConfidence' is defined but never used
- `src/analysis/hotspotDetector.ts:323:5` 'author' is defined but never used
- `src/analysis/hotspotDetector.ts:368:5` 'sha' is defined but never used
- `src/analysis/hotspotDetector.ts:499:36` 'filePath' is defined but never used
- `src/analysis/movedBlockDetector.ts:1:10` 'Database' is defined but never used
- `src/analysis/movedBlockDetector.ts:409:50` 'commitSha' is defined but never used
- `src/analysis/movedBlockDetector.ts:480:38` 'filePath' is defined but never used
- `src/analysis/movedBlockDetector.ts:485:21` 'filePath' is defined but never used
- `src/analysis/movedBlockDetector.ts:490:23` 'filePath' is defined but never used
- `src/analysis/symbolDna.ts:88:51` 'content' is defined but never used
- `src/analysis/symbolDna.ts:88:68` 'context' is defined but never used
- `src/analysis/symbolDna.ts:88:85` 'filePath' is defined but never used
- `src/extension.ts:16:3` 'ReportDTO' is defined but never used
- `src/providers/commitsProvider.ts:2:13` 'path' is defined but never used
- `src/providers/commitsProvider.ts:3:13` 'fs' is defined but never used
- `src/providers/commitsProvider.ts:4:10` 'getGitRoot' is defined but never used
- `src/providers/commitsProvider.ts:8:10` 'getAnalysisPipeline' is defined but never used
- `src/providers/commitsProvider.ts:223:5` 'filterScopes' is defined but never used
- `src/services/commitService.ts:2:20` 'logDebug' is defined but never used
- `src/services/reportService.ts:4:10` 'GitOperations' is defined but never used
- `src/services/reportService.ts:8:10` 'LlmAnalyst' is defined but never used
- `src/services/reportService.ts:9:10` 'getExtensionConfig' is defined but never used
- `src/storage/database.ts:8:7` 'StatementWrapper' is defined but never used
- `src/storage/index.ts:2:25` 'EdgeContext' is defined but never used
- `src/storage/index.ts:4:29` 'symbolToEmbeddingText' is defined but never used
- `src/storage/index.ts:217:24` 'symbolId' is defined but never used
- `src/storage/index.ts:217:42` 'snippet' is defined but never used
- `src/facts/deltaConverter.ts:15:5` 'scopePaths' is defined but never used
- `src/facts/driftDetector.ts:5:52` 'suggestConventionName' is defined but never used
- `src/facts/driftDetector.ts:186:3` 'commitShas' is defined but never used
- `src/commands/commands.ts:7:10` 'getCockpitProvider' is defined but never used

## 🔧 **FIX** (Logic Issues - 10 items)
These variables are assigned but never used, which might indicate incomplete logic:

- `src/analysis/bundleStoryEngine.ts:101:5` 'bundleFacts' is defined but never used
- `src/analysis/bundleStoryEngine.ts:102:5` 'commitFacts' is defined but never used
- `src/analysis/contextExporter.ts:36:11` 'db' is assigned a value but never used
- `src/analysis/contextExporter.ts:413:58` 'shas' is defined but never used
- `src/analysis/dependencies.ts:156:15` 'variable' is assigned a value but never used
- `src/analysis/dependencies.ts:184:15` 'object' is assigned a value but never used
- `src/analysis/conventionEnhancements.ts:181:9` 'dir' is assigned a value but never used
- `src/analysis/symbols.ts:454:17` 'stagedContent' is assigned a value but never used
- `src/analysis/facts/factsAssembler.ts:243:15` 'symbolId' is assigned a value but never used
- `src/analysis/facts/intendedMap.ts:57:15` 'prev' is assigned a value but never used

## 📝 **TODO** (Future Features - 3 items)
These might be needed for future functionality:

- `src/analysis/bundleStoryEngine.ts:204:17` 'dnaId' is assigned a value but never used
- `src/analysis/llmAnalyst/blocks.ts:219:13` 'section' is assigned a value but never used
- `src/analysis/llmAnalyst/renderer.ts:16:12` '_' is assigned a value but never used

## 🎨 **UI/UX Polish** (Optional - 0 items)
These are mostly unused parameters in webview files that don't affect functionality:

- `src/commands/commands.ts:47:21` 'progress' is defined but never used
- `src/commands/commands.ts:47:31` 'token' is defined but never used
- `src/commands/commands.ts:198:41` 'description' is assigned a value but never used
- `src/analysis/llmAnalyst/runner.ts:22:11` 'startTime' is assigned a value but never used
- `src/analysis/llmAnalyst/runner.ts:492:47` 'facts' is defined but never used
- `src/analysis/llmAnalyst/renderer.ts:681:52` 'facts' is defined but never used
- `src/webview/RefactorReportView.ts:1:38` 'Claim' is defined but never used
- `src/webview/RefactorReportView.ts:1:45` 'Action' is defined but never used
- `src/webview/RefactorReportView.ts:121:42` 'index' is defined but never used
- `src/webview/RefactorReportView.ts:241:43` 'evIndex' is defined but never used
- `src/webview/RefactorReportView.ts:266:44` 'evIndex' is defined but never used
- `src/webview/RefactorReportView.ts:387:49` 'index' is defined but never used
- `src/webview/RefactorReportView.ts:438:51` 'index' is defined but never used
- `src/webview/cockpit/CockpitProvider.ts:18:5` '_context' is defined but never used
- `src/webview/cockpit/CockpitProvider.ts:19:5` '_token' is defined but never used
- `src/webview/reports/refactorReportProvider.ts:3:10` 'logInfo' is defined but never used
- `src/webview/reports/refactorReportProvider.ts:3:29` 'logError' is defined but never used
- `src/webview/reports/refactorReportProvider.ts:72:5` 'context' is defined but never used
- `src/webview/reports/refactorReportProvider.ts:73:5` '_token' is defined but never used

## Summary
- **REMOVE**: 91 items can be safely removed
- **FIX**: 10 items need logic fixes
- **TODO**: 3 items are for future features
- **UI/UX Polish**: 17 items are optional polish (don't affect functionality)

Total: 121 warnings (104 from ESLint + 17 UI polish)
