import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { getRefactorPipeline } from '../extension';
import { GitOperations } from '../analysis/git';
import { getReportManager } from '../storage/reportManager';
import { getDatabaseManager } from '../storage/database';
import { getCockpitOrchestrator } from '../state/cockpitOrchestrator';
import { LlmAnalyst } from '../analysis/llmAnalyst/runner';
import { getExtensionConfig } from '../utils/config';
import { RefactorBundleFacts } from '../facts/types';
import { CommitAnalysis } from '../types';
import { makeBundleFingerprint, PIPELINE_VERSION, PROMPT_VERSION } from '../utils/fingerprint';
import { logInfo, logError, logDebug } from '../utils/logger';
import { isWorkspaceSha } from '../utils/workspace';

export class ReportService {
    private static instance: ReportService;

    private constructor() {
        // Singleton: use getInstance()
    }

    static getInstance(): ReportService {
        if (!ReportService.instance) {
            ReportService.instance = new ReportService();
        }
        return ReportService.instance;
    }

    /**
     * Generate a refactor bundle report for a set of commits or workspace changes
     */
    async generateReport(
        shas: string[],
        scope: 'full' | 'staged' | 'unstaged' | 'partial' = 'full',
        options: {
            force?: boolean;
            title?: string;
            existingReportId?: string;
            skipLLM?: boolean;
            cancellationToken?: vscode.CancellationToken;
            llmCallTracker?: (purpose: string, model?: string, tokens?: number, duration?: number) => void;
        } = {}
    ): Promise<string | null> {
        const orchestrator = getCockpitOrchestrator();
        const pipeline = await getRefactorPipeline();
        const reportManager = getReportManager();

        // 1. Check Cache (Layer 3)
        const fingerprint = makeBundleFingerprint(
            shas,
            scope as any, // 'selection' | 'staged' | 'unstaged' | 'lastN' | 'full'
            PIPELINE_VERSION,
            PROMPT_VERSION
        );

        const tempAnalyzed: Set<string> = new Set();

        if (!options.force && !options.existingReportId) {
            const cachedReport = reportManager.loadByFingerprint(fingerprint);
            if (cachedReport) {
                const facts = cachedReport.facts;
                const isEmpty = !facts || facts.scope.files === 0 && facts.working.symbols === 0;
                if (isEmpty) {
                    logInfo(`[ReportService] Empty cache hit for ${fingerprint}; forcing reanalysis...`);
                    orchestrator.updateState({analysisStep: 'Reindexing empty commits...'}, 'report:reindexStart');
                    const commitShas = shas.filter(s => !isWorkspaceSha(s));
                    await pipeline.indexCommits(commitShas);
                    commitShas.forEach(s => tempAnalyzed.add(s));
                    // Fall through to full generation (cache bypassed)
                } else {
                    logInfo(`[ReportService] Cache hit for ${fingerprint}`);
                    orchestrator.updateState({
                        bundleFacts: facts,
                        bundleSummary: cachedReport.analysis,
                        bundleReportId: cachedReport.id,
                        isAnalyzing: false
                    }, 'report:cached');
                    return cachedReport.id;
                }
            }
        }

        orchestrator.updateState({ isAnalyzing: true, analysisStep: 'Analyzing commits...' }, 'report:start');

        try {
            // 2. Run Analysis with new layered pipeline
            const includeWorkspace = scope === 'staged' || scope === 'unstaged' || scope === 'full';
            const commitShas = shas.filter(sha => !isWorkspaceSha(sha));
            const workspaceShas = shas.filter(isWorkspaceSha);

            // Use the new RefactorPipeline.analyzeBundle method
            const result = await pipeline.analyzeBundle(
                commitShas,
                includeWorkspace,
                (event) => {
                    // Map pipeline events to orchestrator state
                    switch (event.type) {
                        case 'start':
                            orchestrator.updateState({
                                analysisStep: event.step.label,
                                analysisProgress: undefined
                            }, `report:step:${event.step.id}`);
                            break;

                        case 'complete':
                            orchestrator.updateState({
                                analysisStep: event.step.label,
                                analysisProgress: 100
                            }, `report:step:${event.step.id}:complete`);
                            break;

                        case 'error':
                            orchestrator.updateState({
                                error: String(event.error),
                                isAnalyzing: false
                            }, `report:error`);
                            break;

                        case 'finished':
                            if (event.state.errors.length === 0) {
                                // Serialize symbolEvolution map
                                const history = event.state.history;
                                const serializedHistory = history ? {
                                    ...history,
                                    symbolEvolution: history.symbolEvolution
                                        ? Object.fromEntries(history.symbolEvolution)
                                        : {}
                                } : undefined;

                                orchestrator.updateState({
                                    bundleFacts: event.state.bundleFacts,
                                    retrievedHistory: serializedHistory,
                                    isAnalyzing: false,
                                    analysisStep: undefined,
                                    pipelineErrors: []
                                }, 'report:complete');
                            }
                            break;
                    }
                }
            );

            if (result.errors.length > 0) {
                throw new Error(`Pipeline failed: ${result.errors[0].error}`);
            }

            if (options.cancellationToken?.isCancellationRequested) {
                orchestrator.updateState({ isAnalyzing: false }, 'report:cancelled');
                return null;
            }

            // 3. Use facts and analysis from new pipeline
            const facts = result.bundleFacts;
            const llmAnalysis = result.llmOutputs;

            // 4. Prepare analysis results
            let summary: string;
            let analysis: any = undefined;

            if (llmAnalysis) {
                summary = llmAnalysis.summary;
                analysis = {
                    summary: llmAnalysis.summary,
                    blocks: llmAnalysis.blocks,
                    markdown: llmAnalysis.markdown,
                    metadata: llmAnalysis.metadata
                };

                logInfo(`[ReportService] LLM analysis complete: ` +
                        `health score ${llmAnalysis.metadata.healthScore}/100, ` +
                        `${llmAnalysis.metadata.totalTokens} tokens`);
            } else {
                logDebug('[ReportService] LLM not available, using fallback summary');
                summary = this.generateFallbackSummary(facts, shas);
                analysis = { summary };
            }

            // 4.5. Compute workspace hash
            let workspaceHash = '';
            if (scope === 'staged' || scope === 'unstaged') {
                // Workspace-based: capture actual file state
                try {
                    workspaceHash = await reportManager.computeWorkspaceHash();
                    logDebug(`[ReportService] Computed workspace hash: ${workspaceHash.substring(0, 8)}...`);
                } catch (error) {
                    logError('[ReportService] Failed to compute workspace hash', error);
                    // Continue with empty hash rather than failing entire report
                    workspaceHash = '';
                }
            } else {
                // Commit-based: use configuration hash
                const selectedFiles = (facts.evidence['scope.files'] as string[]) || [];
                const input = JSON.stringify({
                    shas: [...shas].sort(),
                    selectedFiles: [...selectedFiles].sort(),
                    scope
                });
                workspaceHash = crypto.createHash('sha256').update(input).digest('hex');
                logDebug(`[ReportService] Computed config hash: ${workspaceHash.substring(0, 8)}...`);
            }

            // 5. Save Report
            const reportId = options.existingReportId || crypto.randomUUID();
            const title = options.title || this.generateTitle([...commitShas, ...workspaceShas]);

            const report = {
                id: reportId,
                title,
                commitShas: shas,
                selectedFiles: (facts.evidence['scope.files'] as string[]) || [],
                workspaceScope: scope,
                createdAt: new Date(),
                workspaceHash: workspaceHash,
                facts,
                analysis: analysis || { summary },
                summary,
                criticalCount: facts.findings.incompleteness.missing + facts.findings.incompleteness.zombies,
                warningCount: facts.findings.legacyAudit.dead,
                isPinned: false,
                fingerprint,
                pipelineVersion: PIPELINE_VERSION,
                promptVersion: PROMPT_VERSION,
                mode: scope
            };

            reportManager.save(report);

            // 6. Update State
            orchestrator.updateState({
                bundleFacts: facts,
                bundleSummary: {
                    id: reportId,
                    commitCount: shas.length,
                    fileCount: facts.scope.files,
                    symbolCount: facts.working.symbols,
                    createdAt: new Date().toISOString(),
                    debtScore: 0 // Placeholder
                },
                bundleReportId: reportId,
                isAnalyzing: false
            }, 'report:generated');

            return reportId;

        } catch (error) {
            logError('[ReportService] Failed to generate report', error);
            orchestrator.updateState({
                isAnalyzing: false,
                error: error instanceof Error ? error.message : String(error)
            }, 'report:error');
            throw error;
        }
    }

