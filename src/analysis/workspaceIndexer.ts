import { GitOperations } from './git';
import { SnapshotManager } from './snapshotManager';
import { StructuralDiffManager } from './structuralDiffManager';
import { Database } from 'sql.js';
import { logDebug, logInfo } from '../utils/logger';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { getExtensionConfig, getSupportedExtensions, detectLanguage, isCstOnlyLanguage, createCustomIgnoreMatcher } from '../utils/config';
import { filterPath } from '../utils/pathFilter';
import { getCstTimelineManager } from './cstTimeline';
import { getTreeSitterParser } from './tree-sitter';
// p-limit is CommonJS; use require style to avoid default-import issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
import pLimit = require('p-limit');

export interface WorkspaceFacts {
  workspaceHash: string;
  headSha: string;
  symbolsAdded: number;
  symbolsModified: number;
  symbolsRemoved: number;
  edgesAdded: number;
  edgesRemoved: number;
  risks: string[];
  filesChanged: number;
  structuralChangeScore: number;
  blastRadius: number;
}

export class WorkspaceIndexer {
  private cstTimelineManager = getCstTimelineManager();
  private parser = getTreeSitterParser();

  constructor(
    private db: Database,
    private git: GitOperations,
    private snapshotManager: SnapshotManager,
    private structuralDiffManager: StructuralDiffManager
  ) { }

