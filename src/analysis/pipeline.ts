import * as fs from 'fs';
import * as path from 'path';
import { GitOperations } from './git';
import { SymbolExtractor } from './symbols';
import { DependencyExtractor } from './dependencies';
import { RiskDetector } from './heuristics';
import { LLMSummarizer } from '../llm/summarizer';
import { getDifftasticIntegration } from './difftastic';
import { getDatabaseManager, DatabaseHelpers } from '../storage/database';
import { BranchManager } from '../storage/branchManager';
import { makeWorkspaceSha, isWorkspaceSha } from '../utils/workspace';
import { getGitRoot } from '../utils/config';
import { logInfo, logDebug, logError } from '../utils/logger';
import {
  CommitMetadata,
  CommitAnalysis,
  AnalysisOptions,
  StagedAnalysis,
  FileChange,
  AnalysisResult,
  SymbolInfo,
  SymbolDelta,
  EdgeInfo
} from '../types';

/**
 * Centralized Analysis Pipeline Service
 *
 * Owns all analysis orchestration logic and manages the separation between
 * lightweight metadata loading and heavyweight analysis operations.
 */
export class AnalysisPipeline {
  private static readonly LOG_THRESHOLD = 50;
  private branchManager: BranchManager;
  private pendingProgress: Record<string, { count: number; shas: string[] }> = {};
  private analyzedThisRun: Set<string> = new Set();

  constructor(
    private git: GitOperations,
    private db: any, // Database instance
    private symbolExtractor: SymbolExtractor,
    private dependencyExtractor: DependencyExtractor,
    private difftastic: any, // Difftastic integration
    private riskDetector: RiskDetector,
    private llmSummarizer?: LLMSummarizer
  ) {
    this.branchManager = new BranchManager(this.db);
  }

  private upsertFileMetadata(sha: string, files: FileChange[]): void {
    const deleteStmt = this.db.prepare(`DELETE FROM files WHERE sha = ?`);
    deleteStmt.run(sha);
    if (!files || files.length === 0) {
      return;
    }
    const insertStmt = this.db.prepare(`
      INSERT INTO files (sha, path, status, lang)
      VALUES (?, ?, ?, NULL)
    `);
    const insertMany = this.db.transaction((entries: FileChange[]) => {
      for (const file of entries) {
        insertStmt.run(sha, file.path, file.status);
      }
    });
    insertMany(files);
  }

  private getCachePath(sha: string): string | null {
    const gitRoot = getGitRoot();
    if (!gitRoot) return null;
    return path.join(gitRoot, '.git', 'commit-tracker', 'cache', `analysis-${sha}.json`);
  }

  private loadCachedAnalysis(sha: string): CommitAnalysis | null {
    const cachePath = this.getCachePath(sha);
    if (!cachePath || !fs.existsSync(cachePath)) return null;

    try {
      const raw = fs.readFileSync(cachePath, 'utf8');
      return JSON.parse(raw) as CommitAnalysis;
    } catch (error) {
      logDebug(`[PIPELINE] Failed to read cache for ${sha}: ${error}`);
      return null;
    }
  }

  private saveAnalysisCache(analysis: CommitAnalysis): void {
    const cachePath = this.getCachePath(analysis.sha);
    if (!cachePath) return;

    try {
      fs.mkdirSync(path.dirname(cachePath), { recursive: true });
      fs.writeFileSync(cachePath, JSON.stringify(analysis), 'utf8');
    } catch (error) {
      logDebug(`[PIPELINE] Failed to write cache for ${analysis.sha}: ${error}`);
    }
  }

  private isAnalysisEmpty(analysis: CommitAnalysis): boolean {
    const symbolCount = (analysis.symbols?.added?.length || 0) +
      (analysis.symbols?.removed?.length || 0) +
      (analysis.symbols?.modified?.length || 0);
    const edgeCount = (analysis.edges?.added?.length || 0) + (analysis.edges?.removed?.length || 0);
    return symbolCount === 0 && edgeCount === 0;
  }