    private isEmptyAnalysis(analysis: CommitAnalysis): boolean {
        const symbolCount = (analysis.symbols?.added?.length || 0) +
            (analysis.symbols?.modified?.length || 0) +
            (analysis.symbols?.removed?.length || 0);
        const edgeCount = (analysis.edges?.added?.length || 0) + (analysis.edges?.removed?.length || 0);
        return symbolCount === 0 && edgeCount === 0;
    }

    private aggregateFacts(
        commits: CommitAnalysis[],
        shas: string[] = []
    ): RefactorBundleFacts {
        // Simple aggregation for now - can be expanded
        const totalFiles = new Set<string>();
        let totalBlastRadius = 0;
        let addedSymbols = 0;
        let addedEdges = 0;

        const process = (c: CommitAnalysis) => {
            // Blast radius
            totalBlastRadius += c.blastRadius;

            // Symbols
            addedSymbols += c.symbols.added.length;

            // Edges
            addedEdges += c.edges.added.length;
        };

        commits.forEach(process);

        // For commit-based analysis, query database to get file lists
        if (commits.length > 0) {
            try {
                const db = getDatabaseManager().getDatabase();
                if (db && shas.length > 0) {
                    const placeholders = shas.map(() => '?').join(',');
                    const filesStmt = db.prepare(`
                        SELECT DISTINCT path FROM files
                        WHERE sha IN (${placeholders})
                    `);
                    const fileRows = filesStmt.all(...shas) as Array<{ path: string }>;
                    fileRows.forEach(row => totalFiles.add(row.path));
                }
            } catch (error) {
                logError('[ReportService] Failed to fetch files from database', error);
                // Continue with whatever files we have
            }
        }

        return {
            version: '2.0',
            generated_at: new Date().toISOString(),
            confidence: 0.2, // Low confidence - basic aggregation only
            bundle: {
                oldestSha: shas[shas.length - 1] || '',
                newestSha: shas[0] || '',
                shas
            },
            scope: {
                files: totalFiles.size,
                blastRadius: totalBlastRadius
            },
            intended: {
                present: addedSymbols,
                absent: 0,
                renamed: 0
            },
            working: {
                symbols: addedSymbols,
                edges: addedEdges
            },
            findings: {
                incompleteness: {
                    missing: 0,
                    zombies: 0,
                    divergent: 0
                },
                patternDrift: {
                    mixedTargets: 0,
                    oldNamespaces: 0
                },
                legacyAudit: {
                    dead: 0,
                    legacyUsed: 0,
                    replacedLeftovers: []
                }
            },
            evidence: {
                "scope.files": Array.from(totalFiles)
            }
        };
    }

