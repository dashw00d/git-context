
/* ---- File: src/analysis/astSerializer.ts ---- */

import { getTreeSitterParser, detectLanguage } from './tree-sitter';

export interface SerializedNode {
    type: string;
    text?: string;
    range: [number, number]; // start line, end line
    children?: SerializedNode[];
}

export class AstSerializer {
    private parser = getTreeSitterParser();

    /**
     * Parse file content and return a serialized JSON representation of the AST
     * tailored for LLM consumption (compact, truncated text)
     */
    async serializeFile(content: string, filePath: string, maxDepth: number = 5): Promise<SerializedNode | null> {
        const language = detectLanguage(filePath);
        if (!language) return null;

        const tree = await this.parser.parseFile(content, language);
        if (!tree) return null;

        return this.serializeNode(tree.rootNode, maxDepth);
    }

    private serializeNode(node: any, depth: number): SerializedNode {
        const serialized: SerializedNode = {
            type: node.type,
            range: [node.startPosition.row + 1, node.endPosition.row + 1]
        };

        // Include text for leaf nodes or specific interesting nodes
        // Truncate to avoid exploding token count
        if (node.childCount === 0 || this.isInterestingNode(node.type)) {
            const text = node.text;
            if (text.length > 200) {
                serialized.text = text.substring(0, 200) + '...';
            } else {
                serialized.text = text;
            }
        }

        // Recurse for children if within depth limit
        if (depth > 0 && node.childCount > 0) {
            const children: SerializedNode[] = [];
            // Use a cursor for efficient traversal
            // Note: web-tree-sitter node.children creates an array, which is fine for small trees
            // but for performance we might want to be careful. For now, node.children is easiest.
            for (const child of node.children) {
                // Skip unnamed nodes (punctuation, etc) to save tokens, unless they are critical
                if (child.isNamed) {
                    children.push(this.serializeNode(child, depth - 1));
                }
            }
            if (children.length > 0) {
                serialized.children = children;
            }
        }

        return serialized;
    }

    private isInterestingNode(type: string): boolean {
        // Nodes where we definitely want the text content
        return [
            'identifier',
            'string',
            'string_literal',
            'number',
            'integer',
            'property_identifier',
            'type_identifier',
            'variable_name',
            'method_name',
            'class_name'
        ].includes(type);
    }
}



/* ---- File: src/analysis/contextExporter.ts ---- */

import * as fs from 'fs';
import * as path from 'path';
import { LlmContextReport, CommitContext, FileContext, SymbolContext, EdgeContext, RiskItem } from '../contracts/llmContext';
import { getDatabaseManager } from '../storage/database';
import { getGitRoot } from '../utils/config';
import { MermaidGenerator } from './mermaidGenerator';
import { DependencyExtractor } from './dependencies';
import { auditLegacy } from '../facts/legacyAudit';
import { buildIntendedMap } from '../facts/intendedMap';
import { getWorkingSnapshot } from '../facts/workingSnapshot';
import { computeScope } from '../facts/scope';
import { LegacyAuditReport } from '../contracts/llmContext';
import { getDynamicThreshold } from '../utils/edgeThresholds';

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

    const db = getDatabaseManager().getDatabase();
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
    const db = getDatabaseManager().getDatabase();

    // Get commit info
    const commitStmt = db.prepare(`
      SELECT * FROM commits_metadata WHERE sha = ?
    `);
    const commitRow = commitStmt.get(sha) as any;

    if (!commitRow) {
      throw new Error(`Commit ${sha} not found in database`);
    }

    // Get files
    const filesStmt = db.prepare(`
      SELECT * FROM files WHERE sha = ?
    `);
    const fileRows = filesStmt.all(sha) as any[];

    const files: FileContext[] = [];
    for (const fileRow of fileRows) {
      files.push(await this.buildFileContext(sha, fileRow));
    }

    // Get edges
    const edgesStmt = db.prepare(`
      SELECT * FROM edges WHERE sha = ?
    `);
    const edgeRows = edgesStmt.all(sha) as any[];

    const edges: EdgeContext[] = edgeRows.map(edge => ({
      from_symbol_id: edge.from_symbol_id,
      to_symbol_id: edge.to_symbol_id,
      edge_type: edge.edge_type as any,
      change_type: edge.change_type as any,
      confidence: edge.confidence || 1.0,
      is_resolved: Boolean(edge.is_resolved ?? 1)
    }));

    // Parse risks
    const risks = JSON.parse(commitRow.risks || '[]');

    return {
      sha,
      parent_sha: commitRow.parent_sha,
      message: commitRow.message,
      author: commitRow.author,
      date: commitRow.date,
      stats: {
        files: commitRow.files_changed,
        added: commitRow.symbols_added,
        modified: commitRow.symbols_modified,
        removed: commitRow.symbols_removed
      },
      files,
      risks,
      edges,
      llm_summary: commitRow.summary_md
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
      const { execSync } = require('child_process');
      return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  /**
   * Generate Mermaid graphs for the report
   */
  private async generateGraphs(commits: CommitContext[], shas: string[]): Promise<LlmContextReport['graphs']> {
    try {
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
      // Build required inputs for auditLegacy
      const scope = await computeScope(shas);
      const intended = await buildIntendedMap(shas);
      const working = await getWorkingSnapshot(scope.allPaths);

      // Call the production-ready audit function
      const result = await auditLegacy(intended, working, scope);

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



/* ---- File: src/analysis/conventionEnhancements.ts ---- */

/**
 * Additional convention detection enhancements:
 * - Import path conventions
 * - File naming conventions
 * - Parameter order consistency
 * - Return type conventions
 */

import * as path from 'path';

export type ImportPathStyle = 
  | 'absolute'        // /src/components/Button
  | 'relative'        // ../components/Button
  | 'alias'           // @/components/Button
  | 'package'         // react, lodash
  | 'index'           // ./components/index
  | 'extension'       // ./Button.js
  | 'no-extension';   // ./Button

export interface ImportPathConvention {
  style: ImportPathStyle;
  path: string;
  line: number;
}

export interface FileNamingConvention {
  style: 'PascalCase' | 'camelCase' | 'kebab-case' | 'snake_case' | 'SCREAMING_SNAKE' | 'mixed';
  filename: string;
  path: string;
}

/**
 * Detect import path style from import statement
 */
export function detectImportPathStyle(importPath: string): ImportPathStyle {
  if (!importPath) return 'package';

  // Package imports (no path separators, or starts with package name)
  if (!importPath.includes('/') && !importPath.includes('\\')) {
    return 'package';
  }

  // Alias imports (@/something) - must be @/ specifically
  if (importPath.startsWith('@/')) {
    return 'alias';
  }

  // Scoped npm packages (@scope/package) - @ followed by non-slash
  if (importPath.startsWith('@') && importPath[1] !== '/') {
    return 'package';
  }

  // Absolute imports (starts with /)
  if (importPath.startsWith('/')) {
    return 'absolute';
  }

  // Relative imports (starts with .)
  if (importPath.startsWith('./') || importPath.startsWith('../')) {
    // Check for index file
    if (importPath.endsWith('/index') || importPath.endsWith('/index.js') || importPath.endsWith('/index.ts')) {
      return 'index';
    }
    
    // Check for extension
    const ext = path.extname(importPath);
    if (ext && ext !== '.ts' && ext !== '.tsx' && ext !== '.js' && ext !== '.jsx') {
      return 'extension';
    }
    if (!ext || ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
      return 'no-extension';
    }
    
    return 'relative';
  }

  return 'relative'; // Default
}

/**
 * Extract import paths from code content
 */
export function extractImportPaths(content: string, language: string): ImportPathConvention[] {
  const imports: ImportPathConvention[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (language === 'javascript' || language === 'typescript') {
      // ES6 imports: import ... from 'path'
      const importMatch = line.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/);
      if (importMatch) {
        imports.push({
          style: detectImportPathStyle(importMatch[1]),
          path: importMatch[1],
          line: i + 1
        });
      }

      // CommonJS: require('path')
      const requireMatch = line.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
      if (requireMatch) {
        imports.push({
          style: detectImportPathStyle(requireMatch[1]),
          path: requireMatch[1],
          line: i + 1
        });
      }
    }

    if (language === 'php') {
      // PHP use statements: use Namespace\Class;
      const useMatch = line.match(/^use\s+([^;]+);/);
      if (useMatch) {
        imports.push({
          style: 'package', // PHP namespaces are like packages
          path: useMatch[1],
          line: i + 1
        });
      }

      // PHP require/include: require('path')
      const requireMatch = line.match(/(require|include)(_once)?\s*\(\s*['"]([^'"]+)['"]\s*\)/);
      if (requireMatch) {
        imports.push({
          style: detectImportPathStyle(requireMatch[3]),
          path: requireMatch[3],
          line: i + 1
        });
      }
    }
  }

  return imports;
}

/**
 * Analyze import path convention drift
 */
export function analyzeImportPathDrift(imports: ImportPathConvention[]): {
  dominantStyle: ImportPathStyle;
  styleCounts: Record<ImportPathStyle, number>;
  driftImports: ImportPathConvention[];
  driftPercent: number;
} {
  const counts: Record<ImportPathStyle, number> = {
    'absolute': 0,
    'relative': 0,
    'alias': 0,
    'package': 0,
    'index': 0,
    'extension': 0,
    'no-extension': 0
  };

  for (const imp of imports) {
    counts[imp.style]++;
  }

  const dominant = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)[0]?.[0] as ImportPathStyle || 'relative';

  const driftImports = imports.filter(imp => imp.style !== dominant);
  const total = imports.length;
  const driftPercent = total > 0 ? (driftImports.length / total) * 100 : 0;

  return {
    dominantStyle: dominant,
    styleCounts: counts,
    driftImports,
    driftPercent
  };
}

/**
 * Detect file naming convention
 */
export function detectFileNamingConvention(filePath: string): FileNamingConvention {
  const filename = path.basename(filePath, path.extname(filePath));
  const dir = path.dirname(filePath);

  // Analyze filename
  const hasUnderscore = filename.includes('_');
  const hasHyphen = filename.includes('-');
  const hasUppercase = /[A-Z]/.test(filename);
  const startsUpper = /^[A-Z]/.test(filename);
  const allUpper = filename === filename.toUpperCase() && hasUnderscore;

  let style: FileNamingConvention['style'];
  
  if (allUpper) {
    style = 'SCREAMING_SNAKE';
  } else if (hasUnderscore && !hasUppercase) {
    style = 'snake_case';
  } else if (hasHyphen && !hasUppercase) {
    style = 'kebab-case';
  } else if (startsUpper && hasUppercase) {
    style = 'PascalCase';
  } else if (!startsUpper && hasUppercase) {
    style = 'camelCase';
  } else if ((hasUnderscore && hasUppercase) || (hasHyphen && hasUppercase)) {
    style = 'mixed';
  } else {
    style = 'camelCase'; // Default
  }

  return {
    style,
    filename,
    path: filePath
  };
}

/**
 * Extract parameter order from function signature
 */
export function extractParameterOrder(signature: string): string[] {
  // Extract parameters from signature
  // Handles: function name(param1: type, param2: type)
  //          (param1, param2) =>
  //          name(param1, param2)
  const paramMatch = signature.match(/\(([^)]*)\)/);
  if (!paramMatch) return [];

  return paramMatch[1]
    .split(',')
    .map(p => {
      // Extract parameter name (before colon or equals)
      const name = p.trim().split(/[:=]/)[0].trim();
      return name;
    })
    .filter(p => p.length > 0);
}

/**
 * Compare parameter orders for consistency
 */
export function compareParameterOrders(signatures: string[]): {
  consistent: boolean;
  commonOrder: string[];
  inconsistencies: Array<{
    signature: string;
    order: string[];
    deviation: number;
  }>;
} {
  if (signatures.length === 0) {
    return { consistent: true, commonOrder: [], inconsistencies: [] };
  }

  const orders = signatures.map(sig => extractParameterOrder(sig));
  
  // Find most common order (by parameter name frequency at each position)
  const positionCounts = new Map<number, Map<string, number>>();
  
  for (const order of orders) {
    for (let i = 0; i < order.length; i++) {
      if (!positionCounts.has(i)) {
        positionCounts.set(i, new Map());
      }
      const counts = positionCounts.get(i)!;
      counts.set(order[i], (counts.get(order[i]) || 0) + 1);
    }
  }

  // Build common order
  const commonOrder: string[] = [];
  for (let i = 0; i < Math.max(...orders.map(o => o.length)); i++) {
    const counts = positionCounts.get(i);
    if (counts) {
      const mostCommon = Array.from(counts.entries())
        .sort(([, a], [, b]) => b - a)[0]?.[0];
      if (mostCommon) {
        commonOrder.push(mostCommon);
      }
    }
  }

  // Find inconsistencies
  const inconsistencies: Array<{
    signature: string;
    order: string[];
    deviation: number;
  }> = [];

  for (let i = 0; i < signatures.length; i++) {
    const order = orders[i];
    let deviation = 0;
    
    for (let j = 0; j < Math.min(order.length, commonOrder.length); j++) {
      if (order[j] !== commonOrder[j]) {
        deviation++;
      }
    }
    
    if (deviation > 0) {
      inconsistencies.push({
        signature: signatures[i],
        order,
        deviation
      });
    }
  }

  return {
    consistent: inconsistencies.length === 0,
    commonOrder,
    inconsistencies
  };
}

/**
 * Detect return type convention from signature
 */
export function detectReturnTypeConvention(signature: string, language: string): {
  type: 'promise' | 'callback' | 'async' | 'sync' | 'unknown';
  returnType?: string;
} {
  // Check for Promise<T>
  if (signature.includes('Promise<') || signature.includes(': Promise')) {
    return { type: 'promise', returnType: 'Promise' };
  }

  // Check for async keyword
  if (signature.includes('async') || signature.startsWith('async')) {
    return { type: 'async', returnType: 'async' };
  }

  // Check for callback pattern (function with callback parameter)
  if (signature.includes('callback') || signature.includes('cb') || 
      signature.match(/\(.*\)\s*=>/)) {
    return { type: 'callback', returnType: 'callback' };
  }

  // Check for explicit return type
  const returnTypeMatch = signature.match(/:\s*([A-Z][a-zA-Z0-9<>[\]]+)/);
  if (returnTypeMatch) {
    return { type: 'sync', returnType: returnTypeMatch[1] };
  }

  return { type: 'unknown' };
}




/* ---- File: src/analysis/dependencies.ts ---- */

import { SymbolInfo, EdgeInfo, EdgeDelta, FileChange } from '../types';
import { detectLanguage } from './tree-sitter';
import { getDatabaseManager } from '../storage/database';
import { GitOperations } from './git';
import { getDefaultThreshold } from '../utils/edgeThresholds';

export class DependencyExtractor {
  private readonly MAX_DEPTH = 3; // Prevent infinite recursion
  private resolvedSymbols = new Map<string, boolean>(); // Cache resolved symbols

  /**
   * Extract dependency edges from file content with confidence scoring
   */
  extractDependencies(content: string, filePath: string, symbols: SymbolInfo[], depth: number = 0): EdgeInfo[] {
    // Prevent stack overflow from deep recursion
    if (depth > this.MAX_DEPTH) {
      console.warn(`Max recursion depth reached for ${filePath}`);
      return [];
    }

    const language = detectLanguage(filePath);
    if (!language) {
      return [];
    }

    const edges: EdgeInfo[] = [];

    // Extract imports/requires with high confidence
    const importEdges = this.extractImports(content, filePath, language, symbols);
    edges.push(...importEdges);

    // Extract function calls within symbols
    for (const symbol of symbols) {
      const callEdges = this.extractCallsFromSymbol(content, filePath, symbol, language, symbols);
      edges.push(...callEdges);
    }

    // Mark resolved edges
    for (const edge of edges) {
      edge.confidence = edge.confidence ?? this.calculateEdgeConfidence(edge, symbols);
      edge.isResolved = this.isEdgeResolved(edge);
    }

    return edges;
  }

  /**
   * Extract import/require edges from file content with confidence
   */
  private extractImports(content: string, filePath: string, language: string, knownSymbols: SymbolInfo[]): EdgeInfo[] {
    const edges: EdgeInfo[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (language === 'php') {
        // PHP imports: use, require, include
        const useMatch = line.match(/^use\s+([^;]+);/);
        if (useMatch) {
          const imported = useMatch[1].split('\\').pop() || useMatch[1];
          edges.push({
            from: `${filePath}: file`,
            to: `class_${imported} `,
            type: 'imports',
            confidence: this.isSymbolKnown(`class_${imported} `, knownSymbols) ? 0.9 : 0.6,
            isResolved: this.isSymbolKnown(`class_${imported} `, knownSymbols)
          });
        }

        const requireMatch = line.match(/(require|include)(_once)?\s*\(\s*['"]([^'"]+)['"]\s*\)/);
        if (requireMatch) {
          const requiredFile = requireMatch[3];
          edges.push({
            from: `${filePath}: file`,
            to: `${requiredFile}: file`,
            type: 'imports',
            confidence: 0.8, // File imports are usually reliable
            isResolved: true
          });
        }
      }

      if (language === 'javascript' || language === 'typescript') {
        // JS/TS imports
        const importMatch = line.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/);
        if (importMatch) {
          const importedModule = importMatch[1];
          edges.push({
            from: `${filePath}: file`,
            to: `${importedModule}: module`,
            type: 'imports',
            confidence: 0.9, // ES6 imports are usually reliable
            isResolved: true
          });
        }

        // CommonJS requires
        const requireMatch = line.match(/const\s+\w+\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
        if (requireMatch) {
          const requiredModule = requireMatch[1];
          edges.push({
            from: `${filePath}: file`,
            to: `${requiredModule}: module`,
            type: 'imports',
            confidence: 0.8, // CommonJS requires are reliable
            isResolved: true
          });
        }
      }
    }

    return edges;
  }

