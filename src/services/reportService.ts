import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { MermaidGenerator } from '../analysis/mermaidGenerator';
import { RefactorBundleFacts } from '../facts/types';
import { getRefactorPipeline } from '../services/pipelineFactory';
import { pipelineActions } from '../state/actionCreators';
import { getStore } from '../state/store';
import { getReportManager } from '../storage/reportManager';
import { prepare } from '../storage/statement-wrapper';
import { CommitAnalysis, EdgeInfo, SymbolInfo } from '../types';
import { makeBundleFingerprint, PIPELINE_VERSION, PROMPT_VERSION } from '../utils/fingerprint';
import { logDebug, logError, logInfo } from '../utils/logger';
import { isWorkspaceSha } from '../utils/workspace';

export class ReportService {
  private static instance: ReportService;
  private readonly mermaid = new MermaidGenerator();
  private readonly store = getStore();

  private constructor() {
    //empty
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
      llmCallTracker?: (
        purpose: string,
        model?: string,
        tokens?: number,
        duration?: number
      ) => void;
    } = {
      //empty
    }
  ): Promise<string | null> {
    console.error('🚀 [ReportService] generateReport called:', {
      shas,
      scope,
      force: options.force,
    });
    const pipeline = await getRefactorPipeline();
    const reportManager = getReportManager();
    let _serializedHistory: any = undefined;

    const fingerprint = makeBundleFingerprint(shas, scope as any, PIPELINE_VERSION, PROMPT_VERSION);

    const tempAnalyzed: Set<string> = new Set();

    if (!options.force && !options.existingReportId) {
      const cachedReport = reportManager.loadByFingerprint(fingerprint);
      console.error('🔍 [ReportService] Cache lookup:', { fingerprint, found: !!cachedReport });
      if (cachedReport) {
        const facts = cachedReport.facts;
        const isEmpty = !facts || (facts.scope.files === 0 && facts.working.symbols === 0);
        if (isEmpty) {
          logInfo(`[ReportService] Empty cache hit for ${fingerprint}; forcing reanalysis...`);
          this.store.dispatch({
            type: 'ANALYSIS_STEP_UPDATED',
            payload: { step: 'Reindexing empty commits...' },
          });
          const commitShas = shas.filter(s => !isWorkspaceSha(s));
          await pipeline.indexCommits(commitShas);
          commitShas.forEach(s => tempAnalyzed.add(s));
        } else {
          logInfo(`[ReportService] Cache hit for ${fingerprint}`);

          const summary = {
            id: cachedReport.id,
            commitCount: cachedReport.commitShas.length,
            fileCount: facts.scope.files,
            symbolCount: facts.working.symbols,
            createdAt: cachedReport.createdAt.toISOString(),
            debtScore: 0,
          };

          getStore().dispatch({
            type: 'ANALYSIS_COMPLETED',
            payload: {
              facts,
              summary,
              reportId: cachedReport.id,
              history: undefined,
            },
          });
          return cachedReport.id;
        }
      }
    }

    getStore().dispatch({
      type: 'ANALYSIS_STARTED',
      payload: { step: 'Analyzing commits...' },
    });

    try {
      const includeWorkspace = scope === 'staged' || scope === 'unstaged' || scope === 'full';
      const commitShas = shas.filter(sha => !isWorkspaceSha(sha));
      const workspaceShas = shas.filter(isWorkspaceSha);

      let workspaceParts: Set<'staged' | 'unstaged'> | undefined;
      if (scope === 'staged') {
        workspaceParts = new Set(['staged']);
      } else if (scope === 'unstaged') {
        workspaceParts = new Set(['unstaged']);
      } else if (scope === 'full') {
        workspaceParts = new Set(['staged', 'unstaged']);
      }

      console.error('🔧 [ReportService] About to call pipeline.analyzeBundle:', {
        commitShas: commitShas.length,
        includeWorkspace,
        workspaceParts: workspaceParts ? Array.from(workspaceParts) : null,
      });

      const result = await pipeline.analyzeBundle(
        commitShas,
        includeWorkspace,
        workspaceParts,
        event => {
          console.error(
            `📡 [Pipeline Event] ${event.type}`,
            'step' in event ? event.step?.id : 'no-step'
          );
          const timings: Record<string, number> = {};
          if (event.state?.stepTimings) {
            Object.entries(event.state.stepTimings).forEach(([stepId, timing]) => {
              if ((timing as any).duration !== undefined) {
                timings[stepId] = (timing as any).duration as number;
              }
            });
          }
          const pipelineError =
            event.type === 'error' && event.step?.id && event.error
              ? [{ stepId: event.step.id, error: String(event.error) }]
              : undefined;
          const healthPayload = {
            currentStepId: event.type === 'finished' ? null : event.step?.id,
            stepTimings: Object.keys(timings).length ? timings : undefined,
            pipelineErrors: pipelineError,
          };
          switch (event.type) {
            case 'start':
              getStore().dispatch({
                type: 'ANALYSIS_STEP_UPDATED',
                payload: { step: event.step.label },
              });
              getStore().dispatch(pipelineActions.health(healthPayload));
              break;

            case 'complete':
              getStore().dispatch({
                type: 'ANALYSIS_STEP_UPDATED',
                payload: { step: event.step.label, progress: 100 },
              });
              getStore().dispatch(pipelineActions.health(healthPayload));
              break;

            case 'error':
              getStore().dispatch({
                type: 'ANALYSIS_FAILED',
                payload: { error: String(event.error) },
              });
              getStore().dispatch(pipelineActions.health(healthPayload));
              break;

            case 'finished':
              getStore().dispatch(pipelineActions.health(healthPayload));
              if (event.state.errors.length === 0) {
                const history = event.state.history;
                _serializedHistory = history
                  ? {
                      ...history,
                      symbolEvolution: history.symbolEvolution
                        ? Object.fromEntries(history.symbolEvolution)
                        : {},
                    }
                  : undefined;
              }
              break;
            case 'progress':
              if (event.data && event.data.file) {
                getStore().dispatch({
                  type: 'EXPLORER_NODE_UPDATED',
                  payload: {
                    id: event.data.file,
                    status: event.data.status,
                  },
                });
              }
              break;
          }
        }
      );

      console.error('🟢 Pipeline finished, checking results...');
      const optionalSteps = ['drift', 'legacy', 'hotspots', 'moved_blocks'];
      const criticalErrors = result.errors.filter(err => !optionalSteps.includes(err.stepId));

      if (criticalErrors.length > 0) {
        console.error('🔴 Critical errors found:', criticalErrors);
        logError(`Pipeline failed: ${criticalErrors[0].error}`);
        return null;
      }

      if (result.errors.length > 0) {
        console.error(
          '🟡 Optional step failures:',
          result.errors.map(e => e.stepId)
        );
        logInfo(
          `Pipeline completed with ${result.errors.length} optional step failures: ${result.errors.map(e => e.stepId).join(', ')}`
        );
      }

      if (options.cancellationToken?.isCancellationRequested) {
        console.error('🔴 Analysis cancelled');
        getStore().dispatch({ type: 'ANALYSIS_CANCELLED' });
        return null;
      }

      if (!result.bundleFacts) {
        const failedSteps = result.errors.map(err => err.stepId).join(', ');
        const errorMessage = failedSteps
          ? `Bundle facts unavailable; pipeline steps failed: ${failedSteps}`
          : 'Bundle facts unavailable from pipeline result';
        console.error('🔴 No bundleFacts:', errorMessage);
        logError(`[ReportService] ${errorMessage}`);
        getStore().dispatch({
          type: 'ANALYSIS_FAILED',
          payload: { error: errorMessage },
        });
        return null;
      }

      console.error('🟢 Got bundleFacts, processing report...');
      const facts = result.bundleFacts;
      const llmOutputs = result.llmOutputs;
      const llmAnalysis = llmOutputs?.llmAnalysis;

      let summary: string;
      let analysis: any = undefined;

      if (llmAnalysis) {
        summary = llmAnalysis.summary;
        analysis = {
          summary: llmAnalysis.summary,
          blocks: llmAnalysis.blocks,
          markdown: llmAnalysis.markdown,
          metadata: llmAnalysis.metadata,
        };

        if (llmAnalysis.metadata) {
          logInfo(
            `[ReportService] LLM analysis complete: ` +
              `health score ${llmAnalysis.metadata.healthScore}/100, ` +
              `${llmAnalysis.metadata.totalTokens} tokens`
          );
        }
      } else {
        logDebug('[ReportService] LLM not available, using fallback summary');
        summary = this.generateFallbackSummary(facts, shas);
        analysis = { summary };
      }

      const factsMarkdown = this.buildFactsMarkdown(facts);

      const llmMarkdown = analysis?.markdown || '';
      const baseMarkdown = [
        factsMarkdown,
        llmMarkdown ? `\n\n---\n\n## 🤖 LLM Addendum\n\n${llmMarkdown}` : '',
      ]
        .filter(Boolean)
        .join('');
      const visualsMarkdown = this.buildVisualSection(facts);
      const detailedMarkdown = await this.appendDetailedSections(baseMarkdown + visualsMarkdown, [
        ...commitShas,
        ...workspaceShas,
      ]);

      if (analysis) {
        analysis.markdown = detailedMarkdown;
      } else {
        analysis = { summary, markdown: detailedMarkdown };
      }

      let workspaceHash = '';
      if (scope === 'staged' || scope === 'unstaged') {
        try {
          workspaceHash = await reportManager.computeWorkspaceHash();
          logDebug(`[ReportService] Computed workspace hash: ${workspaceHash.substring(0, 8)}...`);
        } catch (error) {
          logError('[ReportService] Failed to compute workspace hash', error);

          workspaceHash = '';
        }
      } else {
        const selectedFiles = (facts.evidence['scope.files'] as string[]) || [];
        const input = JSON.stringify({
          shas: [...shas].sort(),
          selectedFiles: [...selectedFiles].sort(),
          scope,
        });
        workspaceHash = crypto.createHash('sha256').update(input).digest('hex');
        logDebug(`[ReportService] Computed config hash: ${workspaceHash.substring(0, 8)}...`);
      }

      const reportId = options.existingReportId || crypto.randomUUID();
      const title = options.title || this.generateTitle([...commitShas, ...workspaceShas]);

      const report: any = {
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
        criticalCount:
          facts.findings.incompleteness.missing + facts.findings.incompleteness.zombies,
        warningCount: facts.findings.legacyAudit.dead,
        isPinned: false,
        fingerprint,
        pipelineVersion: PIPELINE_VERSION,
        promptVersion: PROMPT_VERSION,
        mode: scope,
      };

      reportManager.save({
        ...report,
        treemap: (facts as any).treemap,
        hotspots: (facts as any).evidence?.hotspots || (facts as any).findings?.hotspots,
      });

      console.error('🟢 Dispatching ANALYSIS_COMPLETED with facts:', {
        files: facts.scope.files,
        symbols: facts.working.symbols,
        hotspots: (facts as any).evidence?.hotspots?.length || 0,
      });
      getStore().dispatch({
        type: 'ANALYSIS_COMPLETED',
        payload: {
          facts,
          summary: {
            id: reportId,
            commitCount: shas.length,
            fileCount: facts.scope.files,
            symbolCount: facts.working.symbols,
            createdAt: new Date().toISOString(),
            debtScore: 0,
          },
          reportId,
        },
      });

      return reportId;
    } catch (error) {
      logError('[ReportService] Failed to generate report', error);
      getStore().dispatch({
        type: 'ANALYSIS_FAILED',
        payload: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
      return null;
    }
  }

  private isEmptyAnalysis(analysis: CommitAnalysis): boolean {
    const symbolCount =
      (analysis.symbols?.added?.length || 0) +
      (analysis.symbols?.modified?.length || 0) +
      (analysis.symbols?.removed?.length || 0);
    const edgeCount = (analysis.edges?.added?.length || 0) + (analysis.edges?.removed?.length || 0);
    return symbolCount === 0 && edgeCount === 0;
  }

  private aggregateFacts(commits: CommitAnalysis[], shas: string[] = []): RefactorBundleFacts {
    const totalFiles = new Set<string>();
    let totalBlastRadius = 0;
    let addedSymbols = 0;
    let addedEdges = 0;

    const process = (c: CommitAnalysis) => {
      totalBlastRadius += c.blastRadius;

      addedSymbols += c.symbols.added.length;

      addedEdges += c.edges.added.length;
    };

    commits.forEach(process);

    if (commits.length > 0 && shas.length > 0) {
      try {
        const placeholders = shas.map(() => '?').join(',');
        const filesStmt = prepare(`
                      SELECT DISTINCT path FROM files
                      WHERE sha IN (${placeholders})
                  `);
        const fileRows = filesStmt.all(...shas) as Array<{ path: string }>;
        fileRows.forEach(row => totalFiles.add(row.path));
      } catch (error) {
        logError('[ReportService] Failed to fetch files from database', error);
      }
    }

    return {
      version: '2.0',
      generated_at: new Date().toISOString(),
      confidence: 0.2,
      bundle: {
        oldestSha: shas[shas.length - 1] || '',
        newestSha: shas[0] || '',
        shas,
      },
      scope: {
        files: totalFiles.size,
        blastRadius: totalBlastRadius,
      },
      intended: {
        present: addedSymbols,
        absent: 0,
        renamed: 0,
      },
      working: {
        symbols: addedSymbols,
        edges: addedEdges,
      },
      findings: {
        incompleteness: {
          missing: 0,
          zombies: 0,
          divergent: 0,
        },
        patternDrift: {
          mixedTargets: 0,
          oldNamespaces: 0,
        },
        legacyAudit: {
          dead: 0,
          legacyUsed: 0,
          replacedLeftovers: [],
        },
      },
      evidence: {
        'scope.files': Array.from(totalFiles),
      },
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
    const totalIssues =
      facts.findings.incompleteness.missing +
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
  ): Promise<
    Array<{
      id: string;
      title: string;
      summary: string;
      createdAt: string;
      pinned?: boolean;
      branch?: string;
    }>
  > {
    const reportManager = getReportManager();
    let reports = reportManager.list();

    if (filterText && filterText.trim()) {
      const searchTerm = filterText.trim().toLowerCase();
      reports = reports.filter(
        (report: any) =>
          (report.title || '').toLowerCase().includes(searchTerm) ||
          (report.summary || '').toLowerCase().includes(searchTerm)
      );
    }

    if (filterBranch && filterBranch !== 'all') {
      reports = reports.filter((report: any) => (report as any).branch === filterBranch);
    }

    if (showPinnedOnly) {
      reports = reports.filter((report: any) => !!report.isPinned);
    }

    return reports.map((report: any) => ({
      id: report.id,
      title: report.title,
      summary: report.summary || '',
      createdAt: (report.createdAt instanceof Date
        ? report.createdAt
        : new Date(report.createdAt)
      ).toISOString(),
      pinned: !!report.isPinned,
      branch: (report as any).branch,
    }));
  }

  /**
   * Build a small Mermaid visualization block from working edges if available
   */
  private buildVisualSection(facts: RefactorBundleFacts): string {
    const edgeStrings = (facts.evidence?.['working.edges'] as string[]) || [];
    if (!edgeStrings.length) {
      return '';
    }

    const edges: EdgeInfo[] = [];
    const highlight: string[] = [];

    const missing = (facts.evidence?.['findings.incompleteness.missing'] as any[]) || [];
    const zombies = (facts.evidence?.['findings.incompleteness.zombies'] as any[]) || [];
    highlight.push(
      ...missing.map(m => m.symbol_id).filter(Boolean),
      ...zombies.map(z => z.symbol_id).filter(Boolean)
    );

    for (const raw of edgeStrings) {
      const match = raw.match(/^(.*?) -> (.*?) \((.*?)\)$/);
      if (!match) {
        continue;
      }
      const [, from, to, type] = match;
      edges.push({
        from,
        to,
        type: (type as EdgeInfo['type']) || 'imports',
        confidence: 1,
        isResolved: true,
      });
    }

    if (!edges.length) {
      return '';
    }

    const symbols: SymbolInfo[] = [];
    const symbolIds = new Set<string>();
    for (const edge of edges) {
      if (!symbolIds.has(edge.from)) {
        symbolIds.add(edge.from);
        symbols.push(this.makePlaceholderSymbol(edge.from));
      }
      if (!symbolIds.has(edge.to)) {
        symbolIds.add(edge.to);
        symbols.push(this.makePlaceholderSymbol(edge.to));
      }
    }

    const mermaid = this.mermaid.generateGraph(edges, symbols, {
      maxNodes: 40,
      showConfidence: false,
      highlightChanged: highlight,
    });

    return `\n\n## 🔗 Dependency Graph (working snapshot)\n\n` + '```mermaid\n' + mermaid + '```\n';
  }

  /**
   * Build a facts-driven markdown report (no LLM required)
   */
  private buildFactsMarkdown(facts: RefactorBundleFacts): string {
    const lines: string[] = [];
    const findings = facts.findings;

    lines.push(`# 📑 Analysis Report (Facts)`);
    lines.push(`Generated: ${facts.generated_at}`);
    lines.push(
      `Bundle: ${facts.bundle.shas.length} commits (${facts.bundle.oldestSha.substring(0, 8)}...)\n`
    );

    lines.push(`## Scope & Totals`);
    lines.push(`- Commits: ${facts.bundle.shas.length}`);
    lines.push(`- Files in scope: ${facts.scope.files}`);
    lines.push(`- Symbols: ${facts.working.symbols}`);
    lines.push(`- Edges: ${facts.working.edges}\n`);

    lines.push(`## Incompleteness`);
    lines.push(`- Missing: ${findings.incompleteness.missing}`);
    lines.push(`- Zombies: ${findings.incompleteness.zombies}`);
    lines.push(`- Divergent: ${findings.incompleteness.divergent}\n`);
    const missing = (facts.evidence?.['findings.incompleteness.missing'] as any[]) || [];
    const zombies = (facts.evidence?.['findings.incompleteness.zombies'] as any[]) || [];
    if (missing.length) {
      lines.push(`**Top Missing (${Math.min(10, missing.length)})**`);
      missing.slice(0, 10).forEach((m: any) => {
        lines.push(`- \`${m.symbol_id}\` (expected: ${m.expected?.expect || 'present'})`);
      });
      lines.push('');
    }
    if (zombies.length) {
      lines.push(`**Top Zombies (${Math.min(10, zombies.length)})**`);
      zombies.slice(0, 10).forEach((z: any) => {
        lines.push(`- \`${z.symbol_id}\` — ${z.found?.name || ''} (${z.found?.kind || ''})`);
      });
      lines.push('');
    }

    lines.push(`## Pattern Drift`);
    lines.push(`- Mixed targets: ${findings.patternDrift.mixedTargets}`);
    lines.push(`- Old namespaces: ${findings.patternDrift.oldNamespaces}`);
    if (findings.patternDrift.conventionDrift) {
      const cd = findings.patternDrift.conventionDrift;
      lines.push(
        `- Naming drift: ${cd.driftPercent.toFixed(1)}% (dominant: ${cd.dominantConvention})`
      );
      if (cd.importDrift) {
        lines.push(
          `- Import drift: ${cd.importDrift.driftPercent.toFixed(
            1
          )}% (dominant: ${cd.importDrift.dominantStyle})`
        );
      }
      if (cd.fileNamingDrift) {
        lines.push(
          `- File naming drift: ${cd.fileNamingDrift.driftPercent.toFixed(
            1
          )}% (dominant: ${cd.fileNamingDrift.dominantStyle})`
        );
      }
    }
    if (findings.patternDrift.mixedConventionFiles) {
      lines.push(`- Mixed convention files: ${findings.patternDrift.mixedConventionFiles}`);
    }
    lines.push('');
    const driftSymbols =
      (facts.evidence?.['findings.patternDrift.conventionDrift']?.driftSymbols as any[]) || [];
    if (driftSymbols.length) {
      lines.push(`**Convention Drift Symbols (${Math.min(15, driftSymbols.length)})**`);
      driftSymbols.slice(0, 15).forEach((d: any) => {
        lines.push(`- \`${d.name}\` → \`${d.suggestedName}\` (${d.convention}) — ${d.path}`);
      });
      lines.push('');
    }

    lines.push(`## Legacy Audit`);
    lines.push(`- Dead: ${findings.legacyAudit.dead}`);
    lines.push(`- Legacy used: ${findings.legacyAudit.legacyUsed}`);
    lines.push(`- Replaced leftovers: ${findings.legacyAudit.replacedLeftovers.length}\n`);
    const dead = (facts.evidence?.['findings.legacyAudit.dead'] as any[]) || [];
    if (dead.length) {
      lines.push(`**Dead Symbols (${Math.min(15, dead.length)})**`);
      dead.slice(0, 15).forEach((d: any) => {
        lines.push(`- \`${d.symbol_id}\` (${d.kind || ''})`);
      });
      lines.push('');
    }
    const replaced = findings.legacyAudit.replacedLeftovers || [];
    if (replaced.length) {
      lines.push(`**Replaced Leftovers (${Math.min(10, replaced.length)})**`);
      replaced.slice(0, 10).forEach((r: any) => {
        lines.push(
          `- \`${r.old.symbol_id}\` → \`${r.new.symbol_id}\` (conf ${Math.round(
            r.confidence * 100
          )}%)`
        );
      });
      lines.push('');
    }

    const unresolved =
      findings.unresolvedCallers || (facts.findings as any).unresolved_callers?.length || 0;
    lines.push(`## Unresolved Callers`);
    lines.push(`- Total: ${unresolved}\n`);

    if (facts.evidence?.hotspots?.length) {
      lines.push(`## Hotspots`);
      (facts.evidence.hotspots as any[]).slice(0, 10).forEach((h: any) => {
        lines.push(`- \`${h.path}\` — ${h.drift_count || h.score || ''}`);
      });
      lines.push('');
    }

    lines.push(`## Timeline`);
    facts.bundle.shas.forEach((sha, idx) => {
      lines.push(`${idx + 1}. \`${sha.substring(0, 8)}\``);
    });

    return lines.join('\n');
  }

  private makePlaceholderSymbol(id: string): SymbolInfo {
    return {
      id,
      dnaId: id,
      name: id,
      kind: 'function',
      signature: id,
      location: {
        start: { line: 0, column: 0 },
        end: { line: 0, column: 0 },
      },
    };
  }

  private async appendDetailedSections(markdown: string, shas: string[]): Promise<string> {
    try {
      let detailedMarkdown = markdown + '\n\n---\n\n# 📊 Detailed Analysis\n\n';

      const commitShas = shas.filter(sha => !isWorkspaceSha(sha));

      for (const sha of commitShas) {
        const commitInfo = prepare(
          'SELECT message, author, date FROM commits_metadata WHERE sha = ?'
        ).get(sha) as any;
        if (!commitInfo) continue;

        const shortSha = sha.substring(0, 8);
        const title = commitInfo.message.split('\n')[0];
        detailedMarkdown += `## Commit: ${shortSha}\n**${title}**\n\n`;

        const symbolsStmt = prepare(`
                    SELECT name, kind, path, symbol_id, change_type
                    FROM symbols
                    WHERE sha = ?
                    ORDER BY change_type, kind, name
                `);
        const symbols = symbolsStmt.all(sha) as any[];

        if (symbols.length > 0) {
          detailedMarkdown += `### Symbol Changes\n\n`;
          const grouped = this.groupByChangeType(symbols);

          if (grouped.added?.length) {
            detailedMarkdown += `#### ➕ Added (${grouped.added.length})\n`;
            detailedMarkdown += this.formatSymbolList(grouped.added, sha, 'added');
          }
          if (grouped.modified?.length) {
            detailedMarkdown += `#### ✏️ Modified (${grouped.modified.length})\n`;
            detailedMarkdown += this.formatSymbolList(grouped.modified, sha, 'modified');
          }
          if (grouped.removed?.length) {
            detailedMarkdown += `#### ➖ Removed (${grouped.removed.length})\n`;
            detailedMarkdown += this.formatSymbolList(grouped.removed, sha, 'removed');
          }
          detailedMarkdown += '\n';
        }

        const edgesStmt = prepare('SELECT COUNT(*) as count FROM edges WHERE sha = ?').get(
          sha
        ) as any;
        if (edgesStmt && edgesStmt.count > 0) {
          detailedMarkdown += `### 🔗 Call Graph (${edgesStmt.count} connections)\n\n`;

          const topCallers = prepare(`
                        SELECT from_symbol_id, COUNT(*) as call_count
                        FROM edges
                        WHERE sha = ? AND change_type = 'added'
                        GROUP BY from_symbol_id
                        ORDER BY call_count DESC
                        LIMIT 5
                    `).all(sha) as any[];

          if (topCallers.length > 0) {
            detailedMarkdown += `**Top New Callers:**\n`;
            for (const caller of topCallers) {
              const name = this.extractSymbolName(caller.from_symbol_id);
              detailedMarkdown += `- \`${name}\`: ${caller.call_count} calls\n`;
            }
            detailedMarkdown += '\n';
          }
        }

        detailedMarkdown += '---\n\n';
      }

      return detailedMarkdown;
    } catch (error) {
      logError('[ReportService] Failed to append detailed sections', error);
      return markdown;
    }
  }

  private groupByChangeType(symbols: any[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {
      added: [],
      modified: [],
      removed: [],
      signature_changed: [],
    };
    for (const s of symbols) {
      if (grouped[s.change_type]) {
        grouped[s.change_type].push(s);
      } else {
        if (!grouped[s.change_type]) grouped[s.change_type] = [];
        grouped[s.change_type].push(s);
      }
    }
    return grouped;
  }

  private formatSymbolList(symbols: any[], _sha: string, _type: string): string {
    let md = '';

    const byKind: Record<string, any[]> = {};
    for (const s of symbols) {
      if (!byKind[s.kind]) byKind[s.kind] = [];
      byKind[s.kind].push(s);
    }

    for (const [kind, items] of Object.entries(byKind)) {
      md += `* **${kind}**:\n`;
      for (const item of items) {
        md += `  - \`${item.name}\` (${item.path})\n`;
      }
    }
    return md;
  }

  private extractSymbolName(symbolId: string): string {
    const parts = symbolId.split(':');
    return parts.length > 1 ? parts[parts.length - 1] : symbolId;
  }
}

export async function getReportService(): Promise<ReportService> {
  return ReportService.getInstance();
}
