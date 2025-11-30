import * as fs from 'fs';
import * as path from 'path';
import { LlmContextReport, CommitContext, FileContext, SymbolContext, EdgeContext } from '../contracts/llmContext';
import { getDatabaseManager } from '../storage/database';
import { getGitRoot } from '../utils/config';
import { MermaidGenerator } from './mermaidGenerator';
import { DependencyExtractor } from './dependencies';
import { LegacyDetector } from '../facts/legacyAudit';
import { buildIntendedMap } from '../facts/intendedMap';
import { getWorkingSnapshot } from '../facts/workingSnapshot';
import { computeScope } from '../facts/scope';
import { LegacyAuditReport } from '../contracts/llmContext';
import { getDynamicThreshold } from '../utils/edgeThresholds';
import { logDebug } from '../utils/logger';

/**
 * Export LLM context in structured JSON format
 *
 * Generates versioned, machine-readable reports for LLM consumption
 * with deterministic truncation and context budgeting.
 */
export class ContextExporter {
  private readonly MAX_TOKEN_BUDGET = 12000; // Rough token estimate
  private readonly TOKEN_PER_CHAR = 1 / 4; // Rough approximation
  private readonly mermaidGenerator = new MermaidGenerator();
  private readonly dependencyExtractor = new DependencyExtractor();

  /**
   * Export full context report for specified commits
   */
  async exportContext(shas: string[]): Promise<LlmContextReport> {
    const gitRoot = getGitRoot();
    if (!gitRoot) {
      throw new Error('Not in a git repository');
    }

    const commits: CommitContext[] = [];
    const globalRisks: any[] = [];

    for (const sha of shas) {
      const commit = await this.buildCommitContext(sha);
      commits.push(commit);
    }

    const auditReport = await this.performLegacyAudit(shas);

    const report: LlmContextReport = {
      version: "1.0.0",
      generated_at: new Date().toISOString(),
      repo: {
        root: gitRoot,
        head_sha: await this.getHeadSha(),
        branch: await this.getCurrentBranch()
      },
      commits,
      global_risks: globalRisks,
      rollups: await this.buildRollups(shas, auditReport),
      graphs: await this.generateGraphs(commits, shas),
      legacy_audit: auditReport
    };

    // Apply context budgeting
    this.applyContextBudget(report);

    return report;
  }

  /**
   * Export context to JSON file
   */
  async exportToFile(shas: string[], filePath?: string): Promise<string> {
    const report = await this.exportContext(shas);

    const defaultPath = path.join(getGitRoot()!, '.git', 'commit-tracker', 'commit-context.json');
    const outputPath = filePath || defaultPath;

    // Ensure directory exists
    const dir = path.dirname(outputPath);
    fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    return outputPath;
  }

  /**
   * Build context for a single commit
   */
  private async buildCommitContext(sha: string): Promise<CommitContext> {
    const { getDatabaseService } = await import('../services/databaseService');
    const dbService = getDatabaseService();

    // Get commit info using service
    const commitMetadata = await dbService.getCommitMetadata(sha);

    if (!commitMetadata) {
      throw new Error(`Commit ${sha} not found in database`);
    }

    // Get analysis data using service
    const analysisRow = await dbService.getCommitAnalysis(sha);

    // Get files using service
    const fileRows = await dbService.getFilesByCommit(sha);

    const files: FileContext[] = [];
    for (const fileRow of fileRows) {
      files.push(await this.buildFileContext(sha, fileRow));
    }

    // Get edges using service
    const edgeInfos = await dbService.queryEdgesByCommit(sha);
    const edges: EdgeContext[] = edgeInfos.map(edge => ({
      from_symbol_id: edge.from,
      to_symbol_id: edge.to,
      edge_type: edge.type || 'unknown' as any,
      change_type: 'added' as any, // TODO: Add change_type to EdgeInfo interface
      confidence: edge.confidence || 1.0,
      is_resolved: Boolean(edge.isResolved ?? true)
    }));

    // Parse risks
    const risks = JSON.parse(analysisRow?.risks || '[]');

    return {
      sha,
      parent_sha: commitMetadata.parent || undefined,
      message: commitMetadata.message,
      author: commitMetadata.author,
      date: commitMetadata.date.toISOString(),
      stats: {
        files: commitMetadata.filesChanged,
        added: analysisRow?.symbols_added || 0,
        modified: analysisRow?.symbols_modified || 0,
        removed: analysisRow?.symbols_removed || 0
      },
      files,
      risks,
      edges,
      llm_summary: analysisRow?.summary_md
    };
  }

