import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SymbolExtractor } from '../analysis/symbols';
import { DependencyExtractor } from '../analysis/dependencies';
import { RiskDetector } from '../analysis/heuristics';
import { GitOperations } from '../analysis/git';
import { getGitRoot } from '../utils/config';
import { SymbolContext, EdgeContext } from '../contracts/llmContext';
import { computeScope } from '../facts/scope';
import { getWorkingSnapshot } from '../facts/workingSnapshot';
import { buildIntendedMap } from '../facts/intendedMap';
import { detectDrift } from '../facts/driftDetector';
import { auditLegacy } from '../facts/legacyAudit';
import { assembleFacts, saveFacts } from '../facts/factsAssembler';
import { LlmAnalyst } from '../analysis/llmAnalyst/runner';
import { AnalysisRenderer } from '../analysis/llmAnalyst/renderer';
import { RefactorReportProvider } from '../webview/refactorReportProvider';
import { ActiveBundleProvider } from './activeBundleProvider';
import { logInfo, logDebug, logError } from '../utils/logger';

/**
 * Generate report title from workspace scope and commit SHAs
 */
function generateReportTitle(
    workspaceScope: string,
    commitShas: string[],
    git: any
): string {
    const parts: string[] = [];
    
    // Workspace part
    if (workspaceScope !== 'none') {
        parts.push(`Workspace (${workspaceScope})`);
    }
    
    // Commits part
    if (commitShas.length === 1) {
        const isHead = commitShas[0] === git.getHeadSha();
        parts.push(isHead ? 'HEAD' : commitShas[0].substring(0, 8));
    } else if (commitShas.length > 1) {
        parts.push(`HEAD+${commitShas.length - 1}`);
    }
    
    return parts.join(' vs ');
}

// Types for refactor bundle analysis
interface IntendedState {
    expect: 'present' | 'absent';
    lastName?: string;
    lastPath?: string;
    lastSig?: string;
    lastSha: string;
}

interface DriftFindings {
    missing_symbols: Array<{ symbol_id: string, expected: IntendedState }>;
    zombie_symbols: Array<{ symbol_id: string, expected: IntendedState, found: SymbolContext }>;
    divergent_symbols: Array<{ symbol_id: string, expected: IntendedState, found: SymbolContext }>;
    missing_edges: Array<{ from: string, to: string, type: string, expected: IntendedState }>;
    zombie_edges: Array<{ from: string, to: string, type: string, found: EdgeContext }>;
    hotspots: Array<{ path: string, drift_count: number }>;
}

interface WorkingSnapshot {
    symbolsById: Map<string, SymbolContext>;
    symbolsByFile: Map<string, SymbolContext[]>;
    edges: EdgeContext[];
    analyzedPaths: Set<string>; // Track which paths were analyzed
}

interface ScopeSet {
    commitFiles: Set<string>;        // Files touched by selected commits
    workingChanged: Set<string>;     // Files changed in working tree
    blastRadius: Set<string>;        // Neighbor files from dependency analysis
    allPaths: Set<string>;           // Union of all paths to analyze
}






/**
 * Generate refactor bundle analysis report with scoped working tree analysis
 */
