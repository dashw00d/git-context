import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { getTreeSitterParser } from '../../../analysis/tree-sitter';
import { BundleFactsDTO } from '../../../types/cockpit';
import { detectLanguage } from '../../../utils/config';
import { logDebug, logError } from '../../../utils/logger';

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
  constructor(private view?: vscode.WebviewView) {
    //empty
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
  ): Promise<Tier1Data> {
    const fullPath = path.join(workspaceRoot, targetPath);
    const language =
      detectLanguage(targetPath) ||
      path.extname(fullPath).toLowerCase().replace('.', '') ||
      'unknown';

    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lineCount = content.split('\n').length;

      // Extract symbols if language is supported
      let symbols: any[] = [];

      // First, try to use quick scan symbols from bundleFacts
      if (bundleFacts?.evidence?.['working.symbols']) {
        const quickSymbols = bundleFacts.evidence['working.symbols'] as any[];
        // Filter symbols for this file
        const fileSymbols = quickSymbols.filter((s: any) => s.filePath === targetPath);

        if (fileSymbols.length > 0) {
          // Quick scan symbols already have location/signature, use them directly
          symbols = fileSymbols;
          logDebug(`FrameAnalyzer: Using ${symbols.length} quick scan symbols for ${frameId}`);
        }
      }

      // If no quick scan symbols, extract fresh
      if (symbols.length === 0 && language && language !== 'unknown') {
        try {
          const parser = getTreeSitterParser();
          const hybridFacts = await parser.extractHybridFacts(content, targetPath, language);
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
        } catch (error) {
          logDebug(`FrameAnalyzer: Failed to extract symbols for ${frameId}: ${error}`);
        }
      }

      return {
        content,
        lineCount,
        language,
        filePath: targetPath,
        fileExists: true,
        symbols,
      };
    } catch (error) {
      logError(`FrameAnalyzer: Tier 1 analysis failed for ${frameId}`, error);
      return {
        content: '[File not found on disk]',
        lineCount: 1,
        language,
        filePath: targetPath,
        fileExists: false,
        symbols: [],
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

    if (!facts) {
      return data;
    }

    try {
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

      try {
        const { GitOperations } = require('../../../analysis/git');
        const gitOps = new GitOperations();
        const history = await gitOps.getFileHistory(targetPath, 5);
        data.history = history;
      } catch (e) {
        logDebug(`FrameAnalyzer: Failed to get git history for ${frameId}: ${e}`);
      }

      try {
        const { GitOperations } = require('../../../analysis/git');
        const gitOps = new GitOperations();
        const diff = await gitOps.getFileDiff(targetPath);
        data.diff = diff;
      } catch (e) {
        logDebug(`FrameAnalyzer: Failed to get diff for ${frameId}: ${e}`);
      }

      // Fetch line-by-line commit information (blame)
      try {
        const { GitOperations } = require('../../../analysis/git');
        const gitOps = new GitOperations();
        const lineCommits = await gitOps.getFileBlame(targetPath);
        data.lineCommits = lineCommits;
      } catch (e) {
        logDebug(`FrameAnalyzer: Failed to get blame for ${frameId}: ${e}`);
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
    // Placeholder for AI analysis

    return {
      summary: `Analysis not available for ${frameId}`,
      risks: [],
    };
  }
}
