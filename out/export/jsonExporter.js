"use strict";
/**
 * JSON Context Exporter
 *
 * Generates machine-readable LLM context in the versioned JSON schema.
 * This is the SOURCE OF TRUTH - Markdown reports render FROM this data.
 */
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
exports.generatePromptPack = exports.exportAndSaveContext = exports.exportCommitContext = void 0;
const child_process_1 = require("child_process");
async function exportCommitContext(commitShas) {
    const { getDatabaseManager, ensureDatabaseInitialized } = await Promise.resolve().then(() => __importStar(require('../storage/database')));
    const { getGitRoot } = await Promise.resolve().then(() => __importStar(require('../utils/config')));
    await ensureDatabaseInitialized();
    const db = getDatabaseManager().getDatabase();
    const gitRoot = getGitRoot();
    // Get repo context
    let headSha = '';
    let branch = '';
    try {
        headSha = (0, child_process_1.execSync)('git rev-parse HEAD', { cwd: gitRoot, encoding: 'utf8' }).trim();
        branch = (0, child_process_1.execSync)('git rev-parse --abbrev-ref HEAD', { cwd: gitRoot, encoding: 'utf8' }).trim();
    }
    catch (error) {
        console.error('Failed to get git info:', error);
    }
    // Fetch commits
    let commits;
    if (commitShas && commitShas.length > 0) {
        const placeholders = commitShas.map(() => '?').join(',');
        const stmt = db.prepare(`
      SELECT sha, author, date, message, summary_md, files_changed,
             symbols_added, symbols_modified, symbols_removed, risks
      FROM commits
      WHERE sha IN (${placeholders})
      ORDER BY date DESC
    `);
        commits = stmt.all(...commitShas);
    }
    else {
        const stmt = db.prepare(`
      SELECT sha, author, date, message, summary_md, files_changed,
             symbols_added, symbols_modified, symbols_removed, risks
      FROM commits
      ORDER BY date DESC
      LIMIT 20
    `);
        commits = stmt.all();
    }
    // Build context for each commit
    const commitContexts = [];
    const globalRisks = [];
    for (const commit of commits) {
        const risks = JSON.parse(commit.risks || '[]');
        const commitRisks = risks.map(r => ({
            type: r,
            severity: classifyRiskSeverity(r),
            description: r
        }));
        globalRisks.push(...commitRisks);
        // Get files and symbols
        const filesMap = new Map();
        const symbolsStmt = db.prepare(`
      SELECT id, symbol_id, name, kind, path, change_type, loc_pre, loc_post
      FROM symbols
      WHERE sha = ?
      ORDER BY path, change_type, name
    `);
        const symbols = symbolsStmt.all(commit.sha);
        // Group symbols by file
        for (const symbol of symbols) {
            if (!filesMap.has(symbol.path)) {
                filesMap.set(symbol.path, {
                    path: symbol.path,
                    language: detectLanguage(symbol.path),
                    stats: { added: 0, modified: 0, removed: 0 },
                    symbols: { added: [], modified: [], removed: [] }
                });
            }
            const file = filesMap.get(symbol.path);
            const symbolContext = {
                id: symbol.id,
                symbol_id: symbol.symbol_id,
                name: symbol.name,
                kind: symbol.kind,
                loc_pre: symbol.loc_pre ? JSON.parse(symbol.loc_pre) : undefined,
                loc_post: symbol.loc_post ? JSON.parse(symbol.loc_post) : undefined
            };
            if (symbol.change_type === 'added') {
                file.symbols.added.push(symbolContext);
                file.stats.added++;
            }
            else if (symbol.change_type === 'modified' || symbol.change_type === 'signature_changed') {
                file.symbols.modified.push(symbolContext);
                file.stats.modified++;
            }
            else if (symbol.change_type === 'removed') {
                file.symbols.removed.push(symbolContext);
                file.stats.removed++;
            }
        }
        // Get edges
        const edgesStmt = db.prepare(`
      SELECT from_symbol_id, to_symbol_id, edge_type, change_type
      FROM edges
      WHERE sha = ?
    `);
        const edges = edgesStmt.all(commit.sha);
        commitContexts.push({
            sha: commit.sha,
            message: commit.message,
            author: commit.author,
            date: commit.date,
            stats: {
                files: commit.files_changed,
                added: commit.symbols_added,
                modified: commit.symbols_modified,
                removed: commit.symbols_removed
            },
            files: Array.from(filesMap.values()),
            risks: commitRisks,
            edges: edges,
            llm_summary: commit.summary_md
        });
    }
    return {
        version: "1.0.0",
        generated_at: new Date().toISOString(),
        repo: {
            root: gitRoot || '',
            head_sha: headSha,
            branch: branch
        },
        commits: commitContexts,
        global_risks: globalRisks
    };
}
exports.exportCommitContext = exportCommitContext;
/**
 * Export and save JSON context to file
 */
