import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { GitOperations } from '../../../analysis/git';
import { getTreeSitterParser } from '../../../analysis/tree-sitter';
import { getPathService } from '../../../services/pathService';
import { Tier1DataSchema, Tier2DataSchema, Tier3DataSchema } from '../../../state/schemas';
import { BundleFactsDTO } from '../../../types/cockpit';
import { detectLanguage } from '../../../utils/config';
import { splitEdgeId } from '../../../utils/edgeNormalization';
import { logDebug, logError, logWarn } from '../../../utils/logger';

type Tier1Data = {
  content: string;
  lineCount: number;
  language: string;
  filePath: string;
  fileExists: boolean;
  symbols?: any[];
};

type Tier2Data = {
  blastRadius: { incoming: any[]; outgoing: any[] };
  hotspots: any[];
  drift: any[];
  hotspotScore?: number;
  history?: any;
  diff?: any;
  lineCommits?: Array<{ line: number; commitSha: string; author: string; date: string }>;
};

type Tier3Data = {
  summary: string;
  risks: any[];
};

/**
 * FrameAnalyzer: Implements tiered loading for frame analysis
 * Follows the pipeline pattern with best-effort error handling
 */
export class FrameAnalyzer {
  private gitOps: GitOperations;

  constructor(private view?: vscode.WebviewView) {
    this.gitOps = new GitOperations();
  }

