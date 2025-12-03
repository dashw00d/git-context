import { prepare } from '../storage/statement-wrapper';
import { logDebug } from '../utils/logger';
import type { CstDiffResult } from './cstDiff';
import { getCstDiffManager } from './cstDiff';
import { getDifftasticIntegration } from './difftastic';

export interface StructuralDiffMetrics {
  structuralChangeScore: number;
  controlFlowChanged: boolean;
  interfaceChanged: boolean;
  movedBlocks: number;
  linesAdded: number;
  linesRemoved: number;
  rawData?: any;
}

interface QueuedDiff {
  parentBlobSha: string;
  currentBlobSha: string;
  filePath: string;
  metrics: StructuralDiffMetrics;
}

export class StructuralDiffManager {
  private difftastic = getDifftasticIntegration();
  private cstDiff = getCstDiffManager();
  private writeQueue: QueuedDiff[] = [];
  private readonly BATCH_SIZE = 50;

  constructor(private db: any) {}

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
    if (parentBlobSha === currentBlobSha) {
      logDebug(`[StructDiff] Skipping diff for ${filePath} - identical blob SHA`);
      const emptyDiff: StructuralDiffMetrics = {
        structuralChangeScore: 0,
        controlFlowChanged: false,
        interfaceChanged: false,
        movedBlocks: 0,
        linesAdded: 0,
        linesRemoved: 0,
      };

      this.storeDiff(parentBlobSha, currentBlobSha, filePath, emptyDiff);
      return emptyDiff;
    }

    const cached = this.getCachedDiff(parentBlobSha, currentBlobSha, filePath);
    if (cached) {
      logDebug(
        `[StructDiff] Cache hit for ${filePath} ${parentBlobSha.substring(
          0,
          8
        )}→${currentBlobSha.substring(0, 8)}`
      );
      return cached;
    }

    logDebug(`[StructDiff] Computing diff for ${filePath}`);
    const difftasticResult = await this.difftastic.runDifftastic(
      parentContent,
      currentContent,
      filePath,
      filePath
    );

    const metrics = this.extractMetrics(difftasticResult);

    try {
      const cstResult = await this.computeCstDelta(parentContent, currentContent, filePath);
      if (cstResult.changedFacts.length > 0) {
        const cstScore = Math.min(cstResult.changedFacts.length * 0.1, 1.0);
        metrics.structuralChangeScore = Math.max(metrics.structuralChangeScore, cstScore);
      }
    } catch (e) {
      logDebug(`[StructDiff] Failed to compute CST delta for refinement: ${e}`);
    }

    this.queueDiff(parentBlobSha, currentBlobSha, filePath, metrics);

    return metrics;
  }

  /**
   * Flush any pending diff writes (call at end of processing)
   */
  flushDiffQueue(): void {
    while (this.writeQueue.length > 0) {
      this.flushDiffQueueInternal();
    }
  }

  private getCachedDiff(
    parentBlobSha: string,
    currentBlobSha: string,
    filePath: string
  ): StructuralDiffMetrics | null {
    const stmt = prepare(`
      SELECT * FROM structural_diffs
      WHERE parent_blob_sha = ? AND current_blob_sha = ? AND file_path = ?
    `);
    const row = stmt.get([parentBlobSha, currentBlobSha, filePath]) as any;
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

  private queueDiff(
    parentBlobSha: string,
    currentBlobSha: string,
    filePath: string,
    metrics: StructuralDiffMetrics
  ): void {
    this.writeQueue.push({ parentBlobSha, currentBlobSha, filePath, metrics });
    if (this.writeQueue.length >= this.BATCH_SIZE) {
      this.flushDiffQueueInternal();
    }
  }

  private flushDiffQueueInternal(): void {
    if (this.writeQueue.length === 0) return;
    const batch = this.writeQueue.splice(0, this.BATCH_SIZE);

    const stmt = prepare(`
      INSERT OR REPLACE INTO structural_diffs
      (parent_blob_sha, current_blob_sha, file_path, structural_change_score,
       control_flow_changed, interface_changed, moved_blocks, lines_added,
       lines_removed, data_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();

    this.db.transaction(() => {
      for (const diff of batch) {
        stmt.run([
          diff.parentBlobSha,
          diff.currentBlobSha,
          diff.filePath,
          diff.metrics.structuralChangeScore,
          diff.metrics.controlFlowChanged ? 1 : 0,
          diff.metrics.interfaceChanged ? 1 : 0,
          diff.metrics.movedBlocks,
          diff.metrics.linesAdded,
          diff.metrics.linesRemoved,
          diff.metrics.rawData ? JSON.stringify(diff.metrics.rawData) : null,
          now,
        ]);
      }
    })();

    logDebug(`[StructuralDiffManager] Batched ${batch.length} diff writes`);
  }

  private storeDiff(
    parentBlobSha: string,
    currentBlobSha: string,
    filePath: string,
    metrics: StructuralDiffMetrics
  ): void {
    this.queueDiff(parentBlobSha, currentBlobSha, filePath, metrics);
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