  /**
   * Analyze workspace overlay (staged or unstaged changes)
   */
  async analyzeWorkspace(mode: 'staged' | 'unstaged'): Promise<WorkspaceFacts | null> {
    const headSha = await this.git.getHeadSha();
    const changedFiles = mode === 'staged'
      ? await this.git.getStagedFiles()
      : await this.git.getUnstagedFiles();

    // Filter files using centralized path filter
    const gitRoot = this.git.getRoot();

    const filteredFiles = [];
    for (const file of changedFiles) {
      if (await filterPath(file.path, {
        git: this.git,
        gitRoot,
        status: file.status,
        skipSizeCheck: file.status === 'D'
      })) {
        filteredFiles.push(file);
      }
    }

    if (filteredFiles.length === 0) {
      return null;
    }

    // Compute CONTENT-AWARE workspace hash
    const workspaceHash = await this.computeWorkspaceHash(filteredFiles);

    // Check cache
    const cached = this.getCachedWorkspace(headSha, workspaceHash);
    if (cached) {
      logDebug(`[WorkspaceIndexer] Cache hit for ${mode} workspace`);
      return cached;
    }

    // Analyze changes with enhanced processing
    let totalAdded = 0;
    let totalModified = 0;
    let totalRemoved = 0;
    let totalEdgesAdded = 0;
    let totalEdgesRemoved = 0;
    let maxStructuralChange = 0;
    const allRisks: string[] = [];

    // Collect for blast radius calculation
    const changedSymbols: any[] = [];
    const allEdges: any[] = [];

    // Parallelize file processing with concurrency limit
    const limit = pLimit(8);
    const startTime = Date.now();
    const version = mode === 'staged' ? 'workspace-staged' : 'workspace-unstaged';

    const filePromises = filteredFiles.map(file =>
      limit(async () => {
        const { path: filePath, status } = file;

        try {
          if (status === 'D') {
            // FILE DELETED
            const headBlobSha = await this.git.getBlobSha('HEAD', filePath);
            const headContent = await this.git.safeGetFileContent('HEAD', filePath);
            const headSnapshot = await this.snapshotManager.getOrCreateSnapshot(
              filePath,
              headBlobSha,
              headContent
            );

            return {
              added: 0,
              modified: 0,
              removed: headSnapshot.symbols.length,
              edgesAdded: 0,
              edgesRemoved: headSnapshot.edges.length,
              symbols: headSnapshot.symbols,
              edges: headSnapshot.edges,
              risks: ['deletion'],
              structuralChange: 0
            };
          }

          // Get workspace content
          const fullPath = path.join(gitRoot, filePath);
          let workingContent: string;
          try {
            workingContent = fs.readFileSync(fullPath, 'utf8');
          } catch (error: any) {
            // Provide detailed error with path information
            throw new Error(
              `Failed to read workspace file "${filePath}" (resolved to "${fullPath}"): ${error.message}\n` +
              `This may indicate a git path parsing issue. File exists: ${fs.existsSync(fullPath)}`
            );
          }
          const workspaceBlobSha = 'WORKSPACE:' + crypto.createHash('sha256')
            .update(workingContent)
            .digest('hex');

          const workspaceSnapshot = await this.snapshotManager.getOrCreateSnapshot(
            filePath,
            workspaceBlobSha,
            workingContent
          );

          // Extract and save hybrid facts for workspace with mode-specific version
          await this.extractAndSaveHybridFacts(filePath, version, workingContent, workspaceSnapshot.symbols);

          if (status === 'A' || status === 'U') {
            // FILE ADDED or UNTRACKED (both don't exist at HEAD)
            return {
              added: workspaceSnapshot.symbols.length,
              modified: 0,
              removed: 0,
              edgesAdded: workspaceSnapshot.edges.length,
              edgesRemoved: 0,
              symbols: workspaceSnapshot.symbols,
              edges: workspaceSnapshot.edges,
              risks: [],
              structuralChange: 0
            };
          } else {
            // FILE MODIFIED (exists at HEAD)
            const headBlobSha = await this.git.getBlobSha('HEAD', filePath);
            const headContent = await this.git.safeGetFileContent('HEAD', filePath);
            const headSnapshot = await this.snapshotManager.getOrCreateSnapshot(
              filePath,
              headBlobSha,
              headContent
            );

            const diff = this.snapshotManager.compareSnapshots(headSnapshot, workspaceSnapshot);

            // Edge diff
            const headEdgeIds = new Set(headSnapshot.edges.map(e => `${e.from}-${e.to}`));
            const workspaceEdgeIds = new Set(workspaceSnapshot.edges.map(e => `${e.from}-${e.to}`));
            const edgesAdded = workspaceSnapshot.edges.filter(e => !headEdgeIds.has(`${e.from}-${e.to}`)).length;
            const edgesRemoved = headSnapshot.edges.filter(e => !workspaceEdgeIds.has(`${e.from}-${e.to}`)).length;

            // Structural diff (optional - can be slow for workspace)
            const structDiff = await this.structuralDiffManager.getOrCreateStructuralDiff(
              headBlobSha,
              workspaceBlobSha,
              filePath,
              headContent,
              workingContent
            );

            // Extract and save hybrid facts for modified workspace files with mode-specific version
            const headFileHash = await this.computeFileHashForFacts(filePath, 'HEAD', headContent);
            await this.extractAndSaveHybridFacts(filePath, version, workingContent, workspaceSnapshot.symbols, headFileHash);

            // Risk detection
            const risks: string[] = [];
            if (structDiff.interfaceChanged) risks.push('breaking-api');
            if (structDiff.controlFlowChanged) risks.push('refactor');

            return {
              added: diff.added.length,
              modified: diff.modified.length,
              removed: diff.removed.length,
              edgesAdded,
              edgesRemoved,
              symbols: [...diff.added, ...diff.modified.map(m => m.symbol), ...diff.removed],
              edges: workspaceSnapshot.edges,
              risks,
              structuralChange: structDiff.structuralChangeScore
            };
          }
        } catch (error: any) {
          logDebug(`[WorkspaceIndexer] Error processing ${filePath}: ${error.message}`);
          // Return empty result to allow other files to continue
          return {
            added: 0,
            modified: 0,
            removed: 0,
            edgesAdded: 0,
            edgesRemoved: 0,
            symbols: [],
            edges: [],
            risks: [],
            structuralChange: 0
          };
        }
      })
    );

    const fileResults = await Promise.all(filePromises);
    const duration = Date.now() - startTime;
    logInfo(`[WorkspaceIndexer] Processed ${filteredFiles.length} files in ${duration}ms (${(filteredFiles.length / (duration / 1000)).toFixed(1)} files/sec)`);

    // Aggregate results
    for (const result of fileResults) {
      totalAdded += result.added;
      totalModified += result.modified;
      totalRemoved += result.removed;
      totalEdgesAdded += result.edgesAdded;
      totalEdgesRemoved += result.edgesRemoved;
      changedSymbols.push(...result.symbols);
      allEdges.push(...result.edges);
      allRisks.push(...result.risks);
      maxStructuralChange = Math.max(maxStructuralChange, result.structuralChange);
    }

    // Calculate blast radius
    const blastRadiusResult = this.calculateBlastRadius(changedSymbols, allEdges);
    const totalImpact = Array.from(blastRadiusResult.impactScore.values()).reduce((a, b) => a + b, 0);

    // Flush any pending snapshot and diff writes
    this.snapshotManager.flushSnapshotQueue();
    this.structuralDiffManager.flushDiffQueue();

    const facts: WorkspaceFacts = {
      workspaceHash,
      headSha,
      symbolsAdded: totalAdded,
      symbolsModified: totalModified,
      symbolsRemoved: totalRemoved,
      edgesAdded: totalEdgesAdded,
      edgesRemoved: totalEdgesRemoved,
      risks: [...new Set(allRisks)],
      filesChanged: changedFiles.length,
      structuralChangeScore: maxStructuralChange,
      blastRadius: totalImpact
    };

    // Cache result
    this.cacheWorkspace(facts);

    return facts;
  }