export async function generateRefactorBundleReport(
    commitShas: string[],
    refactorReportProvider?: RefactorReportProvider,
    cancellationToken?: vscode.CancellationToken,
    activeBundleProvider?: ActiveBundleProvider,
    selectedFiles?: string[],
    workspaceScope?: 'full' | 'staged' | 'unstaged' | 'partial',
    existingReportId?: string
): Promise<void> {
    const startTime = Date.now();
    console.log(`[REPORT] ========== Starting Refactor Bundle Report Generation ==========`);
    console.log(`[REPORT] Commits to analyze: ${commitShas?.length || 0}`);

    // Guard: Check for empty commits
    if (!commitShas || commitShas.length === 0) {
        console.error('[REPORT] No commits provided');
        vscode.window.showWarningMessage('Select commits in Commit Tracker first (use checkboxes), then click Generate Report.');
        return;
    }

    console.log(`[REPORT] Commit SHAs: ${commitShas.map(s => s.substring(0, 8)).join(', ')}`);

    // Ensure all commits are analyzed before proceeding
    const { getAnalysisPipeline } = await import('../analysis/pipeline');
    const pipeline = await getAnalysisPipeline();

    const unanalyzed: string[] = [];
    for (const sha of commitShas) {
      if (!(await pipeline.isCommitAnalyzed(sha))) {
        unanalyzed.push(sha);
      }
    }

    if (unanalyzed.length > 0) {
      console.log(`[REPORT] Analyzing ${unanalyzed.length} unanalyzed commits: ${unanalyzed.map(s => s.substring(0, 8)).join(', ')}`);
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Analyzing commits for report...',
        cancellable: false
      }, async () => {
        await pipeline.analyzeCommits(unanalyzed);
      });
    }

    try {
        await vscode.window.withProgress({
            location: { viewId: 'commitTracker' },
            title: 'Analyzing refactor bundle...',
            cancellable: true
        }, async (progress, token) => {
            // Merge provided token with the one from progress
            const effectiveToken = cancellationToken || token;

            // Check for cancellation at the start
            if (effectiveToken.isCancellationRequested) {
                return;
            }

            progress.report({ increment: 0, message: 'Computing analysis scope...' });

            // Phase 1: Compute scoped analysis set
            console.log('[REPORT] Phase 1: Computing scope...');
            const scopeStartTime = Date.now();
            
            // Convert workspaceScope to workspaceParts format if needed
            let workspaceParts: Set<'staged' | 'unstaged'> | undefined;
            if (workspaceScope === 'staged') {
              workspaceParts = new Set(['staged']);
            } else if (workspaceScope === 'unstaged') {
              workspaceParts = new Set(['unstaged']);
            } else if (workspaceScope === 'full') {
              workspaceParts = new Set(['staged', 'unstaged']);
            } else {
              // Default to full workspace for any other scope
              workspaceParts = new Set(['staged', 'unstaged']);
            }
            
            const scope = await computeScope(commitShas, workspaceParts);
            
            // Filter scope to only selected files if provided
            if (selectedFiles && selectedFiles.length > 0) {
              const selectedFilesSet = new Set(selectedFiles);
              scope.allPaths = new Set([...scope.allPaths].filter(p => selectedFilesSet.has(p)));
              scope.workingChanged = new Set([...scope.workingChanged].filter(p => selectedFilesSet.has(p)));
            }
            
            console.log(`[REPORT] Scope computed in ${Date.now() - scopeStartTime}ms`);
            console.log(`[REPORT] Scope - commit files: ${scope.commitFiles.size}, working changed: ${scope.workingChanged.size}, blast radius: ${scope.blastRadius.size}, total: ${scope.allPaths.size}`);

            if (scope.allPaths.size === 0) {
                console.warn('[REPORT] Empty scope - no files to analyze');
                vscode.window.showWarningMessage('No files to analyze. Make sure commits have been analyzed first.');
                return;
            }

            if (effectiveToken.isCancellationRequested) {
                return;
            }

            progress.report({ increment: 10, message: `Analyzing ${scope.allPaths.size} scoped files...` });

            // Phase 2: Get working tree snapshot
            console.log(`[REPORT] Phase 2: Analyzing ${scope.allPaths.size} files in working tree...`);
            const workingStartTime = Date.now();
            const working = await getWorkingSnapshot(scope.allPaths);
            console.log(`[REPORT] Working snapshot completed in ${Date.now() - workingStartTime}ms`);
            console.log(`[REPORT] Working tree - symbols: ${working.symbolsById.size}, edges: ${working.edges.length}, analyzed paths: ${working.analyzedPaths.size}`);

            if (working.symbolsById.size === 0) {
                console.warn('[REPORT] No symbols found in working tree');
            }

            if (effectiveToken.isCancellationRequested) {
                return;
            }

            progress.report({ increment: 30, message: 'Building intended refactor map...' });

            // Build intended refactor map
            console.log('[REPORT] Phase 3: Building intended refactor map...');
            const intendedStartTime = Date.now();
            const intended = await buildIntendedMap(commitShas);
            console.log(`[REPORT] Intended map built in ${Date.now() - intendedStartTime}ms`);
            console.log(`[REPORT] Intended state - entries: ${intended.size}`);

            if (intended.size === 0) {
                console.warn('[REPORT] Empty intended map - no refactor patterns detected');
            }

            if (effectiveToken.isCancellationRequested) {
                return;
            }

            progress.report({ increment: 50, message: 'Detecting drift...' });

            // Detect drift
            console.log('[REPORT] Phase 4: Detecting drift...');
            const driftStartTime = Date.now();
            const drift = detectDrift(intended, working, commitShas);
            console.log(`[REPORT] Drift detection completed in ${Date.now() - driftStartTime}ms`);
            console.log(`[REPORT] Drift - missing: ${drift.missing_symbols.length}, zombies: ${drift.zombie_symbols.length}, divergent: ${drift.divergent_symbols.length}`);
            console.log(`[REPORT] Drift edges - missing: ${drift.missing_edges.length}, zombies: ${drift.zombie_edges.length}`);
            console.log(`[REPORT] Drift hotspots: ${drift.hotspots.length}`);

            const totalDrift = drift.missing_symbols.length + drift.zombie_symbols.length + drift.divergent_symbols.length;
            if (totalDrift === 0) {
                console.log('[REPORT] No drift detected - refactor appears complete');
            }

            if (effectiveToken.isCancellationRequested) {
                return;
            }

            progress.report({ increment: 70, message: 'Auditing legacy code...' });

            // Audit legacy code
            console.log('[REPORT] Phase 5: Auditing legacy code...');
            const legacyStartTime = Date.now();
            const legacy = await auditLegacy(intended, working, scope);
            console.log(`[REPORT] Legacy audit completed in ${Date.now() - legacyStartTime}ms`);
            console.log(`[REPORT] Legacy - dead code: ${legacy.dead.length}, leftovers: ${legacy.replacedLeftovers?.length || 0}`);

            if (legacy.dead.length === 0 && (!legacy.replacedLeftovers || legacy.replacedLeftovers.length === 0)) {
                console.log('[REPORT] No legacy issues found');
            }

            if (effectiveToken.isCancellationRequested) {
                return;
            }

            progress.report({ increment: 85, message: 'Assembling facts...' });

            // Assemble facts into JSON
            console.log('[REPORT] Phase 6: Assembling facts...');
            const factsStartTime = Date.now();
            const facts = await assembleFacts(commitShas, scope, intended, working, drift, legacy);
            const factsPath = await saveFacts(facts);
            console.log(`[REPORT] Facts assembled in ${Date.now() - factsStartTime}ms`);
            console.log(`[REPORT] Facts saved to: ${factsPath}`);
            console.log(`[REPORT] Facts keys: ${Object.keys(facts).join(', ')}`);

            // Update active bundle provider with latest facts (triggers tree refresh)
            if (activeBundleProvider) {
                activeBundleProvider.lastBundleFacts = facts;
                activeBundleProvider.refresh();
                console.log('[REPORT] Active bundle provider refreshed with latest facts');
            }

            // Guard: Check if facts are empty
            const hasData = facts && (
                (facts.findings?.incompleteness?.missing > 0) ||
                (facts.findings?.incompleteness?.zombies > 0) ||
                (facts.findings?.patternDrift?.mixedTargets > 0) ||
                (facts.findings?.legacyAudit?.dead > 0)
            );

            if (!hasData) {
                console.warn('[REPORT] Facts appear to be empty or have no findings');
                console.log('[REPORT] Facts object:', JSON.stringify(facts, null, 2));
            }

            // Store facts in active bundle provider for UI updates
            if (activeBundleProvider) {
                activeBundleProvider.lastBundleFacts = facts;
                activeBundleProvider.refresh();
                console.log('[REPORT] Facts stored in active bundle provider');
            }

            if (effectiveToken.isCancellationRequested) {
                return;
            }

            progress.report({ increment: 90, message: 'Running LLM analysis...' });

            // Run LLM analyst on facts
            console.log('[REPORT] Phase 7: Running LLM analysis...');
            const llmStartTime = Date.now();

            // Build raw feed for pattern discovery
            console.log('[REPORT] Building raw feed for discovery...');
            const { AstSerializer } = await import('../analysis/astSerializer');
            const astSerializer = new AstSerializer();

            // Get ASTs for top 10 files
            const topFiles = Array.from(scope.allPaths).slice(0, 10);
            const astSamples = [];
            const git = new GitOperations();

            for (const filePath of topFiles) {
                try {
                    const fullPath = path.join(getGitRoot() || '', filePath);
                    if (fs.existsSync(fullPath)) {
                        const stat = fs.statSync(fullPath);
                        if (!stat.isFile()) {
                            console.log(`[REPORT] Skipping non-file path for AST serialization: ${filePath}`);
                            continue;
                        }
                        const content = fs.readFileSync(fullPath, 'utf8');
                        const ast = await astSerializer.serializeFile(content, filePath);
                        if (ast) {
                            astSamples.push({ path: filePath, ast });
                        }
                    }
                } catch (e) {
                    console.warn(`Failed to serialize AST for ${filePath}:`, e);
                }
            }

            // Get diff hunks for top 20 files
            const diffHunks = [];
            const diffFiles = Array.from(scope.commitFiles).slice(0, 20);

            // Determine bundle range
            // Assumes commitShas are ordered (newest first or oldest first? usually oldest first in this context)
            // Let's sort them by date to be sure, or just trust the input
            // If we assume input is arbitrary, we should sort. But for now let's assume valid range.
            const startSha = commitShas[commitShas.length - 1]; // Oldest?
            const endSha = commitShas[0]; // Newest?
            // Actually, let's just use the first and last from the array as passed
            // If commitShas is [newest, ..., oldest] (git log default), then start=last, end=first
            // If commitShas is [oldest, ..., newest], then start=first, end=last
            // We'll try to detect or just use the first/last in the list

            for (const filePath of diffFiles) {
                try {
                    // Use bundle diff for better context
                    const diff = git.getBundleDiff(commitShas[commitShas.length - 1], commitShas[0], filePath);
                    if (diff) {
                        diffHunks.push({ path: filePath, diff: diff.substring(0, 1000) }); // Truncate
                    }
                } catch (e) {
                    // Ignore diff errors
                }
            }

            const rawFeed = {
                ast_samples: astSamples,
                diff_hunks: diffHunks,
                graph: {
                    nodes: Array.from(working.symbolsById.keys()).slice(0, 50),
                    edges: working.edges.slice(0, 200)
                },
                metrics: {
                    symbols: working.symbolsById.size,
                    edges: working.edges.length,
                    files: scope.allPaths.size
                }
            };

            const analyst = new LlmAnalyst();
            const llmAnalysis = await analyst.analyze(facts, rawFeed);
            console.log(`[REPORT] LLM analysis completed in ${Date.now() - llmStartTime}ms`);
            console.log(`[REPORT] LLM analysis keys: ${llmAnalysis ? Object.keys(llmAnalysis).join(', ') : 'null'}`);

            // Store patterns in Qdrant if discovery block exists
            if (llmAnalysis && llmAnalysis.blocks) {
                const discoveryBlock = llmAnalysis.blocks.find(b => b.type === 'discovery');
                if (discoveryBlock && discoveryBlock.claims.length > 0) {
                    try {
                        const { getSearchIndex } = await import('../storage/index');
                        const searchIndex = getSearchIndex();
                        
                        // Extract patterns from claims (they contain pattern info)
                        const patterns = discoveryBlock.claims.map(claim => ({
                            name: claim.text.split(':')[0] || claim.text.substring(0, 50),
                            description: claim.text,
                            examples: claim.evidence.map(e => e.description).slice(0, 5),
                            count: 0, // Will be extracted from claim if available
                            pct: Math.round(claim.confidence * 100)
                        }));
                        
                        await searchIndex.storePatterns(patterns, commitShas);
                        console.log(`[REPORT] Stored ${patterns.length} patterns to Qdrant`);
                    } catch (error) {
                        console.warn('[REPORT] Failed to store patterns:', error);
                    }
                }
            }

            if (!llmAnalysis) {
                console.warn('[REPORT] LLM analysis returned null or empty');
            } else {
                // Save analysis to file for quick re-opening
                try {
                    const { getGitRoot } = await import('../utils/config');
                    const gitRoot = getGitRoot();
                    if (gitRoot) {
                        const fs = await import('fs');
                        const path = await import('path');
                        const analysisPath = path.join(gitRoot, '.git', 'commit-tracker', 'last-bundle-analysis.json');
                        fs.writeFileSync(analysisPath, JSON.stringify(llmAnalysis, null, 2));
                        console.log('[REPORT] Analysis saved to:', analysisPath);
                    }
                } catch (error) {
                    console.error('[REPORT] Failed to save analysis:', error);
                }
            }

            // Save report to database
            try {
                const { getReportManager } = await import('../storage/reportManager');
                const { GitOperations } = await import('../analysis/git');
                const reportManager = getReportManager();
                const git = new GitOperations();
                
                // Generate report title
                const reportTitle = generateReportTitle(
                    workspaceScope || 'full',
                    commitShas,
                    git
                );
                
                // Calculate summary
                const criticalCount = facts.findings.incompleteness.missing + 
                                    facts.findings.incompleteness.zombies +
                                    (facts.findings.legacyAudit?.dead || 0);
                const warningCount = facts.findings.patternDrift.mixedTargets +
                                   facts.findings.patternDrift.oldNamespaces +
                                   (facts.findings.legacyAudit?.legacyUsed || 0);
                const summary = `${criticalCount} Critical Issues`;
                
                // Create report
                const report = {
                    id: existingReportId || require('crypto').randomUUID(),
                    title: reportTitle,
                    commitShas: commitShas,
                    selectedFiles: selectedFiles || [],
                    workspaceScope: workspaceScope || 'full',
                    createdAt: new Date(),
                    workspaceHash: reportManager.computeWorkspaceHash(),
                    facts: facts,
                    analysis: llmAnalysis,
                    summary: summary,
                    criticalCount: criticalCount,
                    warningCount: warningCount,
                    isPinned: existingReportId ? (reportManager.load(existingReportId)?.isPinned || false) : false
                };
                
                reportManager.save(report);
                console.log('[REPORT] Report saved to database:', report.id);
            } catch (error) {
                console.error('[REPORT] Failed to save report to database:', error);
                // Don't fail the whole operation if saving fails
            }

            if (effectiveToken.isCancellationRequested) {
                return;
            }

            progress.report({ increment: 95, message: 'Generating report...' });

            // Update debt meter with new facts
            console.log('[REPORT] Phase 8: Updating debt meter...');
            const { refreshDebtMeter } = await import('./refactorDebtMeter');
            refreshDebtMeter();
            console.log('[REPORT] Debt meter refreshed');

            // Generate markdown report instead of webview
            console.log('[REPORT] Rendering markdown report...');
            const renderer = new AnalysisRenderer();
            const markdown = renderer.renderAnalysis(llmAnalysis, facts);
            console.log(`[REPORT] Rendered markdown (${markdown.length} chars)`);

            // Save to file and open in markdown preview
            const gitRoot = getGitRoot();
            let reportPath: string;
            
            if (gitRoot) {
                // Save to .git/commit-tracker/report.md
                const reportDir = path.join(gitRoot, '.git', 'commit-tracker');
                reportPath = path.join(reportDir, 'commit-report.md');
                
                // Ensure directory exists
                if (!fs.existsSync(reportDir)) {
                    fs.mkdirSync(reportDir, { recursive: true });
                }
            } else {
                // Fallback to temp directory if not in git repo
                reportPath = path.join(os.tmpdir(), 'git-context-report.md');
            }
            
            // Write file
            fs.writeFileSync(reportPath, markdown, 'utf8');
            
            // Open in markdown preview
            await vscode.commands.executeCommand('markdown.showPreviewToSide', vscode.Uri.file(reportPath));
            
            console.log(`[REPORT] Total report generation time: ${Date.now() - startTime}ms`);
            vscode.window.showInformationMessage(`Refactor bundle analysis complete - see markdown preview`);
        });

    } catch (error) {
        console.error('[REPORT] ========== Report Generation FAILED ==========');
        console.error('[REPORT] Error:', error);
        console.error('[REPORT] Stack:', error instanceof Error ? error.stack : 'No stack trace');
        vscode.window.showErrorMessage(`Failed to generate refactor bundle report: ${error}`);
        console.error('Refactor bundle analysis error:', error);
    }
}


