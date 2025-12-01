import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { getTreeSitterParser } from '../../../analysis/tree-sitter';
import { BundleFactsDTO } from '../../../types/cockpit';
import { logDebug, logError, logInfo } from '../../../utils/logger';
import { detectLanguage } from '../../../utils/supportedLanguages';

/**
 * FrameAnalyzer: Implements tiered loading for frame analysis
 * Follows the pipeline pattern with best-effort error handling
 */
export class FrameAnalyzer {
  constructor(private view?: vscode.WebviewView) {}

  /**
   * Tier 1: Structure (Always succeeds)
   * - File content
   * - Line count
   * - Language detection
   */
  async analyzeTier1(frameId: string, targetPath: string, gitRoot: string): Promise<any> {
    logDebug(`[Tier 1] Analyzing ${frameId}`);

    let content = '';
    let fileExists = true;

    try {
      content = fs.readFileSync(path.join(gitRoot, targetPath), 'utf8');
    } catch {
      content = '[File not found on disk]';
      fileExists = false;
    }

    const data = {
      content,
      lineCount: content ? content.split('\n').length : 0,
      language: path.extname(targetPath).replace('.', '') || 'unknown',
      filePath: targetPath,
      fileExists,
    };

    logDebug(`[Tier 1] Complete for ${frameId}`);
    return data;
  }

  /**
   * Tier 2: Hybrid Metadata (Best effort)
   * - Git history
   * - Diff stats
   * - Hotspot info from facts
   */
  async analyzeTier2(
    frameId: string,
    targetPath: string,
    facts: BundleFactsDTO | null
  ): Promise<any> {
    logDebug(`[Tier 2] Analyzing ${frameId}`);

    const data: any = {};

    // Extract from bundle facts if available
    if (facts) {
      const fileFacts = (facts.evidence?.['scope.files'] as string[] | undefined) || [];
      data.inScope = fileFacts.includes(targetPath);

      const hotspots = (facts.evidence?.hotspots ||
        (facts.findings as any)?.hotspots ||
        []) as any[];
      const hotspot = hotspots.find((h: any) => h.path === targetPath);
      if (hotspot) {
        data.hotspotScore = hotspot.drift_count || hotspot.score || hotspot.count || 0;
      }

      const driftSymbols =
        ((facts.findings as any)?.patternDrift?.conventionDrift?.driftSymbols as any[]) || [];
      data.driftForFile = driftSymbols.filter((d: any) => d.path === targetPath);

      // Extract edges for blast radius
      const edgeStrings = (facts.evidence?.['working.edges'] as string[]) || [];
      const outgoing: any[] = [];
      const incoming: any[] = [];
      edgeStrings.forEach(es => {
        const match = es.match(/^(.*) -> (.*) \((.*)\)$/);
        if (!match) return;
        const from = match[1];
        const to = match[2];
        const type = match[3];
        const fromPath = from.split(':')[0];
        const toPath = to.split(':')[0];
        if (fromPath === targetPath) {
          outgoing.push({ from, to, type });
        }
        if (toPath === targetPath) {
          incoming.push({ from, to, type });
        }
      });
      data.blastRadius = { incoming, outgoing };
    }

    // Get git history
    try {
      const { GitOperations } = await import('../../../analysis/git');
      const gitOps = new GitOperations();
      const gitHistory = await gitOps.getFileHistoryWithStats(targetPath, 10);
      const virtualStaged = await gitOps
        .getDiffStats('staged')
        .catch(() => ({ added: 0, removed: 0 }));
      const virtualUnstaged = await gitOps
        .getDiffStats('unstaged')
        .catch(() => ({ added: 0, removed: 0 }));

      const timeline = [
        ...(virtualUnstaged.added || virtualUnstaged.removed
          ? [
              {
                message: 'Unstaged changes',
                author: 'workspace',
                date: new Date().toISOString(),
                virtual: true,
                stats: virtualUnstaged,
              },
            ]
          : []),
        ...(virtualStaged.added || virtualStaged.removed
          ? [
              {
                message: 'Staged changes',
                author: 'workspace',
                date: new Date().toISOString(),
                virtual: true,
                stats: virtualStaged,
              },
            ]
          : []),
        ...gitHistory,
      ];

      const latestStats = gitHistory.find((h: any) => h.stats)
        ? gitHistory[0].stats
        : { additions: 0, deletions: 0 };
      const changeStats = {
        added:
          (virtualStaged.added || 0) + (virtualUnstaged.added || 0) + (latestStats?.additions || 0),
        removed:
          (virtualStaged.removed || 0) +
          (virtualUnstaged.removed || 0) +
          (latestStats?.deletions || 0),
      };

      data.timeline = timeline;
      data.history = timeline;
      data.changeStats = changeStats;
    } catch (error) {
      logError(`[Tier 2] Git history failed for ${targetPath}`, error);
      // Continue without git history
    }

    logDebug(`[Tier 2] Complete for ${frameId}`);
    return data;
  }