  /**
   * Content-aware workspace hash (includes file content hashes)
   */
  private async computeWorkspaceHash(files: any[]): Promise<string> {
    const fileHashes = await Promise.all(
      files.map(async (f) => {
        if (f.status === 'D') {
          return `${f.path}:deleted`;
        }

        try {
          const gitRoot = this.git.getRoot();
          const fullPath = path.join(gitRoot, f.path);

          // Check if it's a file (not a directory)
          const stats = fs.statSync(fullPath);
          if (!stats.isFile()) {
            return `${f.path}:${f.status}:directory`;
          }

          const content = fs.readFileSync(fullPath, 'utf8');
          const hash = crypto.createHash('sha256')
            .update(content)
            .digest('hex')
            .substring(0, 8);
          return `${f.path}:${f.status}:${hash}`;
        } catch {
          return `${f.path}:${f.status}:error`;
        }
      })
    );

    const combined = fileHashes.sort().join('|');
    return crypto.createHash('sha256')
      .update(combined)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Calculate blast radius for workspace changes
   */
  private calculateBlastRadius(changedSymbols: any[], allEdges: any[]): { impactScore: Map<string, number> } {
    const impactScore = new Map<string, number>();

    // Simple blast radius calculation based on edge connectivity
    for (const symbol of changedSymbols) {
      const symbolId = symbol.dnaId || symbol.id;

      // Direct impact
      impactScore.set(symbolId, (impactScore.get(symbolId) || 0) + 10);

      // Indirect impact through edges
      const connectedSymbols = new Set<string>();
      for (const edge of allEdges) {
        if (edge.from === symbolId) {
          connectedSymbols.add(edge.to);
        } else if (edge.to === symbolId) {
          connectedSymbols.add(edge.from);
        }
      }

      // Secondary impact (reduced weight)
      for (const connectedId of connectedSymbols) {
        impactScore.set(connectedId, (impactScore.get(connectedId) || 0) + 5);
      }
    }

    return { impactScore };
  }

  private getCachedWorkspace(headSha: string, workspaceHash: string): WorkspaceFacts | null {
    const stmt = this.db.prepare(`
      SELECT * FROM workspace_analysis
      WHERE head_sha = ? AND workspace_hash = ?
    `);
    const row = stmt.get([headSha, workspaceHash]) as any;
    if (!row) return null;

    return {
      workspaceHash: row.workspace_hash,
      headSha: row.head_sha,
      symbolsAdded: row.symbols_added || 0,
      symbolsModified: row.symbols_modified || 0,
      symbolsRemoved: row.symbols_removed || 0,
      edgesAdded: row.edges_added || 0,
      edgesRemoved: row.edges_removed || 0,
      risks: row.risks ? JSON.parse(row.risks) : [],
      filesChanged: row.files_changed || 0,
      structuralChangeScore: row.structural_change_score || 0,
      blastRadius: row.blast_radius || 0
    };
  }

  private cacheWorkspace(facts: WorkspaceFacts): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO workspace_analysis
      (head_sha, workspace_hash, symbols_added, symbols_modified, symbols_removed,
       edges_added, edges_removed, risks, files_changed, structural_change_score,
       blast_radius, analyzed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run([
      facts.headSha,
      facts.workspaceHash,
      facts.symbolsAdded,
      facts.symbolsModified,
      facts.symbolsRemoved,
      facts.edgesAdded,
      facts.edgesRemoved,
      JSON.stringify(facts.risks),
      facts.filesChanged,
      facts.structuralChangeScore,
      facts.blastRadius,
      new Date().toISOString()
    ]);
  }

  /**
   * Extract and save hybrid facts for workspace file
   */
  private async extractAndSaveHybridFacts(
    filePath: string,
    version: string,
    content: string,
    existingSymbols: any[],
    prevHash?: string
  ): Promise<void> {
    const config = getExtensionConfig();
    const enableCst = config.enableCstTracking ?? true;
    const enableAugment = config.enableCstAugmentation ?? false;

    if (!enableCst && !enableAugment) {
      return;
    }

    const language = detectLanguage(filePath);
    if (!language) return;

    const isCstOnly = isCstOnlyLanguage(language);
    if (!isCstOnly && !enableAugment) {
      return;
    }

    try {
      const tree = await this.parser.parse(content, language);
      if (!tree) return;

      const hybridFacts = this.parser.extractHybridFacts(tree, filePath, language);
      await this.cstTimelineManager.saveFacts(filePath, version, hybridFacts, prevHash);
      if (hybridFacts.length > 0) {
        logDebug(`[WorkspaceIndexer] Saved ${hybridFacts.length} hybrid facts for ${filePath}@${version}`);
      }
    } catch (error) {
      logDebug(`[WorkspaceIndexer] Error extracting hybrid facts for ${filePath}: ${error}`);
    }
  }

  /**
   * Compute file hash for facts
   */
  private async computeFileHashForFacts(
    filePath: string,
    version: string,
    content: string
  ): Promise<string | undefined> {
    const language = detectLanguage(filePath);
    if (!language) return undefined;

    try {
      const tree = await this.parser.parse(content, language);
      if (!tree) return undefined;

      const hybridFacts = this.parser.extractHybridFacts(tree, filePath, language);
      const serialized = JSON.stringify(hybridFacts.map(f => ({
        id: f.id,
        dnaId: f.dnaId,
        name: f.name,
        kind: f.kind
      })));
      return crypto.createHash('sha256')
        .update(serialized)
        .digest('hex')
        .substring(0, 16);
    } catch (error) {
      logDebug(`[WorkspaceIndexer] Error computing file hash for ${filePath}: ${error}`);
      return undefined;
    }
  }
}
