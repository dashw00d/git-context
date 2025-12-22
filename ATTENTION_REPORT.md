# Code Attention Report

*Generated: 2025-12-04T12:52:01.050Z*

**Analysis scope:** 1 commits, 8 files

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
| 🔴 **Critical** | 50 | Files/symbols requiring immediate attention |
| 🟡 **High** | 1 | Important issues to address soon |
| 🔵 **Medium** | 0 | Code quality improvements |

## Critical Issues

### High Churn Hotspots

Files and symbols that change frequently are prone to bugs and hard to maintain.

#### 📁 Top File Hotspots

1. 🔴 **[src/webview/cockpit/services/MessageController.ts](src/webview/cockpit/services/MessageController.ts)** (Score: 85.1)
   - Churn: +1158 / -745 lines
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
   - Churn: +1960 / -809 lines
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
   - Churn: +978 / -799 lines
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

1. 🟡 **Commit 8153f303**

   - **Blast Radius:** 61 symbols affected
   - **Files Changed:** 8
   - **Symbol Changes:** 2 added, 0 modified, 2 removed
   - **Structural Change:** 0%

## High Priority Items

### Risky Changes

*No risky changes detected.*

### Missing Symbols

*No missing symbols detected.*

## Code Quality Issues

### Drift Detection

Code that has diverged from its expected state or naming conventions.

#### Unresolved Calls

Calls to functions that cannot be resolved:

1. Call to `get` in unknown
   - Occurrences: 14, Severity: 1/10

2. Call to `has` in unknown
   - Occurrences: 8, Severity: 1/10

3. Call to `has` in unknown
   - Occurrences: 6, Severity: 1/10

4. Call to `get` in unknown
   - Occurrences: 6, Severity: 1/10

5. Call to `from` in unknown
   - Occurrences: 6, Severity: 1/10

6. Call to `constructor` in unknown
   - Occurrences: 5, Severity: 1/10

7. Call to `now` in unknown
   - Occurrences: 8, Severity: 1/10

8. Call to `logDebug` in unknown
   - Occurrences: 6, Severity: 1/10

9. Call to `logInfo` in unknown
   - Occurrences: 13, Severity: 1/10

10. Call to `getCollectionName` in unknown
   - Occurrences: 6, Severity: 1/10

### Legacy Code

*No legacy code issues detected.*

## Appendix

### Analyzed Commits

#### 8153f303cdb616e40812be0522ce97fbc3aec674
- Files changed: 8
- Symbols: 2A / 0M / 2D
- Edges: 149A / 83D
- Structural change: 0%
- Blast radius: 61