  /**
   * Tier 3: Semantics (Optional, can fail)
   * - Symbol parsing
   * - Structural analysis
   */
  async analyzeTier3(
    frameId: string,
    targetPath: string,
    content: string,
    facts: BundleFactsDTO | null
  ): Promise<any> {
    logDebug(`[Tier 3] Analyzing ${frameId}`);

    let symbols: any[] = [];

    // First try from facts
    if (facts) {
      const evidenceSymbols = (facts.evidence?.['working.symbols'] as string[]) || [];
      const symbolList = evidenceSymbols.map(id => {
        const [pathPart, ...rest] = id.split(':');
        const name = rest.join(':') || id;
        return { id, path: pathPart, name, kind: 'symbol', signature: name };
      });

      const driftSymbols =
        ((facts.findings as any)?.patternDrift?.conventionDrift?.driftSymbols as any[]) || [];
      const driftSet = new Set<string>(driftSymbols.map((d: any) => d.symbolId || d.symbol_id));
      const driftBySymbol = new Map<string, any>();
      driftSymbols.forEach((d: any) => driftBySymbol.set(d.symbolId || d.symbol_id, d));

      symbols = symbolList
        .filter((s: any) => s.path === targetPath)
        .map((s: any) => {
          const driftDetail = driftBySymbol.get(s.id || `${s.path}:${s.name}`);
          return {
            id: s.id || `${s.path}:${s.name}`,
            name: s.name,
            kind: s.kind,
            signature: s.signature || s.name,
            changeType: s.changeType || s.change_type,
            drift: driftSet.has(s.id || `${s.path}:${s.name}`),
            driftDetail: driftDetail ? driftDetail.suggestedName || driftDetail.reason : undefined,
          };
        });
    }

    // Live parsing fallback if no symbols found
    if (symbols.length === 0 && content && !content.startsWith('[File not found')) {
      try {
        logInfo(`[Tier 3] No symbols in facts for ${targetPath}, attempting live scan...`);
        const parser = getTreeSitterParser();
        const langId = detectLanguage(targetPath);

        if (langId) {
          logInfo(`[Tier 3] Live scanning ${targetPath} (${langId})...`);
          const liveFacts = await parser.extractHybridFacts(content, targetPath, langId);

          if (liveFacts && liveFacts.length > 0) {
            symbols = liveFacts.map(f => ({
              id: f.id,
              name: f.name,
              kind: f.kind,
              signature: f.signature || f.name,
              changeType: undefined,
              drift: false,
              driftDetail: undefined,
            }));
            logInfo(`[Tier 3] Live scan found ${symbols.length} symbols`);
          } else {
            logInfo(`[Tier 3] Live scan completed but found no symbols in ${targetPath}`);
          }
        } else {
          logInfo(`[Tier 3] No language detected for ${targetPath}, skipping live scan`);
        }
      } catch (error) {
        logError(`[Tier 3] Live scanning failed for ${targetPath}`, error);
        // Don't throw - tier 3 is optional
      }
    } else if (symbols.length === 0) {
      logInfo(`[Tier 3] No symbols found for ${targetPath} (content available: ${!!content})`);
    }

    const data = { symbols };
    logDebug(`[Tier 3] Complete for ${frameId} (${symbols.length} symbols)`);
    return data;
  }
}