async function exportAndSaveContext(commitShas) {
    const context = await exportCommitContext(commitShas);
    const { getGitRoot } = await Promise.resolve().then(() => __importStar(require('../utils/config')));
    const gitRoot = getGitRoot();
    if (!gitRoot) {
        throw new Error('Not in a git repository');
    }
    const fs = require('fs');
    const path = require('path');
    const contextDir = path.join(gitRoot, '.git', 'commit-tracker');
    const contextPath = path.join(contextDir, 'commit-context.json');
    if (!fs.existsSync(contextDir)) {
        fs.mkdirSync(contextDir, { recursive: true });
    }
    fs.writeFileSync(contextPath, JSON.stringify(context, null, 2), 'utf8');
    return contextPath;
}
exports.exportAndSaveContext = exportAndSaveContext;
/**
 * Generate prompt pack for LLM consumption
 */
function generatePromptPack(context) {
    let prompt = `You are a senior software engineer reviewing code changes.\n\n`;
    // Reference the JSON file instead of inlining it
    prompt += `Context JSON saved at: .git/commit-tracker/commit-context.json\n\n`;
    // Add executive summary
    prompt += `## Summary\n`;
    for (const commit of context.commits) {
        const riskStr = commit.risks.length > 0 ? `, risks: ${commit.risks.map(r => r.type).join(', ')}` : '';
        prompt += `- ${commit.sha.substring(0, 8)}: ${commit.stats.files} files, +${commit.stats.added} ~${commit.stats.modified} -${commit.stats.removed}${riskStr}\n`;
    }
    prompt += `\n`;
    // Add Mermaid graphs if available
    if (context.graphs?.dependency_graph) {
        prompt += `## Dependency Graph\n\`\`\`mermaid\n${context.graphs.dependency_graph}\n\`\`\`\n\n`;
    }
    if (context.graphs?.blast_radius_graph) {
        prompt += `## Blast Radius Analysis\n\`\`\`mermaid\n${context.graphs.blast_radius_graph}\n\`\`\`\n\n`;
    }
    prompt += `## Analysis Questions\n`;
    prompt += `1. What changed semantically, not just line-by-line?\n`;
    prompt += `2. Any breaking API changes?\n`;
    prompt += `3. What tests should be added or updated?\n`;
    prompt += `4. Are there any security or performance concerns?\n`;
    prompt += `5. What is the blast radius of these changes?\n`;
    prompt += `6. Are there any risky dependency changes?\n`;
    return prompt;
}
exports.generatePromptPack = generatePromptPack;
// Helper functions
function classifyRiskSeverity(risk) {
    const lower = risk.toLowerCase();
    if (lower.includes('breaking') || lower.includes('security'))
        return 'critical';
    if (lower.includes('schema') || lower.includes('migration'))
        return 'high';
    if (lower.includes('performance') || lower.includes('refactor'))
        return 'medium';
    return 'low';
}
function detectLanguage(filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const langMap = {
        'ts': 'typescript',
        'js': 'javascript',
        'tsx': 'typescript-react',
        'jsx': 'javascript-react',
        'py': 'python',
        'php': 'php',
        'java': 'java',
        'go': 'go',
        'rs': 'rust',
        'cpp': 'c++',
        'c': 'c',
        'cs': 'c#'
    };
    return langMap[ext || ''] || 'unknown';
}
//# sourceMappingURL=jsonExporter.js.map