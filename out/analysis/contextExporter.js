"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextExporter = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const database_1 = require("../storage/database");
const config_1 = require("../utils/config");
const mermaidGenerator_1 = require("./mermaidGenerator");
const dependencies_1 = require("./dependencies");
const legacyAudit_1 = require("./legacyAudit");
/**
 * Export LLM context in structured JSON format
 *
 * Generates versioned, machine-readable reports for LLM consumption
 * with deterministic truncation and context budgeting.
 */
class ContextExporter {
    constructor() {
        this.MAX_TOKEN_BUDGET = 12000; // Rough token estimate
        this.TOKEN_PER_CHAR = 1 / 4; // Rough approximation
        this.mermaidGenerator = new mermaidGenerator_1.MermaidGenerator();
        this.dependencyExtractor = new dependencies_1.DependencyExtractor();
        this.legacyAuditService = new legacyAudit_1.LegacyAuditService();
    }
    /**
     * Export full context report for specified commits
     */
    async exportContext(shas) {
        const gitRoot = (0, config_1.getGitRoot)();
        if (!gitRoot) {
            throw new Error('Not in a git repository');
        }
        const db = (0, database_1.getDatabaseManager)().getDatabase();
        const commits = [];
        const globalRisks = [];
        for (const sha of shas) {
            const commit = await this.buildCommitContext(sha);
            commits.push(commit);
        }
        const auditReport = await this.legacyAuditService.auditDrift(shas);
        const report = {
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
    async exportToFile(shas, filePath) {
        const report = await this.exportContext(shas);
        const defaultPath = path.join((0, config_1.getGitRoot)(), '.git', 'commit-tracker', 'commit-context.json');
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
    async buildCommitContext(sha) {
        const db = (0, database_1.getDatabaseManager)().getDatabase();
        // Get commit info
        const commitStmt = db.prepare(`
      SELECT * FROM commits WHERE sha = ?
    `);
        const commitRow = commitStmt.get(sha);
        if (!commitRow) {
            throw new Error(`Commit ${sha} not found in database`);
        }
        // Get files
        const filesStmt = db.prepare(`
      SELECT * FROM files WHERE sha = ?
    `);
        const fileRows = filesStmt.all(sha);
        const files = [];
        for (const fileRow of fileRows) {
            files.push(await this.buildFileContext(sha, fileRow));
        }
        // Get edges
        const edgesStmt = db.prepare(`
      SELECT * FROM edges WHERE sha = ?
    `);
        const edgeRows = edgesStmt.all(sha);
        const edges = edgeRows.map(edge => ({
            from_symbol_id: edge.from_symbol_id,
            to_symbol_id: edge.to_symbol_id,
            edge_type: edge.edge_type,
            change_type: edge.change_type,
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
    async buildFileContext(sha, fileRow) {
        const db = (0, database_1.getDatabaseManager)().getDatabase();
        // Get symbols for this file
        const symbolsStmt = db.prepare(`
      SELECT * FROM symbols WHERE sha = ? AND path = ?
    `);
        const symbolRows = symbolsStmt.all(sha, fileRow.path);
        const symbols = symbolRows.map(row => ({
            id: row.id,
            symbol_id: row.symbol_id,
            name: row.name,
            kind: row.kind,
            signature: row.signature_post || row.signature_pre,
            loc_pre: row.loc_pre ? JSON.parse(row.loc_pre) : undefined,
            loc_post: row.loc_post ? JSON.parse(row.loc_post) : undefined,
            mod_reason: row.mod_reason,
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
        const renamed = renamesStmt.all(sha, fileRow.path).map((r) => ({
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
    async buildRollups(shas, auditReport) {
        const db = (0, database_1.getDatabaseManager)().getDatabase();
        const placeholders = shas.map(() => '?').join(',');
        // Hotspots: symbols changed in ≥2 commits
        const hotspotsStmt = db.prepare(`
      SELECT symbol_id, name, COUNT(DISTINCT sha) as change_count, MAX(date) as last_changed
      FROM symbols s
      JOIN commits c ON s.sha = c.sha
      WHERE s.sha IN (${placeholders})
      GROUP BY symbol_id
      HAVING change_count >= 2
      ORDER BY change_count DESC
      LIMIT 10
    `);
        const hotspots = hotspotsStmt.all(...shas);
        // Top changed files: count of symbol deltas per file across commits
        const fileRollupsStmt = db.prepare(`
      SELECT path, COUNT(*) as total_changes, MAX(c.date) as last_commit
      FROM symbols s
      JOIN commits c ON s.sha = c.sha
      WHERE s.sha IN (${placeholders})
      GROUP BY path
      ORDER BY total_changes DESC
      LIMIT 10
    `);
        const topChangedFiles = fileRollupsStmt.all(...shas);
        // Dependency deltas: individual edge changes
        const depDeltasStmt = db.prepare(`
      SELECT from_symbol_id, to_symbol_id, change_type, confidence
      FROM edges
      WHERE sha IN (${placeholders}) AND change_type IS NOT NULL
      ORDER BY confidence DESC
      LIMIT 20
    `);
        const depDeltas = depDeltasStmt.all(...shas);
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
    applyContextBudget(report) {
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
    estimateTokenCount(report) {
        const jsonString = JSON.stringify(report);
        return Math.floor(jsonString.length * this.TOKEN_PER_CHAR);
    }
    /**
     * Truncate diff hunks (lowest priority)
     */
    truncateDiffHunks(report) {
        for (const commit of report.commits) {
            for (const file of commit.files) {
                file.hunks = undefined; // Remove diff hunks
            }
        }
    }
    /**
     * Remove low-confidence edges with dynamic threshold
     */
    truncateLowConfidenceEdges(report) {
        for (const commit of report.commits) {
            // Dynamic confidence threshold based on edge count
            const totalEdges = commit.edges.length;
            const threshold = totalEdges < 50 ? 0.4 : 0.7;
            commit.edges = commit.edges.filter(edge => (edge.confidence ?? 0) >= threshold);
        }
    }
    /**
     * Remove unchanged callers (would need implementation)
     */
    truncateUnchangedCallers(report) {
        for (const commit of report.commits) {
            const changed = new Set();
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
            commit.edges = commit.edges.filter(e => changed.has(e.from_symbol_id) || changed.has(e.to_symbol_id));
        }
    }
    /**
     * Remove documentation changes
     */
    truncateDocChanges(report) {
        for (const commit of report.commits) {
            for (const file of commit.files) {
                file.symbols.modified = file.symbols.modified.filter(symbol => symbol.mod_reason !== 'doc_changed');
            }
        }
    }
    /**
     * Get current HEAD SHA
     */
    async getHeadSha() {
        try {
            const { GitOperations } = await Promise.resolve().then(() => __importStar(require('./git')));
            const git = new GitOperations();
            return git.getHeadSha();
        }
        catch {
            return 'unknown';
        }
    }
    /**
     * Get current branch name
     */
    async getCurrentBranch() {
        try {
            const { execSync } = require('child_process');
            return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
        }
        catch {
            return 'unknown';
        }
    }
    /**
     * Generate Mermaid graphs for the report
     */
    async generateGraphs(commits, shas) {
        try {
            // Collect all edges and symbols across commits
            const allEdges = [];
            const allSymbols = [];
            const changedSymbols = [];
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
                    changedSymbols.push(...file.symbols.modified.map((s) => ({ id: s.symbol_id || s.id, name: s.name })));
                    changedSymbols.push(...file.symbols.removed.map((s) => ({ id: s.symbol_id || s.id, name: s.name })));
                    if (file.symbols.renamed) {
                        changedSymbols.push(...file.symbols.renamed.map((r) => ({ id: r.new_symbol_id, name: r.new_name })));
                    }
                }
            }
            // Generate dependency graph
            const dependencyGraph = this.mermaidGenerator.generateGraph(allEdges, allSymbols, { maxNodes: 30, showConfidence: true });
            // Generate blast radius graph using real dependency analysis
            const blastRadius = this.dependencyExtractor.calculateBlastRadius(changedSymbols.map(s => ({ id: s.id || s.symbol_id, name: s.name, kind: s.kind, signature: s.signature })), allEdges);
            const blastRadiusGraph = this.mermaidGenerator.generateBlastRadiusGraph(changedSymbols, blastRadius);
            return {
                dependency_graph: dependencyGraph,
                blast_radius_graph: blastRadiusGraph
            };
        }
        catch (error) {
            console.warn('Failed to generate graphs:', error);
            return undefined;
        }
    }
}
exports.ContextExporter = ContextExporter;
//# sourceMappingURL=contextExporter.js.map