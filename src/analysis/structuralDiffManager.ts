import { DatabaseWriteQueue } from '../storage/databaseWriteQueue';
import { prepare } from '../storage/statement-wrapper';
import { logDebug } from '../utils/logger';
import { getCstDiffManager } from './cstDiff';
import { getDifftasticIntegration } from './difftastic';
import { getPathService } from '../services/pathService';
import type { CstDiffResult } from './cstDiff';

export interface StructuralDiffMetrics {
  structuralChangeScore: number;
  controlFlowChanged: boolean;
  interfaceChanged: boolean;
  movedBlocks: number;
  linesAdded: number;
  linesRemoved: number;
  rawData?: any;
}

export class StructuralDiffManager {
  private difftastic = getDifftasticIntegration();
  private cstDiff = getCstDiffManager();
  private writeQueue = DatabaseWriteQueue.getInstance();

  constructor(private db: any) {
    //empty
  }

  /**
   * Get or create structural diff (content-addressed caching)
   */
  async getOrCreateStructuralDiff(
    parentBlobSha: string,
    currentBlobSha: string,
    filePath: string,
    parentContent: string,
    currentContent: string
  ): Promise<StructuralDiffMetrics> {
    // Normalize path for consistency
    const normalizedPath = getPathService().toRelative(filePath);

    if (parentBlobSha === currentBlobSha) {
      logDebug(`[StructDiff] Skipping diff for ${normalizedPath} - identical blob SHA`);
      const emptyDiff: StructuralDiffMetrics = {
        structuralChangeScore: 0,
        controlFlowChanged: false,
        interfaceChanged: false,
        movedBlocks: 0,
        linesAdded: 0,
        linesRemoved: 0,
      };

      // Queue empty diff for batch write
      this.writeQueue.queue({
        type: 'structural_diff',
        data: { parentBlobSha, currentBlobSha, filePath: normalizedPath, metrics: emptyDiff },
      });
      return emptyDiff;
    }

    const cached = this.getCachedDiff(parentBlobSha, currentBlobSha, normalizedPath);
    if (cached) {
      logDebug(
        `[StructDiff] Cache hit for ${filePath} ${parentBlobSha.substring(
          0,
          8
        )}→${currentBlobSha.substring(0, 8)}`
      );
      return cached;
    }

    logDebug(`[StructDiff] Computing diff for ${normalizedPath}`);
    const difftasticResult = await this.difftastic.runDifftastic(
      parentContent,
      currentContent,
      normalizedPath,
      normalizedPath
    );

    const metrics = this.extractMetrics(difftasticResult);

    try {
      const cstResult = await this.computeCstDelta(parentContent, currentContent, normalizedPath);
      if (cstResult.changedFacts.length > 0) {
        const cstScore = Math.min(cstResult.changedFacts.length * 0.1, 1.0);
        metrics.structuralChangeScore = Math.max(metrics.structuralChangeScore, cstScore);
      }
    } catch (e) {
      logDebug(`[StructDiff] Failed to compute CST delta for refinement: ${e}`);
    }

    // Queue diff for batch write
    this.writeQueue.queue({
      type: 'structural_diff',
      data: { parentBlobSha, currentBlobSha, filePath: normalizedPath, metrics },
    });

    return metrics;
  }

  /**
   * Flush any pending diff writes (call at end of processing)
   * Now handled by centralized DatabaseWriteQueue
   */
  flushDiffQueue(): void {
    // No-op: flushing is handled by DatabaseWriteQueue.flushAll()
    // Kept for backward compatibility
  }

  private getCachedDiff(
    parentBlobSha: string,
    currentBlobSha: string,
    filePath: string
  ): StructuralDiffMetrics | null {
    // Normalize path for query consistency
    const normalizedPath = getPathService().toRelative(filePath);
    const stmt = prepare(`
      SELECT * FROM structural_diffs
      WHERE parent_blob_sha = ? AND current_blob_sha = ? AND file_path = ?
    `);
    const row = stmt.get([parentBlobSha, currentBlobSha, normalizedPath]) as any;
    if (!row) return null;

    return {
      structuralChangeScore: row.structural_change_score,
      controlFlowChanged: row.control_flow_changed === 1,
      interfaceChanged: row.interface_changed === 1,
      movedBlocks: row.moved_blocks,
      linesAdded: row.lines_added,
      linesRemoved: row.lines_removed,
      rawData: row.data_json ? JSON.parse(row.data_json) : undefined,
    };
  }

  private extractMetrics(difftasticOutput: any): StructuralDiffMetrics {
    const hunks = difftasticOutput.hunks || [];
    const tags = difftasticOutput.tags || new Map<number, string[]>();
    const highlights = difftasticOutput.highlights || [];
    const morphs = difftasticOutput.morphs || [];

    let linesAdded = 0;
    let linesRemoved = 0;

    for (const hunk of hunks) {
      linesAdded += hunk.linesAdded || 0;
      linesRemoved += hunk.linesRemoved || 0;
    }

    if (hunks.length === 0 && difftasticOutput.rawData) {
      const rawOutput =
        typeof difftasticOutput.rawData === 'string'
          ? difftasticOutput.rawData
          : JSON.stringify(difftasticOutput.rawData);

      const hunkRegex = /^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/gm;
      const hunkLines = rawOutput.split('\n');

      let inHunk = false;
      for (let i = 0; i < hunkLines.length; i++) {
        const line = hunkLines[i];

        if (hunkRegex.test(line)) {
          inHunk = true;

          hunkRegex.lastIndex = 0;
          continue;
        }

        if (inHunk) {
          if (line.startsWith('+') && !line.startsWith('+++')) {
            linesAdded++;
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            linesRemoved++;
          }
        }
      }
    }

    let controlFlowChanged = false;
    for (const [, lineTags] of tags) {
      if (lineTags.includes('control-flow')) {
        controlFlowChanged = true;
        break;
      }
    }

    let interfaceChanged = false;
    for (const [, lineTags] of tags) {
      if (lineTags.includes('interface')) {
        interfaceChanged = true;
        break;
      }
    }

    const movedBlocks = morphs.filter((m: any) => m.type === 'moved_block').length;

    const linesChanged = linesAdded + linesRemoved;
    let structuralChangeScore = Math.min(linesChanged / 10, 1.0);

    if (highlights.length > 0 && linesChanged > 0) {
      const highlightCount = highlights.length;
      const highlightRatio = Math.min(highlightCount / linesChanged, 1.0);

      structuralChangeScore = Math.min(structuralChangeScore * (1 + highlightRatio), 1.0);
    }

    return {
      structuralChangeScore,
      controlFlowChanged,
      interfaceChanged,
      movedBlocks,
      linesAdded,
      linesRemoved,
      rawData: difftasticOutput,
    };
  }

  async computeCstDelta(
    oldSerialized: string,
    newSerialized: string,
    filePath: string
  ): Promise<CstDiffResult> {
    return this.cstDiff.computeCstDelta(oldSerialized, newSerialized, filePath);
  }
}
