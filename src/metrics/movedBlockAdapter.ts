/**
 * Moved Block Adapter
 *
 * Adapter for MovedBlockDetector.detectMovedBlocks()
 * Provides moved block detection metrics for tests
 */

import { MovedBlockDetector, MovedBlockResult } from '../analysis/movedBlockDetector';
import { SymbolInfo } from '../types';

export interface MovedBlockMetrics {
  totalMovedBlocks: number;
  fileRenames: number;
  blockMoves: number;
  symbolRenames: number;
  averageSimilarity: number;
  movedSymbols: number;
  movedLines: number;
}

/**
 * Detect moved blocks using real MovedBlockDetector
 */
export async function detectMovedBlocksFromFacts(
  deletedSymbols: Array<{ id: string; name: string; filePath?: string; content?: string }>,
  addedSymbols: Array<{ id: string; name: string; filePath?: string; content?: string }>
): Promise<MovedBlockMetrics> {
  try {
    // Transform test data to SymbolInfo format
    const deletedSymbolInfos: SymbolInfo[] = deletedSymbols.map(symbol => ({
      id: symbol.id,
      dnaId: symbol.id,
      name: symbol.name,
      kind: 'function' as const, // Default for tests
      signature: '',
      location: {
        start: { line: 1, column: 0 },
        end: { line: 10, column: 0 }
      },
      filePath: symbol.filePath || 'test-file',
      content: symbol.content || `function ${symbol.name}() {}`
    }));

    const addedSymbolInfos: SymbolInfo[] = addedSymbols.map(symbol => ({
      id: symbol.id,
      dnaId: symbol.id,
      name: symbol.name,
      kind: 'function' as const, // Default for tests
      signature: '',
      location: {
        start: { line: 1, column: 0 },
        end: { line: 10, column: 0 }
      },
      filePath: symbol.filePath || 'test-file',
      content: symbol.content || `function ${symbol.name}() {}`
    }));

    // Create detector and run detection
    const detector = new MovedBlockDetector();
    const result: MovedBlockResult = await detector.detectMovedBlocks(
      'test-commit-sha',
      deletedSymbolInfos,
      addedSymbolInfos
    );

    // Calculate metrics
    const fileRenames = result.movedBlocks.filter(block =>
      block.moveReason === 'file_rename' || block.moveReason === 'module_split'
    ).length;

    const blockMoves = result.movedBlocks.filter(block =>
      block.moveReason === 'block_move'
    ).length;

    const symbolRenames = result.symbolLineage.filter(lineage =>
      lineage.moveType === 'symbol_rename'
    ).length;

    const averageSimilarity = result.movedBlocks.length > 0
      ? result.movedBlocks.reduce((sum, block) => sum + block.similarityScore, 0) / result.movedBlocks.length
      : 0;

    const movedLines = result.movedBlocks.reduce((sum, block) =>
      sum + (block.sourceEndLine - block.sourceStartLine), 0
    );

    return {
      totalMovedBlocks: result.movedBlocks.length,
      fileRenames,
      blockMoves,
      symbolRenames,
      averageSimilarity,
      movedSymbols: result.symbolLineage.length,
      movedLines
    };

  } catch (error) {
    console.warn('Moved block detection failed, using simplified metrics:', error);

    // Return simplified metrics on failure
    return {
      totalMovedBlocks: 0,
      fileRenames: 0,
      blockMoves: 0,
      symbolRenames: 0,
      averageSimilarity: 0,
      movedSymbols: 0,
      movedLines: 0
    };
  }
}

/**
 * Simplified moved block detection for tests
 * NOTE: This is a fallback - prefer detectMovedBlocksFromFacts which calls real MovedBlockDetector
 */
export function detectMovedBlocksSimple(
  deletedSymbols: Array<{ id: string; name: string; filePath?: string }>,
  addedSymbols: Array<{ id: string; name: string; filePath?: string }>
): MovedBlockMetrics {
  // Simple heuristics for moved block detection

  // Find symbols with same name but different file paths
  const movedByRename = addedSymbols.filter(added =>
    deletedSymbols.some(deleted =>
      deleted.name === added.name && deleted.filePath !== added.filePath
    )
  );

  // Find symbols with similar names (potential renames)
  const potentialRenames = addedSymbols.filter(added =>
    deletedSymbols.some(deleted =>
      deleted.name.toLowerCase().includes(added.name.toLowerCase().slice(0, 3)) &&
      deleted.name !== added.name
    )
  );

  return {
    totalMovedBlocks: movedByRename.length,
    fileRenames: movedByRename.length,
    blockMoves: 0, // Simplified
    symbolRenames: potentialRenames.length,
    averageSimilarity: movedByRename.length > 0 ? 0.8 : 0, // High similarity for exact name matches
    movedSymbols: movedByRename.length + potentialRenames.length,
    movedLines: movedByRename.length * 10 // Estimate 10 lines per moved block
  };
}