  /**
   * Extract function calls from a symbol's content with confidence
   */
  private extractCallsFromSymbol(
    content: string,
    filePath: string,
    symbol: SymbolInfo,
    language: string,
    knownSymbols: SymbolInfo[]
  ): EdgeInfo[] {
    const edges: EdgeInfo[] = [];

    // Extract the symbol's code block
    const lines = content.split('\n');
    const startLine = symbol.location.start.line - 1; // Convert to 0-based
    const endLine = symbol.location.end.line - 1;

    const symbolContent = lines.slice(startLine, endLine + 1).join('\n');

    // Extract calls based on language
    if (language === 'php') {
      const callMatches = symbolContent.matchAll(/(\w+)\s*\(/g);
      for (const match of callMatches) {
        const calledFunction = match[1];
        // Skip common PHP constructs
        if (!['if', 'while', 'for', 'foreach', 'echo', 'print', 'isset', 'empty'].includes(calledFunction)) {
          const targetId = `function_${calledFunction} `;
          edges.push({
            from: symbol.id,
            to: targetId,
            type: 'calls',
            confidence: this.isSymbolKnown(targetId, knownSymbols) ? 0.8 : 0.4,
            isResolved: this.isSymbolKnown(targetId, knownSymbols)
          });
        }
      }

      // Extract method calls ($obj->method())
      const methodMatches = symbolContent.matchAll(/\$(\w+)\s*->\s*(\w+)\s*\(/g);
      for (const match of methodMatches) {
        const variable = match[1];
        const method = match[2];
        edges.push({
          from: symbol.id,
          to: `method_${method} `,
          type: 'calls'
        });
      }
    }

    if (language === 'javascript' || language === 'typescript') {
      // Extract function calls
      const callMatches = symbolContent.matchAll(/(\w+)\s*\(/g);
      for (const match of callMatches) {
        const calledFunction = match[1];
        // Skip common JS constructs and keywords
        if (!['if', 'while', 'for', 'console', 'setTimeout', 'setInterval', 'Promise', 'Array', 'Object', 'String'].includes(calledFunction)) {
          edges.push({
            from: symbol.id,
            to: `function_${calledFunction} `,
            type: 'calls'
          });
        }
      }

      // Extract method calls (obj.method())
      const methodMatches = symbolContent.matchAll(/(\w+)\.(\w+)\s*\(/g);
      for (const match of methodMatches) {
        const object = match[1];
        const method = match[2];
        edges.push({
          from: symbol.id,
          to: `method_${method} `,
          type: 'calls'
        });
      }
    }

    return edges;
  }

  /**
   * Compare two sets of edges and determine changes
   */
  compareEdges(previous: EdgeInfo[], current: EdgeInfo[]): {
    added: EdgeInfo[];
    removed: EdgeInfo[];
  } {
    const added: EdgeInfo[] = [];
    const removed: EdgeInfo[] = [];

    // Create maps for efficient lookup
    const previousMap = new Map(previous.map(e => [`${e.from}:${e.to}:${e.type} `, e]));
    const currentMap = new Map(current.map(e => [`${e.from}:${e.to}:${e.type} `, e]));

    // Find added edges
    for (const edge of current) {
      const key = `${edge.from}:${edge.to}:${edge.type} `;
      if (!previousMap.has(key)) {
        added.push(edge);
      }
    }

    // Find removed edges
    for (const edge of previous) {
      const key = `${edge.from}:${edge.to}:${edge.type} `;
      if (!currentMap.has(key)) {
        removed.push(edge);
      }
    }

    return { added, removed };
  }

  /**
   * Extract edges from working tree files
   */
  async extractWorkingTreeEdges(files: FileChange[], symbols: { added: SymbolInfo[]; removed: SymbolInfo[]; modified: any[] }, git: any): Promise<{
    added: EdgeInfo[];
    removed: EdgeInfo[];
  }> {
    const currentEdges: EdgeInfo[] = [];

    // Group symbols by file path
    const symbolsByFile = new Map<string, SymbolInfo[]>();
    for (const symbol of [...symbols.added, ...symbols.modified.map(m => m.symbol)]) {
      const filePath = symbol.id.split(':')[0];
      if (!symbolsByFile.has(filePath)) {
        symbolsByFile.set(filePath, []);
      }
      symbolsByFile.get(filePath)!.push(symbol);
    }

    // Extract edges from each file
    for (const [filePath, fileSymbols] of symbolsByFile) {
      try {
        // Get current working content
        const isStaged = files.some(f => f.path === filePath && f.status !== 'U');
        const content = isStaged
          ? git.safeGetStagedContent(filePath)
          : git.safeGetWorkingContent(filePath);

        if (content) {
          const edges = this.extractDependencies(content, filePath, fileSymbols);
          currentEdges.push(...edges);
        }
      } catch (error) {
        console.warn(`Failed to extract edges from working tree file ${filePath}:`, error);
      }
    }

    // For working tree, we consider all edges as "added" since we're comparing against HEAD
    return {
      added: currentEdges,
      removed: []
    };
  }

  /**
   * Extract edges for an entire commit
   */
  async extractCommitEdges(
    sha: string,
    symbols: { added: SymbolInfo[]; removed: SymbolInfo[]; modified: any[] },
    fileContents: Map<string, string>,
    files: FileChange[],
    git: GitOperations
  ): Promise<{
    added: EdgeInfo[];
    removed: EdgeInfo[];
  }> {
    const currentEdges: EdgeInfo[] = [];
    const previousEdges: EdgeInfo[] = [];

    // Process current symbols
    for (const [filePath, content] of fileContents) {
      const fileSymbols = symbols.added.filter(s => s.id.startsWith(`${filePath}: `));
      // Also include modified symbols in current analysis
      const modifiedSymbols = symbols.modified.map(m => m.symbol).filter(s => s.id.startsWith(`${filePath}: `));
      const allFileSymbols = [...fileSymbols, ...modifiedSymbols];

      const edges = this.extractDependencies(content, filePath, allFileSymbols);
      currentEdges.push(...edges);
    }

    // For modified files, we need to compare with previous versions
    const modifiedFiles = new Set(symbols.modified.map(m => m.symbol.id.split(':')[0]));

    // Also check for files that might have edges removed but no symbol changes
    // Ideally we should check all modified files in the commit, but we only have symbol info here
    // We'll rely on the passed fileContents which should contain all modified files

    for (const filePath of modifiedFiles) {
      try {
        const commitInfo = git.getCommitInfo(sha);
        if (commitInfo.parent) {
          // Determine correct path for parent commit (handle renames)
          const fileChange = files.find(f => f.path === filePath);
          const parentPath = (fileChange?.status === 'R' && fileChange.oldPath)
            ? fileChange.oldPath
            : filePath;

          // Get previous content safely
          const previousContent = git.safeGetFileContent(commitInfo.parent, parentPath);

          // Get previous symbols (we need to reconstruct or fetch them)
          // For now, we'll use the previousSymbol from modified deltas
          const previousFileSymbols = symbols.modified
            .filter(m => m.symbol.id.startsWith(`${filePath}: `) && m.previousSymbol)
            .map(m => m.previousSymbol!);

          // Extract previous edges
          const edges = this.extractDependencies(previousContent, filePath, previousFileSymbols);
          previousEdges.push(...edges);
        }
      } catch (error) {
        console.warn(`Failed to extract previous edges for ${filePath}: `, error);
      }
    }

    // Compare edges
    const changes = this.compareEdges(previousEdges, currentEdges);

    return {
      added: changes.added,
      removed: changes.removed
    };
  }

  /**
   * Calculate graph metrics
   */
  calculateMetrics(edges: EdgeInfo[]): {
    fanIn: Map<string, number>;
    fanOut: Map<string, number>;
  } {
    const fanIn = new Map<string, number>();
    const fanOut = new Map<string, number>();

    for (const edge of edges) {
      // Increment fan-in for the target
      fanIn.set(edge.to, (fanIn.get(edge.to) || 0) + 1);

      // Increment fan-out for the source
      fanOut.set(edge.from, (fanOut.get(edge.from) || 0) + 1);
    }

    return { fanIn, fanOut };
  }

  /**
   * Calculate blast radius for changed symbols
   */
  calculateBlastRadius(changedSymbols: SymbolInfo[], allEdges: EdgeInfo[]): {
    downstreamCallers: Map<string, SymbolInfo[]>;
    upstreamDependencies: Map<string, SymbolInfo[]>;
    impactScore: Map<string, number>;
  } {
    const downstreamCallers = new Map<string, SymbolInfo[]>();
    const upstreamDependencies = new Map<string, SymbolInfo[]>();
    const impactScore = new Map<string, number>();

    // Get symbol IDs that changed
    const changedIds = new Set(changedSymbols.map(s => s.id));

    // Find downstream callers (who calls the changed symbols)
    for (const edge of allEdges) {
      if (changedIds.has(edge.to)) {
        // edge.from calls edge.to (which changed)
        const callers = downstreamCallers.get(edge.to) || [];
        // Store the caller's ID even if we can't resolve the full symbol info
        // We create a placeholder SymbolInfo with just the ID
        if (!callers.some(c => c.id === edge.from)) {
          callers.push({ id: edge.from, name: edge.from.split(':').pop() || edge.from, kind: 'variable', location: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } }, signature: '' } as SymbolInfo);
          downstreamCallers.set(edge.to, callers);
        }
      }
    }

    // Find upstream dependencies (what the changed symbols call)
    for (const edge of allEdges) {
      if (changedIds.has(edge.from)) {
        // edge.from (which changed) calls edge.to
        const dependencies = upstreamDependencies.get(edge.from) || [];
        if (!dependencies.some(d => d.id === edge.to)) {
          dependencies.push({ id: edge.to, name: edge.to.split(':').pop() || edge.to, kind: 'variable', location: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } }, signature: '' } as SymbolInfo);
          upstreamDependencies.set(edge.from, dependencies);
        }
      }
    }

    // Calculate impact scores (simple metric)
    for (const symbolId of changedIds) {
      const downstreamCount = downstreamCallers.get(symbolId)?.length || 0;
      const upstreamCount = upstreamDependencies.get(symbolId)?.length || 0;
      impactScore.set(symbolId, downstreamCount + upstreamCount);
    }

    return { downstreamCallers, upstreamDependencies, impactScore };
  }

  /**
   * Check if a symbol ID is known/resolvable
   */
  private isSymbolKnown(symbolId: string, knownSymbols: SymbolInfo[]): boolean {
    return knownSymbols.some(s => s.id === symbolId || s.semanticId === symbolId);
  }

  /**
   * Check if an edge target is resolved
   */
  private isEdgeResolved(edge: EdgeInfo): boolean {
    // For now, assume edges are resolved if confidence > default threshold
    // In a full implementation, this would check against a symbol registry
    return (edge.confidence ?? 0) > getDefaultThreshold();
  }

  /**
   * Calculate confidence for an edge
   */
  private calculateEdgeConfidence(edge: EdgeInfo, knownSymbols: SymbolInfo[]): number {
    if (edge.type === 'imports') {
      return 0.9; // Import statements are usually reliable
    }

    if (edge.type === 'calls') {
      // Lower confidence for dynamic calls or unknown targets
      return this.isSymbolKnown(edge.to, knownSymbols) ? 0.7 : 0.3;
    }

    return 0.5; // Default confidence
  }
}



/* ---- File: src/analysis/difftastic.ts ---- */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { getExtensionConfig } from '../utils/config';

export interface DifftasticResult {
  highlights: string[];
  morphs: MorphHighlight[];
  hasStructuralChanges: boolean;
}

export interface MorphHighlight {
  type: 'signature_change' | 'moved_block' | 'refactor' | 'rename';
  description: string;
  location?: {
    file: string;
    line: number;
  };
}

export class DifftasticIntegration {
  private difftasticPath: string;

  constructor() {
    this.difftasticPath = this.findDifftasticPath();
  }

  /**
   * Find difftastic binary path
   */
  private findDifftasticPath(): string {
    const config = getExtensionConfig();

    // Check configured path first
    if (config.difftasticPath && fs.existsSync(config.difftasticPath)) {
      return config.difftasticPath;
    }

    // Check common installation paths
    const commonPaths = [
      '/usr/local/bin/difftastic',
      '/usr/bin/difftastic',
      '/opt/homebrew/bin/difftastic', // macOS Homebrew
      '/home/linuxbrew/.linuxbrew/bin/difftastic', // Linux Homebrew
      'difftastic' // In PATH
    ];

    for (const binPath of commonPaths) {
      if (this.isValidDifftasticPath(binPath)) {
        return binPath;
      }
    }

    throw new Error('Difftastic binary not found. Please install difftastic or configure the path in settings.');
  }

  /**
   * Check if a path points to a valid difftastic binary
   */
  private isValidDifftasticPath(binPath: string): boolean {
    try {
      const result = spawn(binPath, ['--version'], { stdio: 'pipe' });
      return result.pid !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Run difftastic on two file versions
   */
  async runDifftastic(
    oldContent: string,
    newContent: string,
    oldFilePath: string,
    newFilePath: string
  ): Promise<DifftasticResult> {
    return new Promise((resolve, reject) => {
      // Create temporary files
      const tempDir = require('os').tmpdir();
      const oldFile = path.join(tempDir, `old_${Date.now()}_${path.basename(oldFilePath)}`);
      const newFile = path.join(tempDir, `new_${Date.now()}_${path.basename(newFilePath)}`);

      try {
        fs.writeFileSync(oldFile, oldContent);
        fs.writeFileSync(newFile, newContent);

        // Run difftastic with fixed width to prevent side-by-side overflow panics
        const width = '200'; // Fixed wide terminal
        const difft = spawn(this.difftasticPath, [
          '--color=never', // No ANSI colors for parsing
          '--exit-code',   // Exit with code based on differences
          '--width', width, // Prevent panic on wide diffs
          oldFile,
          newFile
        ], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, COLUMNS: width, DIFT_WIDTH: width }
        });

        let stdout = '';
        let stderr = '';

        difft.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        difft.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        difft.on('close', (code) => {
          // Clean up temp files
          try {
            fs.unlinkSync(oldFile);
            fs.unlinkSync(newFile);
          } catch {
            // Ignore cleanup errors
          }

          if (code !== null && code > 1) { // 1 is success with differences, >1 is error
            reject(new Error(`Difftastic failed: ${stderr}`));
            return;
          }

          const result = this.parseDifftasticOutput(stdout, code === 1);
          resolve(result);
        });

        difft.on('error', (error) => {
          // Clean up temp files
          try {
            fs.unlinkSync(oldFile);
            fs.unlinkSync(newFile);
          } catch {
            // Ignore cleanup errors
          }
          reject(error);
        });

      } catch (error) {
        // Clean up temp files
        try {
          fs.unlinkSync(oldFile);
          fs.unlinkSync(newFile);
        } catch {
          // Ignore cleanup errors
        }
        reject(error);
      }
    });
  }

  /**
   * Parse difftastic output to extract structural highlights
   */
  private parseDifftasticOutput(output: string, hasDifferences: boolean): DifftasticResult {
    const highlights: string[] = [];
    const morphs: MorphHighlight[] = [];

    if (!hasDifferences) {
      return {
        highlights: [],
        morphs: [],
        hasStructuralChanges: false
      };
    }

    // Simple parsing: just capture relevant lines without overfitting
    const lines = output.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('File ')) {
        highlights.push(trimmed);
      }
    }

    return {
      highlights,
      morphs, // Empty for now as we don't want to overfit
      hasStructuralChanges: true
    };
  }

  /**
   * Extract location information from a difftastic output line
   */
  private extractLocationFromLine(line: string): { file: string; line: number } | undefined {
    // Difftastic doesn't always include location info in basic output
    // This would need enhancement based on actual difftastic output format
    return undefined;
  }

  /**
   * Run difftastic on a git commit to get structural highlights
   */
  /**
   * Run difftastic on a git commit to get structural highlights
   */
  async getCommitStructuralHighlights(sha: string, filePath: string, oldPath?: string): Promise<DifftasticResult> {
    try {
      // Get file content at commit and its parent
      const git = new (require('./git').GitOperations)();
      const commitInfo = git.getCommitInfo(sha);

      if (!commitInfo.parent) {
        // First commit, no parent to compare
        return {
          highlights: [],
          morphs: [],
          hasStructuralChanges: false
        };
      }

      const newContent = git.safeGetFileContent(sha, filePath);
      const parentPath = oldPath || filePath;
      const oldContent = git.safeGetFileContent(commitInfo.parent, parentPath);

      if (!newContent && !oldContent) {
        return {
          highlights: [],
          morphs: [],
          hasStructuralChanges: false
        };
      }

      return await this.runDifftastic(oldContent, newContent, parentPath, filePath);
    } catch (error: any) {
      const errorMsg = error.message || String(error);
      const widthRelated = errorMsg.includes('width') || errorMsg.includes('overflow') || errorMsg.includes('panic');
      const diagMsg = widthRelated ? 'width overflow - consider adjusting --width flag' : errorMsg;
      console.warn(`[DIFFTASTIC] Skipped ${filePath} (${diagMsg})`);
      return {
        highlights: [],
        morphs: [],
        hasStructuralChanges: false
      };
    }
  }

  /**
   * Check if difftastic is available
   */
  isAvailable(): boolean {
    try {
      return this.isValidDifftasticPath(this.difftasticPath);
    } catch {
      return false;
    }
  }
}

// Singleton instance
let difftasticInstance: DifftasticIntegration | null = null;

export function getDifftasticIntegration(): DifftasticIntegration {
  if (!difftasticInstance) {
    difftasticInstance = new DifftasticIntegration();
  }
  return difftasticInstance;
}



/* ---- File: src/analysis/git.ts ---- */

import { execSync, spawn } from 'child_process';
import * as path from 'path';
import { CommitInfo, FileChange } from '../types';
import { getGitRoot } from '../utils/config';

export class GitOperations {
  private gitRoot: string;

  constructor() {
    const root = getGitRoot();
    if (!root) {
      throw new Error('Not in a git repository');
    }
    this.gitRoot = root;
  }

  /**
   * Execute a git command and return the output
   */
  private execGit(args: string[]): string {
    try {
      return execSync(`git ${args.join(' ')}`, {
        cwd: this.gitRoot,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      }).trim();
    } catch (error: any) {
      throw new Error(`Git command failed: git ${args.join(' ')}\n${error.message}`);
    }
  }

  /**
   * Get basic commit information
   */
  getCommitInfo(sha: string): CommitInfo {
    const format = '--pretty=format:%H%n%an%n%ad%n%s%n%p';
    const output = this.execGit(['show', '--no-patch', '--date=iso', format, sha]);

    const lines = output.split('\n');
    if (lines.length < 4) {
      throw new Error(`Invalid commit format for SHA: ${sha}`);
    }

    return {
      sha: lines[0],
      author: lines[1],
      date: lines[2],
      message: lines[3],
      parent: lines[4] || undefined
    };
  }

  /**
   * Get list of commits (newest first)
   */
  getRecentCommits(count: number = 5): CommitInfo[] {
    const format = '--pretty=format:%H%n%an%n%ad%n%s%n%p';
    const output = this.execGit(['log', '--no-merges', `-${count}`, '--date=iso', format]);

    const commits: CommitInfo[] = [];
    const lines = output.split('\n');

    for (let i = 0; i < lines.length; i += 5) {
      if (lines[i]) {
        commits.push({
          sha: lines[i],
          author: lines[i + 1],
          date: lines[i + 2],
          message: lines[i + 3],
          parent: lines[i + 4] || undefined
        });
      }
    }

    return commits;
  }

