import { DatabaseService, getDatabaseService } from '../services/databaseService';
import { getDatabaseManager } from '../storage/database';
import { DatabaseWriteQueue } from '../storage/databaseWriteQueue';
import { prepare } from '../storage/statement-wrapper';
import { SymbolInfo } from '../types';
import { logDebug, logInfo } from '../utils/logger';
import { BaseDetector, DetectorConfig } from './detectors/BaseDetector';
import { GitOperations } from './git';

export interface CodeBlock {
  file: string;
  symbolId?: string;
  dnaId?: string;
  symbolKind?: string;
  startLine: number;
  endLine: number;
  content: string;
  normalizedHash: string;
  structureHash: string;
}

export interface MoveCandidate {
  sourceBlock: CodeBlock;
  destBlock: CodeBlock;
  similarityScore: number;
}

export interface MovedBlock {
  commitSha: string;
  sourceFile: string;
  sourceSymbolId?: string;
  sourceStartLine: number;
  sourceEndLine: number;
  sourceContentHash: string;
  destFile: string;
  destSymbolId?: string;
  destStartLine: number;
  destEndLine: number;
  destContentHash: string;
  similarityScore: number;
  blockType: string;
  moveReason: string;
  lineCount: number;
}

export type MoveReason =
  | 'refactoring'
  | 'extraction'
  | 'consolidation'
  | 'module_split'
  | 'file_rename'
  | 'unclear';

export interface MovedBlockResult {
  movedBlocks: MovedBlock[];
  symbolLineage: SymbolLineage[];
}

export interface SymbolLineage {
  symbolId: string;
  previousSymbolId: string;
  commitSha: string;
  moveType: 'file_rename' | 'block_move' | 'symbol_rename';
}

export interface CrossVersionSymbolLineage {
  symbolId: string;
  previousSymbolId: string;
  sourceVersion: string;
  destVersion: string;
  moveType: 'rename' | 'relocate' | 'refactor';
  versionDescription?: string;
}

export class MovedBlockDetector {
  private similarityThreshold: number = 0.6;
  private fileLineCache = new Map<string, string[]>();

  constructor(
    private dbManager = getDatabaseManager(),
    private commitService: DatabaseService = getDatabaseService(),
    private git?: GitOperations
  ) {
    if (!this.git) {
      this.git = new GitOperations();
    }
  }

  /**
   * Set similarity threshold for move detection
   */
  setSimilarityThreshold(threshold: number): void {
    this.similarityThreshold = Math.max(0.0, Math.min(1.0, threshold));
  }

  /**
   * Main entry point: detect moved blocks between file changes
   */
  async detectMovedBlocks(
    commitSha: string,
    deletedSymbols: SymbolInfo[],
    addedSymbols: SymbolInfo[],
    plan?: import('./runner/pipelineTypes').PlanData
  ): Promise<MovedBlockResult> {
    logInfo(`[MovedBlockDetector] Detecting moves for commit ${commitSha.substring(0, 8)}`);
    this.fileLineCache.clear();

    const deletedBlocks = await this.extractCodeBlocks(deletedSymbols, commitSha, 'deleted', plan);
    const addedBlocks = await this.extractCodeBlocks(addedSymbols, commitSha, 'added', plan);

    const candidates = this.findMoveCandidates(deletedBlocks, addedBlocks);

    const movedBlocks: MovedBlock[] = candidates.map(candidate => ({
      commitSha,
      sourceFile: candidate.sourceBlock.file,
      sourceSymbolId: candidate.sourceBlock.symbolId,
      sourceStartLine: candidate.sourceBlock.startLine,
      sourceEndLine: candidate.sourceBlock.endLine,
      sourceContentHash: candidate.sourceBlock.normalizedHash,
      destFile: candidate.destBlock.file,
      destSymbolId: candidate.destBlock.symbolId,
      destStartLine: candidate.destBlock.startLine,
      destEndLine: candidate.destBlock.endLine,
      destContentHash: candidate.destBlock.normalizedHash,
      similarityScore: candidate.similarityScore,
      blockType: this.inferBlockType(candidate.sourceBlock),
      moveReason: this.classifyMoveReason(candidate),
      lineCount: candidate.sourceBlock.endLine - candidate.sourceBlock.startLine + 1,
    }));

    await this.storeMovedBlocks(movedBlocks);

    const symbolLineage = this.generateSymbolLineage(movedBlocks);
    await this.storeSymbolLineage(symbolLineage);

    logInfo(
      `[MovedBlockDetector] Found ${movedBlocks.length} moved blocks, ${symbolLineage.length} lineage entries`
    );

    this.fileLineCache.clear();
    return { movedBlocks, symbolLineage };
  }

