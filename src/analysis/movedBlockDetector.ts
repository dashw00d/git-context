import { Database } from 'sql.js';
import { SymbolInfo } from '../types';
import { logDebug, logInfo } from '../utils/logger';
import { getDatabaseManager } from '../storage/database';
import { GitOperations } from './git';

export interface CodeBlock {
  file: string;
  symbolId?: string;
  dnaId?: string; // Add DNA ID for matching
  symbolKind?: string; // Add symbol kind for inferBlockType
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

export class MovedBlockDetector {
  private similarityThreshold: number = 0.6; // Configurable threshold (default 0.6)

  constructor(
    private dbManager = getDatabaseManager(),
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
    addedSymbols: SymbolInfo[]
  ): Promise<MovedBlockResult> {
    logInfo(`[MovedBlockDetector] Detecting moves for commit ${commitSha.substring(0, 8)}`);

    // Extract code blocks from symbols
    const deletedBlocks = await this.extractCodeBlocks(deletedSymbols, commitSha, 'deleted');
    const addedBlocks = await this.extractCodeBlocks(addedSymbols, commitSha, 'added');

    // Find move candidates
    const candidates = this.findMoveCandidates(deletedBlocks, addedBlocks);

    // Convert candidates to moved blocks
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
      lineCount: candidate.sourceBlock.endLine - candidate.sourceBlock.startLine + 1
    }));

    // Store moved blocks
    await this.storeMovedBlocks(movedBlocks);

    // Generate symbol lineage
    const symbolLineage = this.generateSymbolLineage(movedBlocks);
    await this.storeSymbolLineage(symbolLineage);

    logInfo(`[MovedBlockDetector] Found ${movedBlocks.length} moved blocks, ${symbolLineage.length} lineage entries`);

    return { movedBlocks, symbolLineage };
  }

  /**
   * Extract code blocks from symbols with content hashing
   */
  async extractCodeBlocks(
    symbols: SymbolInfo[],
    commitSha: string,
    context: 'added' | 'deleted'
  ): Promise<CodeBlock[]> {
    const blocks: CodeBlock[] = [];

    for (const symbol of symbols) {
      try {
        // Get file content (for deleted symbols, we need parent content)
        const filePath = symbol.id.split(':')[0];
        const contentSha = context === 'deleted' ? await this.getParentSha(commitSha) : commitSha;
        const fileContent = await this.getFileContent(filePath, contentSha);

        // Extract symbol content from file
        const symbolContent = this.extractSymbolContent(fileContent, symbol);

        // Create hashes
        const normalizedHash = this.hashNormalized(symbolContent);
        const structureHash = this.hashStructure(symbolContent);

        blocks.push({
          file: filePath,
          symbolId: symbol.dnaId,
          dnaId: symbol.dnaId,
          symbolKind: symbol.kind,
          startLine: symbol.location.start.line,
          endLine: symbol.location.end.line,
          content: symbolContent,
          normalizedHash,
          structureHash
        });
      } catch (error) {
        logDebug(`[MovedBlockDetector] Failed to extract block for ${symbol.name}: ${error}`);
      }
    }

    return blocks;
  }

  /**
   * Find move candidates using multi-stage similarity matching
   */
  findMoveCandidates(deletedBlocks: CodeBlock[], addedBlocks: CodeBlock[]): MoveCandidate[] {
    const candidates: MoveCandidate[] = [];

    for (const deleted of deletedBlocks) {
      for (const added of addedBlocks) {
        // Allow same-file moves (in-file refactoring)
        // Match via stable DNA IDs for in-file moves

        let similarityScore = 0;

        // Stage 1: Exact hash match (perfect move)
        if (deleted.normalizedHash === added.normalizedHash) {
          similarityScore = 1.0;
        }
        // Stage 2: Structure match (move with minor edits)
        else if (deleted.structureHash === added.structureHash) {
          similarityScore = this.calculateTextSimilarity(deleted.content, added.content);
          if (similarityScore < this.similarityThreshold) continue; // Too different
        }
        // Stage 3: Fuzzy match (partial moves)
        else {
          similarityScore = this.calculateLevenshteinSimilarity(
            deleted.normalizedHash,
            added.normalizedHash
          );
          if (similarityScore < this.similarityThreshold) continue; // Too different
        }

        candidates.push({
          sourceBlock: deleted,
          destBlock: added,
          similarityScore
        });
      }
    }

    // Deduplicate: prefer highest similarity matches
    return this.deduplicateCandidates(candidates);
  }

  /**
   * Infer block type from symbol information
   * Uses actual symbol kind from SymbolInfo, not regex on IDs
   */
  inferBlockType(block: CodeBlock): string {
    if (block.symbolKind) {
      return block.symbolKind;
    }
    // Fallback to generic 'block' if kind not available
    return 'block';
  }

  /**
   * Classify why a block was moved
   */
  classifyMoveReason(candidate: MoveCandidate): MoveReason {
    const { sourceBlock, destBlock } = candidate;

    // File rename: same directory, different filename
    if (this.isFileRename(sourceBlock.file, destBlock.file)) {
      return 'file_rename';
    }

    // Extraction: moved to a utility/helper file
    if (this.isUtilityFile(destBlock.file) && !this.isUtilityFile(sourceBlock.file)) {
      return 'extraction';
    }

    // Consolidation: multiple similar blocks moved to same file
    if (this.hasMultipleMovesToSameFile(destBlock.file)) {
      return 'consolidation';
    }

    // Module split: moving from large file to new smaller file
    if (this.isNewFile(destBlock.file) && this.isLargeFile(sourceBlock.file)) {
      return 'module_split';
    }

    // Default: generic refactoring
    if (candidate.similarityScore >= 0.95) {
      return 'refactoring';
    }

    return 'unclear';
  }

  /**
   * Calculate text similarity using diff-match-patch
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    // Simplified implementation - in production would use diff-match-patch
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
   * Levenshtein distance calculation
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Deduplicate candidates, preferring highest similarity scores
   */
  private deduplicateCandidates(candidates: MoveCandidate[]): MoveCandidate[] {
    const grouped = new Map<string, MoveCandidate[]>();

    // Group by source block
    for (const candidate of candidates) {
      const key = `${candidate.sourceBlock.file}:${candidate.sourceBlock.symbolId}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(candidate);
    }

    // For each group, pick the highest similarity candidate
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
        // Determine move type
        let moveType: 'file_rename' | 'block_move' | 'symbol_rename' = 'block_move';

        if (move.sourceFile !== move.destFile && move.sourceSymbolId === move.destSymbolId) {
          moveType = 'file_rename';
        } else if (move.sourceSymbolId !== move.destSymbolId) {
          moveType = 'symbol_rename';
        }

        lineage.push({
          symbolId: move.destSymbolId,
          previousSymbolId: move.sourceSymbolId,
          commitSha: move.commitSha,
          moveType
        });
      }
    }

    return lineage;
  }

  /**
   * Store moved blocks in database
   */
  private async storeMovedBlocks(movedBlocks: MovedBlock[]): Promise<void> {
    const db = this.dbManager.getDatabase();

    for (const block of movedBlocks) {
      const stmt = db.prepare(`
        INSERT INTO moved_blocks (
          commit_sha, source_file, source_symbol_id, source_start_line, source_end_line,
          source_content_hash, dest_file, dest_symbol_id, dest_start_line, dest_end_line,
          dest_content_hash, similarity_score, block_type, move_reason, line_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        block.commitSha,
        block.sourceFile,
        block.sourceSymbolId || null,
        block.sourceStartLine,
        block.sourceEndLine,
        block.sourceContentHash,
        block.destFile,
        block.destSymbolId || null,
        block.destStartLine,
        block.destEndLine,
        block.destContentHash,
        block.similarityScore,
        block.blockType,
        block.moveReason,
        block.lineCount
      );
    }
  }

  /**
   * Store symbol lineage in database
   */
  private async storeSymbolLineage(lineage: SymbolLineage[]): Promise<void> {
    const db = this.dbManager.getDatabase();

    for (const entry of lineage) {
      const stmt = db.prepare(`
        INSERT INTO symbol_lineage (symbol_id, previous_symbol_id, commit_sha, move_type)
        VALUES (?, ?, ?, ?)
      `);

      stmt.run(
        entry.symbolId,
        entry.previousSymbolId,
        entry.commitSha,
        entry.moveType
      );
    }
  }

  /**
   * Get file content for a given file and commit SHA
   * Uses GitOperations to get historical file content
   */
  private async getFileContent(filePath: string, commitSha: string): Promise<string> {
    if (!this.git) {
      logDebug(`[MovedBlockDetector] GitOperations not available, returning empty content`);
      return '';
    }
    try {
      return this.git.safeGetFileContent(commitSha, filePath);
    } catch (error: any) {
      logDebug(`[MovedBlockDetector] Failed to get file content for ${filePath} at ${commitSha.substring(0, 8)}: ${error.message}`);
      return '';
    }
  }

  /**
   * Get parent SHA for a given commit
   */
  private async getParentSha(commitSha: string): Promise<string> {
    // This is a simplified implementation
    // In production, this would query the database for commit parent
    const db = this.dbManager.getDatabase();
    const stmt = db.prepare(`
      SELECT parent FROM commits_metadata WHERE sha = ?
    `);
    const row = stmt.get(commitSha) as any;
    return row?.parent || commitSha;
  }

  /**
   * Extract symbol content from file content
   */
  private extractSymbolContent(fileContent: string, symbol: SymbolInfo): string {
    const lines = fileContent.split('\n');
    const startLine = Math.max(0, symbol.location.start.line - 1);
    const endLine = Math.min(lines.length - 1, symbol.location.end.line - 1);

    return lines.slice(startLine, endLine + 1).join('\n');
  }

  /**
   * Hash normalized content (removes comments, whitespace)
   */
  private hashNormalized(content: string): string {
    const normalized = content
      .replace(/\/\*[\s\S]*?\*\//g, '')  // Remove block comments
      .replace(/\/\/.*/g, '')            // Remove line comments
      .replace(/\s+/g, ' ')              // Normalize whitespace
      .trim();

    const crypto = require('crypto');
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Hash structural content (AST-based)
   */
  private hashStructure(content: string): string {
    // Simplified implementation - in production would parse AST
    const tokens = content
      .replace(/[a-zA-Z_][a-zA-Z0-9_]*/g, 'ID')  // Replace identifiers
      .replace(/\d+/g, 'NUM')                     // Replace numbers
      .replace(/["'].*?["']/g, 'STR')             // Replace strings
      .replace(/\s+/g, '');                       // Remove whitespace

    const crypto = require('crypto');
    return crypto.createHash('sha256').update(tokens).digest('hex').substring(0, 16);
  }

  // Utility methods for move classification
  private isUtilityFile(filePath: string): boolean {
    const patterns = ['/utils/', '/helpers/', '/lib/', '/common/', '/shared/'];
    return patterns.some(p => filePath.toLowerCase().includes(p.toLowerCase()));
  }

  private hasMultipleMovesToSameFile(filePath: string): boolean {
    // Simplified - would check if multiple blocks moved to same file
    return false; // Placeholder
  }

  private isNewFile(filePath: string): boolean {
    // Simplified - would check if file was recently created
    return false; // Placeholder
  }

  private isLargeFile(filePath: string): boolean {
    // Simplified - would check file size
    return false; // Placeholder
  }

  private isFileRename(sourcePath: string, destPath: string): boolean {
    // Check if paths represent a file rename (same directory, different filename)
    const sourceDir = sourcePath.substring(0, sourcePath.lastIndexOf('/'));
    const destDir = destPath.substring(0, destPath.lastIndexOf('/'));
    const sourceName = sourcePath.substring(sourcePath.lastIndexOf('/') + 1);
    const destName = destPath.substring(destPath.lastIndexOf('/') + 1);

    return sourceDir === destDir && sourceName !== destName;
  }

  // Public API methods

  /**
   * Get all moved blocks for a commit
   */
  async getMovedBlocks(commitSha: string): Promise<MovedBlock[]> {
    const db = this.dbManager.getDatabase();
    const stmt = db.prepare(`
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
      lineCount: row.line_count
    }));
  }

  /**
   * Get symbol lineage (history of moves)
   */
  async getSymbolLineage(symbolId: string): Promise<SymbolLineage[]> {
    const db = this.dbManager.getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM symbol_lineage
      WHERE symbol_id = ? OR previous_symbol_id = ?
      ORDER BY commit_sha DESC
    `);

    const rows = stmt.all(symbolId, symbolId);
    return rows.map((row: any) => ({
      symbolId: row.symbol_id,
      previousSymbolId: row.previous_symbol_id,
      commitSha: row.commit_sha,
      moveType: row.move_type
    }));
  }

  /**
   * Find all moves involving a file
   */
  async getFileMoves(filePath: string): Promise<MovedBlock[]> {
    const db = this.dbManager.getDatabase();
    const stmt = db.prepare(`
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
      lineCount: row.line_count
    }));
  }
}