  // ====== METADATA ONLY (Lightweight) ======

  /**
   * Load commit metadata from git into commits_metadata table.
   * Does NOT run analysis. Fast operation.
   */
  async loadCommitMetadata(sha: string): Promise<CommitMetadata> {
    const commitInfo = this.git.getCommitInfo(sha);
    const files = this.git.getFileChanges(sha);

    const metadata: CommitMetadata = {
      sha: commitInfo.sha,
      author: commitInfo.author,
      date: commitInfo.date,
      message: commitInfo.message,
      parent: commitInfo.parent,
      filesChanged: files,
      loadedAt: new Date().toISOString()
    };

    // Store in database
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO commits_metadata
      (sha, author, date, message, parent, files_changed, loaded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      metadata.sha,
      metadata.author,
      metadata.date,
      metadata.message,
      metadata.parent || null,
      files.length,
      metadata.loadedAt
    );
    this.upsertFileMetadata(metadata.sha, files);

    return metadata;
  }

  /**
   * Load multiple commits' metadata in batch.
   * Does NOT run analysis. Fast operation.
   */
  async loadCommitsMetadata(shas: string[]): Promise<CommitMetadata[]> {
    const results: CommitMetadata[] = [];
    for (const sha of shas) {
      try {
        const metadata = await this.loadCommitMetadata(sha);
        results.push(metadata);
      } catch (error) {
        logError(`Failed to load metadata for ${sha}`, error);
        // Continue with other commits
      }
    }
    return results;
  }

  /**
   * Load last N commits from git history into commits_metadata.
   * Does NOT run analysis. Fast operation.
   */
  async loadRecentCommits(count: number): Promise<CommitMetadata[]> {
    const recentCommits = this.git.getRecentCommits(count);
    const shas = recentCommits.map(c => c.sha);
    const branch = this.git.getCurrentBranch();
    if (branch && recentCommits.length > 0) {
      for (const commit of recentCommits) {
        this.branchManager.recordCommit(commit.sha, branch);
      }
      this.branchManager.updateBranchHead(branch, recentCommits[0].sha);
    }
    return this.loadCommitsMetadata(shas);
  }

  // ====== ANALYSIS (Heavyweight) ======

