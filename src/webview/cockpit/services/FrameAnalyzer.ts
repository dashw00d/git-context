import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { BundleFactsDTO } from '../../../types/cockpit';
import { logDebug, logError } from '../../../utils/logger';

type Tier1Data = {
  content: string;
  lineCount: number;
  language: string;
  filePath: string;
  fileExists: boolean;
};

type Tier2Data = {
  blastRadius: { incoming: any[]; outgoing: any[] };
  hotspots: any[];
  drift: any[];
  hotspotScore?: number;
  history?: any;
  diff?: any;
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
  constructor(private view?: vscode.WebviewView) {}

  /**
   * Tier 1: Structure (Always succeeds)
   * - File content
   * - Line count
   * - Language detection
   */
  async analyzeTier1(
    frameId: string,
    targetPath: string,
    workspaceRoot: string
  ): Promise<Tier1Data> {
    const fullPath = path.join(workspaceRoot, targetPath);
    const language = path.extname(fullPath).toLowerCase().replace('.', '') || 'unknown';

    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lineCount = content.split('\n').length;

      return {
        content,
        lineCount,
        language,
        filePath: targetPath,
        fileExists: true,
      };
    } catch (error) {
      logError(`FrameAnalyzer: Tier 1 analysis failed for ${frameId}`, error);
      return {
        content: '[File not found on disk]',
        lineCount: 1,
        language,
        filePath: targetPath,
        fileExists: false,
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

      // Extract hotspots for this file
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

      // Extract drift issues
      if (facts.findings?.incompleteness) {
        // This is a simplification - in reality we'd parse the findings
        // to see if they relate to this file
        const missing = facts.findings.incompleteness.missing || 0;
        if (missing > 0) {
          data.drift.push({
            type: 'missing_symbols',
            count: missing,
            severity: 'medium',
          });
        }
      }
      // Extract drift symbols for this file
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

      // Get git history if available
      try {
        const { GitOperations } = require('../../../analysis/git');
        const gitOps = new GitOperations();
        const history = await gitOps.getFileHistory(targetPath, 5);
        data.history = history;
      } catch (e) {
        logDebug(`FrameAnalyzer: Failed to get git history for ${frameId}: ${e}`);
      }

      // Get diff stats
      try {
        const { GitOperations } = require('../../../analysis/git');
        const gitOps = new GitOperations();
        const diff = await gitOps.getFileDiff(targetPath);
        data.diff = diff;
      } catch (e) {
        logDebug(`FrameAnalyzer: Failed to get diff for ${frameId}: ${e}`);
      }

      return data;
    } catch (error) {
      logError(`FrameAnalyzer: Tier 2 analysis failed for ${frameId}`, error);
      return data; // Return partial data
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
    // This would typically call the LLM service
    return {
      summary: `Analysis not available for ${frameId}`,
      risks: [],
    };
  }
}
