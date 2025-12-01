import { prepare } from '../storage/statement-wrapper';
import { logDebug } from '../utils/logger';
import { getCstDiffManager } from './cstDiff';
import { getDifftasticIntegration } from './difftastic';
import type { CstDiffResult } from './cstDiff';

export interface StructuralDiffMetrics {
  structuralChangeScore: number; // 0-1
  controlFlowChanged: boolean;
  interfaceChanged: boolean;
  movedBlocks: number;
  linesAdded: number;
  linesRemoved: number;
  rawData?: any; // Full difftastic output
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
    // Quick check: if blob SHAs are identical, file content is unchanged
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
      // Cache the empty diff to avoid future checks
      this.storeDiff(parentBlobSha, currentBlobSha, filePath, emptyDiff);
      return emptyDiff;
    }

    // Check cache
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

    // Run difftastic
    logDebug(`[StructDiff] Computing diff for ${filePath}`);
    const difftasticResult = await this.difftastic.runDifftastic(
      parentContent,
      currentContent,
      filePath,
      filePath
    );

    const metrics = this.extractMetrics(difftasticResult);

    // Refine with CST diff if possible (uses tree-based verification)
    try {
      const cstResult = await this.computeCstDelta(parentContent, currentContent, filePath);
      if (cstResult.changedFacts.length > 0) {
        // If we have verified CST changes, ensure score is at least 0.1 per change
        // This helps surface structural changes that might be small in line count
        const cstScore = Math.min(cstResult.changedFacts.length * 0.1, 1.0);
        metrics.structuralChangeScore = Math.max(metrics.structuralChangeScore, cstScore);

        // Also set interface/control flow flags if CST facts indicate it
        // (This is a heuristic, as HybridFacts don't explicitly say "interface" vs "control flow" yet,
        // but we can infer from kinds if needed. For now, just boosting score is good.)
      }
    } catch (e) {
      logDebug(`[StructDiff] Failed to compute CST delta for refinement: ${e}`);
    }

    // Queue for batch write
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

    // Get wrapped database with transaction support
    const stmt = prepare(`
      INSERT OR REPLACE INTO structural_diffs
      (parent_blob_sha, current_blob_sha, file_path, structural_change_score,
       control_flow_changed, interface_changed, moved_blocks, lines_added,
       lines_removed, data_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();

    // Use transaction wrapper instead of manual BEGIN/COMMIT
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
    // Legacy method - use queueDiff instead
    this.queueDiff(parentBlobSha, currentBlobSha, filePath, metrics);
  }

  private extractMetrics(difftasticOutput: any): StructuralDiffMetrics {
    // Use parsed hunks and tags from enhanced difftastic output
    const hunks = difftasticOutput.hunks || [];
    const tags = difftasticOutput.tags || new Map<number, string[]>();
    const highlights = difftasticOutput.highlights || [];
    const morphs = difftasticOutput.morphs || [];

    // Calculate lines added/removed from hunks
    let linesAdded = 0;
    let linesRemoved = 0;

    for (const hunk of hunks) {
      linesAdded += hunk.linesAdded || 0;
      linesRemoved += hunk.linesRemoved || 0;
    }

    // Fallback: if hunks not available, parse raw difftastic output text
    if (hunks.length === 0 && difftasticOutput.rawData) {
      const rawOutput =
        typeof difftasticOutput.rawData === 'string'
          ? difftasticOutput.rawData
          : JSON.stringify(difftasticOutput.rawData);

      // Parse @@ hunk headers with regex to identify valid hunk blocks
      const hunkRegex = /^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/gm;
      const hunkLines = rawOutput.split('\n');

      let inHunk = false;
      for (let i = 0; i < hunkLines.length; i++) {
        const line = hunkLines[i];

        // Check for hunk header
        if (hunkRegex.test(line)) {
          inHunk = true;
          // Reset regex lastIndex because test() advances it
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

    // Detect control-flow changes from tagged lines
    let controlFlowChanged = false;
    for (const [, lineTags] of tags) {
      if (lineTags.includes('control-flow')) {
        controlFlowChanged = true;
        break;
      }
    }

    // Detect interface changes from tagged lines or morphs
    let interfaceChanged = false;
    for (const [, lineTags] of tags) {
      if (lineTags.includes('interface')) {
        interfaceChanged = true;
        break;
      }
    }

    // Count moved blocks from morphs or heuristics
    const movedBlocks = morphs.filter((m: any) => m.type === 'moved_block').length;

    // Calculate structural change score: min(linesChanged / 10, 1.0)
    const linesChanged = linesAdded + linesRemoved;
    let structuralChangeScore = Math.min(linesChanged / 10, 1.0);

    // Refine with highlights if available (highlighted volume)
    if (highlights.length > 0 && linesChanged > 0) {
      // Heuristic: if we have highlights, use them to weight the score
      // A fully highlighted line counts more than a partially highlighted one
      // For now, we'll just boost the score if there are many highlights relative to lines changed
      const highlightCount = highlights.length;
      const highlightRatio = Math.min(highlightCount / linesChanged, 1.0);

      // Boost score based on highlight density, but cap at 1.0
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

  /**
   * Compute CST delta for hybrid facts (CST-only or hybrid augmentation)
   */
  async computeCstDelta(
    oldSerialized: string,
    newSerialized: string,
    filePath: string
  ): Promise<CstDiffResult> {
    return this.cstDiff.computeCstDelta(oldSerialized, newSerialized, filePath);
  }
}