  /**
   * Extract code blocks from symbols with content hashing
   */
  async extractCodeBlocks(
    symbols: SymbolInfo[],
    commitSha: string,
    context: 'added' | 'deleted',
    plan?: import('./runner/pipelineTypes').PlanData
  ): Promise<CodeBlock[]> {
    const blocks: CodeBlock[] = [];

    for (const symbol of symbols) {
      try {
        const filePath = symbol.filePath;
        // Normalize path for consistent cache keys
        const normalizedPath = GitOperations.normalizePath(filePath);
        const targetSha = context === 'deleted' ? await this.getParentSha(commitSha) : commitSha;

        let lines = this.fileLineCache.get(`${targetSha}:${normalizedPath}`);

        // Use symbol bodyHash if available to avoid re-hashing
        const normalizedHash = symbol.bodyHash || '';

        if (!lines) {
          const fileContent = await this.getFileContent(filePath, targetSha, plan);
          lines = fileContent.split('\n');
          this.fileLineCache.set(`${targetSha}:${normalizedPath}`, lines);
        }

        const symbolContent = this.extractSymbolContentViaLines(lines, symbol);
        if (!symbolContent.trim()) continue;

        const currentNormalizedHash = normalizedHash || this.hashNormalized(symbolContent);
        const structureHash = this.hashStructure(symbolContent);

        blocks.push({
          file: filePath,
          symbolId: symbol.id,
          dnaId: symbol.id,
          symbolKind: symbol.kind,
          startLine: symbol.location.start.line,
          endLine: symbol.location.end.line,
          content: symbolContent,
          normalizedHash: currentNormalizedHash,
          structureHash,
        });
      } catch (error) {
        logDebug(`[MovedBlockDetector] Failed to extract block for ${symbol.name}: ${error}`);
      }
    }

    return blocks;
  }

  /**
   * Match symbols by DNA ID across versions (for cross-version move detection)
   */
  matchByDna(
    removedSymbols: SymbolInfo[],
    addedSymbols: SymbolInfo[]
  ): Array<{
    removed: SymbolInfo;
    added: SymbolInfo;
    similarity: number;
  }> {
    const matches: Array<{
      removed: SymbolInfo;
      added: SymbolInfo;
      similarity: number;
    }> = [];
    const matchedAdded = new Set<string>();

    for (const removed of removedSymbols) {
      if (!removed.id) continue;

      let bestMatch: SymbolInfo | null = null;
      let bestSimilarity = 0;

      for (const added of addedSymbols) {
        if (matchedAdded.has(added.id)) continue;
        if (!added.id) continue;

        if (removed.id === added.id) {
          bestMatch = added;
          bestSimilarity = 1.0;
          break;
        }
      }

      if (bestMatch) {
        matches.push({ removed, added: bestMatch, similarity: bestSimilarity });
        matchedAdded.add(bestMatch.id);
      }
    }

    return matches;
  }

  /**
   * Find move candidates using multi-stage similarity matching
   */
  findMoveCandidates(deletedBlocks: CodeBlock[], addedBlocks: CodeBlock[]): MoveCandidate[] {
    const candidates: MoveCandidate[] = [];

    for (const deleted of deletedBlocks) {
      for (const added of addedBlocks) {
        let similarityScore = 0;

        if (deleted.normalizedHash === added.normalizedHash) {
          similarityScore = 1.0;
        } else if (deleted.structureHash === added.structureHash) {
          similarityScore = this.calculateOptimizedSimilarity(deleted.content, added.content);
          if (similarityScore < this.similarityThreshold) continue;
        } else {
          // If structure differs, only use Levenshtein on small blocks
          if (deleted.content.length < 1000 && added.content.length < 1000) {
            similarityScore = this.calculateLevenshteinSimilarity(
              deleted.normalizedHash,
              added.normalizedHash
            );
          }
          if (similarityScore < this.similarityThreshold) continue;
        }

        candidates.push({
          sourceBlock: deleted,
          destBlock: added,
          similarityScore,
        });
      }
    }

    return this.deduplicateCandidates(candidates);
  }

