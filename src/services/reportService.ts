import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { getAnalysisPipeline } from '../analysis/pipeline';
import { getReportManager } from '../storage/reportManager';
import { getDatabaseManager } from '../storage/database';
import { getCockpitOrchestrator } from '../state/cockpitOrchestrator';
import { LlmAnalyst } from '../analysis/llmAnalyst/runner';
import { getExtensionConfig } from '../utils/config';
import { RefactorBundleFacts } from '../facts/types';
import { CommitAnalysis, StagedAnalysis } from '../types';
import { makeBundleFingerprint, PIPELINE_VERSION, PROMPT_VERSION } from '../utils/fingerprint';
import { logInfo, logError, logDebug } from '../utils/logger';

export class ReportService {
    private static instance: ReportService;

    private constructor() { }

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
        } = {}
    ): Promise<string | null> {
        const orchestrator = getCockpitOrchestrator();
        const pipeline = await getAnalysisPipeline();
        const reportManager = getReportManager();

        // 1. Check Cache (Layer 3)
        const fingerprint = makeBundleFingerprint(
            shas,
            scope as any, // 'selection' | 'staged' | 'unstaged' | 'lastN' | 'full'
            PIPELINE_VERSION,
            PROMPT_VERSION
        );

        if (!options.force && !options.existingReportId) {
            const cachedReport = reportManager.loadByFingerprint(fingerprint);
            if (cachedReport) {
                logInfo(`[ReportService] Cache hit for fingerprint ${fingerprint}`);
                orchestrator.updateState({
                    bundleFacts: cachedReport.facts,
                    bundleSummary: cachedReport.analysis, // Using analysis as summary for now
                    bundleReportId: cachedReport.id,
                    isAnalyzing: false
                }, 'report:cached');

                // Show report in webview (if provider available - handled by caller usually, but we can emit event)
                return cachedReport.id;
            }
        }

        orchestrator.updateState({ isAnalyzing: true, analysisStep: 'Analyzing commits...' }, 'report:start');

        try {
            // 2. Run Analysis (Layer 1 & 2 handled by pipeline)
            let analysisResults: CommitAnalysis[] = [];
            let stagedAnalysis: StagedAnalysis | undefined;

            if (scope === 'staged') {
                stagedAnalysis = await pipeline.analyzeStagedChanges();
            } else if (scope === 'unstaged') {
                stagedAnalysis = await pipeline.analyzeUnstagedChanges();
            } else {
                // Analyze commits
                analysisResults = await pipeline.analyzeCommits(shas, {
                    forceReanalyze: options.force
                });
            }

            if (options.cancellationToken?.isCancellationRequested) {
                orchestrator.updateState({ isAnalyzing: false }, 'report:cancelled');
                return null;
            }

            // 3. Aggregate Facts
            const facts = this.aggregateFacts(analysisResults, stagedAnalysis, shas);

            // 4. Generate Summary (LLM)
            let summary: string;
            let analysis: any = undefined;

            const config = getExtensionConfig();
            const llmAvailable = config.openRouterApiKey && config.openRouterModel;

            if (!options.skipLLM && llmAvailable) {
                try {
                    orchestrator.updateState({
                        analysisStep: 'Generating LLM analysis...'
                    }, 'report:llm-start');

                    const analyst = new LlmAnalyst();
                    const llmAnalysis = await analyst.analyze(facts);

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
                } catch (error) {
                    logError('[ReportService] LLM analysis failed, using fallback', error);
                    summary = this.generateFallbackSummary(facts, shas);
                    analysis = { summary };
                }
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
            const title = options.title || `Refactor Analysis ${new Date().toLocaleTimeString()}`;

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

    private aggregateFacts(
        commits: CommitAnalysis[],
        staged?: StagedAnalysis,
        shas: string[] = []
    ): RefactorBundleFacts {
        // Simple aggregation for now - can be expanded
        const totalFiles = new Set<string>();
        let totalBlastRadius = 0;
        let addedSymbols = 0;
        let addedEdges = 0;

        const process = (c: CommitAnalysis | StagedAnalysis) => {
            // Blast radius
            totalBlastRadius += c.blastRadius;

            // Symbols
            if ('symbols' in c) {
                addedSymbols += c.symbols.added.length;
            }

            // Edges
            if ('edges' in c) {
                addedEdges += c.edges.added.length;
            }
        };

        commits.forEach(process);
        if (staged) {
            process(staged);
            // Add staged files to set
            staged.files.forEach(f => totalFiles.add(f.path));
        }

        // For commit-based analysis, query database to get file lists
        if (commits.length > 0 && !staged) {
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