  /**
   * Tier 1: Structure (Always succeeds)
   * - File content
   * - Line count
   * - Language detection
   * - Symbol extraction (uses quick scan symbols if available)
   */
  async analyzeTier1(
    frameId: string,
    targetPath: string,
    workspaceRoot: string,
    bundleFacts?: BundleFactsDTO
  ): Promise<Tier1Data & { symbolId?: string }> {
    const pathService = getPathService();
    const fullPath = pathService.toAbsolute(targetPath);
    const normalizedTargetPath = pathService.toRelative(targetPath);

    logDebug(
      `[FrameAnalyzer] Analyzing Tier 1: frameId=${frameId}, targetPath=${targetPath}, workspaceRoot=${workspaceRoot} -> fullPath=${fullPath}`
    );

    const language =
      detectLanguage(targetPath) ||
      (fullPath ? path.extname(fullPath).toLowerCase().replace('.', '') : '') ||
      'unknown';

    // Extract symbol ID if present in frameId (filePath::symbolId)
    const symbolId = frameId.includes('::') ? frameId.split('::')[1] : undefined;

    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lineCount = content.split('\n').length;

      // Extract symbols if language is supported
      let symbols: any[] = [];

      // Use consistent path normalization matching the main pipeline
      const normalizePathForMatch = (p: string) => {
        return getPathService().toRelative(p);
      };

      // First, try to use quick scan symbols from bundleFacts
      if (bundleFacts?.evidence?.['working.symbols']) {
        const rawSymbols = bundleFacts.evidence['working.symbols'] as any[];

        // Handle both string format "path:name:id" and object format
        const quickSymbols = rawSymbols
          .map(s => {
            if (typeof s === 'string') {
              // Matches "path/to/file:symbolName:symbolId" handling colons in path.
              // Note: Assumes symbolName and symbolId don't contain colons themselves.
              const match = s.match(/^(.*):([^:]+):([^:]+)$/);
              if (match) {
                const [, filePath, name, symbolId] = match;
                return {
                  filePath: normalizePathForMatch(filePath), // Normalize when parsing
                  name,
                  symbolId,
                  // String format lacks location/signature - can't use directly
                };
              }
              return null;
            }
            // Object format - normalize the filePath
            return {
              ...s,
              filePath: normalizePathForMatch(s.filePath || ''),
            };
          })
          .filter(Boolean);

        // Filter symbols for this file - use normalized paths
        const normalizedTarget = normalizePathForMatch(normalizedTargetPath);
        const fileSymbols = quickSymbols.filter(
          (s: any) => s?.filePath && normalizePathForMatch(s.filePath) === normalizedTarget
        );

        if (fileSymbols.length === 0 && quickSymbols.length > 0) {
          const samplePaths = quickSymbols.slice(0, 5).map((s: any) => s?.filePath);
          logWarn(
            `FrameAnalyzer: No symbols matched for "${normalizedTarget}". ` +
              `Total quickSymbols: ${quickSymbols.length}. Sample paths: ${JSON.stringify(samplePaths)}`
          );
        }

        // Separate symbols into complete (usable) and incomplete (string format)
        const usableSymbols = fileSymbols.filter((s: any) => s.location && s.signature);
        const incompleteSymbols = fileSymbols.filter((s: any) => !s.location || !s.signature);

        if (usableSymbols.length > 0) {
          symbols = usableSymbols;
          logDebug(
            `FrameAnalyzer: Using ${symbols.length} complete symbols from bundleFacts for ${frameId}`
          );
        } else if (incompleteSymbols.length > 0) {
          // Use incomplete symbols as temporary fallback
          symbols = incompleteSymbols;
          logDebug(
            `FrameAnalyzer: Using ${symbols.length} incomplete symbols from bundleFacts as fallback for ${frameId}`
          );
        }
      }

      // Always parse if we don't have complete symbols, using priority queue
      if (symbols.length === 0 && language && language !== 'unknown') {
        try {
          const parser = getTreeSitterParser();
          const hybridFacts = await parser.extractHybridFacts(
            content,
            normalizedTargetPath,
            language,
            undefined,
            true // High priority - should jump the queue
          );
          // Filter to only symbol kinds (functions, classes, etc.)
          const symbolKinds = new Set([
            'function',
            'method',
            'class',
            'const',
            'variable',
            'interface',
            'enum',
            'module',
            'type',
            'type_alias',
          ]);
          symbols = hybridFacts.filter((f: any) => symbolKinds.has(f.kind));

          // Persist to DB via shared queue
          const { DatabaseWriteQueue } = await import('../../../storage/databaseWriteQueue');
          const { computeHybridDna } = await import('../../../analysis/symbolDna');
          const writeQueue = DatabaseWriteQueue.getInstance();
          const headSha = await this.gitOps.getHeadSha();

          for (const s of symbols) {
            // Compute DNA for stable ID
            const dnaId = await computeHybridDna(s, undefined, language);
            s.id = dnaId;

            // Queue symbol_dna insert
            writeQueue.queue({
              type: 'symbol',
              data: {
                sha: headSha,
                path: normalizedTargetPath,
                symbol: s,
                changeType: 'priority_click',
                isDna: true,
              },
            });

            // Queue symbols insert
            writeQueue.queue({
              type: 'symbol',
              data: {
                sha: headSha,
                path: normalizedTargetPath,
                symbol: s,
                changeType: 'priority_click',
                isDna: false,
              },
            });
          }

          // Flush immediately for click-triggered analysis
          await writeQueue.flushAll();
        } catch (error) {
          logDebug(`FrameAnalyzer: Failed to extract symbols for ${frameId}: ${error}`);
        }
      }

      const result = {
        content,
        lineCount,
        language,
        filePath: normalizedTargetPath,
        fileExists: true,
        symbols,
        symbolId,
      };

      // Validate schema (dev/debug only - safe parse)
      const validation = Tier1DataSchema.safeParse(result);
      if (!validation.success) {
        logWarn(
          `[FrameAnalyzer] Tier 1 schema validation failed for ${frameId}: ${JSON.stringify(
            validation.error,
            null,
            2
          )}`
        );
      }

      return result;
    } catch (error) {
      logError(`FrameAnalyzer: Tier 1 analysis failed for ${frameId}`, error);
      return {
        content: '[File not found on disk]',
        lineCount: 1,
        language,
        filePath: normalizedTargetPath,
        fileExists: false,
        symbols: [],
        symbolId,
      };
    }
  }

  /**
   * Tier 2: Relationships (Best effort)
   * - Blast radius (incoming/outgoing)
   * - Hotspots
   * - Drift issues
   */
  async analyzeTier2(
    frameId: string,
    targetPath: string,
    facts: BundleFactsDTO
  ): Promise<Tier2Data> {
    const data: Tier2Data = {
      blastRadius: { incoming: [], outgoing: [] },
      hotspots: [],
      drift: [],
    };

    // If facts are missing, we can still return git history/blame/diff
    // We just won't have graph edges or cross-file metrics

    // Ensure targetPath is normalized for matching
    const pathService = getPathService();
    const normalizedTarget = pathService.toRelative(targetPath);

    try {
      if (facts) {
        const edgeStrings = (facts.evidence?.['working.edges'] as string[]) || [];
        const outgoing: any[] = [];
        const incoming: any[] = [];

        edgeStrings.forEach(es => {
          const match = es.match(/^(.+) -> (.+) \((.+)\)$/);
          if (!match) return;

          const from = match[1];
          const to = match[2];
          const type = match[3];

          const fromInfo = splitEdgeId(from);
          const toInfo = splitEdgeId(to);
          const fromPath = fromInfo.filePath;
          const toPath = toInfo.filePath;

          // Skip edges with unresolved paths (marked as 'unknown')
          if (!fromPath || !toPath || fromPath === 'unknown' || toPath === 'unknown') {
            return;
          }

          const normalizedFrom = pathService.toRelative(fromPath);
          const normalizedTo = pathService.toRelative(toPath);

          // Collect edges that involve the target file
          if (normalizedFrom === normalizedTarget) {
            outgoing.push({ from, to, type });
          }
          if (normalizedTo === normalizedTarget) {
            incoming.push({ from, to, type });
          }
        });

        data.blastRadius = { incoming, outgoing };

        if (facts.evidence?.hotspots) {
          const hotspot = (facts.evidence.hotspots as any[]).find(h => h.path === targetPath);
          if (hotspot?.score !== undefined) {
            data.hotspotScore = hotspot.score;
          }
        }
        if (facts.evidence?.['hotspots.scores']) {
          const scores = facts.evidence['hotspots.scores'] as Record<string, number>;
          if (scores[targetPath]) {
            data.hotspots.push({
              file: targetPath,
              score: scores[targetPath],
              reason: 'High complexity/churn',
            });
            data.hotspotScore = scores[targetPath];
          }
        }

        if (facts.findings?.incompleteness) {
          const missing = facts.findings.incompleteness.missing || 0;
          if (missing > 0) {
            data.drift.push({
              type: 'missing_symbols',
              count: missing,
              severity: 'medium',
            });
          }
        }

        const driftSymbols =
          (facts.findings?.patternDrift?.conventionDrift?.driftSymbols as any[]) || [];
        driftSymbols
          .filter((s: any) => s.path === targetPath)
          .forEach((s: any) => {
            data.drift.push({
              issue: 'Naming drift',
              severity: 'warning',
              symbol: s.name,
              detail: s.suggestedName ? `Suggested: ${s.suggestedName}` : '',
            });
          });
      }

      try {
        const history = await this.gitOps.getFileHistory(targetPath, 20);
        data.history = history;
      } catch (e) {
        logDebug(`FrameAnalyzer: Failed to get git history for ${frameId}: ${e}`);
      }

      try {
        // Default to HEAD if no context provided
        const diff = await this.gitOps.getFileDiff('HEAD', targetPath);
        data.diff = diff;
      } catch (e) {
        logDebug(`FrameAnalyzer: Failed to get diff for ${frameId}: ${e}`);
      }

      // Fetch line-by-line commit information (blame)

      try {
        const lineCommits = await this.gitOps.getFileBlame(targetPath);

        data.lineCommits = lineCommits;
      } catch (e) {
        logDebug(`FrameAnalyzer: Failed to get blame for ${frameId}: ${e}`);
      }

      // Validate schema
      const validation = Tier2DataSchema.safeParse(data);
      if (!validation.success) {
        logWarn(
          `[FrameAnalyzer] Tier 2 schema validation failed for ${frameId}: ${JSON.stringify(
            validation.error,
            null,
            2
          )}`
        );
      }

      return data;
    } catch (error) {
      logError(`FrameAnalyzer: Tier 2 analysis failed for ${frameId}`, error);
      return data;
    }
  }

  /**
   * Tier 3: AI Insights (Optional)
   * - Explanation
   * - Risk assessment
   */
  async analyzeTier3(
    frameId: string,
    _targetPath: string,
    _content: string,
    _facts: BundleFactsDTO
  ): Promise<Tier3Data> {
    // Placeholder for AI analysis - return immediately to avoid stalling
    // This is a synchronous operation, so we can return directly without await

    const result: Tier3Data = {
      summary: `Analysis not available for ${frameId}`,
      risks: [],
    };

    // Validate schema (synchronous operation)
    const validation = Tier3DataSchema.safeParse(result);
    if (!validation.success) {
      logWarn(
        `[FrameAnalyzer] Tier 3 schema validation failed for ${frameId}: ${JSON.stringify(
          validation.error,
          null,
          2
        )}`
      );
    }

    // Return immediately - no async operations
    return Promise.resolve(result);
  }
}