  /**
   * Infer block type from symbol information
   * Uses actual symbol kind from SymbolInfo, not regex on IDs
   */
  inferBlockType(block: CodeBlock): string {
    return block.symbolKind || 'block';
  }

  /**
   * Classify why a block was moved
   */
  classifyMoveReason(candidate: MoveCandidate): MoveReason {
    const { sourceBlock, destBlock } = candidate;

    if (this.isFileRename(sourceBlock.file, destBlock.file)) {
      return 'file_rename';
    }

    if (this.isUtilityFile(destBlock.file) && !this.isUtilityFile(sourceBlock.file)) {
      return 'extraction';
    }

    if (candidate.similarityScore >= 0.95) {
      return 'refactoring';
    }

    return 'unclear';
  }

  /**
   * Optimized similarity calculation:
   * 1. If very large, use dice coefficient on tokens (O(N))
   * 2. If small, use Levenshtein (O(N^2))
   */
  private calculateOptimizedSimilarity(text1: string, text2: string): number {
    const len1 = text1.length;
    const len2 = text2.length;

    // Levenshtein is too slow for large symbols (> 2000 chars)
    if (len1 > 2000 || len2 > 2000) {
      return this.calculateDiceSimilarity(text1, text2);
    }

    return this.calculateTextSimilarity(text1, text2);
  }

  /**
   * Dice coefficient on bigrams for fast similarity
   */
  private calculateDiceSimilarity(str1: string, str2: string): number {
    const getBigrams = (s: string) => {
      const bigrams = new Set<string>();
      for (let i = 0; i < s.length - 1; i++) {
        bigrams.add(s.substring(i, i + 2));
      }
      return bigrams;
    };

    const s1 = getBigrams(str1);
    const s2 = getBigrams(str2);

    if (s1.size === 0 && s2.size === 0) return 1.0;

    let intersect = 0;
    for (const b of s1) {
      if (s2.has(b)) intersect++;
    }

    return (2.0 * intersect) / (s1.size + s2.size);
  }

  /**
   * Calculate text similarity using Levenshtein distance
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const longer = text1.length > text2.length ? text1 : text2;
    const shorter = text1.length > text2.length ? text2 : text1;

    if (longer.length === 0) return 1.0;

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein similarity between two strings
   */
  private calculateLevenshteinSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Levenshtein distance calculation (Optimized space complexity)
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[] = new Array(len2 + 1);

    for (let j = 0; j <= len2; j++) matrix[j] = j;

    for (let i = 1; i <= len1; i++) {
      let prev = i;
      for (let j = 1; j <= len2; j++) {
        const val =
          str1[i - 1] === str2[j - 1]
            ? matrix[j - 1]
            : Math.min(matrix[j - 1] + 1, prev + 1, matrix[j] + 1);
        matrix[j - 1] = prev;
        prev = val;
      }
      matrix[len2] = prev;
    }