  /**
   * Run full analysis pipeline on a commit.
   * Prerequisite: Metadata must already be loaded.
   * Idempotent: Safe to call multiple times.
   */
  async analyzeCommit(sha: string, options: AnalysisOptions = {}): Promise<CommitAnalysis> {
    const { PIPELINE_VERSION, PROMPT_VERSION } = await import('../utils/fingerprint');

    const headSha = (() => {
      try {
        return this.git.getHeadSha();
      } catch {
        return null;
      }
    })();
    const isCacheable = !isWorkspaceSha(sha) && sha !== headSha;

    // Skip if already analyzed in this run (dedupe across workspace + commits overlap)
    if (this.analyzedThisRun.has(sha) && !options.forceReanalyze) {
      logDebug(`Commit ${sha} already analyzed this run; skipping`);
      const existing = await this.getAnalysisResults(sha);
      if (existing) {
        return existing;
      }
    }

    // Get metadata first (ensures files table is populated)
    const metadata = await this.getCommitMetadata(sha);
    if (!metadata) {
      throw new Error(`Metadata not found for commit ${sha}. Load metadata first.`);
    }
    const hasFilesRecorded = Array.isArray(metadata.filesChanged) && metadata.filesChanged.length > 0;

    // Check if already analyzed (unless force reanalyze) AND metadata is complete
    if (!options.forceReanalyze && hasFilesRecorded && isCacheable && await this.isCommitAnalyzed(sha)) {
      logDebug(`Commit ${sha} already analyzed; skipping (use forceReanalyze to refresh)`);
      const existing = await this.getAnalysisResults(sha);
      if (existing) {
        this.analyzedThisRun.add(sha); // Mark as analyzed this run
        return existing;
      }
    }

    const files = metadata.filesChanged;

    // Extract symbols
    logDebug(`Extracting symbols from ${files.length} files...`);
    const symbols = await this.symbolExtractor.extractCommitSymbols(sha, files);

    logDebug(`Found ${symbols.added.length} added, ${symbols.removed.length} removed, ${symbols.modified.length} modified symbols`);

    // Extract dependencies
    const fileContents = new Map<string, string>();
    for (const file of files) {
      if (file.status === 'D') continue; // Skip deleted files
      try {
        fileContents.set(file.path, this.git.safeGetFileContent(sha, file.path));
      } catch {
        // Skip files that can't be read
      }
    }

    const edges = await this.dependencyExtractor.extractCommitEdges(sha, symbols, fileContents, files, this.git);
    logDebug(`Extracted edges: +${edges.added.length} -${edges.removed.length}`);

    // Calculate blast radius
    const changedSymbols = [...symbols.added, ...symbols.modified.map(m => m.symbol)];
    const blastRadius = this.dependencyExtractor.calculateBlastRadius(changedSymbols, edges.added);
    const totalImpact = Array.from(blastRadius.impactScore.values()).reduce((a, b) => a + b, 0);
    logDebug(`Blast radius calculated: ${totalImpact} total impacts`);

    // Get difftastic highlights
    const difftasticHighlights: any[] = [];
    if (!options.skipDifftastic) {
      for (const file of files) {
        if (file.status === 'M') {
          try {
            const highlights = await this.difftastic.getCommitStructuralHighlights(sha, file.path, file.oldPath);
            difftasticHighlights.push(...highlights.highlights);
          } catch {
            // Skip difftastic failures
          }
        }
      }
    }

    // Detect risks
    const risks = this.riskDetector.detectRisks(files, symbols, edges);

    // Create analysis result
    const analysis: CommitAnalysis = {
      sha,
      symbols,
      edges,
      risks,
      difftasticHighlights,
      blastRadius: totalImpact,
      analyzedAt: new Date().toISOString(),
      pipelineVersion: PIPELINE_VERSION,
      promptVersion: options.promptVersion ?? PROMPT_VERSION,
      model: options.model
    };

    // Generate LLM summary
    if (!options.skipLLM && this.llmSummarizer) {
      try {
        const fullAnalysis: AnalysisResult = {
          commit: {
            sha: metadata.sha,
            author: metadata.author,
            date: metadata.date,
            message: metadata.message,
            parent: metadata.parent
          },
          files,
          symbols,
          edges,
          risks,
          difftasticHighlights,
          llmSummary: undefined
        };

        analysis.llmSummary = await this.llmSummarizer.summarizeCommit(fullAnalysis);
      } catch (error) {
        logDebug(`LLM summarization failed for ${sha}: ${error}`);
      }
    }

    // Store in database + cache
    await this.storeCommitAnalysis(analysis);
    if (isCacheable) {
      this.saveAnalysisCache(analysis);
    }

    // Mark as analyzed this run
    this.analyzedThisRun.add(sha);

    // Sync to Qdrant if enabled
    if (!options.skipQdrant) {
      await this.syncSymbolsToQdrant(symbols, sha);
      await this.syncCommitToQdrant(analysis);
    }

    logDebug(`Stored analysis for ${sha}`);
    return analysis;
  }

  /**
   * Run full analysis pipeline on multiple commits in batch.
   * More efficient than analyzing individually.
   */
  async analyzeCommits(shas: string[], options: AnalysisOptions = {}): Promise<CommitAnalysis[]> {
    const results: CommitAnalysis[] = [];
    for (const sha of shas) {
      try {
        logInfo(`Processing commit ${sha}...`);
        const analysis = await this.analyzeCommit(sha, options);
        results.push(analysis);
        logInfo(`✓ Completed ${sha}`);
      } catch (error) {
        logError(`✗ Failed to analyze ${sha}`, error);
        // Continue with other commits
      }
    }
    return results;
  }