  /**
   * Get file changes for a commit
   */
  getFileChanges(sha: string): FileChange[] {
    const output = this.execGit(['show', '--name-status', '--pretty=format:', sha]);

    const changes: FileChange[] = [];
    const lines = output.split('\n').filter(line => line.trim());

    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length >= 2) {
        const status = parts[0];
        const filePath = parts[1];
        let oldPath: string | undefined;

        // Handle renamed files
        if (status.startsWith('R')) {
          oldPath = parts[2];
        }

        changes.push({
          path: filePath,
          status: status.charAt(0) as FileChange['status'],
          oldPath
        });
      }
    }

    return changes;
  }

  /**
   * Get raw diff for a commit
   */
  getCommitDiff(sha: string): string {
    return this.execGit(['show', '--pretty=format:', sha]);
  }

  /**
   * Get diff for a specific file in a commit
   */
  getFileDiff(sha: string, filePath: string): string {
    // Use show with patch format for specific file
    return this.execGit(['show', '--pretty=format:', '--patch', sha, '--', filePath]);
  }

  /**
   * Get diff for a file across a range of commits (bundle)
   */
  getBundleDiff(startSha: string, endSha: string, filePath: string): string {
    // Diff from parent of start to end
    // If startSha has no parent (root), just diff startSha..endSha (which misses startSha changes if using ..)
    // Safest is startSha~1..endSha
    try {
      return this.execGit(['diff', `${startSha}~1..${endSha}`, '--', filePath]);
    } catch (e) {
      // Fallback if no parent (e.g. shallow clone or root)
      return this.execGit(['diff', `${startSha}..${endSha}`, '--', filePath]);
    }
  }

  /**
   * Get staged changes diff
   */
  getStagedDiff(): string {
    return this.execGit(['diff', '--cached']);
  }

  /**
   * Get file content at specific commit
   */
  getFileContent(sha: string, filePath: string): string {
    return this.execGit(['show', `${sha}:${filePath}`]);
  }

  /**
   * Safely get file content, returning empty string if file doesn't exist
   */
  safeGetFileContent(sha: string, filePath: string): string {
    try {
      return this.getFileContent(sha, filePath);
    } catch (error: any) {
      const msg = error.message || String(error);
      // Check for common git errors indicating file doesn't exist
      if (
        msg.includes('exists on disk, but not in') ||
        msg.includes('did not match any file') ||
        msg.includes('does not exist in')
      ) {
        return '';
      }
      throw error;
    }
  }

  /**
   * Get staged file content (from index)
   */
  getStagedContent(filePath: string): string {
    return this.execGit(['show', `:${filePath}`]);
  }

  /**
   * Safely get staged file content, returning empty string if file doesn't exist in index
   */
  safeGetStagedContent(filePath: string): string {
    try {
      return this.getStagedContent(filePath);
    } catch (error: any) {
      const msg = error.message || String(error);
      if (
        msg.includes('exists on disk, but not in') ||
        msg.includes('did not match any file') ||
        msg.includes('does not exist in')
      ) {
        return '';
      }
      throw error;
    }
  }

  /**
   * Get working directory file content
   */
  getWorkingContent(filePath: string): string {
    const fs = require('fs');
    const path = require('path');
    const fullPath = path.join(this.gitRoot, filePath);
    return fs.readFileSync(fullPath, 'utf8');
  }

  /**
   * Safely get working directory file content, returning empty string if file doesn't exist
   */
  safeGetWorkingContent(filePath: string): string {
    try {
      return this.getWorkingContent(filePath);
    } catch (error: any) {
      // File doesn't exist in working directory
      return '';
    }
  }

  /**
   * Check if a file is ignored by git
   */
  isIgnored(filePath: string): boolean {
    try {
      // git check-ignore returns exit code 0 if ignored, 1 if not ignored
      this.execGit(['check-ignore', '-q', filePath]);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current HEAD SHA
   */
  getHeadSha(): string {
    return this.execGit(['rev-parse', 'HEAD']);
  }

  /**
   * Check if repository is clean (no uncommitted changes)
   */
  isClean(): boolean {
    try {
      this.execGit(['diff', '--quiet']);
      this.execGit(['diff', '--cached', '--quiet']);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get list of changed files in working directory
   */
  getWorkingDirectoryChanges(): FileChange[] {
    const output = this.execGit(['status', '--porcelain']);

    const changes: FileChange[] = [];
    const lines = output.split('\n').filter(line => line.trim());

    for (const line of lines) {
      const status = line.substring(0, 2).trim();
      const filePath = line.substring(3);

      // Map git status codes to our status types
      let changeStatus: FileChange['status'];
      if (status.includes('A')) {
        changeStatus = 'A';
      } else if (status.includes('M')) {
        changeStatus = 'M';
      } else if (status.includes('D')) {
        changeStatus = 'D';
      } else if (status.includes('R')) {
        changeStatus = 'R';
      } else if (status.includes('C')) {
        changeStatus = 'C';
      } else if (status.includes('U')) {
        changeStatus = 'U';
      } else {
        changeStatus = 'M'; // Default to modified
      }

      changes.push({
        path: filePath,
        status: changeStatus
      });
    }

    return changes;
  }

  /**
   * Get staged files only
   */
  getStagedFiles(): FileChange[] {
    const output = this.execGit(['status', '--porcelain']);

    const staged: FileChange[] = [];
    const lines = output.split('\n').filter(line => line.trim());

    for (const line of lines) {
      const status = line.substring(0, 2);
      const filePath = line.substring(3);

      // First character indicates staged status (not space, not ?)
      if (status.charAt(0) !== ' ' && status.charAt(0) !== '?') {
        let changeStatus: FileChange['status'];
        if (status.charAt(0) === 'A') {
          changeStatus = 'A';
        } else if (status.charAt(0) === 'M') {
          changeStatus = 'M';
        } else if (status.charAt(0) === 'D') {
          changeStatus = 'D';
        } else if (status.charAt(0) === 'R') {
          changeStatus = 'R';
        } else {
          changeStatus = 'M';
        }

        staged.push({
          path: filePath,
          status: changeStatus
        });
      }
    }

    return staged;
  }

  /**
   * Get unstaged files only (including untracked files)
   */
  getUnstagedFiles(): FileChange[] {
    const output = this.execGit(['status', '--porcelain']);

    const unstaged: FileChange[] = [];
    const lines = output.split('\n').filter(line => line.trim());

    for (const line of lines) {
      const status = line.substring(0, 2);
      const filePath = line.substring(3);

      // Second character indicates unstaged status (not space)
      // Include untracked files (?) as unstaged
      if (status.charAt(1) !== ' ') {
        let changeStatus: FileChange['status'];
        if (status.charAt(1) === 'A') {
          changeStatus = 'A';
        } else if (status.charAt(1) === 'M') {
          changeStatus = 'M';
        } else if (status.charAt(1) === 'D') {
          changeStatus = 'D';
        } else if (status.charAt(1) === 'R') {
          changeStatus = 'R';
        } else if (status.charAt(1) === '?') {
          // Untracked files are considered unstaged
          changeStatus = 'U';
        } else {
          changeStatus = 'M';
        }

        unstaged.push({
          path: filePath,
          status: changeStatus
        });
      }
    }

    // Also include untracked files from ls-files
    try {
      const untrackedOutput = this.execGit(['ls-files', '--others', '--exclude-standard']);
      const untrackedLines = untrackedOutput.split('\n').filter(f => f.trim());
      for (const filePath of untrackedLines) {
        // Only add if not already in unstaged (avoid duplicates)
        if (!unstaged.some(f => f.path === filePath)) {
          unstaged.push({
            path: filePath,
            status: 'U' // U = untracked
          });
        }
      }
    } catch (error) {
      // Silently ignore if ls-files fails (e.g., no untracked files)
    }

    return unstaged;
  }

  /**
   * Get diff stats for a specific file (added/removed lines)
   */
  getFileDiffStats(filePath: string, staged: boolean = false): { added: number; removed: number } {
    try {
      const args = staged ? ['diff', '--cached', '--numstat', '--', filePath] : ['diff', '--numstat', '--', filePath];
      const output = this.execGit(args);

      if (!output.trim()) {
        return { added: 0, removed: 0 };
      }

      // --numstat output format: "added<TAB>removed<TAB>file"
      const parts = output.trim().split('\t');
      if (parts.length >= 2) {
        const added = parseInt(parts[0], 10) || 0;
        const removed = parseInt(parts[1], 10) || 0;
        return { added, removed };
      }

      return { added: 0, removed: 0 };
    } catch (error) {
      // If git diff fails (e.g., file not tracked), return zero stats
      return { added: 0, removed: 0 };
    }
  }

  /**
   * Spawn a git command asynchronously
   */
  async spawnGit(args: string[]): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const git = spawn('git', args, {
        cwd: this.gitRoot,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      git.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      git.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      git.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Git command failed with code ${code}: ${stderr}`));
        }
      });

      git.on('error', (error) => {
        reject(error);
      });
    });
  }
}



/* ---- File: src/analysis/heuristics.ts ---- */

import { RiskFlag, SymbolDelta, FileChange, EdgeInfo } from '../types';

export class RiskDetector {
  /**
   * Analyze a commit and detect risk flags
   */
  detectRisks(
    files: FileChange[],
    symbols: {
      added: any[];
      removed: any[];
      modified: SymbolDelta[];
    },
    edges: {
      added: EdgeInfo[];
      removed: EdgeInfo[];
    }
  ): RiskFlag[] {
    const risks: RiskFlag[] = [];

    // Check for breaking changes
    if (this.hasBreakingChanges(symbols.modified)) {
      risks.push('breaking-api');
    }

    // Check for migrations
    if (this.hasMigrations(files)) {
      risks.push('schema-migration');
    }

    // Check for refactors
    if (this.hasRefactor(files, symbols)) {
      risks.push('refactor');
    }

    // Check for security-related changes
    if (this.hasSecurityChanges(files, symbols)) {
      risks.push('security');
    }

    // Check for performance-related changes
    if (this.hasPerformanceChanges(files, symbols)) {
      risks.push('performance');
    }

    // Check for authentication changes
    if (this.hasAuthChanges(files, symbols)) {
      risks.push('auth');
    }

    // Check for payment-related changes
    if (this.hasPaymentChanges(files, symbols)) {
      risks.push('payment');
    }

    return risks;
  }

  /**
   * Check for breaking API changes
   */
  private hasBreakingChanges(modifiedSymbols: SymbolDelta[]): boolean {
    for (const delta of modifiedSymbols) {
      // Public function/method signature changes
      if ((delta.symbol.kind === 'function' || delta.symbol.kind === 'method') &&
          delta.changeType === 'signature_changed' &&
          this.isPublicSymbol(delta.symbol)) {
        return true;
      }

      // Removed public exports
      if (delta.changeType === 'removed' && this.isPublicSymbol(delta.symbol)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check for database/schema migrations
   */
  private hasMigrations(files: FileChange[]): boolean {
    const migrationPatterns = [
      /migration/i,
      /schema/i,
      /database/i,
      /db/i,
      /\.sql$/,
      /alter\s+table/i,
      /create\s+table/i,
      /drop\s+table/i,
      /migration\.php$/,
      /migration\.js$/,
      /migration\.ts$/
    ];

    return files.some(file => {
      const fileName = file.path.toLowerCase();
      return migrationPatterns.some(pattern => pattern.test(fileName));
    });
  }

  /**
   * Check for large refactoring operations
   */
  private hasRefactor(
    files: FileChange[],
    symbols: { added: any[]; removed: any[]; modified: SymbolDelta[] }
  ): boolean {
    // Many files changed
    if (files.length > 10) {
      return true;
    }

    // Many symbols renamed or moved
    const renamedSymbols = symbols.modified.filter(delta =>
      delta.changeType === 'signature_changed' &&
      this.isRename(delta.symbol, delta.previousSymbol)
    );

    if (renamedSymbols.length > 5) {
      return true;
    }

    // Large number of symbol changes
    const totalSymbolChanges = symbols.added.length + symbols.removed.length + symbols.modified.length;
    if (totalSymbolChanges > 20) {
      return true;
    }

    return false;
  }

  /**
   * Check for security-related changes
   */
  private hasSecurityChanges(
    files: FileChange[],
    symbols: { added: any[]; removed: any[]; modified: SymbolDelta[] }
  ): boolean {
    const securityPatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /auth/i,
      /security/i,
      /encrypt/i,
      /decrypt/i,
      /hash/i,
      /ssl/i,
      /tls/i,
      /certificate/i,
      /vulnerability/i,
      /exploit/i
    ];

    // Check file names
    if (files.some(file => securityPatterns.some(pattern => pattern.test(file.path)))) {
      return true;
    }

    // Check symbol names
    const allSymbols = [...symbols.added, ...symbols.modified.map(s => s.symbol)];
    if (allSymbols.some(symbol => securityPatterns.some(pattern => pattern.test(symbol.name)))) {
      return true;
    }

    return false;
  }

  /**
   * Check for performance-related changes
   */
  private hasPerformanceChanges(
    files: FileChange[],
    symbols: { added: any[]; removed: any[]; modified: SymbolDelta[] }
  ): boolean {
    const performancePatterns = [
      /performance/i,
      /optimize/i,
      /cache/i,
      /memory/i,
      /speed/i,
      /latency/i,
      /throughput/i,
      /bottleneck/i,
      /slow/i,
      /fast/i
    ];

    // Check file names
    if (files.some(file => performancePatterns.some(pattern => pattern.test(file.path)))) {
      return true;
    }

    // Check symbol names
    const allSymbols = [...symbols.added, ...symbols.modified.map(s => s.symbol)];
    if (allSymbols.some(symbol => performancePatterns.some(pattern => pattern.test(symbol.name)))) {
      return true;
    }

    return false;
  }

  /**
   * Check for authentication-related changes
   */
  private hasAuthChanges(
    files: FileChange[],
    symbols: { added: any[]; removed: any[]; modified: SymbolDelta[] }
  ): boolean {
    const authPatterns = [
      /auth/i,
      /login/i,
      /logout/i,
      /session/i,
      /user/i,
      /permission/i,
      /role/i,
      /access/i,
      /authenticate/i,
      /authorization/i
    ];

    // Check file names
    if (files.some(file => authPatterns.some(pattern => pattern.test(file.path)))) {
      return true;
    }

    // Check symbol names
    const allSymbols = [...symbols.added, ...symbols.modified.map(s => s.symbol)];
    if (allSymbols.some(symbol => authPatterns.some(pattern => pattern.test(symbol.name)))) {
      return true;
    }

    return false;
  }

  /**
   * Check for payment-related changes
   */
  private hasPaymentChanges(
    files: FileChange[],
    symbols: { added: any[]; removed: any[]; modified: SymbolDelta[] }
  ): boolean {
    const paymentPatterns = [
      /payment/i,
      /billing/i,
      /invoice/i,
      /charge/i,
      /refund/i,
      /stripe/i,
      /paypal/i,
      /checkout/i,
      /transaction/i,
      /money/i,
      /currency/i
    ];

    // Check file names
    if (files.some(file => paymentPatterns.some(pattern => pattern.test(file.path)))) {
      return true;
    }

    // Check symbol names
    const allSymbols = [...symbols.added, ...symbols.modified.map(s => s.symbol)];
    if (allSymbols.some(symbol => paymentPatterns.some(pattern => pattern.test(symbol.name)))) {
      return true;
    }

    return false;
  }

  /**
   * Check if a symbol is public (not private)
   */
  private isPublicSymbol(symbol: any): boolean {
    // Symbols starting with underscore are typically private
    return !symbol.name.startsWith('_');
  }

  /**
   * Check if a symbol change represents a rename
   */
  private isRename(current: any, previous: any): boolean {
    // Same signature structure but different name
    return current.name !== previous.name &&
           current.signature.replace(current.name, 'X') === previous.signature.replace(previous.name, 'X');
  }
}



/* ---- File: src/analysis/llmAnalyst/blocks.ts ---- */

/**
 * Typed structures for LLM analyst output
 * Evidence-linked blocks that can be rendered with clickable references
 */

export interface EvidenceLink {
  /** JSON path in facts (e.g., "findings.legacyAudit.dead[2]") */
  path: string;
  /** Human-readable description */
  description: string;
  /** Optional symbol/file reference for UI linking */
  symbolId?: string;
  /** Optional file path for opening */
  filePath?: string;
  /** Optional line number */
  lineNumber?: number;
}

export interface Claim {
  /** The claim or finding */
  text: string;
  /** Confidence level (0.0-1.0) */
  confidence: number;
  /** Evidence supporting this claim */
  evidence: EvidenceLink[];
  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface Action {
  /** Actionable task description */
  description: string;
  /** Priority level */
  priority: 'low' | 'medium' | 'high' | 'urgent';
  /** Evidence this action addresses */
  evidence: EvidenceLink[];
  /** Estimated effort (story points or time) */
  effort: 'xs' | 's' | 'm' | 'l' | 'xl';
  /** Risk level of implementing this action */
  risk: 'low' | 'medium' | 'high';
  /** Dependencies on other actions */
  dependsOn?: string[];
}

export interface AnalysisBlock {
  /** Unique identifier for this block */
  id: string;
  /** Human-readable title */
  title: string;
  /** Block type */
  type: 'intent' | 'drift' | 'cleanup' | 'summary' | 'discovery';
  /** Claims made in this block */
  claims: Claim[];
  /** Recommended actions */
  actions: Action[];
  /** Overall confidence in this analysis */
  confidence: number;
  /** When this analysis was generated */
  timestamp: string;
}

export interface LlmAnalysis {
  /** Overall analysis summary */
  summary: string;
  /** Structured analysis blocks */
  blocks: AnalysisBlock[];
  /** Generation metadata */
  metadata: {
    /** Total LLM calls made */
    totalCalls: number;
    /** Total tokens used */
    totalTokens: number;
    /** Model used */
    model: string;
    /** Generation timestamp */
    timestamp: string;
    /** Refactor health score (0-100) */
    healthScore?: number;
  };
  /** Rendered markdown version */
  markdown: string;
}

/**
 * Utility functions for working with analysis blocks
 */
export class AnalysisBlockUtils {
  /**
   * Create a new analysis block
   */
  static createBlock(
    id: string,
    title: string,
    type: AnalysisBlock['type'],
    claims: Claim[] = [],
    actions: Action[] = []
  ): AnalysisBlock {
    return {
      id,
      title,
      type,
      claims,
      actions,
      confidence: 0.8, // Default confidence
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Add a claim to a block
   */
  static addClaim(block: AnalysisBlock, claim: Claim): void {
    block.claims.push(claim);
  }

  /**
   * Add an action to a block
   */
  static addAction(block: AnalysisBlock, action: Action): void {
    block.actions.push(action);
  }

  /**
   * Create an evidence link
   */
  static createEvidence(
    path: string,
    description: string,
    symbolId?: string,
    filePath?: string,
    lineNumber?: number
  ): EvidenceLink {
    return {
      path,
      description,
      symbolId,
      filePath,
      lineNumber
    };
  }

  /**
   * Create an evidence link with auto-generated readable description
   * Parses the evidence path to generate human-readable text
   */
  static createEvidenceAuto(path: string, context?: string): EvidenceLink {
    const description = this.parseEvidencePathToDescription(path, context);
    const parsed = this.parseEvidencePath(path);
    
    return {
      path,
      description,
      symbolId: parsed.symbolId,
      filePath: parsed.filePath,
      lineNumber: parsed.lineNumber
    };
  }

  /**
   * Parse evidence path into human-readable description
   * Handles various path formats:
   * - diff[file.php] (code snippet)
   * - ast[file.php].method_name
   * - graph.nodes[symbol_id]
   * - graph.edges[from -> to]
   * - findings.incompleteness.missing[0]
   */
  static parseEvidencePathToDescription(path: string, context?: string): string {
    if (!path) return context || 'Evidence';

    // Handle diff paths: diff[file.php] (code snippet)
    const diffMatch = path.match(/^diff\[([^\]]+)\]\s*(?:\(([^)]+)\))?/);
    if (diffMatch) {
      const file = diffMatch[1].split('/').pop() || diffMatch[1];
      const snippet = diffMatch[2];
      if (snippet) {
        // Clean up the snippet - show first meaningful part
        const cleanSnippet = snippet.replace(/\s+/g, ' ').trim();
        return `Diff: ${file} - "${cleanSnippet.substring(0, 40)}${cleanSnippet.length > 40 ? '...' : ''}"`;
      }
      return `Diff: ${file}`;
    }

    // Handle AST paths: ast[file.php].method_name
    const astMatch = path.match(/^ast\[([^\]]+)\]\.?(\w+)?/);
    if (astMatch) {
      const file = astMatch[1].split('/').pop() || astMatch[1];
      const symbol = astMatch[2];
      if (symbol) {
        const cleanSymbol = symbol.replace(/^(method_|property_|class_|function_)/, '');
        return `AST: ${cleanSymbol}() in ${file}`;
      }
      return `AST: ${file}`;
    }

    // Handle graph node paths: graph.nodes[symbol_id]
    const nodeMatch = path.match(/^graph\.nodes\[([^\]]+)\]/);
    if (nodeMatch) {
      const symbolId = nodeMatch[1];
      const parts = symbolId.split(':');
      if (parts.length > 1) {
        const file = parts[0].split('/').pop() || parts[0];
        const symbol = parts[1].replace(/^(method_|property_|class_|function_)/, '');
        return `Graph node: ${symbol} in ${file}`;
      }
      return `Graph node: ${symbolId}`;
    }

    // Handle graph edge paths: graph.edges[from -> to]
    const edgeMatch = path.match(/^graph\.edges\[([^\]]+)\]/);
    if (edgeMatch) {
      const edge = edgeMatch[1];
      return `Graph edge: ${edge.replace(/ -> /g, ' → ')}`;
    }

    // Handle JSON paths: findings.incompleteness.missing
    const jsonPathMatch = path.match(/^(findings|intended|working|scope|bundle|evidence)\.(.+)/);
    if (jsonPathMatch) {
      const section = jsonPathMatch[1];
      const subpath = jsonPathMatch[2];
      
      // Clean up the subpath for display
      const parts = subpath.split('.');
      const lastPart = parts[parts.length - 1].replace(/\[\d+\]$/, '');
      
      // Generate human-readable names
      const readableNames: Record<string, string> = {
        'incompleteness.missing': 'Missing symbols',
        'incompleteness.zombies': 'Zombie symbols',
        'incompleteness.divergent': 'Divergent symbols',
        'legacyAudit.dead': 'Dead code',
        'legacyAudit.legacyUsed': 'Legacy code still in use',
        'legacyAudit.replacedLeftovers': 'Replaced leftovers',
        'patternDrift.mixedTargets': 'Mixed patterns',
        'patternDrift.oldNamespaces': 'Old namespaces',
        'patternDrift.conventionDrift': 'Naming convention drift',
        'patternDrift.mixedConventionFiles': 'Files with mixed conventions',
        'blastRadius': 'Blast radius',
        'symbols': 'Working symbols',
        'edges': 'Symbol relationships',
        'files': 'Changed files',
        'shas': 'Commit SHAs',
        'present': 'Symbols expected present',
        'absent': 'Symbols expected absent'
      };

      const readableName = readableNames[subpath] || 
                          readableNames[parts.slice(-2).join('.')] || 
                          lastPart.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
      
      return `${readableName}`;
    }

    // Fallback: clean up raw path
    if (context) {
      return context;
    }
    
    // Try to make the path more readable
    return path
      .replace(/\[/g, ': ')
      .replace(/\]/g, '')
      .replace(/_/g, ' ')
      .replace(/\./g, ' > ')
      .replace(/([a-z])([A-Z])/g, '$1 $2');
  }

  /**
   * Parse evidence path to extract file/symbol info
   */
  static parseEvidencePath(path: string): { filePath?: string; symbolId?: string; lineNumber?: number } {
    const result: { filePath?: string; symbolId?: string; lineNumber?: number } = {};

    // Extract file path from various formats
    const filePatterns = [
      /diff\[([^\]]+)\]/,           // diff[file.php]
      /ast\[([^\]]+)\]/,            // ast[file.php]
      /^([^:]+\.(?:php|ts|js|tsx|jsx)):/, // file.php:symbol
    ];

    for (const pattern of filePatterns) {
      const match = path.match(pattern);
      if (match) {
        result.filePath = match[1];
        break;
      }
    }

    // Extract symbol ID
    const symbolPatterns = [
      /graph\.nodes\[([^\]]+)\]/,   // graph.nodes[symbol_id]
      /([^:]+):(\w+)$/,              // file:symbol
    ];

    for (const pattern of symbolPatterns) {
      const match = path.match(pattern);
      if (match) {
        result.symbolId = match[1];
        break;
      }
    }

    return result;
  }

  /**
   * Extract file path from symbol ID
   */
  static extractFilePath(symbolId: string): string {
    return symbolId.split(':')[0];
  }

  /**
   * Extract symbol name from symbol ID
   */
  static extractSymbolName(symbolId: string): string {
    const parts = symbolId.split(':');
    return parts.length > 1 ? parts[parts.length - 1] : symbolId;
  }

  /**
   * Sort actions by priority and dependencies
   */
  static sortActions(actions: Action[]): Action[] {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };

    return actions.sort((a, b) => {
      // Sort by priority first
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Then by effort (smaller first)
      const effortOrder = { xs: 0, s: 1, m: 2, l: 3, xl: 4 };
      return effortOrder[a.effort] - effortOrder[b.effort];
    });
  }

  /**
   * Filter blocks by type
   */
  static filterByType(blocks: AnalysisBlock[], type: AnalysisBlock['type']): AnalysisBlock[] {
    return blocks.filter(block => block.type === type);
  }

  /**
   * Get all evidence links from blocks
   */
  static getAllEvidence(blocks: AnalysisBlock[]): EvidenceLink[] {
    const evidence: EvidenceLink[] = [];
    for (const block of blocks) {
      for (const claim of block.claims) {
        evidence.push(...claim.evidence);
      }
      for (const action of block.actions) {
        evidence.push(...action.evidence);
      }
    }
    return evidence;
  }
}



/* ---- File: src/analysis/llmAnalyst/renderer.ts ---- */

import { LlmAnalysis, AnalysisBlock, AnalysisBlockUtils, EvidenceLink } from './blocks';
import { RefactorBundleFacts } from '../../facts/types';

/**
 * Resolve evidence JSON path to file location
 */
export function resolveEvidencePath(
  evidencePath: string,
  facts: RefactorBundleFacts
): { filePath: string; lineNumber?: number; description: string } | null {
  // Parse JSON path like "findings.incompleteness.missing[0]"
  const pathParts = evidencePath.split('.');
  const arrayMatch = pathParts[pathParts.length - 1].match(/^(\w+)\[(\d+)\]$/);

  if (arrayMatch) {
    const [_, arrayName, index] = arrayMatch;
    const arrayPath = pathParts.slice(0, -1).join('.');

    // Navigate to the array in facts
    let current: any = facts;
    for (const part of arrayPath.split('.')) {
      current = current[part];
      if (!current) return null;
    }

    const item = current[parseInt(index)];
    if (item && item.symbol_id) {
      const filePath = item.symbol_id.split(':')[0];
      // Try to extract line number from location data
      let lineNumber: number | undefined;
      if (item.loc_pre?.start?.line) {
        lineNumber = item.loc_pre.start.line;
      } else if (item.loc_post?.start?.line) {
        lineNumber = item.loc_post.start.line;
      } else if (item.expected?.lastPath) {
        // Try to get from expected state
        lineNumber = undefined;
      }

      return {
        filePath,
        lineNumber,
        description: evidencePath
      };
    }

    // Also check evidence object directly
    if (facts.evidence && facts.evidence[arrayName]) {
      const evidenceArray = facts.evidence[arrayName];
      if (Array.isArray(evidenceArray) && evidenceArray[parseInt(index)]) {
        const evidenceItem = evidenceArray[parseInt(index)];
        if (evidenceItem.symbol_id) {
          const filePath = evidenceItem.symbol_id.split(':')[0];
          return {
            filePath,
            lineNumber: evidenceItem.loc_pre?.start?.line || evidenceItem.loc_post?.start?.line,
            description: evidencePath
          };
        }
      }
    }
  }

  // Try direct path access (e.g., "bundle.shas")
  let current: any = facts;
  for (const part of evidencePath.split('.')) {
    if (current && typeof current === 'object') {
      current = current[part];
    } else {
      return null;
    }
  }

  // If we found something but it's not a symbol, return path info
  if (current !== undefined && current !== null) {
    return {
      filePath: evidencePath, // Use path as file path for non-symbol evidence
      description: evidencePath
    };
  }

  return null;
}

/**
 * Renderer for LLM analysis results
 * Generates interwoven markdown with clickable evidence links
 */
export class AnalysisRenderer {

  /**
   * Render complete analysis to markdown
   */
  renderAnalysis(analysis: LlmAnalysis, facts: RefactorBundleFacts): string {
    let markdown = this.renderHeader(analysis, facts);

    // Add findings sections with stable anchors for navigation
    markdown += this.renderFindingsSections(facts);

    // Filter low-value content before sorting
    const filteredBlocks = this.filterLowValueContent(analysis.blocks);

    // Sort blocks by value score (high-value first)
    const sortedBlocks = this.sortBlocks(filteredBlocks);

    for (const block of sortedBlocks) {
      markdown += this.renderBlock(block, facts);
    }

    markdown += this.renderFooter(analysis);
    return markdown;
  }

  /**
   * Filter out low-value content from blocks
   */
  private filterLowValueContent(blocks: AnalysisBlock[]): AnalysisBlock[] {
    return blocks.map(block => ({
      ...block,
      claims: block.claims.filter(c => 
        c.severity !== 'low' || c.confidence >= 0.8
      ),
      actions: block.actions.filter(a =>
        a.priority !== 'low' || (a.effort === 'xs' && a.risk === 'low')
      )
    })).filter(block => 
      block.claims.length > 0 || block.actions.length > 0
    );
  }

  /**
   * Render findings sections with stable anchors for tree navigation
   * These anchors correspond to bundle category nodes in the tree view
   */
  private renderFindingsSections(facts: RefactorBundleFacts): string {
    let content = `## 🔍 Findings Overview\n\n`;
    content += `This section provides structured findings data for navigation from the Commit Tracker sidebar.\n\n`;

    // Incompleteness section
    if (facts.findings.incompleteness.missing > 0 || facts.findings.incompleteness.zombies > 0) {
      content += `### {#incompleteness} Incompleteness Analysis\n\n`;
      
      if (facts.findings.incompleteness.missing > 0) {
        content += `#### {#incompleteness-missing} Missing Additions (${facts.findings.incompleteness.missing})\n\n`;
        content += `Symbols added in commits but not found in working tree.\n\n`;
        const missing = facts.evidence?.['findings.incompleteness.missing'] || [];
        if (missing.length > 0) {
          content += `**Top ${Math.min(10, missing.length)} missing symbols:**\n\n`;
          missing.slice(0, 10).forEach((item: any, idx: number) => {
            const symbolName = item.symbol_id?.split(':')[1] || item.symbol_id;
            content += `${idx + 1}. \`${symbolName}\` - Expected: ${item.expected?.expect || 'present'}\n`;
          });
          content += `\n`;
        }
      }

      if (facts.findings.incompleteness.zombies > 0) {
        content += `#### {#incompleteness-zombies} Zombie Removals (${facts.findings.incompleteness.zombies})\n\n`;
        content += `Symbols removed in commits but still exist in working tree.\n\n`;
        const zombies = facts.evidence?.['findings.incompleteness.zombies'] || [];
        if (zombies.length > 0) {
          content += `**Top ${Math.min(10, zombies.length)} zombie symbols:**\n\n`;
          zombies.slice(0, 10).forEach((item: any, idx: number) => {
            const symbolName = item.found?.name || item.symbol_id?.split(':')[1] || item.symbol_id;
            content += `${idx + 1}. \`${symbolName}\` - Should be removed\n`;
          });
          content += `\n`;
        }
      }
      content += `\n`;
    }

    // Drift section
    if (facts.findings.patternDrift.mixedTargets > 0 || facts.findings.patternDrift.oldNamespaces > 0) {
      content += `### {#drift} Pattern Drift Analysis\n\n`;
      
      const hotspots = facts.evidence?.['findings.drift.hotspots'] || [];
      if (hotspots.length > 0) {
        content += `#### {#drift-hotspots} Drift Hotspots (${hotspots.length})\n\n`;
        content += `Files with multiple drift issues.\n\n`;
        hotspots.slice(0, 10).forEach((h: any, idx: number) => {
          content += `${idx + 1}. \`${h.path}\` - ${h.drift_count} drift issues\n`;
        });
        content += `\n`;
      }

      if (facts.findings.patternDrift.mixedTargets > 0) {
        content += `#### Mixed Targets (${facts.findings.patternDrift.mixedTargets})\n\n`;
        content += `Inconsistent target usage patterns detected.\n\n`;
      }

      if (facts.findings.patternDrift.oldNamespaces > 0) {
        content += `#### Old Namespaces (${facts.findings.patternDrift.oldNamespaces})\n\n`;
        content += `Using outdated namespace patterns.\n\n`;
      }
      content += `\n`;
    }

    // Convention drift section
    if (facts.findings.patternDrift.conventionDrift) {
      content += this.renderConventionDriftSection(facts);
    }

    // Legacy section
    if (facts.findings.legacyAudit.dead > 0 || facts.findings.legacyAudit.replacedLeftovers.length > 0) {
      content += `### {#legacy} Legacy Audit\n\n`;
      
      if (facts.findings.legacyAudit.dead > 0) {
        content += `#### {#legacy-dead} Dead Code (${facts.findings.legacyAudit.dead})\n\n`;
        content += `Symbols no longer used.\n\n`;
        const dead = facts.evidence?.['findings.legacyAudit.dead'] || [];
        if (dead.length > 0) {
          content += `**Top ${Math.min(20, dead.length)} dead symbols:**\n\n`;
          dead.slice(0, 20).forEach((item: any, idx: number) => {
            const symbolName = item.name || item.symbol_id?.split(':')[1] || item.symbol_id;
            content += `${idx + 1}. \`${symbolName}\` - ${item.kind || 'unknown'}\n`;
          });
          content += `\n`;
        }
      }

      if (facts.findings.legacyAudit.replacedLeftovers.length > 0) {
        content += `#### Replaced Leftovers (${facts.findings.legacyAudit.replacedLeftovers.length})\n\n`;
        content += `Old symbols that should have been removed.\n\n`;
      }
      content += `\n`;
    }

    // Timeline section (if we have commit data)
    if (facts.bundle.shas.length > 0) {
      content += `### {#timeline} Timeline Rewind\n\n`;
      content += `Evolution of changes across ${facts.bundle.shas.length} commit(s).\n\n`;
      content += `**Commits in bundle:**\n\n`;
      facts.bundle.shas.forEach((sha: string, idx: number) => {
        content += `${idx + 1}. \`${sha.substring(0, 8)}\`\n`;
      });
      content += `\n`;
    }

    content += `---\n\n`;
    return content;
  }

  /**
   * Render analysis header with health score
   */
  private renderHeader(analysis: LlmAnalysis, facts: RefactorBundleFacts): string {
    const healthScore = this.calculateHealthScore(facts);
    const healthIndicator = healthScore >= 80 ? '✅' : healthScore >= 60 ? '⚠️' : '🔴';
    
    let header = `# 🤖 LLM Analysis Report\n\n`;
    header += `**Generated:** ${new Date(analysis.metadata.timestamp).toLocaleString()}\n`;
    header += `**Bundle:** ${facts.bundle.shas.length} commits (${facts.bundle.oldestSha.substring(0, 8)}...)\n`;
    header += `**Symbols:** ${facts.working.symbols} analyzed, ${facts.working.edges} relationships\n`;
    header += `**Refactor Health:** ${healthScore.toFixed(0)}/100 ${healthIndicator}\n`;
    header += `**Model:** ${analysis.metadata.model}\n`;
    header += `**Analysis Time:** ${this.formatDuration(analysis.metadata.totalCalls)}\n\n`;

    if (analysis.summary) {
      header += `${analysis.summary}\n\n`;
    }

    return header;
  }

  /**
   * Render analysis footer
   */
  private renderFooter(analysis: LlmAnalysis): string {
    let footer = `---\n\n`;
    footer += `**Analysis Details:** ${analysis.metadata.totalCalls} LLM calls, `;
    footer += `~${analysis.metadata.totalTokens.toLocaleString()} tokens\n`;
    
    // Include health score in footer if available
    if (analysis.metadata.healthScore !== undefined) {
      const healthIndicator = analysis.metadata.healthScore >= 80 ? '✅' : 
                             analysis.metadata.healthScore >= 60 ? '⚠️' : '🔴';
      footer += `**Refactor Health:** ${analysis.metadata.healthScore.toFixed(0)}/100 ${healthIndicator}\n`;
    }
    
    footer += `*Generated by Git Context v2 LLM Analyst*\n`;

    return footer;
  }

  /**
   * Calculate value score for a block based on claims and actions
   * Higher score = higher value/importance
   */
  private calculateBlockValue(block: AnalysisBlock): number {
    let score = 0;

    // Claims value: severity-weighted by confidence
    const severityWeight = { critical: 10, high: 5, medium: 2, low: 1 };
    block.claims.forEach(claim => {
      score += severityWeight[claim.severity] * claim.confidence;
    });

    // Actions value: priority + impact/effort ratio
    const priorityWeight = { urgent: 10, high: 5, medium: 2, low: 1 };
    const effortWeight = { xs: 5, s: 4, m: 3, l: 2, xl: 1 };
    
    block.actions.forEach(action => {
      const impactScore = priorityWeight[action.priority] * effortWeight[action.effort];
      // Prefer low-risk actions (multiply by 1.5 for low risk)
      const riskMultiplier = action.risk === 'low' ? 1.5 : action.risk === 'medium' ? 1.0 : 0.7;
      score += impactScore * riskMultiplier;
    });

    // Bonus for actionable items (has evidence paths)
    const hasActionableClaims = block.claims.some(c => c.evidence.length > 0);
    const hasActionableActions = block.actions.some(a => a.evidence.length > 0);
    if (hasActionableClaims || hasActionableActions) {
      score *= 1.2;
    }

    return score;
  }

  /**
   * Calculate refactor health score (0-100)
   * Higher score = healthier refactor (fewer issues)
   */
  private calculateHealthScore(facts: RefactorBundleFacts): number {
    const totalIssues = 
      facts.findings.incompleteness.missing +
      facts.findings.incompleteness.zombies +
      facts.findings.legacyAudit.dead;
    
    const totalSymbols = facts.working.symbols;
    const issueRate = totalSymbols > 0 ? totalIssues / totalSymbols : 0;
    
    // Base score: 100 = perfect, 0 = terrible
    // Lower issue rate = higher score
    const baseScore = Math.max(0, 100 - (issueRate * 100));
    
    // Penalties for critical issues (missing symbols are most critical)
    const criticalPenalty = facts.findings.incompleteness.missing * 2;
    
    // Additional penalty for high zombie count (indicates incomplete cleanup)
    const zombiePenalty = facts.findings.incompleteness.zombies * 0.5;
    
    return Math.max(0, Math.min(100, baseScore - criticalPenalty - zombiePenalty));
  }

  /**
   * Sort blocks by value score (descending)
   * High-value blocks appear first
   */
  private sortBlocks(blocks: AnalysisBlock[]): AnalysisBlock[] {
    return blocks.sort((a, b) => {
      const valueA = this.calculateBlockValue(a);
      const valueB = this.calculateBlockValue(b);
      
      // Sort by value score (descending)
      if (valueB !== valueA) {
        return valueB - valueA;
      }
      
      // Fallback to confidence within same value tier
      return b.confidence - a.confidence;
    });
  }

  /**
   * Render a single analysis block with value-based prioritization
   */
  private renderBlock(block: AnalysisBlock, facts: RefactorBundleFacts): string {
    const icon = this.getBlockIcon(block.type);
    const valueScore = this.calculateBlockValue(block);
    
    // Show value indicator for high-value blocks
    let content = `## ${icon} ${block.title}`;
    if (valueScore > 20) {
      content += ` ⭐ High Value`;
    }
    content += `\n\n`;

    // Separate critical/high claims from others
    const criticalClaims = block.claims.filter(c => 
      c.severity === 'critical' || c.severity === 'high'
    );
    const otherClaims = block.claims.filter(c => 
      c.severity !== 'critical' && c.severity !== 'high'
    );

    // Render critical findings first
    if (criticalClaims.length > 0) {
      content += `### 🚨 Critical Findings\n\n`;
      content += this.renderClaims(criticalClaims, facts);
    }

    // Render other findings
    if (otherClaims.length > 0) {
      content += `### Other Findings\n\n`;
      content += this.renderClaims(otherClaims, facts);
    }

    // Separate urgent/high actions from others
    const urgentActions = block.actions.filter(a => 
      a.priority === 'urgent' || a.priority === 'high'
    );
    const otherActions = block.actions.filter(a => 
      a.priority !== 'urgent' && a.priority !== 'high'
    );

    // Render immediate actions first
    if (urgentActions.length > 0) {
      content += `### ⚡ Immediate Actions\n\n`;
      content += this.renderActions(urgentActions, facts);
    }

    // Render additional actions
    if (otherActions.length > 0) {
      content += `### 📋 Additional Actions\n\n`;
      content += this.renderActions(otherActions, facts);
    }

    // Add confidence indicator
    if (block.confidence < 0.8) {
      content += `\n⚠️ **Low Confidence:** This analysis has ${(block.confidence * 100).toFixed(0)}% confidence. Verify manually.\n`;
    }

    content += `\n`;
    return content;
  }

  /**
   * Get icon for block type
   */
  private getBlockIcon(type: AnalysisBlock['type']): string {
    switch (type) {
      case 'intent': return '🎯';
      case 'discovery': return '💡';
      case 'drift': return '🔍';
      case 'cleanup': return '🧹';
      case 'summary': return '📊';
      default: return '📝';
    }
  }

  /**
   * Render claims section (sorted by severity, limited evidence)
   */
  private renderClaims(claims: any[], facts: RefactorBundleFacts): string {
    // Sort by severity (critical > high > medium > low) then confidence
    const severityOrder: Record<'critical' | 'high' | 'medium' | 'low', number> = { critical: 4, high: 3, medium: 2, low: 1 };
    const sortedClaims = [...claims].sort((a: any, b: any) => {
      const aSeverity = a.severity as 'critical' | 'high' | 'medium' | 'low';
      const bSeverity = b.severity as 'critical' | 'high' | 'medium' | 'low';
      const severityDiff = severityOrder[bSeverity] - severityOrder[aSeverity];
      if (severityDiff !== 0) return severityDiff;
      return b.confidence - a.confidence;
    });

    let content = '';

    for (const claim of sortedClaims) {
      const severityIcon = this.getSeverityIcon(claim.severity);
      content += `- ${severityIcon} **${claim.severity.toUpperCase()}:** ${claim.text}\n`;

      if (claim.confidence < 0.9) {
        content += `  *(confidence: ${(claim.confidence * 100).toFixed(0)}%)*\n`;
      }

      // Render evidence links (limit to top 5)
      if (claim.evidence && claim.evidence.length > 0) {
        const evidenceToShow = claim.evidence.slice(0, 5);
        content += `  **Evidence:**\n`;
        for (const evidence of evidenceToShow) {
          content += `  - ${this.renderEvidenceLink(evidence, facts)}\n`;
        }
        if (claim.evidence.length > 5) {
          content += `  - *...and ${claim.evidence.length - 5} more*\n`;
        }
      }

      content += `\n`;
    }

    return content;
  }

  /**
   * Render actions section (sorted by priority, limited evidence)
   */
  private renderActions(actions: any[], facts: RefactorBundleFacts): string {
    // Sort actions by priority (already sorted by AnalysisBlockUtils.sortActions)
    const sortedActions = AnalysisBlockUtils.sortActions(actions);

    let content = '';

    for (const action of sortedActions) {
      const priorityIcon = this.getPriorityIcon(action.priority);
      const riskIcon = this.getRiskIcon(action.risk);

      content += `- ${priorityIcon} **[${action.priority.toUpperCase()}]** `;
      content += `[${action.effort.toUpperCase()}] ${action.description}\n`;

      if (action.risk !== 'low') {
        content += `  ${riskIcon} **Risk:** ${action.risk}\n`;
      }

      // Show dependencies
      if (action.dependsOn && action.dependsOn.length > 0) {
        content += `  ⏳ **Depends on:** ${action.dependsOn.join(', ')}\n`;
      }

      // Render evidence links (limit to top 5)
      if (action.evidence && action.evidence.length > 0) {
        const evidenceToShow = action.evidence.slice(0, 5);
        content += `  **Evidence:**\n`;
        for (const evidence of evidenceToShow) {
          content += `  - ${this.renderEvidenceLink(evidence, facts)}\n`;
        }
        if (action.evidence.length > 5) {
          content += `  - *...and ${action.evidence.length - 5} more*\n`;
        }
      }

      content += `\n`;
    }

    return content;
  }

  /**
   * Render evidence link with clickable reference
   */
  private renderEvidenceLink(evidence: EvidenceLink, facts: RefactorBundleFacts): string {
    // Create a clickable link format that triggers the openEvidence command
    // Format: [description](command:git-context.openEvidence?encodedArgs)

    const args = {
      path: evidence.path,
      description: evidence.description,
      filePath: evidence.filePath,
      lineNumber: evidence.lineNumber,
      symbolId: evidence.symbolId
    };

    // If we have symbolId but no filePath, try to resolve it
    if (!args.filePath && args.symbolId) {
      args.filePath = AnalysisBlockUtils.extractFilePath(args.symbolId);
    }

    // Try to extract file path from evidence path if not already set
    if (!args.filePath) {
      const parsed = AnalysisBlockUtils.parseEvidencePath(evidence.path);
      if (parsed.filePath) args.filePath = parsed.filePath;
      if (parsed.symbolId && !args.symbolId) args.symbolId = parsed.symbolId;
    }

    // VS Code command URIs require arguments to be a JSON array, URI encoded
    const encodedArgs = encodeURIComponent(JSON.stringify([args]));
    
    // Generate smart link text
    let linkText = evidence.description;
    
    // If description looks like a raw path, generate a better one
    if (this.looksLikeRawPath(evidence.description)) {
      linkText = AnalysisBlockUtils.parseEvidencePathToDescription(evidence.path);
    }

    // Build additional context info
    let extraInfo = '';
    
    // Try to resolve count from facts
    const count = this.resolveEvidenceCount(evidence.path, facts);
    if (count !== null) {
      extraInfo = ` (${count} items)`;
    } else if (evidence.filePath && !linkText.includes(evidence.filePath)) {
      // Only add file info if not already in the link text
      const shortFile = evidence.filePath.split('/').pop() || evidence.filePath;
      extraInfo = ` in ${shortFile}`;
      if (evidence.lineNumber) {
        extraInfo += `:${evidence.lineNumber}`;
      }
    }

    return `[${linkText}${extraInfo}](command:git-context.openEvidence?${encodedArgs})`;
  }

  /**
   * Check if a string looks like a raw JSON path rather than a description
   */
  private looksLikeRawPath(text: string): boolean {
    if (!text) return true;
    // Looks like path if it contains dots with no spaces, or starts with common path prefixes
    return (
      text === 'Example' ||
      /^(findings|intended|working|scope|bundle|evidence|diff|ast|graph)\./.test(text) ||
      /^diff\[/.test(text) ||
      /^ast\[/.test(text) ||
      /^graph\.(nodes|edges)\[/.test(text) ||
      (text.includes('.') && !text.includes(' '))
    );
  }

  /**
   * Resolve evidence count from facts JSON path
   */
  private resolveEvidenceCount(path: string, facts: RefactorBundleFacts): number | null {
    try {
      const parts = path.split('.');
      let current: any = facts;

      for (const part of parts) {
        if (part.includes('[')) {
          // Handle array access like findings.incompleteness.missing
          const arrayMatch = part.match(/^([^[]+)/);
          if (arrayMatch) {
            current = current[arrayMatch[1]];
          }
        } else {
          current = current[part];
        }
      }

      if (Array.isArray(current)) {
        return current.length;
      } else if (typeof current === 'number') {
        return current;
      }
    } catch (error) {
      // Ignore errors in path resolution
    }

    return null;
  }

  /**
   * Get severity icon
   */
  private getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'critical': return '🚨';
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  }

  /**
   * Get priority icon
   */
  private getPriorityIcon(priority: string): string {
    switch (priority) {
      case 'urgent': return '🚨';
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  }

  /**
   * Get risk icon
   */
  private getRiskIcon(risk: string): string {
    switch (risk) {
      case 'high': return '⚠️';
      case 'medium': return '⚡';
      case 'low': return '✅';
      default: return '❓';
    }
  }

  /**
   * Format duration (placeholder for now)
   */
  private formatDuration(callCount: number): string {
    // This is a placeholder - in a real implementation we'd track actual timing
    return `~${callCount * 30}s`;
  }

  /**
   * Generate quick stats summary
   */
  static generateQuickStats(analysis: LlmAnalysis, facts: RefactorBundleFacts): string {
    const totalActions = analysis.blocks.reduce((sum, block) => sum + block.actions.length, 0);
    const highPriorityActions = analysis.blocks.reduce((sum, block) =>
      sum + block.actions.filter(a => a.priority === 'high' || a.priority === 'urgent').length, 0);

    let stats = `📊 **Analysis Results:** `;
    stats += `${analysis.blocks.length} analysis sections, `;
    stats += `${totalActions} actions recommended`;

    if (highPriorityActions > 0) {
      stats += ` (${highPriorityActions} high priority)`;
    }

    return stats;
  }

  /**
   * Render convention drift section
   */
  private renderConventionDriftSection(facts: RefactorBundleFacts): string {
    const conventionDrift = facts.findings.patternDrift.conventionDrift;
    if (!conventionDrift) {
      return '';
    }

    let content = `### {#convention-drift} Naming Convention Analysis\n\n`;
    
    content += `**Dominant Convention:** \`${conventionDrift.dominantConvention}\`\n`;
    content += `**Drift:** ${conventionDrift.driftPercent.toFixed(1)}% of symbols use different conventions\n\n`;

    // Show drift symbols with suggestions
    const driftSymbols = facts.evidence?.['findings.patternDrift.conventionDrift']?.driftSymbols || [];
    if (driftSymbols.length > 0) {
      content += `#### Symbols to Migrate (${driftSymbols.length})\n\n`;
      content += `| Current Name | Convention | Suggested Name | Path |\n`;
      content += `|-------------|------------|----------------|------|\n`;
      
      for (const ds of driftSymbols.slice(0, 30)) {
        content += `| \`${ds.name}\` | ${ds.convention} | \`${ds.suggestedName}\` | \`${ds.path}\` |\n`;
      }
      
      if (driftSymbols.length > 30) {
        content += `\n*... and ${driftSymbols.length - 30} more symbols*\n`;
      }
      content += `\n`;
    }

    // Show files with mixed conventions
    const mixedFiles = facts.findings.patternDrift.mixedConventionFiles || 0;
    if (mixedFiles > 0) {
      const mixedFilesList = facts.evidence?.['findings.patternDrift.mixedConventionFiles'] || [];
      content += `#### Files with Mixed Conventions (${mixedFiles})\n\n`;
      content += `Files containing symbols using multiple naming conventions:\n\n`;
      
      for (const file of (mixedFilesList as any[]).slice(0, 15)) {
        const conventions = file.conventions?.join(', ') || 'unknown';
        content += `- \`${file.path}\` - ${conventions} (${file.symbolCount} symbols, ${file.driftPercent.toFixed(1)}% drift)\n`;
      }
      
      if (mixedFilesList.length > 15) {
        content += `\n*... and ${mixedFilesList.length - 15} more files*\n`;
      }
      content += `\n`;
    }

    return content;
  }
}



/* ---- File: src/analysis/llmAnalyst/runner.ts ---- */

import { RefactorBundleFacts } from '../../facts/types';
import { LlmAnalysis, AnalysisBlock, AnalysisBlockUtils, Claim, Action } from './blocks';
import { PROMPT_INTENT_AND_STORY, PROMPT_DRIFT_VERIFICATION, PROMPT_CLEANUP_PLAN, PROMPT_DISCOVER, PROMPT_QUANTIFY, PROMPT_PLAN, SYSTEM_PROMPT } from '../../llm/prompts';
import { getLLMClient } from '../../llm/openrouter';
import { getExtensionConfig } from '../../utils/config';

/**
 * LLM Analyst - Runs sequential analysis passes over refactor bundle facts
 */
export class LlmAnalyst {
  private client = getLLMClient();

  /**
   * Run complete analysis pipeline on facts JSON
   */
  async analyze(facts: RefactorBundleFacts, rawFeed?: any): Promise<LlmAnalysis> {
    const startTime = Date.now();
    let totalTokens = 0;
    let totalCalls = 0;

    try {
      // Pass 1: Intent & Story Analysis
      console.log('LLM Analyst: Running intent analysis...');
      const intentBlock = await this.analyzeIntent(facts);
      totalCalls++;
      totalTokens += this.estimateTokens(JSON.stringify(facts) + PROMPT_INTENT_AND_STORY);

      // Pass 2: Drift Verification
      console.log('LLM Analyst: Running drift verification...');
      const driftBlock = await this.analyzeDrift(facts);
      totalCalls++;
      totalTokens += this.estimateTokens(JSON.stringify(facts) + PROMPT_DRIFT_VERIFICATION);

      // Pass 3: Cleanup Plan
      console.log('LLM Analyst: Generating cleanup plan...');
      const cleanupBlock = await this.analyzeCleanup(facts);
      totalCalls++;
      totalTokens += this.estimateTokens(JSON.stringify(facts) + PROMPT_CLEANUP_PLAN);

      // Pass 4: Pattern Discovery (if raw feed provided)
      let discoveryBlock: AnalysisBlock | undefined;
      if (rawFeed) {
        console.log('LLM Analyst: Running pattern discovery...');
        const discoveryResult = await this.discoverPatterns(rawFeed);
        discoveryBlock = this.createDiscoveryBlock(discoveryResult);
        totalCalls += 3; // Discover, Quantify, Plan
        totalTokens += discoveryResult.metadata.totalTokens;
      }

      // Combine results
      const blocks = [intentBlock, driftBlock, cleanupBlock];
      if (discoveryBlock) {
        blocks.push(discoveryBlock);
      }
      const summary = this.generateSummary(blocks, facts);
      const markdown = this.generateMarkdown(blocks, facts);

      // Calculate health score
      const healthScore = this.calculateHealthScore(facts);

      return {
        summary,
        blocks,
        markdown,
        metadata: {
          totalCalls,
          totalTokens,
          model: getExtensionConfig().openRouterModel,
          timestamp: new Date().toISOString(),
          healthScore
        }
      };

    } catch (error) {
      console.error('LLM Analyst failed:', error);

      // Return minimal fallback analysis
      const fallbackBlock = AnalysisBlockUtils.createBlock(
        'error',
        'Analysis Error',
        'summary',
        [{
          text: `LLM analysis failed: ${error}`,
          confidence: 0,
          evidence: [],
          severity: 'high'
        }],
        [{
          description: 'Retry analysis or check LLM configuration',
          priority: 'high',
          evidence: [],
          effort: 's',
          risk: 'low'
        }]
      );

      // Calculate health score even for error case
      const healthScore = this.calculateHealthScore(facts);

      return {
        summary: `Analysis failed: ${error}`,
        blocks: [fallbackBlock],
        markdown: `# Analysis Error\n\n${error}`,
        metadata: {
          totalCalls: 1,
          totalTokens: 0,
          model: 'unknown',
          timestamp: new Date().toISOString(),
          healthScore
        }
      };
    }
  }

  /**
   * Run the "Churn" pipeline: Discover -> Quantify -> Plan
   * Uses raw AST/diff/graph feed to find emergent patterns
   */
  async discoverPatterns(rawFeed: any): Promise<any> {
    const startTime = Date.now();
    let totalTokens = 0;

    try {
      // Turn 1: Discover Patterns
      console.log('LLM Analyst: Discovering emergent patterns...');
      const discoverPromptTemplate = this.getPrompt('discover', PROMPT_DISCOVER);
      const discoverPrompt = `${SYSTEM_PROMPT}\n\nRAW FEED JSON:\n${JSON.stringify(rawFeed)}\n\n${discoverPromptTemplate}`;
      const discovery = await this.callLLM(discoverPrompt, 'discover');
      totalTokens += this.estimateTokens(discoverPrompt);

      // Turn 2: Quantify Impact
      console.log('LLM Analyst: Quantifying patterns...');
      const quantifyPromptTemplate = this.getPrompt('quantify', PROMPT_QUANTIFY);
      const quantifyPrompt = `${SYSTEM_PROMPT}\n\nDISCOVERED PATTERNS:\n${JSON.stringify(discovery)}\n\n${quantifyPromptTemplate}`;
      const quantified = await this.callLLM(quantifyPrompt, 'quantify');
      totalTokens += this.estimateTokens(quantifyPrompt);

      // Turn 3: Plan Synthesis
      console.log('LLM Analyst: Synthesizing fix plan...');
      const planPromptTemplate = this.getPrompt('plan', PROMPT_PLAN);
      const planPrompt = `${SYSTEM_PROMPT}\n\nQUANTIFIED PATTERNS:\n${JSON.stringify(quantified)}\n\n${planPromptTemplate}`;
      const plan = await this.callLLM(planPrompt, 'plan');
      totalTokens += this.estimateTokens(planPrompt);

      return {
        discovery,
        quantified,
        plan,
        metadata: {
          totalTokens,
          duration: Date.now() - startTime,
          model: getExtensionConfig().openRouterModel
        }
      };

    } catch (error) {
      console.error('Pattern discovery failed:', error);
      return { error: String(error) };
    }
  }

  /**
   * Pass 1: Analyze refactor intent and story
   */
  private async analyzeIntent(facts: RefactorBundleFacts): Promise<AnalysisBlock> {
    const promptTemplate = this.getPrompt('intent', PROMPT_INTENT_AND_STORY);
    const prompt = this.buildPrompt(promptTemplate, facts);
    const response = await this.callLLM(prompt, 'intent');

    const block = AnalysisBlockUtils.createBlock(
      'intent',
      'Refactor Intent & Story',
      'intent'
    );

    // Parse the LLM response and extract claims
    const claims = this.parseIntentResponse(response, facts);
    block.claims = claims;

    return block;
  }

  /**
   * Pass 2: Verify drift findings
   */
  private async analyzeDrift(facts: RefactorBundleFacts): Promise<AnalysisBlock> {
    const promptTemplate = this.getPrompt('drift', PROMPT_DRIFT_VERIFICATION);
    const prompt = this.buildPrompt(promptTemplate, facts);
    const response = await this.callLLM(prompt, 'drift');

    const block = AnalysisBlockUtils.createBlock(
      'drift',
      'Drift Verification',
      'drift'
    );

    // Parse drift verification response
    const { claims, actions } = this.parseDriftResponse(response, facts);
    block.claims = claims;
    block.actions = actions;

    return block;
  }

  /**
   * Pass 3: Generate cleanup plan
   */
  private async analyzeCleanup(facts: RefactorBundleFacts): Promise<AnalysisBlock> {
    const promptTemplate = this.getPrompt('cleanup', PROMPT_CLEANUP_PLAN);
    const prompt = this.buildPrompt(promptTemplate, facts);
    const response = await this.callLLM(prompt, 'cleanup');

    const block = AnalysisBlockUtils.createBlock(
      'cleanup',
      'Cleanup Plan',
      'cleanup'
    );

    // Parse cleanup plan response
    const { claims, actions } = this.parseCleanupResponse(response, facts);
    block.claims = claims;
    block.actions = actions;

    return block;
  }

  /**
   * Convert discovery results into an AnalysisBlock
   */
  private createDiscoveryBlock(discoveryResult: any): AnalysisBlock {
    const block = AnalysisBlockUtils.createBlock(
      'discovery',
      'LLM-Driven Pattern Discovery',
      'discovery'
    );

    if (discoveryResult.quantified && discoveryResult.quantified.quantified) {
      const patterns = discoveryResult.quantified.quantified;
      block.claims = patterns.map((p: any) => ({
        text: `${p.name}: ${p.desc} (Impact: ${p.impact}, Coverage: ${p.coverage_pct}%)`,
        confidence: 0.9,
        severity: p.impact === 'high' ? 'high' : 'medium',
        evidence: (p.examples || []).map((ex: string) => 
          AnalysisBlockUtils.createEvidenceAuto(ex, `${p.name} example`)
        )
      }));
    }

    if (discoveryResult.plan && discoveryResult.plan.plan) {
      const plans = discoveryResult.plan.plan;
      block.actions = plans.map((p: any) => ({
        description: `Fix ${p.pattern}: ${p.fixes.length} fixes identified`,
        priority: 'high',
        effort: 'medium',
        risk: 'medium',
        evidence: (p.fixes || []).slice(0, 3).map((fix: any) => 
          AnalysisBlockUtils.createEvidenceAuto(
            fix.file || p.pattern,
            `${fix.before ? `Change: ${fix.before.substring(0, 30)}...` : p.pattern}`
          )
        ),
        dependsOn: []
      }));
    }

    return block;
  }

  /**
   * Build a complete prompt with system message and facts
   */
  private buildPrompt(userPrompt: string, facts: RefactorBundleFacts): string {
    const factsJson = JSON.stringify(facts, null, 2);
    return `${SYSTEM_PROMPT}\n\nFACTS JSON:\n${factsJson}\n\n${userPrompt}`;
  }

  /**
   * Get prompt from config or fallback to default
   */
  private getPrompt(key: string, defaultPrompt: string): string {
    const config = getExtensionConfig();
    if (config.customPrompts && config.customPrompts[key]) {
      return config.customPrompts[key];
    }
    return defaultPrompt;
  }

  /**
   * Get max tokens from config or fallback to default
   */
  private getMaxTokens(key: string, defaultTokens: number = 4000): number {
    const config = getExtensionConfig();
    if (config.tokensPerStep && config.tokensPerStep[key]) {
      return config.tokensPerStep[key];
    }
    return defaultTokens;
  }

  /**
   * Call the LLM with the prompt
   */
  private async callLLM(prompt: string, stepKey: string = 'default'): Promise<any> {
    const messages = [
      {
        role: 'user' as const,
        content: prompt
      }
    ];

    const maxTokens = this.getMaxTokens(stepKey);

    const response = await this.client.complete(messages, {
      temperature: 0.1,
      maxTokens
    });

    // Try to parse as JSON first
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : response.trim();

      // Try to find JSON object in the response
      const jsonStart = jsonStr.indexOf('{');
      const jsonEnd = jsonStr.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        const extractedJson = jsonStr.substring(jsonStart, jsonEnd + 1);
        return JSON.parse(extractedJson);
      }

      // If no braces found, try parsing the whole string
      return JSON.parse(jsonStr);
    } catch (error) {
      console.warn('Failed to parse LLM response as JSON, falling back to string parsing:', error);
      return { raw: response };
    }
  }

  /**
   * Parse intent analysis response
   */
  private parseIntentResponse(response: any, facts: RefactorBundleFacts): any[] {
    const claims = [];

    // If response is parsed JSON
    if (response.claims && Array.isArray(response.claims)) {
      return response.claims.map((claim: any) => ({
        text: claim.text,
        confidence: claim.confidence || 0.8,
        severity: claim.severity || 'medium',
        evidence: (claim.evidence || []).map((path: string) =>
          AnalysisBlockUtils.createEvidenceAuto(path)
        )
      }));
    }

    // Fallback to existing string matching logic
    if (response.raw) {
      const rawResponse = response.raw.toLowerCase();

      // Look for problem identification
      if (rawResponse.includes('problem') ||
        rawResponse.includes('issue') ||
        rawResponse.includes('trying to solve')) {
        claims.push({
          text: 'Refactor addresses specific architectural problems',
          confidence: 0.9,
          evidence: [AnalysisBlockUtils.createEvidence(
            'bundle.shas',
            'Bundle contains multiple related commits'
          )],
          severity: 'medium'
        });
      }

      // Look for scope assessment
      const totalChanges = facts.intended.present + facts.intended.absent;
      if (totalChanges > 50) {
        claims.push({
          text: 'Large-scale refactor affecting many symbols',
          confidence: 0.95,
          evidence: [AnalysisBlockUtils.createEvidence(
            'intended',
            `${totalChanges} symbols affected`
          )],
          severity: 'high'
        });
      }
    }

    return claims;
  }

  /**
   * Parse drift verification response
   */
  private parseDriftResponse(response: any, facts: RefactorBundleFacts): { claims: any[], actions: any[] } {
    const claims = [];
    const actions = [];

    // If response is parsed JSON
    if (response.claims && Array.isArray(response.claims)) {
      claims.push(...response.claims.map((claim: any) => ({
        text: claim.text,
        confidence: claim.confidence || 0.8,
        severity: claim.severity || 'medium',
        evidence: (claim.evidence || []).map((path: string) =>
          AnalysisBlockUtils.createEvidenceAuto(path)
        )
      })));
    }

    if (response.actions && Array.isArray(response.actions)) {
      actions.push(...response.actions.map((action: any) => ({
        description: action.description,
        priority: action.priority || 'medium',
        effort: action.effort || 'medium',
        risk: action.risk || 'low',
        evidence: (action.evidence || []).map((path: string) =>
          AnalysisBlockUtils.createEvidenceAuto(path)
        ),
        dependsOn: action.dependsOn || []
      })));
    }

    // Fallback to existing logic if no structured data
    if (claims.length === 0 && actions.length === 0 && response.raw) {
      const rawResponse = response.raw.toLowerCase();

      // Check for incompleteness validation
      if (facts.findings.incompleteness.missing > 0) {
        if (rawResponse.includes('real') ||
          rawResponse.includes('valid') ||
          rawResponse.includes('confirmed')) {
          claims.push({
            text: 'Missing symbols are real issues requiring completion',
            confidence: 0.8,
            evidence: [AnalysisBlockUtils.createEvidence(
              'findings.incompleteness.missing',
              `${facts.findings.incompleteness.missing} symbols missing`
            )],
            severity: 'high'
          });

          actions.push({
            description: 'Complete missing symbol implementations',
            priority: 'high',
            evidence: [AnalysisBlockUtils.createEvidence('findings.incompleteness.missing', 'Missing symbols list')],
            effort: 'l',
            risk: 'medium'
          });
        }
      }

      // Check for zombie validation
      if (facts.findings.incompleteness.zombies > 0) {
        if (rawResponse.includes('should be removed') ||
          rawResponse.includes('obsolete')) {
          actions.push({
            description: 'Remove zombie symbols that are no longer needed',
            priority: 'medium',
            evidence: [AnalysisBlockUtils.createEvidence('findings.incompleteness.zombies', 'Zombie symbols list')],
            effort: 'm',
            risk: 'low'
          });
        }
      }
    }

    return { claims, actions };
  }

  /**
   * Parse cleanup plan response
   */
  private parseCleanupResponse(response: any, facts: RefactorBundleFacts): { claims: any[], actions: any[] } {
    const claims: any[] = [];
    const actions: any[] = [];

    // If response is parsed JSON
    if (response.actions && Array.isArray(response.actions)) {
      actions.push(...response.actions.map((action: any) => ({
        description: action.description,
        priority: action.priority || 'medium',
        effort: action.effort || 'medium',
        risk: action.risk || 'low',
        evidence: (action.evidence || []).map((path: string) =>
          AnalysisBlockUtils.createEvidenceAuto(path)
        ),
        dependsOn: action.dependsOn || []
      })));
    }

    // Fallback to existing numbered list parsing
    if (actions.length === 0 && response.raw) {
      const lines = response.raw.split('\n');
      let currentAction: any = null;

      for (const line of lines) {
        // Look for numbered items (1., 2., etc.)
        const numberedMatch = line.match(/^(\d+)\.\s*(.+)/);
        if (numberedMatch) {
          if (currentAction) {
            actions.push(currentAction);
          }

          currentAction = {
            description: numberedMatch[2],
            priority: this.inferPriority(numberedMatch[2]),
            evidence: [],
            effort: this.inferEffort(numberedMatch[2]),
            risk: this.inferRisk(numberedMatch[2])
          };
        }
        // Look for evidence citations
        else if (currentAction && (line.includes('findings.') || line.includes('legacyAudit.'))) {
          // Extract evidence paths
          const evidenceMatch = line.match(/findings\.[^.]+(?:\[[^\]]+\])?/g);
          if (evidenceMatch) {
            for (const path of evidenceMatch) {
              currentAction.evidence.push(AnalysisBlockUtils.createEvidence(
                path,
                `Referenced in cleanup plan`
              ));
            }
          }
        }
      }

      if (currentAction) {
        actions.push(currentAction);
      }
    }

    return { claims, actions };
  }

  /**
   * Extract top N claims by severity and confidence
   */
  private extractTopClaims(blocks: AnalysisBlock[], limit: number = 3): Claim[] {
    const allClaims: Claim[] = [];
    blocks.forEach(block => {
      allClaims.push(...block.claims);
    });

    // Filter to critical/high severity or high confidence (>=0.8)
    const valuableClaims = allClaims.filter(c => 
      c.severity === 'critical' || 
      c.severity === 'high' || 
      c.confidence >= 0.8
    );

    // Sort by severity (critical > high > medium > low) then confidence
    const severityOrder: Record<'critical' | 'high' | 'medium' | 'low', number> = { critical: 4, high: 3, medium: 2, low: 1 };
    valuableClaims.sort((a, b) => {
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.confidence - a.confidence;
    });

    return valuableClaims.slice(0, limit);
  }

  /**
   * Extract top N actions by priority/effort ratio
   */
  private extractTopActions(blocks: AnalysisBlock[], limit: number = 5): Action[] {
    const allActions: Action[] = [];
    blocks.forEach(block => {
      allActions.push(...block.actions);
    });

    // Calculate value score for each action
    const priorityWeight: Record<'urgent' | 'high' | 'medium' | 'low', number> = { urgent: 10, high: 5, medium: 2, low: 1 };
    const effortWeight: Record<'xs' | 's' | 'm' | 'l' | 'xl', number> = { xs: 5, s: 4, m: 3, l: 2, xl: 1 };
    
    const scoredActions = allActions.map(action => ({
      action,
      score: priorityWeight[action.priority] * effortWeight[action.effort] * 
             (action.risk === 'low' ? 1.5 : action.risk === 'medium' ? 1.0 : 0.7)
    }));

    // Sort by score (descending)
    scoredActions.sort((a, b) => b.score - a.score);

    return scoredActions.slice(0, limit).map(item => item.action);
  }

  /**
   * Calculate refactor health score (0-100)
   */
  private calculateHealthScore(facts: RefactorBundleFacts): number {
    const totalIssues = 
      facts.findings.incompleteness.missing +
      facts.findings.incompleteness.zombies +
      facts.findings.legacyAudit.dead;
    
    const totalSymbols = facts.working.symbols;
    const issueRate = totalSymbols > 0 ? totalIssues / totalSymbols : 0;
    
    // Base score: 100 = perfect, 0 = terrible
    const baseScore = Math.max(0, 100 - (issueRate * 100));
    
    // Penalties for critical issues
    const criticalPenalty = facts.findings.incompleteness.missing * 2;
    const zombiePenalty = facts.findings.incompleteness.zombies * 0.5;
    
    return Math.max(0, Math.min(100, baseScore - criticalPenalty - zombiePenalty));
  }

  /**
   * Generate enhanced executive summary with key insights
   */
  private generateSummary(blocks: AnalysisBlock[], facts: RefactorBundleFacts): string {
    const totalIssues = facts.findings.incompleteness.missing +
      facts.findings.incompleteness.zombies +
      facts.findings.incompleteness.divergent +
      facts.findings.legacyAudit.dead;

    // Extract top insights
    const topClaims = this.extractTopClaims(blocks, 3);
    const topActions = this.extractTopActions(blocks, 5);
    const healthScore = this.calculateHealthScore(facts);
    
    // Calculate high-priority action count
    const highPriorityActions = blocks.reduce((sum, block) =>
      sum + block.actions.filter(a => a.priority === 'high' || a.priority === 'urgent').length, 0);

    let summary = `## Key Insights\n\n`;

    // Most critical finding
    if (topClaims.length > 0) {
      const criticalClaim = topClaims[0];
      summary += `**Most Critical:** ${criticalClaim.text} `;
      summary += `(${criticalClaim.severity} severity, ${(criticalClaim.confidence * 100).toFixed(0)}% confidence)\n\n`;
    }

    // Top actionable items
    if (topActions.length > 0) {
      summary += `**Immediate Actions:**\n`;
      topActions.forEach((action, i) => {
        summary += `${i + 1}. ${action.description} `;
        summary += `[${action.priority} priority, ${action.effort} effort]\n`;
      });
      summary += `\n`;
    }

    // Refactor health score
    const healthIndicator = healthScore >= 80 ? '✅' : healthScore >= 60 ? '⚠️' : '🔴';
    summary += `**Refactor Health:** ${healthScore.toFixed(0)}/100 ${healthIndicator}\n\n`;

    // Quick stats
    summary += `**Quick Stats:** `;
    summary += `${facts.bundle.shas.length} commits, `;
    summary += `${facts.working.symbols} symbols analyzed, `;
    if (totalIssues === 0) {
      summary += `no issues found`;
    } else {
      summary += `${totalIssues} issues (${highPriorityActions} high-priority actions)`;
    }
    summary += `\n`;

    return summary;
  }

  /**
   * Generate markdown representation
   */
  private generateMarkdown(blocks: AnalysisBlock[], facts: RefactorBundleFacts): string {
    let markdown = `# LLM Analysis Report\n\n`;
    markdown += `**Generated:** ${new Date().toLocaleString()}\n\n`;
    markdown += `**Bundle:** ${facts.bundle.shas.length} commits\n\n`;

    for (const block of blocks) {
      markdown += `## ${block.title}\n\n`;

      if (block.claims.length > 0) {
        markdown += `### Findings\n\n`;
        for (const claim of block.claims) {
          markdown += `- **${claim.severity.toUpperCase()}:** ${claim.text} (confidence: ${(claim.confidence * 100).toFixed(0)}%)\n`;
          for (const evidence of claim.evidence) {
            markdown += `  - Evidence: \`${evidence.path}\`\n`;
          }
        }
        markdown += `\n`;
      }

      if (block.actions.length > 0) {
        markdown += `### Actions\n\n`;
        const sortedActions = AnalysisBlockUtils.sortActions(block.actions);
        for (const action of sortedActions) {
          markdown += `- **${action.priority.toUpperCase()}** [${action.effort.toUpperCase()}] ${action.description} (risk: ${action.risk})\n`;
          for (const evidence of action.evidence) {
            markdown += `  - Evidence: \`${evidence.path}\`\n`;
          }
        }
        markdown += `\n`;
      }
    }

    return markdown;
  }

  /**
   * Infer priority from action description
   */
  private inferPriority(description: string): 'low' | 'medium' | 'high' | 'urgent' {
    const lower = description.toLowerCase();
    if (lower.includes('urgent') || lower.includes('critical') || lower.includes('breaking')) {
      return 'urgent';
    }
    if (lower.includes('high') || lower.includes('important') || lower.includes('missing')) {
      return 'high';
    }
    if (lower.includes('medium') || lower.includes('moderate')) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Infer effort from action description
   */
  private inferEffort(description: string): 'xs' | 's' | 'm' | 'l' | 'xl' {
    const lower = description.toLowerCase();
    if (lower.includes('complex') || lower.includes('large') || lower.includes('architectural')) {
      return 'xl';
    }
    if (lower.includes('significant') || lower.includes('multiple')) {
      return 'l';
    }
    if (lower.includes('moderate') || lower.includes('several')) {
      return 'm';
    }
    if (lower.includes('simple') || lower.includes('single')) {
      return 's';
    }
    return 'xs';
  }

  /**
   * Infer risk from action description
   */
  private inferRisk(description: string): 'low' | 'medium' | 'high' {
    const lower = description.toLowerCase();
    if (lower.includes('high risk') || lower.includes('dangerous') || lower.includes('breaking')) {
      return 'high';
    }
    if (lower.includes('medium risk') || lower.includes('careful') || lower.includes('complex')) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Rough token estimation for tracking
   */
  private estimateTokens(text: string): number {
    // Very rough approximation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}



/* ---- File: src/analysis/mermaidGenerator.ts ---- */

import { EdgeInfo, SymbolInfo } from '../types';
import { getDefaultThreshold } from '../utils/edgeThresholds';

/**
 * Generate Mermaid graph visualizations for dependency graphs
 */
export class MermaidGenerator {
  /**
   * Generate Mermaid graph from edges and symbols
   */
  generateGraph(edges: EdgeInfo[], symbols: SymbolInfo[], options: {
    maxNodes?: number;
    showConfidence?: boolean;
    highlightChanged?: string[];
  } = {}): string {
    const { maxNodes = 50, showConfidence = false, highlightChanged = [] } = options;

    // Filter to most relevant edges
    const filteredEdges = this.filterRelevantEdges(edges, maxNodes);

    // Build node and edge definitions
    const nodes = new Set<string>();
    const edgeDefinitions: string[] = [];

    for (const edge of filteredEdges) {
      nodes.add(this.formatNodeId(edge.from));
      nodes.add(this.formatNodeId(edge.to));

      const style = this.getEdgeStyle(edge, showConfidence);
      const label = this.getEdgeLabel(edge, showConfidence);

      edgeDefinitions.push(`${this.formatNodeId(edge.from)} -->|"${label}"| ${this.formatNodeId(edge.to)}`);
    }

    // Generate Mermaid code
    let mermaid = 'graph TD\n';

    // Add node styling for changed symbols
    const changedNodeIds = highlightChanged.map(id => this.formatNodeId(id));
    for (const nodeId of changedNodeIds) {
      if (nodes.has(nodeId)) {
        mermaid += `    ${nodeId}:::changed\n`;
      }
    }

    // Add edges
    for (const edgeDef of edgeDefinitions) {
      mermaid += `    ${edgeDef}\n`;
    }

    // Add styling
    mermaid += '\n    classDef changed fill:#ff6b6b,stroke:#d63031,color:#fff\n';

    return mermaid;
  }

  /**
   * Generate blast radius visualization
   */
  generateBlastRadiusGraph(
    changedSymbols: SymbolInfo[],
    blastRadius: {
      downstreamCallers: Map<string, any[]>;
      upstreamDependencies: Map<string, any[]>;
      impactScore: Map<string, number>;
    }
  ): string {
    let mermaid = 'graph TD\n';

    // Add changed symbols as central nodes
    for (const symbol of changedSymbols) {
      const nodeId = this.formatNodeId(symbol.id);
      const impact = blastRadius.impactScore.get(symbol.id) || 0;
      mermaid += `    ${nodeId}["${symbol.name}<br/>Impact: ${impact}"]:::changed\n`;
    }

    // Add downstream callers
    for (const [symbolId, callers] of blastRadius.downstreamCallers) {
      const sourceId = this.formatNodeId(symbolId);
      // Note: In a full implementation, we'd resolve caller names
      mermaid += `    Caller${callers.length} --> ${sourceId}\n`;
    }

    // Add upstream dependencies
    for (const [symbolId, dependencies] of blastRadius.upstreamDependencies) {
      const targetId = this.formatNodeId(symbolId);
      // Note: In a full implementation, we'd resolve dependency names
      mermaid += `    ${targetId} --> Dep${dependencies.length}\n`;
    }

    mermaid += '\n    classDef changed fill:#ff6b6b,stroke:#d63031,color:#fff\n';

    return mermaid;
  }

  /**
   * Filter edges to most relevant ones for visualization
   */
  private filterRelevantEdges(edges: EdgeInfo[], maxNodes: number): EdgeInfo[] {
    // Sort by confidence and keep only high-confidence edges
    const threshold = getDefaultThreshold();
    const sortedEdges = edges
      .filter(edge => (edge.confidence || 0) > threshold)
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

    // Limit to prevent overwhelming graphs
    return sortedEdges.slice(0, maxNodes * 2); // Allow ~2 edges per node
  }

  /**
   * Format symbol ID for Mermaid node ID
   */
  private formatNodeId(symbolId: string): string {
    // Mermaid node IDs must start with letters, no special chars
    return 'N' + symbolId.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
  }

  /**
   * Get edge styling based on type and confidence
   */
  private getEdgeStyle(edge: EdgeInfo, showConfidence: boolean): string {
    let style = '';

    // Different line styles for different edge types
    switch (edge.type) {
      case 'imports':
        style = 'stroke:#2ecc71,stroke-width:2px';
        break;
      case 'calls':
        style = 'stroke:#3498db,stroke-width:2px';
        break;
      case 'extends':
        style = 'stroke:#e74c3c,stroke-width:3px';
        break;
      case 'implements':
        style = 'stroke:#f39c12,stroke-width:3px,stroke-dasharray:5,5';
        break;
      default:
        style = 'stroke:#95a5a6,stroke-width:1px';
    }

    return style;
  }

  /**
   * Get edge label
   */
  private getEdgeLabel(edge: EdgeInfo, showConfidence: boolean): string {
    let label = edge.type;

    if (showConfidence && edge.confidence !== undefined) {
      label += ` (${Math.round(edge.confidence * 100)}%)`;
    }

    if (!edge.isResolved) {
      label += ' (?)';
    }

    return label;
  }
}



/* ---- File: src/analysis/namingConventions.ts ---- */

/**
 * Naming convention detection and analysis
 * Detects naming patterns and identifies drift/inconsistencies
 */

export type NamingConvention =
  | 'camelCase'      // getUserData
  | 'PascalCase'     // GetUserData
  | 'snake_case'     // get_user_data
  | 'SCREAMING_SNAKE' // GET_USER_DATA
  | 'kebab-case'     // get-user-data (rare for symbols)
  | 'hungarian'      // strUserData
  | 'mixed'          // get_userData
  | 'unknown';

export interface ConventionProfile {
  convention: NamingConvention;
  confidence: number;
  parts: string[]; // ['get', 'User', 'Data']
}

export interface ConventionDriftResult {
  dominantConvention: NamingConvention;
  conventionCounts: Record<NamingConvention, number>;
  driftSymbols: Array<{
    name: string;
    convention: NamingConvention;
    path: string;
    suggestedName: string;
  }>;
  driftPercent: number;
}

/**
 * Detect naming convention from a symbol name
 */
export function detectNamingConvention(name: string): ConventionProfile {
  if (!name || name.length === 0) {
    return { convention: 'unknown', confidence: 0, parts: [] };
  }

  const hasUnderscore = name.includes('_');
  const hasUppercase = /[A-Z]/.test(name);
  const hasHyphen = name.includes('-');
  const startsLower = /^[a-z]/.test(name);
  const startsUpper = /^[A-Z]/.test(name);
  const allUpper = name === name.toUpperCase() && hasUnderscore;
  
  // Single-word lowercase names (e.g., form, table, handle) 
  // Default to camelCase since that's the standard for methods in most languages
  const isSingleLowerWord = startsLower && !/[_A-Z-]/.test(name.slice(1));
  if (isSingleLowerWord) {
    return { convention: 'camelCase', confidence: 0.7, parts: [name] };
  }

  let parts: string[] = [];
  let convention: NamingConvention;
  let confidence = 0.9;

  // SCREAMING_SNAKE_CASE: All uppercase with underscores
  if (allUpper) {
    convention = 'SCREAMING_SNAKE';
    parts = name.split('_').filter(Boolean);
  }
  // snake_case: lowercase with underscores, no uppercase
  else if (hasUnderscore && !hasUppercase) {
    convention = 'snake_case';
    parts = name.split('_').filter(Boolean);
  }
  // kebab-case: lowercase with hyphens
  else if (hasHyphen && !hasUppercase) {
    convention = 'kebab-case';
    parts = name.split('-').filter(Boolean);
  }
  // mixed: combination (e.g., get_userData)
  else if (hasUnderscore && hasUppercase) {
    convention = 'mixed';
    confidence = 0.7;
    // Split on both underscores and uppercase transitions
    parts = name.split(/[_A-Z]/).filter(Boolean);
    // Reconstruct parts more intelligently
    const reconstructed: string[] = [];
    let current = '';
    for (let i = 0; i < name.length; i++) {
      const char = name[i];
      if (char === '_') {
        if (current) {
          reconstructed.push(current.toLowerCase());
          current = '';
        }
      } else if (/[A-Z]/.test(char) && current && i > 0) {
        reconstructed.push(current.toLowerCase());
        current = char;
      } else {
        current += char;
      }
    }
    if (current) {
      reconstructed.push(current.toLowerCase());
    }
    parts = reconstructed.filter(Boolean);
  }
  // PascalCase: Starts with uppercase, has uppercase transitions
  else if (startsUpper && hasUppercase) {
    convention = 'PascalCase';
    parts = name.split(/(?=[A-Z])/).filter(Boolean);
  }
  // camelCase: Starts with lowercase, has uppercase transitions
  else if (startsLower && hasUppercase) {
    convention = 'camelCase';
    parts = name.split(/(?=[A-Z])/).filter(Boolean);
  }
  // Hungarian notation: starts with lowercase type prefix (str, int, etc.)
  else if (/^[a-z]{1,3}[A-Z]/.test(name)) {
    convention = 'hungarian';
    confidence = 0.8;
    const match = name.match(/^([a-z]{1,3})(.+)$/);
    if (match) {
      parts = [match[1], ...match[2].split(/(?=[A-Z])/).filter(Boolean)];
    } else {
      parts = [name];
    }
  }
  // Unknown: single word or no clear pattern
  else {
    convention = 'unknown';
    confidence = 0.5;
    parts = [name];
  }

  return { convention, confidence, parts };
}

/**
 * Suggest a name following a target convention
 */
export function suggestConventionName(
  name: string,
  targetConvention: NamingConvention
): string {
  const profile = detectNamingConvention(name);
  const parts = profile.parts.length > 0 ? profile.parts : [name];

  // Normalize parts (lowercase, remove empty)
  const normalizedParts = parts
    .map(p => p.toLowerCase().trim())
    .filter(p => p.length > 0);

  if (normalizedParts.length === 0) {
    return name; // Can't convert
  }

  switch (targetConvention) {
    case 'camelCase':
      return normalizedParts[0] + normalizedParts.slice(1)
        .map(p => p.charAt(0).toUpperCase() + p.slice(1))
        .join('');

    case 'PascalCase':
      return normalizedParts
        .map(p => p.charAt(0).toUpperCase() + p.slice(1))
        .join('');

    case 'snake_case':
      return normalizedParts.join('_');

    case 'SCREAMING_SNAKE':
      return normalizedParts.map(p => p.toUpperCase()).join('_');

    case 'kebab-case':
      return normalizedParts.join('-');

    case 'hungarian':
      // Keep first part as prefix, rest as PascalCase
      if (normalizedParts.length > 1) {
        return normalizedParts[0] + normalizedParts.slice(1)
          .map(p => p.charAt(0).toUpperCase() + p.slice(1))
          .join('');
      }
      return normalizedParts[0];

    case 'mixed':
      // Use camelCase with underscores (uncommon, but handle it)
      return normalizedParts[0] + '_' + normalizedParts.slice(1)
        .map(p => p.charAt(0).toUpperCase() + p.slice(1))
        .join('');

    default:
      return name;
  }
}

/**
 * Analyze convention drift across a set of symbols
 */
export function analyzeConventionDrift(symbols: Array<{
  name: string;
  kind: string;
  path: string;
}>): ConventionDriftResult {
  const counts: Record<NamingConvention, number> = {
    'camelCase': 0,
    'PascalCase': 0,
    'snake_case': 0,
    'SCREAMING_SNAKE': 0,
    'kebab-case': 0,
    'hungarian': 0,
    'mixed': 0,
    'unknown': 0
  };

  const symbolConventions = symbols.map(s => ({
    ...s,
    profile: detectNamingConvention(s.name)
  }));

  // Count conventions
  for (const s of symbolConventions) {
    counts[s.profile.convention]++;
  }

  // Find dominant convention (excluding unknown)
  const conventionEntries = Object.entries(counts)
    .filter(([k]) => k !== 'unknown')
    .sort(([, a], [, b]) => b - a);

  const dominant = (conventionEntries[0]?.[0] as NamingConvention) || 'unknown';
  const dominantCount = conventionEntries[0]?.[1] || 0;

  // Find symbols that don't match dominant
  const driftSymbols = symbolConventions
    .filter(s => s.profile.convention !== dominant && s.profile.convention !== 'unknown')
    .map(s => ({
      name: s.name,
      convention: s.profile.convention,
      path: s.path,
      suggestedName: suggestConventionName(s.name, dominant)
    }));

  const totalRelevant = Object.values(counts).reduce((a, b) => a + b, 0) - counts['unknown'];
  const driftPercent = totalRelevant > 0 ? (driftSymbols.length / totalRelevant) * 100 : 0;

  return {
    dominantConvention: dominant,
    conventionCounts: counts,
    driftSymbols,
    driftPercent
  };
}




/* ---- File: src/analysis/pipeline.ts ---- */

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
  ) {}

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
    const files = this.git.getStagedFiles();
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
    const files = this.git.getUnstagedFiles();
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



/* ---- File: src/analysis/semanticChanges.ts ---- */

import { SymbolInfo, SymbolDelta, ChangeType, ModReason } from '../types';
import { detectLanguage } from './tree-sitter';

/**
 * Semantic change detection for enhanced LLM context
 *
 * Detects renames, moves, and classifies modification reasons
 * beyond basic added/modified/removed.
 */
export class SemanticChangeDetector {
  /**
   * Detect renames by comparing removed and added symbols
   */
  detectRenames(
    removed: SymbolInfo[],
    added: SymbolInfo[],
    threshold: number = 0.8
  ): Array<{
    oldSymbol: SymbolInfo;
    newSymbol: SymbolInfo;
    confidence: number;
  }> {
    const renames: Array<{
      oldSymbol: SymbolInfo;
      newSymbol: SymbolInfo;
      confidence: number;
    }> = [];

    for (const removedSymbol of removed) {
      let bestMatch: SymbolInfo | null = null;
      let bestConfidence = 0;

      for (const addedSymbol of added) {
        const confidence = this.calculateRenameConfidence(removedSymbol, addedSymbol);
        if (confidence > bestConfidence && confidence >= threshold) {
          bestMatch = addedSymbol;
          bestConfidence = confidence;
        }
      }

      if (bestMatch) {
        renames.push({
          oldSymbol: removedSymbol,
          newSymbol: bestMatch,
          confidence: bestConfidence
        });
      }
    }

    return renames;
  }

  /**
   * Calculate confidence that two symbols represent a rename
   */
  private calculateRenameConfidence(oldSymbol: SymbolInfo, newSymbol: SymbolInfo): number {
    let confidence = 0;

    // Same kind (function->function, class->class)
    if (oldSymbol.kind === newSymbol.kind) {
      confidence += 0.3;
    } else {
      return 0; // Different kinds can't be renames
    }

    // Similar signature structure (ignoring name)
    if (this.signaturesSimilar(oldSymbol.signature, newSymbol.signature, oldSymbol.name, newSymbol.name)) {
      confidence += 0.4;
    }

    // Name similarity (but not identical - that would be same symbol)
    if (oldSymbol.name !== newSymbol.name) {
      const nameSimilarity = this.nameSimilarity(oldSymbol.name, newSymbol.name);
      confidence += nameSimilarity * 0.3;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Check if signatures are similar when ignoring symbol names
   */
  private signaturesSimilar(sig1: string, sig2: string, name1: string, name2: string): boolean {
    // Remove symbol names and compare structure
    const normalized1 = sig1.replace(name1, 'SYMBOL').replace(/\s+/g, ' ').trim();
    const normalized2 = sig2.replace(name2, 'SYMBOL').replace(/\s+/g, ' ').trim();

    return normalized1 === normalized2;
  }

  /**
   * Calculate name similarity using Jaro-Winkler distance approximation
   */
  private nameSimilarity(name1: string, name2: string): number {
    if (name1 === name2) return 1.0;

    // Simple prefix/suffix matching for common rename patterns
    const prefixes = ['get', 'set', 'is', 'has', 'can', 'should', 'validate'];
    const suffixes = ['Handler', 'Service', 'Controller', 'Manager', 'Util', 'Helper'];

    for (const prefix of prefixes) {
      if (name1.startsWith(prefix) && name2.startsWith(prefix)) {
        const rest1 = name1.slice(prefix.length);
        const rest2 = name2.slice(prefix.length);
        if (rest1 === rest2) return 0.9;
      }
    }

    for (const suffix of suffixes) {
      if (name1.endsWith(suffix) && name2.endsWith(suffix)) {
        const rest1 = name1.slice(0, -suffix.length);
        const rest2 = name2.slice(0, -suffix.length);
        if (rest1 === rest2) return 0.9;
      }
    }

    // Levenshtein distance approximation
    return this.levenshteinSimilarity(name1, name2);
  }

  /**
   * Simple Levenshtein distance approximation for name similarity
   */
  private levenshteinSimilarity(s1: string, s2: string): number {
    const len1 = s1.length;
    const len2 = s2.length;
    const maxLen = Math.max(len1, len2);

    if (maxLen === 0) return 1.0;

    const distance = this.levenshteinDistance(s1, s2);
    return 1.0 - (distance / maxLen);
  }

  private levenshteinDistance(s1: string, s2: string): number {
    const matrix = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));

    for (let i = 0; i <= s1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= s2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= s2.length; j++) {
      for (let i = 1; i <= s1.length; i++) {
        const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[s2.length][s1.length];
  }

  /**
   * Detect moves by comparing symbols with same name but different paths
   */
  detectMoves(
    previousSymbols: SymbolInfo[],
    currentSymbols: SymbolInfo[]
  ): Array<{
    symbol: SymbolInfo;
    oldPath: string;
    newPath: string;
    confidence: number;
  }> {
    const moves: Array<{
      symbol: SymbolInfo;
      oldPath: string;
      newPath: string;
      confidence: number;
    }> = [];

    // Group by name and kind
    const prevByName = new Map<string, SymbolInfo[]>();
    const currByName = new Map<string, SymbolInfo[]>();

    for (const symbol of previousSymbols) {
      const key = `${symbol.name}:${symbol.kind}`;
      if (!prevByName.has(key)) prevByName.set(key, []);
      prevByName.get(key)!.push(symbol);
    }

    for (const symbol of currentSymbols) {
      const key = `${symbol.name}:${symbol.kind}`;
      if (!currByName.has(key)) currByName.set(key, []);
      currByName.get(key)!.push(symbol);
    }

    // Find symbols with same name/kind but different paths
    for (const [key, prevGroup] of prevByName) {
      const currGroup = currByName.get(key);
      if (!currGroup) continue;

      for (const prevSymbol of prevGroup) {
        for (const currSymbol of currGroup) {
          if (prevSymbol.id.split(':')[0] !== currSymbol.id.split(':')[0]) {
            // Different paths - potential move
            const confidence = this.calculateMoveConfidence(prevSymbol, currSymbol);
            if (confidence > 0.7) {
              moves.push({
                symbol: currSymbol,
                oldPath: prevSymbol.id.split(':')[0],
                newPath: currSymbol.id.split(':')[0],
                confidence
              });
            }
          }
        }
      }
    }

    return moves;
  }

  /**
   * Calculate confidence that a symbol was moved
   */
  private calculateMoveConfidence(oldSymbol: SymbolInfo, newSymbol: SymbolInfo): number {
    let confidence = 0;

    // Same name and kind (required)
    if (oldSymbol.name === newSymbol.name && oldSymbol.kind === newSymbol.kind) {
      confidence += 0.5;
    } else {
      return 0;
    }

    // Similar signature
    if (oldSymbol.signature === newSymbol.signature) {
      confidence += 0.4;
    } else if (this.signaturesSimilar(oldSymbol.signature, newSymbol.signature, oldSymbol.name, newSymbol.name)) {
      confidence += 0.3;
    }

    // Same language (file extension)
    const oldLang = detectLanguage(oldSymbol.id.split(':')[0]);
    const newLang = detectLanguage(newSymbol.id.split(':')[0]);
    if (oldLang === newLang) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Classify the reason for a symbol modification
   */
  classifyModificationReason(delta: SymbolDelta): ModReason {
    if (!delta.previousSymbol) return 'body_changed';

    const prev = delta.previousSymbol;
    const curr = delta.symbol;

    // Signature changed (function parameters, return type, etc.)
    if (prev.signature !== curr.signature) {
      // Check if it's just parameter names vs types
      const prevNormalized = this.normalizeSignature(prev.signature);
      const currNormalized = this.normalizeSignature(curr.signature);

      if (prevNormalized !== currNormalized) {
        return 'signature_changed';
      }
    }

    // Check for visibility changes
    const visibilityRegex = /(public|private|protected|export)/g;
    const prevVisibility = (prev.signature.match(visibilityRegex) || []).join(' ');
    const currVisibility = (curr.signature.match(visibilityRegex) || []).join(' ');

    if (prevVisibility !== currVisibility) {
      return 'visibility_changed';
    }

    // Check for doc changes (if we had doc comments in symbol info, but we don't currently store them explicitly)
    // However, we can check if the body change is ONLY comments if we had the content.
    // Since we don't have content here, we can't easily detect doc changes unless we store doc comments.
    // But the user asked for "lightweight doc-change detection: if only comments/annotations changed between snippets".
    // We don't have snippets here yet.
    // But we can try to infer from signature if it has annotations/decorators.

    // Check for annotation/decorator changes
    const annotationRegex = /@\w+/g;
    const prevAnnotations = (prev.signature.match(annotationRegex) || []).join(' ');
    const currAnnotations = (curr.signature.match(annotationRegex) || []).join(' ');

    if (prevAnnotations !== currAnnotations) {
      return 'annotation_changed';
    }

    // Location significantly changed (likely moved within file)
    const prevLines = prev.location.end.line - prev.location.start.line;
    const currLines = curr.location.end.line - curr.location.start.line;

    if (Math.abs(prevLines - currLines) > prevLines * 0.5) {
      return 'body_changed';
    }

    // Default to body changed
    return 'body_changed';
  }

  /**
   * Normalize signature for comparison (remove variable names, focus on types)
   */
  private normalizeSignature(signature: string): string {
    // Simple normalization - could be enhanced for specific languages
    return signature.replace(/\b\w+\s+(\w+)/g, '$1').replace(/\s+/g, ' ').trim();
  }

  /**
   * Extract diff snippets for context (truncated to reasonable size)
   */
  extractDiffSnippets(
    previousContent: string,
    currentContent: string,
    symbol: SymbolInfo,
    maxLines: number = 10
  ): { pre: string; post: string } {
    const extractSnippet = (content: string, location: typeof symbol.location): string => {
      const lines = content.split('\n');
      const startLine = Math.max(0, location.start.line - 3);
      const endLine = Math.min(lines.length, location.end.line + 3);

      return lines.slice(startLine, endLine).join('\n');
    };

    return {
      pre: extractSnippet(previousContent, symbol.location),
      post: extractSnippet(currentContent, symbol.location)
    };
  }
}



/* ---- File: src/analysis/symbols.ts ---- */

import { SymbolInfo, SymbolDelta, SymbolChangeType, FileChange } from '../types';
import { getTreeSitterParser, detectLanguage } from './tree-sitter';
import { GitOperations } from './git';
import { SemanticChangeDetector } from './semanticChanges';

export class SymbolExtractor {
  private git: GitOperations;
  private parser = getTreeSitterParser();
  private semanticDetector = new SemanticChangeDetector();

  constructor(git: GitOperations) {
    this.git = git;
  }

  /**
   * Extract symbols from all changed files in a commit with semantic enrichment
   */
  async extractCommitSymbols(sha: string, files: FileChange[]): Promise<{
    added: SymbolInfo[];
    removed: SymbolInfo[];
    modified: SymbolDelta[];
    renames: Array<{ oldSymbol: SymbolInfo; newSymbol: SymbolInfo; confidence: number }>;
    moves: Array<{ symbol: SymbolInfo; oldPath: string; newPath: string; confidence: number }>;
  }> {
    const added: SymbolInfo[] = [];
    const removed: SymbolInfo[] = [];
    const modified: SymbolDelta[] = [];

    // Collect symbols from all files
    for (const file of files) {
      if (this.shouldAnalyzeFile(file.path)) {
        const fileSymbols = await this.extractFileSymbols(sha, file);
        added.push(...fileSymbols.added);
        removed.push(...fileSymbols.removed);
        modified.push(...fileSymbols.modified);
      }
    }

    // Get parent commit for comparison
    let parentSha: string | undefined;
    try {
      const commitInfo = this.git.getCommitInfo(sha);
      parentSha = commitInfo.parent;
    } catch (error) {
      // No parent commit available
    }

    // Perform semantic analysis for renames and moves
    const renames = parentSha ?
      this.semanticDetector.detectRenames(removed, added) : [];

    // For moves, we need symbols from previous commit
    let previousSymbols: SymbolInfo[] = [];
    if (parentSha) {
      try {
        const previousCommitSymbols = await this.extractCommitSymbols(parentSha, files);
        previousSymbols = [
          ...previousCommitSymbols.added,
          ...previousCommitSymbols.removed,
          ...previousCommitSymbols.modified.map(m => m.symbol)
        ];
      } catch (error) {
        // Can't get previous symbols
      }
    }

    const currentSymbols = [...added, ...modified.map(m => m.symbol)];
    const moves = this.semanticDetector.detectMoves(previousSymbols, currentSymbols);

    return { added, removed, modified, renames, moves };
  }

  /**
   * Extract symbols from a single file in a commit
   */
  private async extractFileSymbols(sha: string, file: FileChange): Promise<{
    added: SymbolInfo[];
    removed: SymbolInfo[];
    modified: SymbolDelta[];
  }> {
    const added: SymbolInfo[] = [];
    const removed: SymbolInfo[] = [];
    const modified: SymbolDelta[] = [];

    try {
      // Skip deleted files - they don't exist in the commit
      if (file.status === 'D') {
        return { added, removed, modified };
      }

      // Get current file content (use safe method to handle path mismatches)
      console.log(`[SYMBOLS] Extracting ${file.path} at ${sha.substring(0, 8)} (status: ${file.status})`);
      const currentContent = this.git.safeGetFileContent(sha, file.path);

      // Skip if file doesn't exist at this SHA (path mismatch, rename, or file added later)
      if (!currentContent) {
        console.log(`[SYMBOLS] Skipping ${file.path} at ${sha.substring(0, 8)} - not found in commit`);
        return { added, removed, modified };
      }

      // Get previous file content (if it exists)
      let previousContent: string | null = null;
      if (file.status !== 'A' && file.oldPath) {
        try {
          const parentSha = this.git.getCommitInfo(sha).parent;
          if (parentSha) {
            previousContent = this.git.safeGetFileContent(parentSha, file.oldPath);
          }
        } catch {
          // File didn't exist in parent, treat as new
        }
      } else if (file.status !== 'A') {
        try {
          const parentSha = this.git.getCommitInfo(sha).parent;
          if (parentSha) {
            previousContent = this.git.safeGetFileContent(parentSha, file.path);
          }
        } catch {
          // File didn't exist in parent, treat as new
        }
      }

      // Extract symbols from both versions
      const currentSymbols = await this.extractSymbolsFromContent(currentContent, file.path);
      const previousSymbols = previousContent
        ? await this.extractSymbolsFromContent(previousContent, file.oldPath || file.path)
        : [];

      // Compare and categorize changes
      const changes = this.compareSymbolSets(previousSymbols, currentSymbols, file.path);

      // Enhance modified symbols with semantic information
      for (const delta of changes.modified) {
        // Classify modification reason
        delta.modReason = this.semanticDetector.classifyModificationReason(delta);

        // Capture diff snippets if content available
        if (previousContent && currentContent) {
          const snippets = this.semanticDetector.extractDiffSnippets(
            previousContent,
            currentContent,
            delta.symbol
          );
          delta.diffSnippetPre = snippets.pre;
          delta.diffSnippetPost = snippets.post;
        }
      }

      added.push(...changes.added);
      removed.push(...changes.removed);
      modified.push(...changes.modified);

    } catch (error) {
      console.warn(`Failed to extract symbols from ${file.path}:`, error);
    }

    return { added, removed, modified };
  }

  /**
   * Extract symbols from working tree files (staged or unstaged) compared to HEAD
   */
  async extractWorkingTreeSymbols(files: FileChange[], options: { staged?: boolean } = {}): Promise<{
    added: SymbolInfo[];
    removed: SymbolInfo[];
    modified: SymbolDelta[];
  }> {
    const added: SymbolInfo[] = [];
    const removed: SymbolInfo[] = [];
    const modified: SymbolDelta[] = [];

    for (const file of files) {
      if (this.shouldAnalyzeFile(file.path)) {
        const fileSymbols = await this.extractWorkingTreeFileSymbols(file, options);
        added.push(...fileSymbols.added);
        removed.push(...fileSymbols.removed);
        modified.push(...fileSymbols.modified);
      }
    }

    return { added, removed, modified };
  }

  /**
   * Extract symbols from a single working tree file
   */
  private async extractWorkingTreeFileSymbols(file: FileChange, options: { staged?: boolean }): Promise<{
    added: SymbolInfo[];
    removed: SymbolInfo[];
    modified: SymbolDelta[];
  }> {
    const added: SymbolInfo[] = [];
    const removed: SymbolInfo[] = [];
    const modified: SymbolDelta[] = [];

    try {
      // Get current working tree content (staged or unstaged)
      const currentContent = options.staged
        ? this.git.safeGetStagedContent(file.path)
        : this.git.safeGetWorkingContent(file.path);

      if (!currentContent) {
        console.log(`[SYMBOLS] Skipping ${file.path} - no content available`);
        return { added, removed, modified };
      }

      // Get HEAD content for comparison
      const headContent = this.git.safeGetFileContent('HEAD', file.path);

      // Extract symbols from both versions
      const currentSymbols = await this.extractSymbolsFromContent(currentContent, file.path);
      const headSymbols = headContent
        ? await this.extractSymbolsFromContent(headContent, file.path)
        : [];

      // Compare and categorize changes
      const changes = this.compareSymbolSets(headSymbols, currentSymbols, file.path);

      // Enhance modified symbols with semantic information
      for (const delta of changes.modified) {
        delta.modReason = this.semanticDetector.classifyModificationReason(delta);

        // Capture diff snippets if content available
        if (headContent && currentContent) {
          const snippets = this.semanticDetector.extractDiffSnippets(
            headContent,
            currentContent,
            delta.symbol
          );
          delta.diffSnippetPre = snippets.pre;
          delta.diffSnippetPost = snippets.post;
        }
      }

      added.push(...changes.added);
      removed.push(...changes.removed);
      modified.push(...changes.modified);

    } catch (error) {
      console.warn(`Failed to extract working tree symbols from ${file.path}:`, error);
    }

    return { added, removed, modified };
  }

  /**
   * Extract symbols from file content
   */
  public async extractSymbolsFromContent(content: string, filePath: string): Promise<SymbolInfo[]> {
    const language = detectLanguage(filePath);
    if (!language) {
      return [];
    }

    const tree = await this.parser.parseFile(content, language);
    if (!tree) {
      return [];
    }

    const symbols = this.parser.extractSymbols(tree, filePath, language);

    // Add unique IDs and ensure they include file path for uniqueness
    return symbols.map(symbol => ({
      ...symbol,
      semanticId: symbol.id,
      id: `${filePath}:${symbol.id}`
    }));
  }

  /**
   * Compare two sets of symbols and determine changes
   */
  private compareSymbolSets(
    previous: SymbolInfo[],
    current: SymbolInfo[],
    filePath: string
  ): {
    added: SymbolInfo[];
    removed: SymbolInfo[];
    modified: SymbolDelta[];
  } {
    const added: SymbolInfo[] = [];
    const removed: SymbolInfo[] = [];
    const modified: SymbolDelta[] = [];

    // Create maps for efficient lookup
    const previousMap = new Map(previous.map(s => [s.id, s]));
    const currentMap = new Map(current.map(s => [s.id, s]));

    // Find added symbols
    for (const symbol of current) {
      if (!previousMap.has(symbol.id)) {
        added.push(symbol);
      }
    }

    // Find removed symbols
    for (const symbol of previous) {
      if (!currentMap.has(symbol.id)) {
        removed.push(symbol);
      }
    }

    // Find modified symbols
    for (const currentSymbol of current) {
      const previousSymbol = previousMap.get(currentSymbol.id);
      if (previousSymbol) {
        const changeType = this.determineSymbolChange(previousSymbol, currentSymbol);
        if (changeType !== 'body_changed') { // Only report significant changes
          modified.push({
            symbol: currentSymbol,
            changeType,
            previousSymbol
          });
        }
      }
    }

    return { added, removed, modified };
  }

  /**
   * Determine the type of change between two symbol versions
   */
  private determineSymbolChange(previous: SymbolInfo, current: SymbolInfo): SymbolChangeType {
    // Check if signature changed
    if (previous.signature !== current.signature) {
      // Check if it's a breaking change (public API change)
      if (this.isPublicSymbol(previous) && this.isPublicSymbol(current)) {
        return 'signature_changed';
      }
    }

    // Check if location changed significantly (might indicate move/refactor)
    const prevLines = previous.location.end.line - previous.location.start.line;
    const currLines = current.location.end.line - current.location.start.line;

    if (Math.abs(prevLines - currLines) > 10) { // Arbitrary threshold
      return 'body_changed';
    }

    // Default to body change
    return 'body_changed';
  }

  /**
   * Check if a symbol is public (exported)
   */
  private isPublicSymbol(symbol: SymbolInfo): boolean {
    // Simple heuristic: symbols starting with underscore are private
    return !symbol.name.startsWith('_');
  }

  /**
   * Check if a file should be analyzed for symbols
   */
  private shouldAnalyzeFile(filePath: string): boolean {
    const language = detectLanguage(filePath);
    if (!language) return false;

    // Skip certain directories and files
    const skipPatterns = [
      /node_modules/,
      /\.git/,
      /dist/,
      /build/,
      /vendor/,
      /\.min\./,
      /test.*\.(js|ts|php)$/,
      /spec.*\.(js|ts|php)$/,
      /\.(test|spec)\.(js|ts|php)$/
    ];

    return !skipPatterns.some(pattern => pattern.test(filePath));
  }

  /**
   * Extract symbols from staged changes
   */
  async extractStagedSymbols(): Promise<{
    added: SymbolInfo[];
    removed: SymbolInfo[];
    modified: SymbolDelta[];
  }> {
    const stagedChanges = this.git.getWorkingDirectoryChanges();
    const added: SymbolInfo[] = [];
    const removed: SymbolInfo[] = [];
    const modified: SymbolDelta[] = [];

    for (const file of stagedChanges) {
      if (file.status === 'M' && this.shouldAnalyzeFile(file.path)) {
        try {
          // Get staged content
          const stagedContent = this.git.getStagedDiff();
          // This is complex - we'd need to parse the diff to extract staged content
          // For now, just mark as modified
          console.log(`Staged changes in ${file.path} - would extract symbols`);
        } catch (error) {
          console.warn(`Failed to extract staged symbols from ${file.path}:`, error);
        }
      }
    }

    return { added, removed, modified };
  }
}



/* ---- File: src/analysis/tree-sitter.ts ---- */

import * as path from 'path';
import * as fs from 'fs';
import { SymbolInfo } from '../types';

// Use require to avoid type issues with web-tree-sitter
const { Parser, Language } = require('web-tree-sitter');

// Language detection based on file extension
export function detectLanguage(filePath: string): string | null {
  const ext = filePath.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'php':
      return 'php';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
      return 'javascript';
    default:
      return null;
  }
}

export class TreeSitterParser {
  private parsers: Map<string, any> = new Map();
  private initialized = false;

  async initializeParsers(): Promise<void> {
    if (this.initialized) return;

    try {
      await Parser.init();

      // Load languages
      const languages = ['typescript', 'javascript', 'php'];

      for (const lang of languages) {
        // Look for WASM in the out directory (where it's copied/downloaded to)
        const wasmPath = path.join(__dirname, '..', '..', 'out', `tree-sitter-${lang}.wasm`);
        if (fs.existsSync(wasmPath)) {
          const language = await Language.load(wasmPath);
          const parser = new Parser();
          parser.setLanguage(language);
          this.parsers.set(lang, parser);
          console.log(`✓ Loaded tree-sitter parser for ${lang}`);
        } else {
          // Fallback to checking root if not in out yet (dev mode)
          const rootWasmPath = path.join(__dirname, '..', '..', `tree-sitter-${lang}.wasm`);
          if (fs.existsSync(rootWasmPath)) {
            const language = await Language.load(rootWasmPath);
            const parser = new Parser();
            parser.setLanguage(language);
            this.parsers.set(lang, parser);
            console.log(`✓ Loaded tree-sitter parser for ${lang} (dev mode)`);
          } else {
            console.warn(`✗ Language WASM not found for ${lang}: ${wasmPath}`);
          }
        }
      }

      this.initialized = true;
      console.log(`Tree-sitter initialized with ${this.parsers.size} parsers`);
    } catch (error) {
      console.error('Failed to initialize tree-sitter parsers:', error);
      // Don't throw, just log. This allows the extension to work without tree-sitter
    }
  }

  getParser(languageId: string): any | undefined {
    // Map VS Code language IDs to tree-sitter languages
    const map: Record<string, string> = {
      'typescript': 'typescript',
      'typescriptreact': 'typescript',
      'javascript': 'javascript',
      'javascriptreact': 'javascript',
      'php': 'php'
    };

    const lang = map[languageId] || languageId;
    return this.parsers.get(lang);
  }

  async parse(content: string, languageId: string): Promise<any | undefined> {
    if (!this.initialized) {
      await this.initializeParsers();
    }

    const parser = this.getParser(languageId);
    if (!parser) return undefined;

    return parser.parse(content);
  }

  // Compatibility method for symbols.ts
  async parseFile(content: string, languageId: string): Promise<any | null> {
    const tree = await this.parse(content, languageId);
    return tree || null;
  }

  extractSymbols(tree: any, filePath: string, language: string): SymbolInfo[] {
    const symbols: SymbolInfo[] = [];

    // Walk the tree and extract symbols
    const cursor = tree.walk();

    while (true) {
      const node = cursor.currentNode;

      // Extract symbols based on node type and language
      const symbol = this.extractSymbolFromNode(node, filePath, language);
      if (symbol) {
        symbols.push(symbol);
      }

      // Move to next node
      if (cursor.gotoFirstChild()) {
        continue;
      }

      while (!cursor.gotoNextSibling()) {
        if (!cursor.gotoParent()) {
          return symbols; // Done walking
        }
      }
    }
  }

  private extractSymbolFromNode(node: any, filePath: string, language: string): SymbolInfo | null {
    switch (language) {
      case 'php':
        return this.extractPHPSymbol(node, filePath);
      case 'typescript':
      case 'javascript':
        return this.extractJSSymbol(node, filePath, language);
      default:
        return null;
    }
  }

  private extractPHPSymbol(node: any, filePath: string): SymbolInfo | null {
    // PHP symbol extraction - simplified version
    if (node.type === 'function_definition') {
      // Find name in child nodes
      for (const child of node.children) {
        if (child.type === 'name') {
          const name = child.text;
          const signature = this.extractPHPSignature(node);
          return {
            id: `function_${name}`,
            name,
            kind: 'function',
            signature,
            location: {
              start: { line: node.startPosition.row + 1, column: node.startPosition.column },
              end: { line: node.endPosition.row + 1, column: node.endPosition.column }
            }
          };
        }
      }
    }

    if (node.type === 'class_declaration') {
      for (const child of node.children) {
        if (child.type === 'name') {
          const name = child.text;
          return {
            id: `class_${name}`,
            name,
            kind: 'class',
            signature: `class ${name}`,
            location: {
              start: { line: node.startPosition.row + 1, column: node.startPosition.column },
              end: { line: node.endPosition.row + 1, column: node.endPosition.column }
            }
          };
        }
      }
    }

    if (node.type === 'method_declaration') {
      for (const child of node.children) {
        if (child.type === 'name') {
          const name = child.text;
          const signature = this.extractPHPSignature(node);
          return {
            id: `method_${name}`,
            name,
            kind: 'method',
            signature,
            location: {
              start: { line: node.startPosition.row + 1, column: node.startPosition.column },
              end: { line: node.endPosition.row + 1, column: node.endPosition.column }
            }
          };
        }
      }
    }

    if (node.type === 'const_declaration') {
      for (const child of node.children) {
        if (child.type === 'name') {
          const name = child.text;
          return {
            id: `const_${name}`,
            name,
            kind: 'const',
            signature: `const ${name}`,
            location: {
              start: { line: node.startPosition.row + 1, column: node.startPosition.column },
              end: { line: node.endPosition.row + 1, column: node.endPosition.column }
            }
          };
        }
      }
    }

    return null;
  }

  private extractJSSymbol(node: any, filePath: string, language: string): SymbolInfo | null {
    // JavaScript/TypeScript symbol extraction - simplified version
    if (node.type === 'function_declaration') {
      for (const child of node.children) {
        if (child.type === 'identifier') {
          const name = child.text;
          const signature = this.extractJSSignature(node, language);
          return {
            id: `function_${name}`,
            name,
            kind: 'function',
            signature,
            location: {
              start: { line: node.startPosition.row + 1, column: node.startPosition.column },
              end: { line: node.endPosition.row + 1, column: node.endPosition.column }
            }
          };
        }
      }
    }

    if (node.type === 'class_declaration') {
      for (const child of node.children) {
        if (child.type === 'identifier') {
          const name = child.text;
          return {
            id: `class_${name}`,
            name,
            kind: 'class',
            signature: `class ${name}`,
            location: {
              start: { line: node.startPosition.row + 1, column: node.startPosition.column },
              end: { line: node.endPosition.row + 1, column: node.endPosition.column }
            }
          };
        }
      }
    }

    if (node.type === 'method_definition') {
      for (const child of node.children) {
        if (child.type === 'property_identifier') {
          const name = child.text;
          const signature = this.extractJSSignature(node, language);
          return {
            id: `method_${name}`,
            name,
            kind: 'method',
            signature,
            location: {
              start: { line: node.startPosition.row + 1, column: node.startPosition.column },
              end: { line: node.endPosition.row + 1, column: node.endPosition.column }
            }
          };
        }
      }
    }

    if (node.type === 'variable_declaration' || node.type === 'lexical_declaration') {
      // Look for const declarations
      for (const child of node.children) {
        if (child.type === 'variable_declarator') {
          for (const subChild of child.children) {
            if (subChild.type === 'identifier' && node.text.startsWith('const')) {
              const name = subChild.text;
              return {
                id: `const_${name}`,
                name,
                kind: 'const',
                signature: `const ${name}`,
                location: {
                  start: { line: node.startPosition.row + 1, column: node.startPosition.column },
                  end: { line: node.endPosition.row + 1, column: node.endPosition.column }
                }
              };
            }
          }
        }
      }
    }

    return null;
  }

  private extractPHPSignature(node: any): string {
    // Extract function/method signature from PHP node - simplified
    return node.text.split('{')[0].trim(); // Take everything before the body
  }

  private extractJSSignature(node: any, language: string): string {
    // Extract function/method signature from JS/TS node - simplified
    return node.text.split('{')[0].trim(); // Take everything before the body
  }

  dispose(): void {
    // Clean up parsers
    this.parsers.clear();
  }
}

// Singleton instance
let parserInstance: TreeSitterParser | null = null;

export function getTreeSitterParser(): TreeSitterParser {
  if (!parserInstance) {
    parserInstance = new TreeSitterParser();
  }
  return parserInstance;
}


