import { Database } from 'sql.js';
import { getDifftasticIntegration } from './difftastic';
import { logDebug } from '../utils/logger';

export interface StructuralDiffMetrics {
  structuralChangeScore: number; // 0-1
  controlFlowChanged: boolean;
  interfaceChanged: boolean;
  movedBlocks: number;
  linesAdded: number;
  linesRemoved: number;
  rawData?: any; // Full difftastic output
}

export class StructuralDiffManager {
  private difftastic = getDifftasticIntegration();

  constructor(private db: Database) {}

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
    // Check cache
    const cached = this.getCachedDiff(parentBlobSha, currentBlobSha, filePath);
    if (cached) {
      logDebug(`[StructDiff] Cache hit for ${filePath} ${parentBlobSha.substring(0, 8)}→${currentBlobSha.substring(0, 8)}`);
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

    // Store to cache
    this.storeDiff(parentBlobSha, currentBlobSha, filePath, metrics);

    return metrics;
  }

  private getCachedDiff(
    parentBlobSha: string,
    currentBlobSha: string,
    filePath: string
  ): StructuralDiffMetrics | null {
    const stmt = this.db.prepare(`
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
      rawData: row.data_json ? JSON.parse(row.data_json) : undefined
    };
  }

  private storeDiff(
    parentBlobSha: string,
    currentBlobSha: string,
    filePath: string,
    metrics: StructuralDiffMetrics
  ): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO structural_diffs
      (parent_blob_sha, current_blob_sha, file_path, structural_change_score,
       control_flow_changed, interface_changed, moved_blocks, lines_added,
       lines_removed, data_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      parentBlobSha,
      currentBlobSha,
      filePath,
      metrics.structuralChangeScore,
      metrics.controlFlowChanged ? 1 : 0,
      metrics.interfaceChanged ? 1 : 0,
      metrics.movedBlocks,
      metrics.linesAdded,
      metrics.linesRemoved,
      metrics.rawData ? JSON.stringify(metrics.rawData) : null,
      new Date().toISOString()
    ]);
  }

  private extractMetrics(difftasticOutput: any): StructuralDiffMetrics {
    // Parse difftastic JSON output to extract metrics
    // This is simplified - adapt to actual difftastic output format
    const highlights = difftasticOutput.highlights || [];

    const structuralChanges = highlights.filter((h: any) =>
      h.type === 'structural' || h.type === 'syntax'
    ).length;

    const totalChanges = highlights.length;
    const structuralChangeScore = totalChanges > 0
      ? structuralChanges / totalChanges
      : 0;

    const controlFlowChanged = highlights.some((h: any) =>
      h.tags?.includes('control-flow')
    );

    const interfaceChanged = highlights.some((h: any) =>
      h.tags?.includes('signature') || h.tags?.includes('params')
    );

    const movedBlocks = highlights.filter((h: any) =>
      h.type === 'moved'
    ).length;

    return {
      structuralChangeScore,
      controlFlowChanged,
      interfaceChanged,
      movedBlocks,
      linesAdded: difftasticOutput.linesAdded || 0,
      linesRemoved: difftasticOutput.linesRemoved || 0,
      rawData: difftasticOutput
    };
  }
}