  /**
   * Analyze staged or unstaged workspace changes and store them like commits.
   */
  async analyzeWorkspace(
    mode: 'staged' | 'unstaged',
    options: AnalysisOptions = {}
  ): Promise<CommitAnalysis | null> {
    const { PIPELINE_VERSION, PROMPT_VERSION } = await import('../utils/fingerprint');
    const branch = this.git.getCurrentBranch();
    const sha = makeWorkspaceSha(mode, branch);

    if (!options.forceReanalyze && await this.isCommitAnalyzed(sha)) {
      logDebug(`Workspace ${mode} already analyzed`);
      const existing = await this.getAnalysisResults(sha);
      if (existing) {
        return existing;
      }
    }

    const files = mode === 'staged'
      ? await this.git.getStagedFiles()
      : await this.git.getUnstagedFiles();

    if (files.length === 0) {
      logDebug(`No ${mode} files to analyze`);
      return null;
    }

    const symbols = await this.symbolExtractor.extractWorkingTreeSymbols(files, { staged: mode === 'staged' });
    const edges = await this.dependencyExtractor.extractWorkingTreeEdges(files, symbols, this.git);
    const risks = this.riskDetector.detectRisks(files, symbols, edges);
    const blastRadiusResult = this.dependencyExtractor.calculateBlastRadius(
      [...symbols.added, ...symbols.modified.map(m => m.symbol)],
      edges.added
    );

    const analysis: CommitAnalysis = {
      sha,
      symbols,
      edges,
      risks,
      difftasticHighlights: [],
      blastRadius: blastRadiusResult.impactScore.size,
      analyzedAt: new Date().toISOString(),
      pipelineVersion: PIPELINE_VERSION,
      promptVersion: options.promptVersion ?? PROMPT_VERSION,
      model: options.model
    };

    await this.ensureWorkspaceMetadata(sha, branch, files, mode);
    await this.storeCommitAnalysis(analysis);

    logInfo(`[PIPELINE] Workspace ${mode} analyzed on ${branch || 'detached'} (${files.length} files)`);
    return analysis;
  }

  /**
   * Analyze staged changes (not yet committed).
   */
  async analyzeStagedChanges(): Promise<StagedAnalysis> {
    const analysis = await this.analyzeWorkspace('staged', { forceReanalyze: true });
    const files = await this.git.getStagedFiles();
    return {
      files,
      symbols: {
        added: analysis?.symbols.added || [],
        modified: analysis?.symbols.modified || []
      },
      edges: {
        added: analysis?.edges.added || []
      },
      risks: analysis?.risks || [],
      blastRadius: analysis?.blastRadius || 0
    };
  }

  /**
   * Analyze unstaged changes (working directory vs HEAD).
   */
  async analyzeUnstagedChanges(): Promise<StagedAnalysis> {
    const analysis = await this.analyzeWorkspace('unstaged', { forceReanalyze: true });
    const files = await this.git.getUnstagedFiles();
    return {
      files,
      symbols: {
        added: analysis?.symbols.added || [],
        modified: analysis?.symbols.modified || []
      },
      edges: {
        added: analysis?.edges.added || []
      },
      risks: analysis?.risks || [],
      blastRadius: analysis?.blastRadius || 0
    };
  }

  /**
   * Migrate workspace analysis to a real commit SHA after git commit.
   */
  async migrateWorkspaceToCommit(newSha: string): Promise<void> {
    const branch = this.git.getCurrentBranch();
    if (!branch || !newSha) {
      return;
    }
    const workspaceSha = makeWorkspaceSha('staged', branch);
    const analyzed = await this.isCommitAnalyzed(workspaceSha);
    if (!analyzed) {
      return;
    }

    this.db.exec('BEGIN TRANSACTION');
    try {
      const tables = ['commits_analysis', 'symbols', 'edges', 'files', 'commits_metadata'];
      for (const table of tables) {
        this.db.prepare(`UPDATE ${table} SET sha = ? WHERE sha = ?`).run(newSha, workspaceSha);
      }

      this.branchManager.recordCommit(newSha, branch);
      this.branchManager.updateBranchHead(branch, newSha);

      this.db.exec('COMMIT');
      logInfo(`[PIPELINE] Migrated ${workspaceSha} → ${newSha}`);
    } catch (error) {
      this.db.exec('ROLLBACK');
      logError('[PIPELINE] Failed to migrate workspace analysis', error);
    }
  }