  /**
   * Build context for a single file
   */
  private async buildFileContext(sha: string, fileRow: any): Promise<FileContext> {
    const db = getDatabaseManager().getDatabase();

    // Get symbols for this file
    const symbolsStmt = db.prepare(`
      SELECT * FROM symbols WHERE sha = ? AND path = ?
    `);
    const symbolRows = symbolsStmt.all(sha, fileRow.path) as any[];

    const symbols: SymbolContext[] = symbolRows.map(row => ({
      id: row.id,
      symbol_id: row.symbol_id,
      name: row.name,
      kind: row.kind,
      signature: row.signature_post || row.signature_pre,
      loc_pre: row.loc_pre ? JSON.parse(row.loc_pre) : undefined,
      loc_post: row.loc_post ? JSON.parse(row.loc_post) : undefined,
      mod_reason: row.mod_reason as any,
      diff_snippet_pre: row.diff_snippet_pre,
      diff_snippet_post: row.diff_snippet_post
    }));

    // Group symbols by change type from database
    const added = symbols.filter(s => symbolRows.find(r => r.id === s.id)?.change_type === 'added');
    const removed = symbols.filter(s => symbolRows.find(r => r.id === s.id)?.change_type === 'removed');
    const modified = symbols.filter(s => symbolRows.find(r => r.id === s.id)?.change_type === 'modified' ||
      symbolRows.find(r => r.id === s.id)?.change_type === 'signature_changed');

    // Handle renames: load from renames table
    const renamesStmt = db.prepare(`
      SELECT * FROM renames WHERE sha = ? AND path = ?
    `);
    const renamed = renamesStmt.all(sha, fileRow.path).map((r: any) => ({
      old_symbol_id: r.old_symbol_id,
      new_symbol_id: r.new_symbol_id,
      old_name: r.old_name,
      new_name: r.new_name,
      confidence: r.confidence
    }));

    return {
      path: fileRow.path,
      language: fileRow.lang || 'unknown',
      stats: {
        added: added.length,
        modified: modified.length,
        removed: removed.length,
        renamed: renamed.length > 0
      },
      symbols: {
        added,
        modified,
        removed,
        renamed
      }
    };
  }

  /**
   * Build cross-commit rollups
   */
  private async buildRollups(shas: string[], auditReport?: LegacyAuditReport): Promise<LlmContextReport['rollups']> {
    const db = getDatabaseManager().getDatabase();
    const placeholders = shas.map(() => '?').join(',');

    // Hotspots: symbols changed in ≥2 commits
    const hotspotsStmt = db.prepare(`
      SELECT symbol_id, name, COUNT(DISTINCT sha) as change_count, MAX(date) as last_changed
      FROM symbols s
      JOIN commits_metadata c ON s.sha = c.sha
      WHERE s.sha IN (${placeholders})
      GROUP BY symbol_id
      HAVING change_count >= 2
      ORDER BY change_count DESC
      LIMIT 10
    `);
    const hotspots = hotspotsStmt.all(...shas) as any[];

    // Top changed files: count of symbol deltas per file across commits
    const fileRollupsStmt = db.prepare(`
      SELECT path, COUNT(*) as total_changes, MAX(c.date) as last_commit
      FROM symbols s
      JOIN commits_metadata c ON s.sha = c.sha
      WHERE s.sha IN (${placeholders})
      GROUP BY path
      ORDER BY total_changes DESC
      LIMIT 10
    `);
    const topChangedFiles = fileRollupsStmt.all(...shas) as any[];

    // Dependency deltas: individual edge changes
    const depDeltasStmt = db.prepare(`
      SELECT from_symbol_id, to_symbol_id, change_type, confidence
      FROM edges
      WHERE sha IN (${placeholders}) AND change_type IS NOT NULL
      ORDER BY confidence DESC
      LIMIT 20
    `);
    const depDeltas = depDeltasStmt.all(...shas) as any[];

    return {
      hotspots: hotspots.map(h => ({
        symbol_id: h.symbol_id,
        change_count: h.change_count,
        last_changed: h.last_changed,
        risk_score: Math.min(h.change_count / 5, 1.0) // Simple risk scoring
      })),
      top_changed_files: topChangedFiles.map(f => ({
        path: f.path,
        total_changes: f.total_changes,
        last_commit: f.last_commit,
        languages: [] // Would need to detect from files
      })),
      dependency_deltas: depDeltas.map(d => ({
        from_symbol_id: d.from_symbol_id,
        to_symbol_id: d.to_symbol_id,
        change_type: d.change_type,
        confidence: d.confidence || 1.0
      })),
      expected_absent_but_present_count: auditReport?.zombie_symbols.length || 0,
      expected_present_but_missing_count: auditReport?.missing_symbols.length || 0
    };
  }

