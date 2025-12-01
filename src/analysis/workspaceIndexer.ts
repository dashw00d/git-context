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
import type { HybridFact } from '../types/cstFacts';

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
            const headFileHash = await this.computeFileHashForFacts(filePath, headContent);
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
      // Parse file via worker
      const hybridFacts: HybridFact[] = await this.parser.extractHybridFacts(content, filePath, language, existingSymbols);

      // Save via timeline manager
      await this.cstTimelineManager.saveFacts(filePath, version, hybridFacts, prevHash);
      if (hybridFacts.length > 0) {
        logDebug(`[WorkspaceIndexer] Saved ${hybridFacts.length} hybrid facts for ${filePath}@${version}`);
      }
    } catch (error) {
      logDebug(`[WorkspaceIndexer] Error extracting hybrid facts for ${filePath}: ${error}`);
    }
  }

  /**
   * Compute file hash for facts (for delta tracking)
   */
  private async computeFileHashForFacts(
    filePath: string,
    content: string
  ): Promise<string | undefined> {
    const language = detectLanguage(filePath);
    if (!language) return undefined;

    try {
      // Use worker to extract facts for hash computation
      const hybridFacts: HybridFact[] = await this.parser.extractHybridFacts(content, filePath, language);
      const serialized = JSON.stringify(hybridFacts.map((f: any) => ({
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
  /**
   * Get the workspace file tree for the Explorer
   */
  async getWorkspaceTree(): Promise<any[]> {
    const allFiles = await this.git.getAllFiles();
    const gitRoot = this.git.getRoot();

    // Filter files
    const filteredFiles: string[] = [];
    for (const file of allFiles) {
      if (await filterPath(file, {
        git: this.git,
        gitRoot,
        status: 'M', // Dummy status for filtering
        skipSizeCheck: true
      })) {
        filteredFiles.push(file);
      }
    }

    // Build Tree
    const root: any[] = [];
    const map = new Map<string, any>();

    for (const filePath of filteredFiles) {
      const parts = filePath.split('/');
      let currentLevel = root;
      let currentPath = '';

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        let node = map.get(currentPath);
        if (!node) {
          node = {
            id: currentPath,
            name: part,
            type: isFile ? 'file' : 'folder',
            status: 'unknown', // Default status
            children: isFile ? [] : []
          };
          map.set(currentPath, node);
          currentLevel.push(node);
        }

        if (!isFile) {
          currentLevel = node.children;
        }
      }
    }

    // Sort: Folders first, then files, alphabetical
    const sortNodes = (nodes: any[]) => {
      nodes.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'folder' ? -1 : 1;
      });
      nodes.forEach(n => {
        if (n.children) sortNodes(n.children);
      });
    };
    sortNodes(root);

    return root;
  }
  /**
   * Get context data for a specific file (Tier 2: Metadata + Structure)
   */
  async getFileContext(filePath: string): Promise<any> {
    const gitRoot = this.git.getRoot();
    const fullPath = path.join(gitRoot, filePath);

    // 1. Basic Metadata
    let content = '';
    try {
      content = fs.readFileSync(fullPath, 'utf8');
    } catch {
      return null; // File not found
    }

    // 2. Git Metadata & Timeline
    let lastCommit = null;
    let timeline: any[] = [];

    try {
      // Fetch history
      timeline = await this.git.getFileHistory(filePath, 10);
      if (timeline.length > 0) {
        lastCommit = timeline[0];
      }

      // Check Staged Changes (Virtual Commit)
      const stagedFiles = await this.git.getStagedFiles();
      const stagedFile = stagedFiles.find(f => f.path === filePath);
      if (stagedFile) {
        timeline.unshift({
          hash: 'workspace-staged',
          author: 'You',
          date: new Date().toISOString(),
          message: 'Staged Changes',
          virtual: true,
          stats: { additions: 0, deletions: 0 } // TODO: Calculate stats
        });
      }

      // Check Unstaged Changes (Virtual Commit)
      const unstagedFiles = await this.git.getUnstagedFiles();
      const unstagedFile = unstagedFiles.find(f => f.path === filePath);
      if (unstagedFile) {
        timeline.unshift({
          hash: 'workspace-unstaged',
          author: 'You',
          date: new Date().toISOString(),
          message: 'Unstaged Changes',
          virtual: true,
          stats: { additions: 0, deletions: 0 } // TODO: Calculate stats
        });
      }

    } catch (e) {
      // Ignore git errors for new files
    }

    // 3. Symbols (CST)
    let symbols: any[] = [];
    const language = detectLanguage(filePath);
    if (language) {
      try {
        symbols = await this.parser.extractHybridFacts(content, filePath, language);
      } catch (e) {
        logDebug(`[WorkspaceIndexer] Failed to parse symbols for ${filePath}: ${e}`);
      }
    }

    return {
      id: filePath,
      language,
      size: content.length,
      lineCount: content.split('\n').length,
      lastModified: lastCommit?.date,
      lastAuthor: lastCommit?.author,
      timeline,
      content,
      blastRadius: await this.getBlastRadius(filePath, content),
      drift: this.detectDrift(symbols),
      symbols: symbols.map((s: any) => ({
        id: s.id,
        name: s.name,
        kind: s.kind,
        range: s.range,
        signature: s.signature
      }))
    };
  }

  /**
   * Simple naming drift detector
   */
  private detectDrift(symbols: any[]): any[] {
    const drift: any[] = [];

    for (const symbol of symbols) {
      if (symbol.kind === 'function' || symbol.kind === 'method') {
        // Expect camelCase
        if (!/^[a-z][a-zA-Z0-9]*$/.test(symbol.name)) {
          drift.push({
            symbol: symbol.name,
            issue: 'Naming Convention',
            detail: 'Should be camelCase',
            severity: 'medium'
          });
        }
      } else if (symbol.kind === 'class' || symbol.kind === 'interface') {
        // Expect PascalCase
        if (!/^[A-Z][a-zA-Z0-9]*$/.test(symbol.name)) {
          drift.push({
            symbol: symbol.name,
            issue: 'Naming Convention',
            detail: 'Should be PascalCase',
            severity: 'medium'
          });
        }
      }
    }
    return drift;
  }

  /**
   * Get context for the Bundle Stage (Heatmap)
   */
  async getBundleContext(config?: { mode: 'repo' | 'module' | 'changes' | 'custom'; roots: string[]; includeConnected: boolean; exclusions: string[] }): Promise<any> {
    // 1. Resolve Skeleton
    // Use the ContextSkeletonService to determine the exact list of files to analyze
    // based on the provided configuration (mode, roots, exclusions).
    const { ContextSkeletonService } = await import('../services/contextSkeleton');
    const skeletonService = new ContextSkeletonService();
    const skeleton = await skeletonService.resolveSkeleton(config || { mode: 'repo', roots: [], includeConnected: false, exclusions: [] });

    // 2. Get hotspots for resolved files
    // We need to filter hotspots by the files in the skeleton
    const hotspots = await this.git.getHotspots(20);
    const skeletonSet = new Set(skeleton.files);

    const filteredHotspots = hotspots.filter((h: any) => skeletonSet.has(h.path));

    // If 'changes' mode, ensure all changed files are included even if not in hotspots
    // This handles new files that haven't been committed yet.
    if (config?.mode === 'changes') {
      for (const file of skeleton.files) {
        if (!filteredHotspots.find(h => h.path === file)) {
          filteredHotspots.push({ path: file, count: 0, added: 0, removed: 0, size: undefined });
        }
      }
    }

    return {
      hotspots: filteredHotspots.map(h => ({
        path: h.path,
        score: h.count, // Churn count
        name: h.path.split('/').pop(),
        added: h.added,
        removed: h.removed,
        size: h.size
      })),
      scope: {
        files: skeleton.files.length,
        roots: skeleton.roots,
        mode: skeleton.mode
      }
    };
  }

  /**
   * Get the skeleton of files to be analyzed based on config
   */
  async getSkeleton(config: { mode: 'repo' | 'module' | 'changes' | 'custom'; roots: string[]; includeConnected: boolean; exclusions: string[] }): Promise<any> {
    const { ContextSkeletonService } = await import('../services/contextSkeleton');
    const skeletonService = new ContextSkeletonService();
    return skeletonService.resolveSkeleton(config);
  }

  /**
   * Simple regex-based import extractor for Blast Radius
   */
  private async getBlastRadius(filePath: string, content: string): Promise<any> {
    const imports: Set<string> = new Set();
    const basedir = path.dirname(filePath);

    // Regex for JS/TS imports
    const importRegex = /from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\)/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1] || match[2];
      if (importPath && importPath.startsWith('.')) {
        // Resolve relative path
        try {
          const resolved = path.resolve(basedir, importPath);
          // Try to find the file with extensions
          // This is a simplification; in reality we'd check file existence
          // For the prototype, we'll just return the resolved path relative to root if possible
          // But we need to map it back to workspace relative path
          // Let's just store the raw import for now, or try to resolve simple cases
          imports.add(importPath);
        } catch (e) {
          // ignore
        }
      }
    }

    return {
      outgoing: Array.from(imports).map(imp => ({
        target: imp,
        type: 'import'
      })),
      incoming: [] // TODO: Reverse index needed for incoming
    };
  }

  /**
   * Get context for a specific symbol
   */
  async getSymbolContext(symbolId: string): Promise<any> {
    // symbolId format: "path/to/file.ts::symbolName"
    const [filePath, symbolName] = symbolId.split('::');

    if (!filePath || !symbolName) return null;

    const content = await this.snapshotManager.getFileContent(filePath);
    if (!content) return null;

    // 1. Find symbol range
    const language = detectLanguage(filePath);
    let symbolRange = null;
    let symbolContent = '';

    if (language) {
      try {
        const symbols = await this.parser.extractHybridFacts(content, filePath, language);
        const symbol = symbols.find((s: any) => s.name === symbolName) as any;
        if (symbol && symbol.range) {
          symbolRange = symbol.range;
          // Extract content based on range (1-based lines)
          const lines = content.split('\n');
          symbolContent = lines.slice(symbol.range.start.line - 1, symbol.range.end.line).join('\n');
        }
      } catch (e) {
        // ignore
      }
    }

    if (!symbolContent) {
      return { id: symbolId, error: 'Symbol not found' };
    }

    // 2. Get history for this symbol (git log -L)
    // Note: git log -L requires start,end:file
    let history: any[] = [];
    if (symbolRange) {
      try {
        const { stdout } = await this.git.spawnGit([
          'log',
          '-L',
          `${symbolRange.start.line},${symbolRange.end.line}:${filePath}`,
          '--format=%h|%an|%aI|%s'
        ]);

        history = stdout.trim().split('\n').filter(Boolean).map(line => {
          const [hash, author, date, message] = line.split('|');
          return { hash, author, date, message };
        });
      } catch (e) {
        // git log -L can fail if lines don't match history, fallback to file history?
        // For now, just return empty
      }
    }

    return {
      id: symbolId,
      name: symbolName,
      filePath,
      content: symbolContent,
      range: symbolRange,
      history
    };
  }
}
