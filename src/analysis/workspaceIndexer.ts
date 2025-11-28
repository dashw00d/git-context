import { GitOperations } from './git';
import { SnapshotManager } from './snapshotManager';
import { StructuralDiffManager } from './structuralDiffManager';
import { Database } from 'sql.js';
import { logDebug } from '../utils/logger';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { getExtensionConfig, getSupportedExtensions, detectLanguage, isCstOnlyLanguage } from '../utils/config';
import { getCstTimelineManager } from './cstTimeline';
import { getTreeSitterParser } from './tree-sitter';

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
    const headSha = this.git.getHeadSha();
    const changedFiles = mode === 'staged'
      ? await this.git.getStagedFiles()
      : await this.git.getUnstagedFiles();

    // Filter files
    const config = getExtensionConfig();
    const allowedExtensions = new Set(config.allowedExtensions || getSupportedExtensions());
    // maxFileSize should always have a default from package.json via getExtensionConfig
    const maxFileSize = config.maxFileSize ?? 102400;
    const gitRoot = this.git.getRoot();

    const filteredFiles = changedFiles.filter(file => {
      const { path: filePath, status } = file;

      // 0. Validate file path
      if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') {
        logDebug(`[WorkspaceIndexer] Skipping invalid file path: ${JSON.stringify(file)}`);
        return false;
      }

      // 1. Check extension
      const ext = path.extname(filePath).slice(1).toLowerCase();
      if (!allowedExtensions.has(ext)) return false;

      // 2. Check if ignored
      if (this.git.isIgnored(filePath)) return false;

      // 3. Check file size (if not deleted)
      if (status !== 'D') {
        try {
          const fullPath = path.join(gitRoot, filePath);
          if (fs.existsSync(fullPath)) {
            const stats = fs.statSync(fullPath);
            if (stats.size > maxFileSize) return false;
          }
        } catch (e) {
          return false;
        }
      }
      return true;
    });

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

    for (const file of filteredFiles) {
      const { path: filePath, status } = file;

      if (status === 'D') {
        // FILE DELETED
        const headBlobSha = this.git.getBlobSha('HEAD', filePath);
        const headContent = this.git.safeGetFileContent('HEAD', filePath);
        const headSnapshot = await this.snapshotManager.getOrCreateSnapshot(
          filePath,
          headBlobSha,
          headContent
        );

        totalRemoved += headSnapshot.symbols.length;
        totalEdgesRemoved += headSnapshot.edges.length;

        // Track removed symbols for blast radius
        changedSymbols.push(...headSnapshot.symbols);
        allEdges.push(...headSnapshot.edges);

        allRisks.push('deletion');
        continue;
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

      // Extract and save hybrid facts for workspace
      await this.extractAndSaveHybridFacts(filePath, 'workspace', workingContent, workspaceSnapshot.symbols);

      // Collect edges for blast radius
      allEdges.push(...workspaceSnapshot.edges);

      if (status === 'A' || status === 'U') {
        // FILE ADDED or UNTRACKED (both don't exist at HEAD)
        totalAdded += workspaceSnapshot.symbols.length;
        totalEdgesAdded += workspaceSnapshot.edges.length;

        // Track added symbols
        changedSymbols.push(...workspaceSnapshot.symbols);
      } else {
        // FILE MODIFIED (exists at HEAD)
        const headBlobSha = this.git.getBlobSha('HEAD', filePath);
        const headContent = this.git.safeGetFileContent('HEAD', filePath);
        const headSnapshot = await this.snapshotManager.getOrCreateSnapshot(
          filePath,
          headBlobSha,
          headContent
        );

        const diff = this.snapshotManager.compareSnapshots(headSnapshot, workspaceSnapshot);
        totalAdded += diff.added.length;
        totalModified += diff.modified.length;
        totalRemoved += diff.removed.length;

        // Track all changed symbols
        changedSymbols.push(...diff.added);
        changedSymbols.push(...diff.modified.map(m => m.symbol));
        changedSymbols.push(...diff.removed);

        // Edge diff
        const headEdgeIds = new Set(headSnapshot.edges.map(e => `${e.from}-${e.to}`));
        const workspaceEdgeIds = new Set(workspaceSnapshot.edges.map(e => `${e.from}-${e.to}`));
        totalEdgesAdded += workspaceSnapshot.edges.filter(e => !headEdgeIds.has(`${e.from}-${e.to}`)).length;
        totalEdgesRemoved += headSnapshot.edges.filter(e => !workspaceEdgeIds.has(`${e.from}-${e.to}`)).length;

        // Structural diff (optional - can be slow for workspace)
        const structDiff = await this.structuralDiffManager.getOrCreateStructuralDiff(
          headBlobSha,
          workspaceBlobSha,
          filePath,
          headContent,
          workingContent
        );

        maxStructuralChange = Math.max(maxStructuralChange, structDiff.structuralChangeScore);

        // Extract and save hybrid facts for modified workspace files
        const headFileHash = await this.computeFileHashForFacts(filePath, 'HEAD', headContent, headSnapshot.symbols);
        await this.extractAndSaveHybridFacts(filePath, 'workspace', workingContent, workspaceSnapshot.symbols, headFileHash);

        // Risk detection
        if (structDiff.interfaceChanged) allRisks.push('breaking-api');
        if (structDiff.controlFlowChanged) allRisks.push('refactor');
      }
    }

    // Calculate blast radius
    const blastRadiusResult = this.calculateBlastRadius(changedSymbols, allEdges);
    const totalImpact = Array.from(blastRadiusResult.impactScore.values()).reduce((a, b) => a + b, 0);

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
    content: string,
    existingSymbols: any[]
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
