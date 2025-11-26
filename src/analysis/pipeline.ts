import { GitOperations } from './git';
import { SymbolExtractor } from './symbols';
import { DependencyExtractor } from './dependencies';
import { RiskDetector } from './heuristics';
import { LLMSummarizer } from '../llm/summarizer';
import { getDifftasticIntegration } from './difftastic';
import { getDatabaseManager } from '../storage/database';
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
  constructor(
    private git: GitOperations,
    private db: any, // Database instance
    private symbolExtractor: SymbolExtractor,
    private dependencyExtractor: DependencyExtractor,
    private difftastic: any, // Difftastic integration
    private riskDetector: RiskDetector,
    private llmSummarizer?: LLMSummarizer
  ) { }

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
    return this.loadCommitsMetadata(shas);
  }

  // ====== ANALYSIS (Heavyweight) ======

  /**
   * Run full analysis pipeline on a commit.
   * Prerequisite: Metadata must already be loaded.
   * Idempotent: Safe to call multiple times.
   */
  async analyzeCommit(sha: string, options: AnalysisOptions = {}): Promise<CommitAnalysis> {
    // Check if already analyzed (unless force reanalyze)
    if (!options.forceReanalyze && await this.isCommitAnalyzed(sha)) {
      logDebug(`Commit ${sha} already analyzed; skipping (use forceReanalyze to refresh)`);
      const existing = await this.getAnalysisResults(sha);
      if (existing) {
        return existing;
      }
    }

    // Get metadata first
    const metadata = await this.getCommitMetadata(sha);
    if (!metadata) {
      throw new Error(`Metadata not found for commit ${sha}. Load metadata first.`);
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
      analyzedAt: new Date().toISOString()
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

    // Store in database
    await this.storeCommitAnalysis(analysis);

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
   * Analyze staged changes (not yet committed).
   */
  async analyzeStagedChanges(): Promise<StagedAnalysis> {
    const files = await this.git.getStagedFiles();
    logInfo(`[PIPELINE] Analyzing staged changes (${files.length} files)`);

    // Extract symbols from staged changes compared to HEAD
    const symbols = await this.symbolExtractor.extractWorkingTreeSymbols(files, { staged: true });
    const edges = await this.dependencyExtractor.extractWorkingTreeEdges(files, symbols, this.git);
    const risks = this.riskDetector.detectRisks(
      files,
      symbols,
      edges
    );
    const blastRadiusResult = this.dependencyExtractor.calculateBlastRadius(
      [...symbols.added, ...symbols.modified.map(m => m.symbol)],
      edges.added
    );
    const blastRadius = blastRadiusResult.impactScore.size; // Use number of impacted symbols

    return {
      files,
      symbols,
      edges,
      risks,
      blastRadius
    };
  }

  /**
   * Analyze unstaged changes (working directory vs HEAD).
   */
  async analyzeUnstagedChanges(): Promise<StagedAnalysis> {
    const files = await this.git.getUnstagedFiles();
    logInfo(`[PIPELINE] Analyzing unstaged changes (${files.length} files)`);

    // Extract symbols from unstaged changes compared to HEAD
    const symbols = await this.symbolExtractor.extractWorkingTreeSymbols(files, { staged: false });
    const edges = await this.dependencyExtractor.extractWorkingTreeEdges(files, symbols, this.git);
    const risks = this.riskDetector.detectRisks(
      files,
      symbols,
      edges
    );
    const blastRadiusResult = this.dependencyExtractor.calculateBlastRadius(
      [...symbols.added, ...symbols.modified.map(m => m.symbol)],
      edges.added
    );
    const blastRadius = blastRadiusResult.impactScore.size; // Use number of impacted symbols

    return {
      files,
      symbols,
      edges,
      risks,
      blastRadius
    };
  }

  // ====== QUERY ======

  /**
   * Check if a commit has been analyzed.
   */
  async isCommitAnalyzed(sha: string): Promise<boolean> {
    const stmt = this.db.prepare(`
      SELECT 1 FROM commits_analysis WHERE sha = ? LIMIT 1
    `);
    const result = stmt.get(sha);
    return !!result;
  }

  /**
   * Get analysis results for a commit (returns null if not analyzed).
   */
  async getAnalysisResults(sha: string): Promise<CommitAnalysis | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM commits_analysis WHERE sha = ?
    `);
    const row = stmt.get(sha);
    if (!row) return null;

    // Parse JSON fields
    return {
      sha: row.sha,
      symbols: {
        added: JSON.parse(row.symbols_added || '[]'),
        removed: JSON.parse(row.symbols_removed || '[]'),
        modified: JSON.parse(row.symbols_modified || '[]')
      },
      edges: {
        added: JSON.parse(row.edges_added || '[]'),
        removed: JSON.parse(row.edges_removed || '[]')
      },
      risks: JSON.parse(row.risks || '[]'),
      difftasticHighlights: row.difftastic_highlights ? JSON.parse(row.difftastic_highlights) : [],
      llmSummary: row.raw_llm_json ? JSON.parse(row.raw_llm_json) : undefined,
      blastRadius: row.blast_radius || 0,
      analyzedAt: row.analyzed_at
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

      const filesChanged = fileRows.map(fileRow => ({
        path: fileRow.path,
        status: fileRow.status as any,
        oldPath: undefined // Could be enhanced to track renames
      }));

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

  private async storeCommitAnalysis(analysis: CommitAnalysis): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO commits_analysis
      (sha, summary_md, raw_llm_json, symbols_added, symbols_removed, symbols_modified,
       edges_added, edges_removed, risks, blast_radius, difftastic_highlights, analyzed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const llmJson = analysis.llmSummary ? JSON.stringify(analysis.llmSummary) : null;
    const risksJson = JSON.stringify(analysis.risks);
    const difftasticJson = analysis.difftasticHighlights && analysis.difftasticHighlights.length > 0
      ? JSON.stringify(analysis.difftasticHighlights)
      : null;

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
      analysis.analyzedAt
    );
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