  /**
   * Apply context budgeting with predictable truncation
   */
  private applyContextBudget(report: LlmContextReport): void {
    const currentTokens = this.estimateTokenCount(report);

    if (currentTokens <= this.MAX_TOKEN_BUDGET) {
      return; // No truncation needed
    }

    // Truncate in priority order (lowest priority first)
    const truncationSteps = [
      () => this.truncateDiffHunks(report),
      () => this.truncateLowConfidenceEdges(report),
      () => this.truncateUnchangedCallers(report),
      () => this.truncateDocChanges(report)
    ];

    for (const step of truncationSteps) {
      step();
      if (this.estimateTokenCount(report) <= this.MAX_TOKEN_BUDGET) {
        break;
      }
    }
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokenCount(report: LlmContextReport): number {
    const jsonString = JSON.stringify(report);
    return Math.floor(jsonString.length * this.TOKEN_PER_CHAR);
  }

  /**
   * Truncate diff hunks (lowest priority)
   */
  private truncateDiffHunks(report: LlmContextReport): void {
    for (const commit of report.commits) {
      for (const file of commit.files) {
        file.hunks = undefined; // Remove diff hunks
      }
    }
  }

  /**
   * Remove low-confidence edges with dynamic threshold, preserving edges for legacy audit
   */
  private truncateLowConfidenceEdges(report: LlmContextReport): void {
    for (const commit of report.commits) {
      // Dynamic confidence threshold based on edge count
      const totalEdges = commit.edges.length;
      const threshold = getDynamicThreshold(totalEdges);

      // Collect symbols that were removed or modified (important for legacy audit)
      const legacySymbols = new Set<string>();
      for (const file of commit.files) {
        for (const symbol of file.symbols.removed) {
          legacySymbols.add(String(symbol.symbol_id || symbol.id));
        }
        for (const symbol of file.symbols.modified) {
          legacySymbols.add(String(symbol.symbol_id || symbol.id));
        }
      }

      commit.edges = commit.edges.filter(edge => {
        // Always keep edges connected to legacy symbols (removed/modified) for dead-code detection
        const isLegacyEdge = legacySymbols.has(edge.from_symbol_id) || legacySymbols.has(edge.to_symbol_id);
        return isLegacyEdge || (edge.confidence ?? 0) >= threshold;
      });
    }
  }

  /**
   * Remove unchanged callers (would need implementation)
   */
  private truncateUnchangedCallers(report: LlmContextReport): void {
    for (const commit of report.commits) {
      const changed = new Set<string>();
      for (const file of commit.files) {
        // Handle regular symbols
        for (const s of [...file.symbols.added, ...file.symbols.modified, ...file.symbols.removed]) {
          changed.add(s.symbol_id || String(s.id));
        }
        // Handle renames (both old and new symbol IDs)
        for (const r of file.symbols.renamed || []) {
          changed.add(r.old_symbol_id);
          changed.add(r.new_symbol_id);
        }
      }
      commit.edges = commit.edges.filter(e =>
        changed.has(e.from_symbol_id) || changed.has(e.to_symbol_id)
      );
    }
  }

  /**
   * Remove documentation changes
   */
  private truncateDocChanges(report: LlmContextReport): void {
    for (const commit of report.commits) {
      for (const file of commit.files) {
        file.symbols.modified = file.symbols.modified.filter(
          symbol => symbol.mod_reason !== 'doc_changed'
        );
      }
    }
  }

  /**
   * Get current HEAD SHA
   */
  private async getHeadSha(): Promise<string> {
    try {
      const { GitOperations } = await import('./git');
      const git = new GitOperations();
      return git.getHeadSha();
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get current branch name
   */
  private async getCurrentBranch(): Promise<string> {
    try {
      const { GitOperations } = await import('./git');
      const git = new GitOperations();
      const branch = await git.getCurrentBranch();
      return branch || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Generate Mermaid graphs for the report
   */
  private async generateGraphs(commits: CommitContext[], shas: string[]): Promise<LlmContextReport['graphs']> {
    try {
      // Validate that commits match the requested shas
      if (commits.length !== shas.length) {
        logDebug(`[ContextExporter] Warning: commit count (${commits.length}) doesn't match sha count (${shas.length})`);
      }

      // Collect all edges and symbols across commits
      const allEdges: any[] = [];
      const allSymbols: any[] = [];
      const changedSymbols: any[] = [];

      for (const commit of commits) {
        allEdges.push(...commit.edges);

        for (const file of commit.files) {
          allSymbols.push(...file.symbols.added);
          allSymbols.push(...file.symbols.modified);
          allSymbols.push(...file.symbols.removed);

          // For renames, we want to show both old and new states if possible
          // But for the graph, we mainly need the nodes to exist
          if (file.symbols.renamed) {
            for (const r of file.symbols.renamed) {
              allSymbols.push({ id: r.new_symbol_id, name: r.new_name, kind: 'unknown' }); // New
              allSymbols.push({ id: r.old_symbol_id, name: r.old_name, kind: 'unknown' }); // Old
            }
          }

          changedSymbols.push(...file.symbols.added);
          changedSymbols.push(...file.symbols.modified.map((s: any) => ({ id: s.symbol_id || s.id, name: s.name })));
          changedSymbols.push(...file.symbols.removed.map((s: any) => ({ id: s.symbol_id || s.id, name: s.name })));

          if (file.symbols.renamed) {
            changedSymbols.push(...file.symbols.renamed.map((r: any) => ({ id: r.new_symbol_id, name: r.new_name })));
          }
        }
      }

      // Generate dependency graph
      const dependencyGraph = this.mermaidGenerator.generateGraph(
        allEdges,
        allSymbols,
        { maxNodes: 30, showConfidence: true }
      );

      // Generate blast radius graph using real dependency analysis
      const blastRadius = this.dependencyExtractor.calculateBlastRadius(
        changedSymbols.map(s => ({ id: s.id || s.symbol_id, name: s.name, kind: s.kind, signature: s.signature } as any)),
        allEdges
      );
      const blastRadiusGraph = this.mermaidGenerator.generateBlastRadiusGraph(changedSymbols, blastRadius);

      return {
        dependency_graph: dependencyGraph,
        blast_radius_graph: blastRadiusGraph
      };
    } catch (error) {
      const { logError } = await import('../utils/logger');
      logError('Failed to generate graphs', error);
      return undefined;
    }
  }

  /**
   * Perform legacy audit using facts/legacyAudit implementation
   * Adapter that converts LegacyAuditResult to LegacyAuditReport format
   */
  private async performLegacyAudit(shas: string[]): Promise<LegacyAuditReport> {
    try {
      // Build required inputs for legacy audit
      const scope = await computeScope(shas);
      const intended = await buildIntendedMap(shas);
      const working = await getWorkingSnapshot(scope.allPaths);

      // Use V2 detector with BaseDetector enhancements
      const legacyDetector = new LegacyDetector();
      const result = await legacyDetector.detect({
        intended,
        working,
        scope
      });

      // Convert LegacyAuditResult to LegacyAuditReport format
      return {
        missing_symbols: [], // Not directly provided by auditLegacy, would need drift detector
        zombie_symbols: result.legacyUsed.map(s => s.symbol_id),
        replaced_leftover: result.replacedLeftovers.map(r => r.old.symbol_id),
        dead_candidates: result.dead.map(s => s.symbol_id),
        drift_edges: [], // Not directly provided by auditLegacy
        hotspots: [] // Would need to compute from file-level analysis
      };
    } catch (error) {
      const { logError } = await import('../utils/logger');
      logError('Legacy audit failed, returning empty report', error);
      return {
        missing_symbols: [],
        zombie_symbols: [],
        replaced_leftover: [],
        dead_candidates: [],
        drift_edges: [],
        hotspots: []
      };
    }
  }

}