    private generateTitle(shas: string[]): string {
        const workspaceCount = shas.filter(isWorkspaceSha).length;
        const commitCount = shas.length - workspaceCount;
        const parts: string[] = [];
        if (commitCount > 0) {
            parts.push(`${commitCount} commits`);
        }
        if (workspaceCount > 0) {
            parts.push(`${workspaceCount} workspace`);
        }
        if (parts.length === 0) {
            return 'Workspace Analysis';
        }
        return `Analysis: ${parts.join(' + ')}`;
    }

    private generateFallbackSummary(facts: RefactorBundleFacts, shas: string[]): string {
        const totalIssues = facts.findings.incompleteness.missing +
            facts.findings.incompleteness.zombies +
            facts.findings.legacyAudit.dead;

        let summary = `## Refactor Analysis Summary\n\n`;
        summary += `**Scope**: ${shas.length} commits, ${facts.scope.files} files, `;
        summary += `${facts.working.symbols} symbols\n\n`;

        if (totalIssues === 0) {
            summary += '### Status: ✅ Healthy\n\n';
            summary += 'No critical issues detected. The refactor appears complete and consistent.\n\n';
        } else {
            summary += `### Status: ⚠️ ${totalIssues} Issues Found\n\n`;

            if (facts.findings.incompleteness.missing > 0) {
                summary += `- **${facts.findings.incompleteness.missing} Missing Symbols**: `;
                summary += `Expected symbols not found in working directory\n`;
            }
            if (facts.findings.incompleteness.zombies > 0) {
                summary += `- **${facts.findings.incompleteness.zombies} Zombie Symbols**: `;
                summary += `Symbols marked for removal but still present\n`;
            }
            if (facts.findings.legacyAudit.dead > 0) {
                summary += `- **${facts.findings.legacyAudit.dead} Dead Code**: `;
                summary += `Unreferenced symbols that can be removed\n`;
            }

            summary += `\n### Recommended Actions\n\n`;
            if (facts.findings.incompleteness.missing > 0) {
                summary += `1. Complete missing symbol implementations (high priority)\n`;
            }
            if (facts.findings.incompleteness.zombies > 0) {
                summary += `2. Remove zombie symbols to finish cleanup\n`;
            }
            if (facts.findings.legacyAudit.dead > 0) {
                summary += `3. Clean up dead code to improve maintainability\n`;
            }
        }

        return summary;
    }

    async exportReportsDto(
        filterText?: string,
        filterBranch?: string | 'all',
        showPinnedOnly?: boolean
    ): Promise<Array<{ id: string; title: string; summary: string; createdAt: string; pinned?: boolean; branch?: string }>> {
        const reportManager = getReportManager();
        let reports = reportManager.list();

        // Apply filters
        if (filterText && filterText.trim()) {
            const searchTerm = filterText.trim().toLowerCase();
            reports = reports.filter((report: any) =>
                (report.title || '').toLowerCase().includes(searchTerm) ||
                (report.summary || '').toLowerCase().includes(searchTerm)
            );
        }

        if (filterBranch && filterBranch !== 'all') {
            // reports don't have branch field in SavedReport interface yet, but let's keep it safe
            reports = reports.filter((report: any) => (report as any).branch === filterBranch);
        }

        if (showPinnedOnly) {
            reports = reports.filter((report: any) => !!report.isPinned);
        }

        return reports.map((report: any) => ({
            id: report.id,
            title: report.title,
            summary: report.summary || '',
            createdAt: (report.createdAt instanceof Date ? report.createdAt : new Date(report.createdAt)).toISOString(),
            pinned: !!report.isPinned,
            branch: (report as any).branch
        }));
    }
}

export async function getReportService(): Promise<ReportService> {
    return ReportService.getInstance();
}