export async function generateCommitReport(commitShas?: string[]): Promise<void> {
    try {
        const { getDatabaseManager, ensureDatabaseInitialized } = await import('../storage/database');
        await ensureDatabaseInitialized();
        const db = getDatabaseManager().getDatabase();

        // Fetch commits
        let commits: any[];

        if (commitShas && commitShas.length > 0) {
            // Generate report for specific commits
            const placeholders = commitShas.map(() => '?').join(',');
            const commitsStmt = db.prepare(`
            SELECT
                m.sha, m.author, m.date, m.message,
                a.summary_md, m.files_changed,
                a.symbols_added, a.symbols_modified, a.symbols_removed, a.risks
            FROM commits_metadata m
            LEFT JOIN commits_analysis a ON m.sha = a.sha
            WHERE m.sha IN(${placeholders})
            ORDER BY m.date DESC
    `);
            commits = commitsStmt.all(...commitShas) as any[];
        } else {
            // Fetch all commits
            const commitsStmt = db.prepare(`
            SELECT
                m.sha, m.author, m.date, m.message,
                a.summary_md, m.files_changed,
                a.symbols_added, a.symbols_modified, a.symbols_removed, a.risks
            FROM commits_metadata m
            LEFT JOIN commits_analysis a ON m.sha = a.sha
            ORDER BY m.date DESC
            LIMIT 20
          `);
            commits = commitsStmt.all() as any[];
        }

        if (commits.length === 0) {
            vscode.window.showInformationMessage('No commits analyzed yet. Run "Analyze Last N Commits" first.');
            return;
        }

        // Build markdown report
        let markdown = `# Git Commit Analysis Report\n\n`;
        markdown += `Generated: ${new Date().toLocaleString()} \n\n`;
        if (commitShas && commitShas.length > 0) {
            markdown += `Report for ${commits.length} selected commit${commits.length > 1 ? 's' : ''} \n\n`;
        } else {
            markdown += `Total commits analyzed: ${commits.length} \n\n`;
        }
        markdown += `-- -\n\n`;

        for (const commit of commits) {
            const shortSha = commit.sha.substring(0, 8);
            const risks = JSON.parse(commit.risks || '[]');

            markdown += `## 📝 ${shortSha} - ${commit.message.split('\n')[0]} \n\n`;
            markdown += `** Author:** ${commit.author} \n`;
            markdown += `** Date:** ${commit.date} \n`;
            markdown += `** Files Changed:** ${commit.files_changed} \n`;
            markdown += `** Symbols:** +${commit.symbols_added} ~${commit.symbols_modified} -${commit.symbols_removed} \n\n`;

            // Add risks if any
            if (risks.length > 0) {
                markdown += `### ⚠️ Risks\n\n`;
                for (const risk of risks) {
                    markdown += `- ${risk} \n`;
                }
                markdown += `\n`;
            }

            // Add AI summary if available
            if (commit.summary_md) {
                markdown += `### Summary\n\n${commit.summary_md} \n\n`;
            }

            // Fetch and display symbols
            if (commit.symbols_added > 0) {
                const symbolsStmt = db.prepare(`
          SELECT name, kind, path, symbol_id FROM symbols
          WHERE sha = ? AND change_type = 'added'
          ORDER BY kind, name
    `);
                const symbols = symbolsStmt.all(commit.sha) as any[];

                if (symbols.length > 0) {
                    markdown += `### ➕ Added Symbols(${symbols.length}) \n\n`;
                    const grouped = groupByKind(symbols);
                    for (const [kind, items] of Object.entries(grouped)) {
                        markdown += `** ${kind}:**\n`;
                        for (const item of items) {
                            markdown += `- \`${item.name}\` (${item.path})\n`;

                            // Show what this new symbol calls
                            const callsStmt = db.prepare(`
                SELECT to_symbol_id, edge_type FROM edges
                WHERE sha = ? AND from_symbol_id = ? AND change_type = 'added'
                LIMIT 5
              `);
                            const calls = callsStmt.all(commit.sha, item.symbol_id) as any[];
                            if (calls.length > 0) {
                                markdown += `  - Calls: ${calls.map(c => `\`${extractSymbolName(c.to_symbol_id)}\``).join(', ')}${calls.length === 5 ? '...' : ''}\n`;
                            }
                        }
                        markdown += `\n`;
                    }
                }
            }

            if (commit.symbols_modified > 0) {
                const symbolsStmt = db.prepare(`
          SELECT name, kind, path, symbol_id FROM symbols
          WHERE sha = ? AND change_type IN ('modified', 'signature_changed')
          ORDER BY kind, name
        `);
                const symbols = symbolsStmt.all(commit.sha) as any[];

                if (symbols.length > 0) {
                    markdown += `### ✏️ Modified Symbols (${symbols.length})\n\n`;
                    const grouped = groupByKind(symbols);
                    for (const [kind, items] of Object.entries(grouped)) {
                        markdown += `**${kind}:**\n`;
                        for (const item of items) {
                            markdown += `- \`${item.name}\` (${item.path})\n`;
                        }
                        markdown += `\n`;
                    }
                }
            }

            if (commit.symbols_removed > 0) {
                const symbolsStmt = db.prepare(`
          SELECT name, kind, path, symbol_id FROM symbols
          WHERE sha = ? AND change_type = 'removed'
          ORDER BY kind, name
        `);
                const symbols = symbolsStmt.all(commit.sha) as any[];

                if (symbols.length > 0) {
                    markdown += `### ➖ Removed Symbols (${symbols.length})\n\n`;
                    const grouped = groupByKind(symbols);
                    for (const [kind, items] of Object.entries(grouped)) {
                        markdown += `**${kind}:**\n`;
                        for (const item of items) {
                            markdown += `- \`${item.name}\` (${item.path})\n`;

                            // Show what used to call this removed symbol
                            const calledByStmt = db.prepare(`
                SELECT from_symbol_id, edge_type FROM edges
                WHERE sha = ? AND to_symbol_id = ? AND change_type = 'removed'
                LIMIT 5
              `);
                            const calledBy = calledByStmt.all(commit.sha, item.symbol_id) as any[];
                            if (calledBy.length > 0) {
                                markdown += `  - Was called by: ${calledBy.map(c => `\`${extractSymbolName(c.from_symbol_id)}\``).join(', ')}${calledBy.length === 5 ? '...' : ''}\n`;
                            }
                        }
                        markdown += `\n`;
                    }
                }
            }

            // Add dependency graph section
            const edgesStmt = db.prepare(`
        SELECT COUNT(*) as count FROM edges WHERE sha = ?
      `);
            const edgeCount = edgesStmt.get(commit.sha) as any;

            if (edgeCount && edgeCount.count > 0) {
                markdown += `### 🔗 Function Call Graph (${edgeCount.count} connections)\n\n`;
                markdown += `This commit creates ${edgeCount.count} new function call relationships.\n\n`;

                // Show top call patterns
                const topCallersStmt = db.prepare(`
          SELECT from_symbol_id, COUNT(*) as call_count
          FROM edges
          WHERE sha = ? AND change_type = 'added'
          GROUP BY from_symbol_id
          ORDER BY call_count DESC
          LIMIT 5
        `);
                const topCallers = topCallersStmt.all(commit.sha) as any[];

                if (topCallers.length > 0) {
                    markdown += `**Most Connected New Functions:**\n`;
                    for (const caller of topCallers) {
                        const symbolName = extractSymbolName(caller.from_symbol_id);
                        markdown += `- \`${symbolName}\` makes ${caller.call_count} calls\n`;

                        // Show what it calls
                        const callsStmt = db.prepare(`
              SELECT to_symbol_id FROM edges
              WHERE sha = ? AND from_symbol_id = ? AND change_type = 'added'
              LIMIT 3
            `);
                        const calls = callsStmt.all(commit.sha, caller.from_symbol_id) as any[];
                        if (calls.length > 0) {
                            markdown += `  → ${calls.map(c => `\`${extractSymbolName(c.to_symbol_id)}\``).join(', ')}${calls.length === 3 ? '...' : ''}\n`;
                        }
                    }
                    markdown += `\n`;
                }
            }

            markdown += `---\n\n`;
        }

        // Create and show document
        const { getGitRoot } = await import('../utils/config');
        const gitRoot = getGitRoot();

        let reportPath: string;
        
        if (gitRoot) {
            // Save to .git/commit-tracker/report.md
            const reportDir = path.join(gitRoot, '.git', 'commit-tracker');
            reportPath = path.join(reportDir, 'commit-report.md');

            // Ensure directory exists
            if (!fs.existsSync(reportDir)) {
                fs.mkdirSync(reportDir, { recursive: true });
            }
        } else {
            // Fallback to temp directory if not in git repo
            reportPath = path.join(os.tmpdir(), 'git-context-report.md');
        }

        // Write file
        fs.writeFileSync(reportPath, markdown, 'utf8');

        // Open in markdown preview
        await vscode.commands.executeCommand('markdown.showPreviewToSide', vscode.Uri.file(reportPath));

        vscode.window.showInformationMessage(`Report saved to ${reportPath}`);

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to generate report: ${error}`);
        console.error('Report generation error:', error);
    }
}

function groupByKind(symbols: any[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};
    for (const symbol of symbols) {
        if (!grouped[symbol.kind]) {
            grouped[symbol.kind] = [];
        }
        grouped[symbol.kind].push(symbol);
    }
    return grouped;
}

function extractSymbolName(symbolId: string): string {
    // symbol_id format is typically "path:class_name" or "path:function_name"
    const parts = symbolId.split(':');
    if (parts.length > 1) {
        return parts[parts.length - 1].replace(/^(class_|function_)/, '');
    }
    return symbolId;
}