  // ====== QUERY ======

  /**
   * Check if a commit has been analyzed with compatible pipeline version.
   */
  async isCommitAnalyzed(sha: string): Promise<boolean> {
    const { PIPELINE_VERSION } = await import('../utils/fingerprint');
    const { DatabaseHelpers } = await import('../storage/database');
    return DatabaseHelpers.isCommitAnalyzed(this.db, sha, PIPELINE_VERSION);
  }

  /**
   * Get analysis results for a commit (returns null if not analyzed).
   */
  async getAnalysisResults(sha: string): Promise<CommitAnalysis | null> {
    const cached = this.loadCachedAnalysis(sha);
    if (cached) {
      this.analyzedThisRun.add(sha);
      return cached;
    }

    const stmt = this.db.prepare(`
      SELECT * FROM commits_analysis WHERE sha = ?
    `);
    const row = stmt.get(sha);
    if (!row) return null;

    const parseArray = (value: any) => {
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      }
      return [];
    };

    // Parse JSON fields
    return {
      sha: row.sha,
      symbols: {
        added: parseArray(row.symbols_added),
        removed: parseArray(row.symbols_removed),
        modified: parseArray(row.symbols_modified)
      },
      edges: {
        added: parseArray(row.edges_added),
        removed: parseArray(row.edges_removed)
      },
      risks: row.risks ? JSON.parse(row.risks) : [],
      difftasticHighlights: row.difftastic_highlights ? JSON.parse(row.difftastic_highlights) : [],
      llmSummary: row.raw_llm_json ? JSON.parse(row.raw_llm_json) : undefined,
      blastRadius: row.blast_radius || 0,
      analyzedAt: row.analyzed_at,
      pipelineVersion: row.pipeline_version,
      promptVersion: row.prompt_version,
      model: row.model
    };
  }

  /**
   * Get metadata for a commit (from DB or git fallback).
   */
  async getCommitMetadata(sha: string): Promise<CommitMetadata | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM commits_metadata WHERE sha = ?
    `);
    const row = stmt.get(sha);
    if (row) {
      // Reconstruct filesChanged array from files table
      const filesStmt = this.db.prepare(`
        SELECT path, status, lang FROM files WHERE sha = ?
      `);
      const fileRows = filesStmt.all(sha) as Array<{
        path: string;
        status: string;
        lang: string | null;
      }>;

      let filesChanged: FileChange[] = fileRows.map(fileRow => ({
        path: fileRow.path,
        status: fileRow.status as FileChange['status'],
        oldPath: undefined
      }));

      if (filesChanged.length === 0) {
        try {
          const files = this.git.getFileChanges(sha);
          filesChanged = files;
          this.upsertFileMetadata(sha, files);
        } catch {
          filesChanged = [];
        }
      }

      return {
        sha: row.sha,
        author: row.author,
        date: row.date,
        message: row.message,
        parent: row.parent,
        filesChanged,
        loadedAt: row.loaded_at
      };
    }

    // Fallback to git if not in DB
    try {
      return await this.loadCommitMetadata(sha);
    } catch {
      return null;
    }
  }

  // ====== PRIVATE METHODS ======

  private ensureWorkspaceMetadata(
    sha: string,
    branch: string | null,
    files: FileChange[],
    mode: 'staged' | 'unstaged'
  ): void {
    const metadata: CommitMetadata = {
      sha,
      author: 'workspace',
      date: new Date().toISOString(),
      message: `[Workspace:${mode}] ${branch || 'detached'}`,
      parent: this.git.getHeadSha(),
      filesChanged: files,
      loadedAt: new Date().toISOString()
    };
    DatabaseHelpers.insertCommitMetadata(this.db, metadata);
    this.upsertFileMetadata(sha, files);
  }

  private async storeCommitAnalysis(analysis: CommitAnalysis): Promise<void> {
    // Store the analysis summary first
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO commits_analysis
      (sha, summary_md, raw_llm_json, symbols_added, symbols_removed, symbols_modified,
       edges_added, edges_removed, risks, blast_radius, difftastic_highlights, analyzed_at,
       pipeline_version, prompt_version, model)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const llmJson = analysis.llmSummary ? JSON.stringify(analysis.llmSummary) : null;
    const risksJson = JSON.stringify(analysis.risks);
    const difftasticJson = analysis.difftasticHighlights && analysis.difftasticHighlights.length > 0
      ? JSON.stringify(analysis.difftasticHighlights)
      : null;

    // Normalize metadata fields to avoid undefined bindings
    const pipelineVersion = analysis.pipelineVersion || '0.0';
    const promptVersion = analysis.promptVersion || '0.0';
    const model = analysis.model || null;

    stmt.run(
      analysis.sha,
      analysis.llmSummary?.summary_md || '',
      llmJson,
      analysis.symbols.added.length,
      analysis.symbols.removed.length,
      analysis.symbols.modified.length,
      analysis.edges.added.length,
      analysis.edges.removed.length,
      risksJson,
      analysis.blastRadius,
      difftasticJson,
      analysis.analyzedAt,
      pipelineVersion,
      promptVersion,
      model
    );

    // Store individual symbols to enable future caching
    await this.storeSymbols(analysis.sha, analysis.symbols);

    const totalSymbols = analysis.symbols.added.length + analysis.symbols.modified.length + analysis.symbols.removed.length;
    if (totalSymbols > 0) {
      this.trackProgress('symbols', totalSymbols, analysis.sha);
    }
    const totalEdges = analysis.edges.added.length + analysis.edges.removed.length;
    if (totalEdges > 0) {
      this.trackProgress('edges', totalEdges, analysis.sha);
    }
  }

  private async storeSymbols(sha: string, symbols: {
    added: SymbolInfo[];
    removed: SymbolInfo[];
    modified: SymbolDelta[];
  }): Promise<void> {
    // Delete existing symbols for this SHA (idempotent)
    this.db.prepare('DELETE FROM symbols WHERE sha = ?').run(sha);

    const symbolStmt = this.db.prepare(`
      INSERT INTO symbols
      (sha, path, symbol_id, name, kind, signature, change_type, mod_reason,
       diff_snippet_pre, diff_snippet_post, confidence, naming_convention, convention_confidence)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Store added symbols
    for (const symbol of symbols.added) {
      symbolStmt.run(
        sha,
        '', // path - we don't store this for now
        symbol.id,
        symbol.name,
        symbol.kind,
        symbol.signature,
        'added',
        null, // mod_reason
        null, // diff_snippet_pre
        null, // diff_snippet_post
        1.0, // confidence
        null, // naming_convention
        null  // convention_confidence
      );
    }

    // Store removed symbols
    for (const symbol of symbols.removed) {
      symbolStmt.run(
        sha,
        '', // path - we don't store this for now
        symbol.id,
        symbol.name,
        symbol.kind,
        symbol.signature,
        'removed',
        null, // mod_reason
        null, // diff_snippet_pre
        null, // diff_snippet_post
        1.0, // confidence
        null, // naming_convention
        null  // convention_confidence
      );
    }

    // Store modified symbols with additional metadata
    for (const delta of symbols.modified) {
      symbolStmt.run(
        sha,
        '', // path - we don't store this for now
        delta.symbol.id,
        delta.symbol.name,
        delta.symbol.kind,
        delta.symbol.signature,
        'modified',
        delta.modReason || null,
        delta.diffSnippetPre || null,
        delta.diffSnippetPost || null,
        1.0, // confidence - use default since SymbolDelta doesn't have confidence
        null, // naming_convention
        null  // convention_confidence
      );
    }
  }

  /**
   * Retrieve stored symbols for a commit (for future caching)
   */
  private getStoredSymbols(sha: string): {
    added: SymbolInfo[];
    removed: SymbolInfo[];
    modified: SymbolDelta[];
  } | null {
    const symbols = this.db.prepare('SELECT * FROM symbols WHERE sha = ?').all(sha);

    if (symbols.length === 0) {
      return null;
    }

    const added: SymbolInfo[] = [];
    const removed: SymbolInfo[] = [];
    const modified: SymbolDelta[] = [];

    for (const row of symbols) {
      const symbol: SymbolInfo = {
        id: row.symbol_id,
        name: row.name,
        kind: row.kind as any, // Cast to match the union type
        location: {
          start: { line: 1, column: 0 }, // Placeholder values
          end: { line: 1, column: 0 }
        },
        signature: row.signature || ''
      };

      switch (row.change_type) {
        case 'added':
          added.push(symbol);
          break;
        case 'removed':
          removed.push(symbol);
          break;
        case 'modified':
          const delta: SymbolDelta = {
            symbol,
            changeType: 'modified',
            modReason: row.mod_reason || undefined,
            diffSnippetPre: row.diff_snippet_pre || undefined,
            diffSnippetPost: row.diff_snippet_post || undefined
          };
          modified.push(delta);
          break;
      }
    }

    return { added, removed, modified };
  }

  private trackProgress(kind: 'symbols' | 'edges' | 'dna', delta: number, sha?: string): void {
    if (delta <= 0) {
      return;
    }

    const entry = this.pendingProgress[kind] ?? { count: 0, shas: [] };
    entry.count += delta;
    if (sha) {
      entry.shas.push(sha);
    }

    if (entry.count >= AnalysisPipeline.LOG_THRESHOLD) {
      const recent = entry.shas.slice(-3).map((s) => s.substring(0, 8)).join(', ');
      logInfo(`[PIPELINE] ${entry.count} ${kind} persisted to DB (recent SHAs: ${recent || 'n/a'})`);
      this.pendingProgress[kind] = { count: 0, shas: [] };
    } else {
      this.pendingProgress[kind] = entry;
    }
  }

  private async syncSymbolsToQdrant(
    symbols: {
      added: SymbolInfo[];
      removed: SymbolInfo[];
      modified: SymbolDelta[];
    },
    sha: string
  ): Promise<void> {
    try {
      const { getQdrantClient } = await import('../storage/qdrantClient');
      const { generateEmbedding, symbolToEmbeddingText } = await import('../storage/embeddings');

      const qdrant = getQdrantClient();
      if (!(await qdrant.isEnabled())) {
        return; // Skip if Qdrant not available
      }

      await qdrant.ensureCollections();
      const client = await qdrant.getClient();
      if (!client) {
        return;
      }

      const { stringToPointId } = await import('../storage/embeddings');
      const { detectNamingConvention } = await import('./namingConventions');
      const points: any[] = [];

      // Process added symbols
      for (const symbol of symbols.added) {
        const convention = detectNamingConvention(symbol.name);
        const embeddingText = symbolToEmbeddingText({
          name: symbol.name,
          kind: symbol.kind,
          signature: symbol.signature,
          path: symbol.id.split(':')[0],
          naming_convention: convention.convention
        });
        const embedding = await generateEmbedding(embeddingText);

        points.push({
          id: stringToPointId(symbol.id),
          vector: embedding,
          payload: {
            symbol_id: symbol.id,
            name: symbol.name,
            kind: symbol.kind,
            path: symbol.id.split(':')[0],
            sha,
            change_type: 'added',
            naming_convention: convention.convention
          }
        });
      }

      // Process modified symbols
      for (const delta of symbols.modified) {
        const convention = detectNamingConvention(delta.symbol.name);
        const embeddingText = symbolToEmbeddingText({
          name: delta.symbol.name,
          kind: delta.symbol.kind,
          signature: delta.symbol.signature,
          path: delta.symbol.id.split(':')[0],
          diff_snippet_post: delta.diffSnippetPost,
          naming_convention: convention.convention
        });
        const embedding = await generateEmbedding(embeddingText);

        points.push({
          id: stringToPointId(delta.symbol.id),
          vector: embedding,
          payload: {
            symbol_id: delta.symbol.id,
            name: delta.symbol.name,
            kind: delta.symbol.kind,
            path: delta.symbol.id.split(':')[0],
            sha,
            change_type: 'modified',
            naming_convention: convention.convention
          }
        });
      }

      // Batch upsert to Qdrant
      if (points.length > 0) {
        await client.upsert('symbols', {
          wait: true,
          points
        });
        logDebug(`[Qdrant] Synced ${points.length} symbols to Qdrant`);
      }
    } catch (error) {
      logError('[Qdrant] Failed to sync symbols', error);
      // Don't throw - Qdrant sync is optional
    }
  }

  private async syncCommitToQdrant(analysis: CommitAnalysis): Promise<void> {
    try {
      const { getQdrantClient } = await import('../storage/qdrantClient');
      const { generateEmbedding, commitToEmbeddingText, stringToPointId } = await import('../storage/embeddings');

      const qdrant = getQdrantClient();
      if (!(await qdrant.isEnabled())) {
        return; // Skip if Qdrant not available
      }

      await qdrant.ensureCollections();
      const client = await qdrant.getClient();
      if (!client) {
        return;
      }

      const metadata = await this.getCommitMetadata(analysis.sha);
      if (!metadata) return;

      const embeddingText = commitToEmbeddingText({
        message: metadata.message,
        summary_md: analysis.llmSummary?.summary_md,
        risks: analysis.risks
      });

      const embedding = await generateEmbedding(embeddingText);

      await client.upsert('commits', {
        wait: true,
        points: [{
          id: stringToPointId(analysis.sha),
          vector: embedding,
          payload: {
            sha: analysis.sha,
            author: metadata.author,
            date: metadata.date,
            message: metadata.message,
            files_changed: metadata.filesChanged.length,
            symbols_added: analysis.symbols.added.length,
            symbols_modified: analysis.symbols.modified.length,
            symbols_removed: analysis.symbols.removed.length,
            risks: analysis.risks
          }
        }]
      });
      logDebug(`[Qdrant] Synced commit ${analysis.sha.substring(0, 8)} to Qdrant`);
    } catch (error) {
      logError('[Qdrant] Failed to sync commit', error);
      // Don't throw - Qdrant sync is optional
    }
  }
}

// Singleton instance
let analysisPipeline: AnalysisPipeline | null = null;

/**
 * Get the global AnalysisPipeline instance
 */
export async function getAnalysisPipeline(): Promise<AnalysisPipeline> {
  if (!analysisPipeline) {
    const git = new GitOperations();
    const db = getDatabaseManager().getDatabase();
    const symbolExtractor = new SymbolExtractor(git);
    const dependencyExtractor = new DependencyExtractor();
    const difftastic = getDifftasticIntegration();
    const riskDetector = new RiskDetector();

    // LLM summarizer is optional
    let llmSummarizer: LLMSummarizer | undefined;
    try {
      llmSummarizer = new LLMSummarizer();
    } catch {
      // LLM not available, continue without it
    }

    analysisPipeline = new AnalysisPipeline(
      git,
      db,
      symbolExtractor,
      dependencyExtractor,
      difftastic,
      riskDetector,
      llmSummarizer
    );
  }

  return analysisPipeline;
}
