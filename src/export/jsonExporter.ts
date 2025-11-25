/**
 * JSON Context Exporter
 * 
 * Generates machine-readable LLM context in the versioned JSON schema.
 * This is the SOURCE OF TRUTH - Markdown reports render FROM this data.
 */

import * as vscode from 'vscode';
import {
    LlmContextReport,
    CommitContext,
    FileContext,
    SymbolContext,
    EdgeContext,
    RiskItem
} from '../contracts/llmContext';
import { execSync } from 'child_process';

export async function exportCommitContext(commitShas?: string[]): Promise<LlmContextReport> {
    const { getDatabaseManager, ensureDatabaseInitialized } = await import('../storage/database');
    const { getGitRoot } = await import('../utils/config');

    await ensureDatabaseInitialized();
    const db = getDatabaseManager().getDatabase();
    const gitRoot = getGitRoot();

    // Get repo context
    let headSha = '';
    let branch = '';
    try {
        headSha = execSync('git rev-parse HEAD', { cwd: gitRoot, encoding: 'utf8' }).trim();
        branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: gitRoot, encoding: 'utf8' }).trim();
    } catch (error) {
        console.error('Failed to get git info:', error);
    }

    // Fetch commits
    let commits: any[];
    if (commitShas && commitShas.length > 0) {
        const placeholders = commitShas.map(() => '?').join(',');
        const stmt = db.prepare(`
      SELECT m.sha, m.author, m.date, m.message, a.summary_md, m.files_changed,
             COALESCE(a.symbols_added, 0) as symbols_added,
             COALESCE(a.symbols_modified, 0) as symbols_modified,
             COALESCE(a.symbols_removed, 0) as symbols_removed,
             a.risks
      FROM commits_metadata m
      LEFT JOIN commits_analysis a ON m.sha = a.sha
      WHERE m.sha IN (${placeholders})
      ORDER BY m.date DESC
    `);
        commits = stmt.all(...commitShas) as any[];
    } else {
        const stmt = db.prepare(`
      SELECT m.sha, m.author, m.date, m.message, a.summary_md, m.files_changed,
             COALESCE(a.symbols_added, 0) as symbols_added,
             COALESCE(a.symbols_modified, 0) as symbols_modified,
             COALESCE(a.symbols_removed, 0) as symbols_removed,
             a.risks
      FROM commits_metadata m
      LEFT JOIN commits_analysis a ON m.sha = a.sha
      ORDER BY m.date DESC
      LIMIT 20
    `);
        commits = stmt.all() as any[];
    }

    // Build context for each commit
    const commitContexts: CommitContext[] = [];
    const globalRisks: RiskItem[] = [];

    for (const commit of commits) {
        const risks = JSON.parse(commit.risks || '[]') as string[];
        const commitRisks: RiskItem[] = risks.map(r => ({
            type: r,
            severity: classifyRiskSeverity(r),
            description: r
        }));

        globalRisks.push(...commitRisks);

        // Get files and symbols
        const filesMap = new Map<string, FileContext>();
        const symbolsStmt = db.prepare(`
      SELECT id, symbol_id, name, kind, path, change_type, loc_pre, loc_post
      FROM symbols
      WHERE sha = ?
      ORDER BY path, change_type, name
    `);
        const symbols = symbolsStmt.all(commit.sha) as any[];

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

            const file = filesMap.get(symbol.path)!;
            const symbolContext: SymbolContext = {
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
            } else if (symbol.change_type === 'modified' || symbol.change_type === 'signature_changed') {
                file.symbols.modified.push(symbolContext);
                file.stats.modified++;
            } else if (symbol.change_type === 'removed') {
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
        const edges = edgesStmt.all(commit.sha) as EdgeContext[];

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

/**
 * Export and save JSON context to file
 */
export async function exportAndSaveContext(commitShas?: string[]): Promise<string> {
    const context = await exportCommitContext(commitShas);
    const { getGitRoot } = await import('../utils/config');
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

/**
 * Generate prompt pack for LLM consumption
 */
export function generatePromptPack(context: LlmContextReport): string {
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

// Helper functions
function classifyRiskSeverity(risk: string): "low" | "medium" | "high" | "critical" {
    const lower = risk.toLowerCase();
    if (lower.includes('breaking') || lower.includes('security')) return 'critical';
    if (lower.includes('schema') || lower.includes('migration')) return 'high';
    if (lower.includes('performance') || lower.includes('refactor')) return 'medium';
    return 'low';
}

function detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
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