    return matrix[len2];
  }

  /**
   * Deduplicate candidates, preferring highest similarity scores
   */
  private deduplicateCandidates(candidates: MoveCandidate[]): MoveCandidate[] {
    const grouped = new Map<string, MoveCandidate[]>();

    for (const candidate of candidates) {
      const key = `${candidate.sourceBlock.file}:${candidate.sourceBlock.symbolId}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(candidate);
    }

    const deduplicated: MoveCandidate[] = [];
    for (const group of Array.from(grouped.values())) {
      const best = group.reduce((best, current) =>
        current.similarityScore > best.similarityScore ? current : best
      );
      deduplicated.push(best);
    }

    return deduplicated;
  }

  /**
   * Generate symbol lineage from moved blocks
   */
  private generateSymbolLineage(movedBlocks: MovedBlock[]): SymbolLineage[] {
    const lineage: SymbolLineage[] = [];

    for (const move of movedBlocks) {
      if (move.sourceSymbolId && move.destSymbolId && move.sourceSymbolId !== move.destSymbolId) {
        let moveType: 'file_rename' | 'block_move' | 'symbol_rename' = 'block_move';

        if (move.sourceFile !== move.destFile && move.sourceSymbolId === move.destSymbolId) {
          moveType = 'file_rename';
        } else {
          moveType = 'symbol_rename';
        }

        lineage.push({
          symbolId: move.destSymbolId,
          previousSymbolId: move.sourceSymbolId,
          commitSha: move.commitSha,
          moveType,
        });
      }
    }

    return lineage;
  }

  /**
   * Store moved blocks in database
   */
  private async storeMovedBlocks(movedBlocks: MovedBlock[]): Promise<void> {
    const writeQueue = DatabaseWriteQueue.getInstance();
    for (const block of movedBlocks) {
      writeQueue.queue({ type: 'moved_block', data: block });
    }
  }

  /**
   * Store symbol lineage in database
   */
  private async storeSymbolLineage(lineage: SymbolLineage[]): Promise<void> {
    const writeQueue = DatabaseWriteQueue.getInstance();

    for (const entry of lineage) {
      writeQueue.queue({
        type: 'symbol_lineage',
        data: {
          symbolId: entry.symbolId,
          previousSymbolId: entry.previousSymbolId,
          commitSha: entry.commitSha,
          moveType: entry.moveType,
        },
      });
    }
  }

  /**
   * Get file content for a given file and commit SHA
   * Uses GitOperations to get historical file content
   */
  private async getFileContent(
    filePath: string,
    commitSha: string,
    plan?: import('./runner/pipelineTypes').PlanData
  ): Promise<string> {
    // Try plan data first
    // Normalize path for consistent plan data lookup
    const normalizedPath = GitOperations.normalizePath(filePath);
    if (plan?.content.has(`${commitSha}:${normalizedPath}`)) {
      return plan.content.get(`${commitSha}:${normalizedPath}`)!;
    }

    if (!this.git) {
      logDebug(`[MovedBlockDetector] GitOperations not available, returning empty content`);
      return '';
    }
    try {
      return this.git.safeGetFileContent(commitSha, filePath);
    } catch (error: any) {
      logDebug(
        `[MovedBlockDetector] Failed to get file content for ${filePath} at ${commitSha.substring(
          0,
          8
        )}: ${error.message}`
      );
      return '';
    }
  }

  /**
   * Get parent SHA for a given commit
   */
  private async getParentSha(commitSha: string): Promise<string> {
    const metadata = await this.commitService.getCommitMetadata(commitSha);
    return metadata?.parent || commitSha;
  }

  private extractSymbolContentViaLines(lines: string[], symbol: SymbolInfo): string {
    const startLine = Math.max(0, symbol.location.start.line - 1);
    const endLine = Math.min(lines.length - 1, symbol.location.end.line - 1);

    return lines.slice(startLine, endLine + 1).join('\n');
  }

  /**
   * Hash normalized content (removes comments, whitespace)
   */
  private hashNormalized(content: string): string {
    const normalized = content
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const crypto = require('crypto');
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Hash structural content (AST-based)
   */
  private hashStructure(content: string): string {
    const tokens = content
      .replace(/[a-zA-Z_][a-zA-Z0-9_]*/g, 'ID')
      .replace(/\d+/g, 'NUM')
      .replace(/["'].*?["']/g, 'STR')
      .replace(/\s+/g, '');

    const crypto = require('crypto');
    return crypto.createHash('sha256').update(tokens).digest('hex').substring(0, 16);
  }

  private isUtilityFile(filePath: string): boolean {
    const patterns = ['/utils/', '/helpers/', '/lib/', '/common/', '/shared/'];
    return patterns.some(p => filePath.toLowerCase().includes(p.toLowerCase()));
  }

  private isFileRename(sourcePath: string, destPath: string): boolean {
    const sourceName = sourcePath.substring(sourcePath.lastIndexOf('/') + 1);
    const destName = destPath.substring(destPath.lastIndexOf('/') + 1);

    return sourcePath !== destPath && sourceName === destName;
  }

  async getMovedBlocks(commitSha: string): Promise<MovedBlock[]> {
    const stmt = prepare(`
      SELECT * FROM moved_blocks
      WHERE commit_sha = ?
      ORDER BY similarity_score DESC
    `);

    const rows = stmt.all(commitSha);
    return rows.map((row: any) => ({
      commitSha: row.commit_sha,
      sourceFile: row.source_file,
      sourceSymbolId: row.source_symbol_id,
      sourceStartLine: row.source_start_line,
      sourceEndLine: row.source_end_line,
      sourceContentHash: row.source_content_hash,
      destFile: row.dest_file,
      destSymbolId: row.dest_symbol_id,
      destStartLine: row.dest_start_line,
      destEndLine: row.dest_end_line,
      destContentHash: row.dest_content_hash,
      similarityScore: row.similarity_score,
      blockType: row.block_type,
      moveReason: row.move_reason,
      lineCount: row.line_count,
    }));
  }

  async getSymbolLineage(symbolId: string): Promise<SymbolLineage[]> {
    const stmt = prepare(`
      SELECT * FROM symbol_lineage
      WHERE symbol_id = ? OR previous_symbol_id = ?
      ORDER BY commit_sha DESC
    `);

    const rows = stmt.all(symbolId, symbolId);
    return rows.map((row: any) => ({
      symbolId: row.symbol_id,
      previousSymbolId: row.previous_symbol_id,
      commitSha: row.commit_sha,
      moveType: row.move_type,
    }));
  }

  async getFileMoves(filePath: string): Promise<MovedBlock[]> {
    const stmt = prepare(`
      SELECT * FROM moved_blocks
      WHERE source_file = ? OR dest_file = ?
      ORDER BY commit_sha DESC, similarity_score DESC
    `);

    const rows = stmt.all(filePath, filePath);
    return rows.map((row: any) => ({
      commitSha: row.commit_sha,
      sourceFile: row.source_file,
      sourceSymbolId: row.source_symbol_id,
      sourceStartLine: row.source_start_line,
      sourceEndLine: row.source_end_line,
      sourceContentHash: row.source_content_hash,
      destFile: row.dest_file,
      destSymbolId: row.dest_symbol_id,
      destStartLine: row.dest_start_line,
      destEndLine: row.dest_end_line,
      destContentHash: row.dest_content_hash,
      similarityScore: row.similarity_score,
      blockType: row.block_type,
      moveReason: row.move_reason,
      lineCount: row.line_count,
    }));
  }
}

export interface MovedBlockDetectorInput {
  commitSha: string;
  deletedSymbols: SymbolInfo[];
  addedSymbols: SymbolInfo[];
}

export class MovedBlockDetectorV2 extends BaseDetector<MovedBlockDetectorInput, MovedBlock[]> {
  private legacyDetector: MovedBlockDetector;

  constructor(config: Partial<DetectorConfig> = {}) {
    super({
      enableCaching: false,
      ...config,
    });
    this.legacyDetector = new MovedBlockDetector();
  }

  async detect(input: MovedBlockDetectorInput): Promise<MovedBlock[]> {
    return this.getCachedResult(
      this.generateCacheKey(input.commitSha, input.deletedSymbols, input.addedSymbols),
      async () => {
        const result = await this.legacyDetector.detectMovedBlocks(
          input.commitSha,
          input.deletedSymbols,
          input.addedSymbols
        );
        return result.movedBlocks;
      }
    );
  }

  async detectMovedBlocks(
    commitSha: string,
    deletedSymbols: SymbolInfo[],
    addedSymbols: SymbolInfo[],
    plan?: import('./runner/pipelineTypes').PlanData
  ): Promise<MovedBlockResult> {
    return this.legacyDetector.detectMovedBlocks(commitSha, deletedSymbols, addedSymbols, plan);
  }

  matchByDna(
    removedSymbols: SymbolInfo[],
    addedSymbols: SymbolInfo[]
  ): Array<{
    removed: SymbolInfo;
    added: SymbolInfo;
    similarity: number;
  }> {
    return this.legacyDetector.matchByDna(removedSymbols, addedSymbols);
  }

  setSimilarityThreshold(threshold: number): void {
    this.legacyDetector.setSimilarityThreshold(threshold);
  }

  async getFileMoves(filePath: string): Promise<MovedBlock[]> {
    return this.legacyDetector.getFileMoves(filePath);
  }

  async getSymbolLineage(symbolId: string): Promise<SymbolLineage[]> {
    return this.legacyDetector.getSymbolLineage(symbolId);
  }
}
