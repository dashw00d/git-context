import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Database } from 'sql.js';
import { prepare } from '../storage/statement-wrapper';
import type { HybridFact } from '../types/cstFacts';
import { detectLanguage, getExtensionConfig, isCstOnlyLanguage } from '../utils/config';
import { logDebug, logError, logInfo } from '../utils/logger';
import { filterPath } from '../utils/pathFilter';
import { getCstTimelineManager } from './cstTimeline';
import { GitOperations } from './git';
import { SnapshotManager } from './snapshotManager';
import { StructuralDiffManager } from './structuralDiffManager';
import { getTreeSitterParser } from './tree-sitter';
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
  incoming?: Map<string, string[]>;
  outgoing?: Map<string, string[]>;
}

export class WorkspaceIndexer {
  private cstTimelineManager = getCstTimelineManager();
  private parser = getTreeSitterParser();

  constructor(
    private db: Database,
    private git: GitOperations,
    private snapshotManager: SnapshotManager,
    private structuralDiffManager: StructuralDiffManager
  ) {
    //empty
  }

  /**
   * Analyze workspace overlay (staged or unstaged changes)
   */
  async analyzeWorkspace(mode: 'staged' | 'unstaged'): Promise<WorkspaceFacts | null> {
    const headSha = await this.git.getHeadSha();
    const changedFiles =
      mode === 'staged' ? await this.git.getStagedFiles() : await this.git.getUnstagedFiles();

    const gitRoot = this.git.getRoot();

    const filteredFiles = [];
    for (const file of changedFiles) {
      if (
        await filterPath(file.path, {
          git: this.git,
          gitRoot,
          status: file.status,
          skipSizeCheck: file.status === 'D',
        })
      ) {
        filteredFiles.push(file);
      }
    }

    if (filteredFiles.length === 0) {
      return null;
    }

    const workspaceHash = await this.computeWorkspaceHash(filteredFiles);

    const cached = this.getCachedWorkspace(headSha, workspaceHash);
    if (cached) {
      logDebug(`[WorkspaceIndexer] Cache hit for ${mode} workspace`);
      return cached;
    }

    let totalAdded = 0;
    let totalModified = 0;
    let totalRemoved = 0;
    let totalEdgesAdded = 0;
    let totalEdgesRemoved = 0;
    let maxStructuralChange = 0;
    const allRisks: string[] = [];

    const changedSymbols: any[] = [];
    const allEdges: any[] = [];

    const limit = pLimit(8);
    const startTime = Date.now();
    const version = mode === 'staged' ? 'workspace-staged' : 'workspace-unstaged';

    const filePromises = filteredFiles.map(file =>
      limit(async () => {
        const { path: filePath, status } = file;

        try {
          if (status === 'D') {
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
              structuralChange: 0,
            };
          }

          const fullPath = path.join(gitRoot, filePath);
          let workingContent: string;
          try {
            if (mode === 'staged') {
              workingContent = await this.git.safeGetStagedContent(filePath);
            } else {
              workingContent = fs.readFileSync(fullPath, 'utf8');
            }
          } catch (error: any) {
            logError(
              `Failed to read workspace file "${filePath}" (resolved to "${fullPath}"): ${error.message}\n` +
                `This may indicate a git path parsing issue. File exists: ${fs.existsSync(
                  fullPath
                )}`
            );

            return {
              added: 0,
              modified: 0,
              removed: 0,
              edgesAdded: 0,
              edgesRemoved: 0,
              symbols: [],
              edges: [],
              risks: ['read_error'],
              structuralChange: 0,
            };
          }
          const workspaceBlobSha =
            'WORKSPACE:' + crypto.createHash('sha256').update(workingContent).digest('hex');

          const workspaceSnapshot = await this.snapshotManager.getOrCreateSnapshot(
            filePath,
            workspaceBlobSha,
            workingContent
          );

          await this.extractAndSaveHybridFacts(
            filePath,
            version,
            workingContent,
            workspaceSnapshot.symbols
          );

          if (status === 'A' || status === 'U') {
            return {
              added: workspaceSnapshot.symbols.length,
              modified: 0,
              removed: 0,
              edgesAdded: workspaceSnapshot.edges.length,
              edgesRemoved: 0,
              symbols: workspaceSnapshot.symbols,
              edges: workspaceSnapshot.edges,
              risks: [],
              structuralChange: 0,
            };
          } else {
            const headBlobSha = await this.git.getBlobSha('HEAD', filePath);
            const headContent = await this.git.safeGetFileContent('HEAD', filePath);
            const headSnapshot = await this.snapshotManager.getOrCreateSnapshot(
              filePath,
              headBlobSha,
              headContent
            );

            const diff = this.snapshotManager.compareSnapshots(headSnapshot, workspaceSnapshot);

            const headEdgeIds = new Set(headSnapshot.edges.map(e => `${e.from}-${e.to}`));
            const workspaceEdgeIds = new Set(workspaceSnapshot.edges.map(e => `${e.from}-${e.to}`));
            const edgesAdded = workspaceSnapshot.edges.filter(
              e => !headEdgeIds.has(`${e.from}-${e.to}`)
            ).length;
            const edgesRemoved = headSnapshot.edges.filter(
              e => !workspaceEdgeIds.has(`${e.from}-${e.to}`)
            ).length;

            const structDiff = await this.structuralDiffManager.getOrCreateStructuralDiff(
              headBlobSha,
              workspaceBlobSha,
              filePath,
              headContent,
              workingContent
            );

            const headFileHash = await this.computeFileHashForFacts(filePath, headContent);
            await this.extractAndSaveHybridFacts(
              filePath,
              version,
              workingContent,
              workspaceSnapshot.symbols,
              headFileHash
            );

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
              structuralChange: structDiff.structuralChangeScore,
            };
          }
        } catch (error: any) {
          logDebug(`[WorkspaceIndexer] Error processing ${filePath}: ${error.message}`);

          return {
            added: 0,
            modified: 0,
            removed: 0,
            edgesAdded: 0,
            edgesRemoved: 0,
            symbols: [],
            edges: [],
            risks: [],
            structuralChange: 0,
          };
        }
      })
    );

    const fileResults = await Promise.all(filePromises);
    const duration = Date.now() - startTime;
    logInfo(
      `[WorkspaceIndexer] Processed ${filteredFiles.length} files in ${duration}ms (${(
        filteredFiles.length /
        (duration / 1000)
      ).toFixed(1)} files/sec)`
    );

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

    const blastRadiusResult = this.calculateBlastRadius(changedSymbols, allEdges);
    const totalImpact = Array.from(blastRadiusResult.impactScore.values()).reduce(
      (a, b) => a + b,
      0
    );

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
      blastRadius: totalImpact,
      incoming: blastRadiusResult.incoming,
      outgoing: blastRadiusResult.outgoing,
    };

    this.cacheWorkspace(facts);

    return facts;
  }

  /**
   * Content-aware workspace hash (includes file content hashes)
   */
  private async computeWorkspaceHash(files: any[]): Promise<string> {
    const fileHashes = await Promise.all(
      files.map(async f => {
        if (f.status === 'D') {
          return `${f.path}:deleted`;
        }

        try {
          const gitRoot = this.git.getRoot();
          const fullPath = path.join(gitRoot, f.path);

          const stats = fs.statSync(fullPath);
          if (!stats.isFile()) {
            return `${f.path}:${f.status}:directory`;
          }

          const content = fs.readFileSync(fullPath, 'utf8');
          const hash = crypto.createHash('sha256').update(content).digest('hex').substring(0, 8);
          return `${f.path}:${f.status}:${hash}`;
        } catch {
          return `${f.path}:${f.status}:error`;
        }
      })
    );

    const combined = fileHashes.sort().join('|');
    return crypto.createHash('sha256').update(combined).digest('hex').substring(0, 16);
  }

  /**
   * Calculate blast radius for workspace changes with reverse edge index
   */
  private calculateBlastRadius(
    changedSymbols: any[],
    allEdges: any[]
  ): {
    impactScore: Map<string, number>;
    incoming: Map<string, string[]>;
    outgoing: Map<string, string[]>;
  } {
    const impactScore = new Map<string, number>();
    const incoming = new Map<string, string[]>();
    const outgoing = new Map<string, string[]>();

    for (const edge of allEdges) {
      const fromId = edge.from;
      const toId = edge.to;

      if (!outgoing.has(fromId)) {
        outgoing.set(fromId, []);
      }
      outgoing.get(fromId)!.push(toId);

      if (!incoming.has(toId)) {
        incoming.set(toId, []);
      }
      incoming.get(toId)!.push(fromId);
    }

    for (const symbol of changedSymbols) {
      const symbolId = symbol.id; // id is now the DNA hash

      impactScore.set(symbolId, (impactScore.get(symbolId) || 0) + 10);

      const connectedSymbols = outgoing.get(symbolId) || [];

      for (const connectedId of connectedSymbols) {
        impactScore.set(connectedId, (impactScore.get(connectedId) || 0) + 5);
      }

      const dependentSymbols = incoming.get(symbolId) || [];
      for (const dependentId of dependentSymbols) {
        impactScore.set(dependentId, (impactScore.get(dependentId) || 0) + 3);
      }
    }

    return { impactScore, incoming, outgoing };
  }

  private getCachedWorkspace(headSha: string, workspaceHash: string): WorkspaceFacts | null {
    const stmt = prepare(`
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
      blastRadius: row.blast_radius || 0,
    };
  }

  private cacheWorkspace(facts: WorkspaceFacts): void {
    const stmt = prepare(`
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
      new Date().toISOString(),
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
      const hybridFacts: HybridFact[] = await this.parser.extractHybridFacts(
        content,
        filePath,
        language,
        existingSymbols
      );

      await this.cstTimelineManager.saveFacts(filePath, version, hybridFacts, prevHash);
      if (hybridFacts.length > 0) {
        logDebug(
          `[WorkspaceIndexer] Saved ${hybridFacts.length} hybrid facts for ${filePath}@${version}`
        );
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
      const hybridFacts: HybridFact[] = await this.parser.extractHybridFacts(
        content,
        filePath,
        language
      );
      const serialized = JSON.stringify(
        hybridFacts.map((f: any) => ({
          id: f.id,
          dnaId: f.dnaId,
          name: f.name,
          kind: f.kind,
        }))
      );
      return crypto.createHash('sha256').update(serialized).digest('hex').substring(0, 16);
    } catch (error) {
      logDebug(`[WorkspaceIndexer] Error computing file hash for ${filePath}: ${error}`);
      return undefined;
    }
  }
  /**
   * Get the workspace file tree for the Explorer
   */
  async getWorkspaceTree(): Promise<any[]> {
    const allFiles = await this.git.getAllFiles(); // Already excludes ignored files via --exclude-standard
    const gitRoot = this.git.getRoot();

    const filteredFiles: string[] = [];
    for (const file of allFiles) {
      if (
        await filterPath(file, {
          git: this.git,
          gitRoot,
          status: 'M',
          skipSizeCheck: true,
          skipGitIgnore: true, // Skip redundant check since getAllFiles() already excluded ignored files
        })
      ) {
        filteredFiles.push(file);
      }
    }

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
            status: 'unknown',
            children: isFile ? [] : [],
          };
          map.set(currentPath, node);
          currentLevel.push(node);
        }

        if (!isFile) {
          currentLevel = node.children;
        }
      }
    }

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

    let content = '';
    try {
      content = fs.readFileSync(fullPath, 'utf8');
    } catch {
      return null;
    }

    let lastCommit = null;
    let timeline: any[] = [];

    try {
      timeline = await this.git.getFileHistory(filePath, 10);
      if (timeline.length > 0) {
        lastCommit = timeline[0];
      }

      const stagedFiles = await this.git.getStagedFiles();
      const stagedFile = stagedFiles.find(f => f.path === filePath);
      if (stagedFile) {
        const stats = await this.git.getFileDiffStats(filePath, true);
        timeline.unshift({
          hash: 'workspace-staged',
          author: 'You',
          date: new Date().toISOString(),
          message: 'Staged Changes',
          virtual: true,
          stats: { additions: stats.added, deletions: stats.removed },
        });
      }

      const unstagedFiles = await this.git.getUnstagedFiles();
      const unstagedFile = unstagedFiles.find(f => f.path === filePath);
      if (unstagedFile) {
        const stats = await this.git.getFileDiffStats(filePath, false);
        timeline.unshift({
          hash: 'workspace-unstaged',
          author: 'You',
          date: new Date().toISOString(),
          message: 'Unstaged Changes',
          virtual: true,
          stats: { additions: stats.added, deletions: stats.removed },
        });
      }
    } catch (e) {
      //empty
    }

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
        signature: s.signature,
      })),
    };
  }

  /**
   * Simple naming drift detector
   */
  private detectDrift(symbols: any[]): any[] {
    const drift: any[] = [];

    for (const symbol of symbols) {
      if (symbol.kind === 'function' || symbol.kind === 'method') {
        if (!/^[a-z][a-zA-Z0-9]*$/.test(symbol.name)) {
          drift.push({
            symbol: symbol.name,
            issue: 'Naming Convention',
            detail: 'Should be camelCase',
            severity: 'medium',
          });
        }
      } else if (symbol.kind === 'class' || symbol.kind === 'interface') {
        if (!/^[A-Z][a-zA-Z0-9]*$/.test(symbol.name)) {
          drift.push({
            symbol: symbol.name,
            issue: 'Naming Convention',
            detail: 'Should be PascalCase',
            severity: 'medium',
          });
        }
      }
    }
    return drift;
  }

  /**
   * Get context for the Bundle Stage (Heatmap)
   */
  async getBundleContext(config?: {
    mode: 'repo' | 'module' | 'changes' | 'custom';
    roots: string[];
    includeConnected: boolean;
    exclusions: string[];
  }): Promise<any> {
    const { ContextSkeletonService } = await import('../services/contextSkeleton');
    const skeletonService = new ContextSkeletonService();
    const skeleton = await skeletonService.resolveSkeleton(
      config || {
        mode: 'repo',
        roots: [],
        includeConnected: false,
        exclusions: [],
      }
    );

    const hotspots = await this.git.getHotspots(20);
    const skeletonSet = new Set(skeleton.files);

    const filteredHotspots = hotspots.filter((h: any) => skeletonSet.has(h.path));

    if (config?.mode === 'changes') {
      for (const file of skeleton.files) {
        if (!filteredHotspots.find(h => h.path === file)) {
          filteredHotspots.push({
            path: file,
            count: 0,
            added: 0,
            removed: 0,
            size: undefined,
          });
        }
      }
    }

    return {
      hotspots: filteredHotspots.map(h => ({
        path: h.path,
        score: h.count,
        name: h.path.split('/').pop(),
        added: h.added,
        removed: h.removed,
        size: h.size,
      })),
      scope: {
        files: skeleton.files.length,
        roots: skeleton.roots,
        mode: skeleton.mode,
      },
    };
  }

  /**
   * Get the skeleton of files to be analyzed based on config
   */
  async getSkeleton(config: {
    mode: 'repo' | 'module' | 'changes' | 'custom';
    roots: string[];
    includeConnected: boolean;
    exclusions: string[];
  }): Promise<any> {
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

    const importRegex = /from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\)/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1] || match[2];
      if (importPath && importPath.startsWith('.')) {
        try {
          const _resolved = path.resolve(basedir, importPath);

          imports.add(importPath);
        } catch (e) {
          //empty
        }
      }
    }

    return {
      outgoing: Array.from(imports).map(imp => ({
        target: imp,
        type: 'import',
      })),
      incoming: [], // TODO: Reverse index needed for incoming
    };
  }

  /**
   * Quick scan for symbols in a list of files (for initial explorer population)
   * Returns full symbol objects with id, name, kind, signature, location, and filePath
   */
  async quickScanSymbols(files: string[]): Promise<any[]> {
    const limit = pLimit(10); // Concurrent processing
    const gitRoot = this.git.getRoot();
    const results: any[] = [];

    await Promise.all(
      files.map(filePath =>
        limit(async () => {
          try {
            const fullPath = path.join(gitRoot, filePath);
            const content = fs.readFileSync(fullPath, 'utf8');
            const language = detectLanguage(filePath);

            if (language) {
              const symbols = await this.parser.extractHybridFacts(content, filePath, language);
              // Filter to only symbol kinds (functions, classes, etc.)
              const symbolKinds = new Set([
                'function',
                'method',
                'class',
                'const',
                'variable',
                'interface',
                'enum',
                'module',
                'type',
                'type_alias',
              ]);
              const filteredSymbols = symbols.filter((s: any) => symbolKinds.has(s.kind));

              // Store full symbol objects with filePath
              filteredSymbols.forEach((s: any) => {
                results.push({
                  id: s.id,
                  name: s.name,
                  kind: s.kind,
                  signature: s.signature,
                  location: s.location,
                  filePath: filePath,
                });
              });
            }
          } catch (e) {
            // Ignore errors during quick scan
          }
        })
      )
    );

    return results;
  }

  async getSymbolContext(symbolId: string): Promise<any> {
    const [filePath, symbolName] = symbolId.split('::');

    if (!filePath || !symbolName) return null;

    const content = await this.snapshotManager.getFileContent(filePath);
    if (!content) return null;

    const language = detectLanguage(filePath);
    let symbolRange = null;
    let symbolContent = '';

    if (language) {
      try {
        const symbols = await this.parser.extractHybridFacts(content, filePath, language);
        const symbol = symbols.find((s: any) => s.name === symbolName) as any;
        if (symbol && symbol.range) {
          symbolRange = symbol.range;

          const lines = content.split('\n');
          symbolContent = lines
            .slice(symbol.range.start.line - 1, symbol.range.end.line)
            .join('\n');
        }
      } catch (e) {
        //empty
      }
    }

    if (!symbolContent) {
      return { id: symbolId, error: 'Symbol not found' };
    }

    let history: any[] = [];
    if (symbolRange) {
      try {
        const { stdout } = await this.git.spawnGit([
          'log',
          '-L',
          `${symbolRange.start.line},${symbolRange.end.line}:${filePath}`,
          '--format=%h|%an|%aI|%s',
        ]);

        history = stdout
          .trim()
          .split('\n')
          .filter(Boolean)
          .map(line => {
            const [hash, author, date, message] = line.split('|');
            return { hash, author, date, message };
          });
      } catch (e) {
        //empty
      }
    }

    return {
      id: symbolId,
      name: symbolName,
      filePath,
      content: symbolContent,
      range: symbolRange,
      history,
    };
  }
}
