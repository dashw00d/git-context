# Code Attention Report

*Generated: 2025-12-04T11:51:19.634Z*

**Analysis scope:** 2 commits, 199 files

## Table of Contents

- [Executive Summary](#executive-summary)
- [Critical Issues](#critical-issues)
  - [High Churn Hotspots](#high-churn-hotspots)
  - [Wide Blast Radius](#wide-blast-radius)
- [High Priority Items](#high-priority-items)
  - [Risky Changes](#risky-changes)
  - [Missing Symbols](#missing-symbols)
- [Code Quality Issues](#code-quality-issues)
  - [Drift Detection](#drift-detection)
  - [Legacy Code](#legacy-code)
- [Appendix](#appendix)

## Executive Summary

### Summary Statistics

| Severity | Count | Description |
|----------|-------|-------------|
| 🔴 **Critical** | 52 | Files/symbols requiring immediate attention |
| 🟡 **High** | 44 | Important issues to address soon |
| 🔵 **Medium** | 0 | Code quality improvements |

## Critical Issues

### High Churn Hotspots

Files and symbols that change frequently are prone to bugs and hard to maintain.

#### 📁 Top File Hotspots

1. 🔴 **[src/webview/cockpit/services/MessageController.ts](src/webview/cockpit/services/MessageController.ts)** (Score: 85.1)
   - Changed in 3/3 versions
   - Churn: +821 / -745 lines
   <details><summary>Preview</summary>

   ```typescript
   import * as vscode from 'vscode';
import { normalizeBundleConfig } from '../../../state/bundleConfig';
import { getStore } from '../../../state/store';
import { CockpitClientMessage, CockpitHostMessage, BundleView } from '../../../types/cockpit';
import { withTimeout } from '../../../utils/async';
import { logError, logInfo, logWarn } from '../../../utils/logger';
import { extractSnippet } from '../utils/bundleViewHelpers';
import { AnalysisController } from './AnalysisController';
import { BundleManager } from './BundleManager';
import { ExplorerController } from './ExplorerController';
   ```
   </details>

2. 🔴 **[src/state/effects.ts](src/state/effects.ts)** (Score: 85.1)
   - Changed in 3/3 versions
   <details><summary>Preview</summary>

   ```typescript
   import * as vscode from 'vscode';
import { ActiveBundleProvider } from '../providers/activeBundleProvider';
import { CommitsProvider } from '../providers/commitsProvider';
import { SymbolHistoryProvider } from '../providers/symbolHistoryProvider';
import { getReportService } from '../services/reportService';
import { prepare } from '../storage/statement-wrapper';
import { logError, logInfo } from '../utils/logger';
import { deriveAnalysisScope, shouldForceWorkspaceOnly } from '../utils/scopeUtils';
import { Action } from './actions';
import { CockpitStore } from './store';
   ```
   </details>

3. 🔴 **[src/services/metricsService.ts](src/services/metricsService.ts)** (Score: 85.1)
   - Changed in 3/3 versions
   <details><summary>Preview</summary>

   ```typescript
   import { ensureDatabaseInitialized } from '../storage/database';
import { prepare } from '../storage/statement-wrapper';
import { NodeMetrics } from '../types/cockpit';
import { logError } from '../utils/logger';

export class MetricsService {
  private static instance: MetricsService;

  private constructor() {
    //empty
   ```
   </details>

4. 🔴 **[src/analysis/git.ts](src/analysis/git.ts)** (Score: 85.1)
   - Changed in 3/3 versions
   - Churn: +1853 / -790 lines
   <details><summary>Preview</summary>

   ```typescript
   import * as fs from 'fs';
import * as path from 'path';
import simpleGit, { SimpleGit } from 'simple-git';
import { CommitInfo, FileChange } from '../types';
import { withTimeout } from '../utils/async';
import { getGitRoot } from '../utils/config';
import { logDebug, logError, logWarn } from '../utils/logger';

export class GitOperations {
  private gitRoot: string;
   ```
   </details>

5. 🔴 **[src/webview/cockpit/services/AnalysisController.ts](src/webview/cockpit/services/AnalysisController.ts)** (Score: 85.1)
   - Changed in 3/3 versions
   - Churn: +781 / -799 lines
   <details><summary>Preview</summary>

   ```typescript
   import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { GitOperations } from '../../../analysis/git';
import { RefactorBundleFacts } from '../../../facts/types';
import { getAnalysisService } from '../../../services/analysisService';
import { getRefactorPipeline } from '../../../services/pipelineFactory';
import { getStore } from '../../../state/store';
import { BundleSummaryDTO } from '../../../types/cockpit';
import { withTimeout } from '../../../utils/async';
   ```
   </details>

6. 🔴 **[src/analysis/symbols.ts](src/analysis/symbols.ts)** (Score: 85.1)
   - Changed in 3/3 versions
   - Churn: +763 / -270 lines
   <details><summary>Preview</summary>

   ```typescript
   import * as vscode from 'vscode';
import { FileChange, SymbolDelta, SymbolDeltaChangeType, SymbolInfo } from '../types';
import { detectLanguage, getTestFilePattern } from '../utils/config';
import { logDebug, logInfo, logWarn } from '../utils/logger';
import { filterPath } from '../utils/pathFilter';
import { GitOperations } from './git';
import { SemanticChangeDetector } from './semanticChanges';
import { assignDNAIds } from './symbolDna';
import { getTreeSitterParser } from './tree-sitter';

   ```
   </details>

7. 🔴 **[src/analysis/symbolDna.ts](src/analysis/symbolDna.ts)** (Score: 85.1)
   - Changed in 3/3 versions
   - Churn: +637 / -524 lines
   <details><summary>Preview</summary>

   ```typescript
   import * as crypto from 'crypto';
import { SymbolInfo } from '../types';
import { HybridFact, isCstFact } from '../types/cstFacts';
import { getTreeSitterParser } from './tree-sitter';

/**
 * DNA Configuration
 */
export interface DnaConfig {
  maxDepth: number;
   ```
   </details>

8. 🔴 **[src/analysis/workspaceIndexer.ts](src/analysis/workspaceIndexer.ts)** (Score: 85.1)
   - Changed in 3/3 versions
   - Churn: +1354 / -500 lines
   <details><summary>Preview</summary>

   ```typescript
   import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import pLimit = require('p-limit');
import { Database } from 'sql.js';
import { prepare } from '../storage/statement-wrapper';
import { WorkspaceFacts } from '../types/workspace';
import { detectLanguage, getExtensionConfig, isCstOnlyLanguage } from '../utils/config';
import { logDebug, logError, logInfo } from '../utils/logger';
import { filterPath } from '../utils/pathFilter';
   ```
   </details>

9. 🔴 **[src/analysis/cstTimeline.ts](src/analysis/cstTimeline.ts)** (Score: 85.1)
   - Changed in 3/3 versions
   - Churn: +664 / -292 lines
   <details><summary>Preview</summary>

   ```typescript
   import { getDatabase } from '../storage/database';
import { prepare } from '../storage/statement-wrapper';
import { DeltaChange, HybridFact, isCstFact } from '../types/cstFacts';
import { logDebug, logError } from '../utils/logger';
import { computeHybridDna } from './symbolDna';
import type { ScopeSet } from '../facts/scope';

/**
 * Manager for CST timeline tracking (hybrid facts evolution)
 */
   ```
   </details>

10. 🔴 **[src/utils/pipelineDebugger.ts](src/utils/pipelineDebugger.ts)** (Score: 85.1)
   - Changed in 2/3 versions
   <details><summary>Preview</summary>

   ```typescript
   /* eslint-disable @typescript-eslint/no-explicit-any */
import { logDebug, logError, logWarn } from './logger';

interface TierTrace {
  frameId: string;
  tier: 1 | 2 | 3;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'pending' | 'success' | 'failed';
   ```
   </details>

#### 🎯 Top Symbol Hotspots

1. 🔴 **getWorkingContent** in [src/analysis/git.ts](src/analysis/git.ts) (Score: 82.7)

2. 🔴 **safeGetWorkingContent** in [src/analysis/git.ts](src/analysis/git.ts) (Score: 82.7)

3. 🔴 **isIgnored** in [src/analysis/git.ts](src/analysis/git.ts) (Score: 82.7)

4. 🔴 **isIgnoredAtCommit** in [src/analysis/git.ts](src/analysis/git.ts) (Score: 82.7)

5. 🔴 **getHeadSha** in [src/analysis/git.ts](src/analysis/git.ts) (Score: 82.7)

6. 🔴 **getBlobSha** in [src/analysis/git.ts](src/analysis/git.ts) (Score: 82.7)

7. 🔴 **getBlobSize** in [src/analysis/git.ts](src/analysis/git.ts) (Score: 82.7)

8. 🔴 **getCurrentBranch** in [src/analysis/git.ts](src/analysis/git.ts) (Score: 82.7)

9. 🔴 **getBranchCommits** in [src/analysis/git.ts](src/analysis/git.ts) (Score: 82.7)

10. 🔴 **isClean** in [src/analysis/git.ts](src/analysis/git.ts) (Score: 82.7)

### Wide Blast Radius

Commits that affect many symbols can have unintended consequences across the codebase.

1. 🔴 **Commit 75d3bdfd**

   - **Blast Radius:** 3835 symbols affected
   - **Files Changed:** 108
   - **Symbol Changes:** 185 added, 19 modified, 168 removed
   - **Structural Change:** 0%
   - **Risks:** schema-migration, refactor, security, performance, payment

2. 🔴 **Commit 26bfd617**

   - **Blast Radius:** 9511 symbols affected
   - **Files Changed:** 164
   - **Symbol Changes:** 482 added, 0 modified, 482 removed
   - **Structural Change:** 0%
   - **Risks:** schema-migration, refactor, security, performance, auth, payment

## High Priority Items

### Risky Changes

Commits flagged with specific risk patterns that require careful review.

#### 1. Commit 75d3bdfd

**Risk Flags:**
- 🗄️ `schema-migration`
- ♻️ `refactor`
- 🔒 `security`
- ⚡ `performance`
- 💳 `payment`

**Impact:**
- 108 files, 185A / 19M / 168D symbols
- Structural change: 0%

**Affected Hotspots:**
- 2eb37755b768c4e1 (impact: 214)
- 55222ed75af18c19 (impact: 198)
- 2a20a5a36214fe41 (impact: 196)
- ddd34238ce0e4523 (impact: 167)
- daca2697a02e94dc (impact: 145)

#### 2. Commit 26bfd617

**Risk Flags:**
- 🗄️ `schema-migration`
- ♻️ `refactor`
- 🔒 `security`
- ⚡ `performance`
- 🔐 `auth`
- 💳 `payment`

**Impact:**
- 164 files, 482A / 0M / 482D symbols
- Structural change: 0%

**Affected Hotspots:**
- 45434d58ce553a61 (impact: 214)
- f413bc12b8b746d8 (impact: 214)
- 610026479079c4e2 (impact: 199)
- 3d2a82fc6040f6b2 (impact: 196)
- 91b5771460cc5f33 (impact: 167)

### Missing Symbols

Symbols that were expected to be present but are not found in the current codebase.

1. 🟡 **isPublicSymbol** in `src/analysis/symbols.ts`
   - Missing since: 1 version ago (75d3bdf)
   - Last signature: `private isPublicSymbol(symbol: SymbolInfo): boolean`

2. 🟡 **SymbolExtractor** in `src/analysis/symbols.ts`
   - Missing since: 1 version ago (75d3bdf)
   - Last signature: `class SymbolExtractor`

3. 🟡 **extractCommitSymbols** in `src/analysis/symbols.ts`
   - Missing since: 1 version ago (75d3bdf)
   - Last signature: `async extractCommitSymbols(
    sha: string,
    files: FileChange[]
  ): Promise<`

4. 🟡 **extractFileSymbols** in `src/analysis/symbols.ts`
   - Missing since: 1 version ago (75d3bdf)
   - Last signature: `private async extractFileSymbols(
    sha: string,
    file: FileChange
  ): Promise<`

5. 🟡 **extractWorkingTreeSymbols** in `src/analysis/symbols.ts`
   - Missing since: 1 version ago (75d3bdf)
   - Last signature: `async extractWorkingTreeSymbols(
    files: FileChange[],
    options:`

6. 🟡 **extractWorkingTreeFileSymbols** in `src/analysis/symbols.ts`
   - Missing since: 1 version ago (75d3bdf)
   - Last signature: `private async extractWorkingTreeFileSymbols(
    file: FileChange,
    options:`

7. 🟡 **extractIncremental** in `src/analysis/symbols.ts`
   - Missing since: 1 version ago (75d3bdf)
   - Last signature: `public async extractIncremental(
    prevSymbols: SymbolInfo[],
    changes: vscode.TextDocumentContentChangeEvent[],
    content: string,
    path: string
  ): Promise<`

8. 🟡 **extractSymbolsFromContent** in `src/analysis/symbols.ts`
   - Missing since: 1 version ago (75d3bdf)
   - Last signature: `public async extractSymbolsFromContent(content: string, filePath: string): Promise<SymbolInfo[]>`

9. 🟡 **extractSymbolsWithBodies** in `src/analysis/symbols.ts`
   - Missing since: 1 version ago (75d3bdf)
   - Last signature: `async extractSymbolsWithBodies(
    content: string,
    filePath: string,
    _language: string
  ): Promise<`

10. 🟡 **extractBodyText** in `src/analysis/symbols.ts`
   - Missing since: 1 version ago (75d3bdf)
   - Last signature: `private extractBodyText(content: string, startLine: number, endLine: number): string`

11. 🟡 **compareSymbolSets** in `src/analysis/symbols.ts`
   - Missing since: 1 version ago (75d3bdf)
   - Last signature: `private compareSymbolSets(
    previous: SymbolInfo[],
    current: SymbolInfo[],
    _filePath: string
  ):`

12. 🟡 **shouldAnalyzeFile** in `src/analysis/symbols.ts`
   - Missing since: 1 version ago (75d3bdf)
   - Last signature: `private async shouldAnalyzeFile(filePath: string): Promise<boolean>`

13. 🟡 **extractStagedSymbols** in `src/analysis/symbols.ts`
   - Missing since: 1 version ago (75d3bdf)
   - Last signature: `async extractStagedSymbols(): Promise<`

14. 🟡 **MetricsService** in `src/services/metricsService.ts`
   - Missing since: 1 version ago (75d3bdf)
   - Last signature: `class MetricsService`

15. 🟡 **getNodeMetrics** in `src/services/metricsService.ts`
   - Missing since: 1 version ago (75d3bdf)
   - Last signature: `public async getNodeMetrics(
    filePaths: string[],
    since?: number
  ): Promise<Record<string, NodeMetrics>>`

## Code Quality Issues

### Drift Detection

Code that has diverged from its expected state or naming conventions.

#### Unresolved Calls

Calls to functions that cannot be resolved:

1. Call to `function_log` in unknown
   - Occurrences: 55, Severity: 1/10

2. Call to `function_join` in unknown
   - Occurrences: 22, Severity: 1/10

3. Call to `function_filter` in unknown
   - Occurrences: 7, Severity: 1/10

4. Call to `function_existsSync` in unknown
   - Occurrences: 9, Severity: 1/10

5. Call to `function_file` in unknown
   - Occurrences: 5, Severity: 1/10

6. Call to `function_warn` in unknown
   - Occurrences: 6, Severity: 1/10

7. Call to `method_log` in unknown
   - Occurrences: 55, Severity: 1/10

8. Call to `method_join` in unknown
   - Occurrences: 22, Severity: 1/10

9. Call to `method_filter` in unknown
   - Occurrences: 7, Severity: 1/10

10. Call to `method_existsSync` in unknown
   - Occurrences: 9, Severity: 1/10

### Legacy Code

## Appendix

### Analyzed Commits

#### 75d3bdfd3c49fbcb476deb8de43ac193806bc796
- Files changed: 108
- Symbols: 185A / 19M / 168D
- Edges: 8461A / 7404D
- Structural change: 0%
- Blast radius: 3835
- Risks: schema-migration, refactor, security, performance, payment

#### 26bfd6171667199783a886d7e10d2bf086301d13
- Files changed: 164
- Symbols: 482A / 0M / 482D
- Edges: 18952A / 19698D
- Structural change: 0%
- Blast radius: 9511
- Risks: schema-migration, refactor, security, performance, auth, payment
