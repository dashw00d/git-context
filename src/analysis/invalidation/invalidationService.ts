/**
 * Invalidation Service
 * Handles invalidation of stale data from database and embeddings
 * when files change between scans
 */

import { prepare } from '../../storage/statement-wrapper';
import { logDebug, logInfo, logWarn } from '../../utils/logger';

/**
 * Options for invalidation operations
 */
export interface InvalidationOptions {
  /** Also invalidate Qdrant embeddings */
  invalidateEmbeddings?: boolean;
  /** Mark as stale instead of deleting */
  markStale?: boolean;
  /** Cascade invalidation to dependent symbols */
  cascade?: boolean;
}

/**
 * Result of an invalidation operation
 */
export interface InvalidationResult {
  /** Number of symbols invalidated */
  symbolsInvalidated: number;
  /** Number of edges invalidated */
  edgesInvalidated: number;
  /** Number of dependents marked stale */
  dependentsMarkedStale: number;
}

/**
 * Reset commit analysis status to force re-indexing
 * This ensures the pipeline won't skip re-indexing when symbols have been invalidated
 */
async function resetCommitAnalysisStatus(sha: string): Promise<void> {
  try {
    // Reset commit analysis status to 'pending' so it will be re-indexed
    const stmt = prepare(`
      UPDATE commits_analysis
      SET status = 'pending',
          symbols_added = 0,
          symbols_modified = 0,
          symbols_removed = 0,
          edges_added = 0,
          edges_removed = 0
      WHERE sha = ?
    `);
    stmt.run(sha);
    stmt.free?.();

    logDebug(`[Invalidation] Reset analysis status for commit ${sha.substring(0, 8)}`);
  } catch (error) {
    logWarn(`[Invalidation] Error resetting commit status: ${error}`);
  }
}

/**
 * Invalidate symbols for a specific file at a specific commit
 */
export async function invalidateFileSymbols(
  sha: string,
  filePath: string,
  options: InvalidationOptions = {}
): Promise<InvalidationResult> {
  const result: InvalidationResult = {
    symbolsInvalidated: 0,
    edgesInvalidated: 0,
    dependentsMarkedStale: 0,
  };

  try {
    logInfo(`[Invalidation] Invalidating symbols for ${filePath}@${sha.substring(0, 8)}`);

    if (options.markStale) {
      // Mark as stale instead of deleting
      result.symbolsInvalidated = await markFileSymbolsStale(sha, filePath);
    } else {
      // Delete symbols and edges
      const deleteResult = await deleteFileSymbols(sha, filePath);
      result.symbolsInvalidated = deleteResult.symbols;
      result.edgesInvalidated = deleteResult.edges;
    }

    // Reset commit analysis status so pipeline will re-index
    // This is critical: if we invalidate file-level data, the commit needs re-analysis
    await resetCommitAnalysisStatus(sha);

    // Cascade invalidation if requested
    if (options.cascade) {
      result.dependentsMarkedStale = await cascadeInvalidation(sha, filePath);
    }

    logDebug(
      `[Invalidation] Completed: ${result.symbolsInvalidated} symbols, ${result.edgesInvalidated} edges`
    );
  } catch (error) {
    logWarn(`[Invalidation] Error invalidating ${filePath}: ${error}`);
  }

  return result;
}

/**
 * Mark file symbols as stale (reset completeness flags)
 */
async function markFileSymbolsStale(sha: string, filePath: string): Promise<number> {
  try {
    const stmt = prepare(`
      UPDATE symbols
      SET completeness_flags = '{}'
      WHERE sha = ? AND path = ?
    `);
    const result = stmt.run(sha, filePath);
    stmt.free?.();

    // Also mark file as stale
    const fileStmt = prepare(`
      UPDATE files
      SET completeness_flags = '{}'
      WHERE sha = ? AND path = ?
    `);
    fileStmt.run(sha, filePath);
    fileStmt.free?.();

    return typeof result === 'object' && 'changes' in result
      ? (result as { changes: number }).changes
      : 0;
  } catch (error) {
    logWarn(`[Invalidation] Error marking symbols stale: ${error}`);
    return 0;
  }
}

/**
 * Delete file symbols and associated edges
 */
async function deleteFileSymbols(
  sha: string,
  filePath: string
): Promise<{ symbols: number; edges: number }> {
  try {
    let edgesDeleted = 0;

    // Delete edges that reference symbols in this file using a single set-based operation
    const edgeStmt = prepare(`
      DELETE FROM edges
      WHERE sha = ?
      AND (
        from_symbol_id IN (SELECT dna_id FROM symbols WHERE sha = ? AND path = ?)
        OR to_symbol_id IN (SELECT dna_id FROM symbols WHERE sha = ? AND path = ?)
      )
    `);
    const result = edgeStmt.run(sha, sha, filePath, sha, filePath);
    edgeStmt.free?.();
    if (typeof result === 'object' && 'changes' in result) {
      edgesDeleted = (result as { changes: number }).changes;
    }

    // Delete symbols
    const deleteStmt = prepare(`
      DELETE FROM symbols WHERE sha = ? AND path = ?
    `);
    const symResult = deleteStmt.run(sha, filePath);
    deleteStmt.free?.();

    const symbolsDeleted =
      typeof symResult === 'object' && 'changes' in symResult
        ? (symResult as { changes: number }).changes
        : 0;

    return { symbols: symbolsDeleted, edges: edgesDeleted };
  } catch (error) {
    logWarn(`[Invalidation] Error deleting symbols: ${error}`);
    return { symbols: 0, edges: 0 };
  }
}

/**
 * Cascade invalidation to dependent symbols
 * When a symbol is invalidated, mark symbols that depend on it as stale
 */
async function cascadeInvalidation(sha: string, filePath: string): Promise<number> {
  try {
    // Get symbols from this file
    const symbolStmt = prepare(`
      SELECT dna_id FROM symbols WHERE sha = ? AND path = ?
    `);
    const symbols = symbolStmt.all(sha, filePath) as Array<{ dna_id: string }>;
    symbolStmt.free?.();

    if (symbols.length === 0) {
      return 0;
    }

    let dependentsMarked = 0;

    // Find and mark symbols that depend on these
    for (const symbol of symbols) {
      const dependentStmt = prepare(`
        SELECT DISTINCT from_symbol_id as dna_id
        FROM edges
        WHERE sha = ? AND to_symbol_id = ?
      `);
      const dependents = dependentStmt.all(sha, symbol.dna_id) as Array<{ dna_id: string }>;
      dependentStmt.free?.();

      // Mark dependents as needing re-analysis
      for (const dependent of dependents) {
        const updateStmt = prepare(`
          UPDATE symbols
          SET completeness_flags = '{}'
          WHERE sha = ? AND dna_id = ?
        `);
        updateStmt.run(sha, dependent.dna_id);
        updateStmt.free?.();
        dependentsMarked++;

        logDebug(`[Invalidation] Marked dependent symbol ${dependent.dna_id} as stale`);
      }
    }

    return dependentsMarked;
  } catch (error) {
    logWarn(`[Invalidation] Error cascading invalidation: ${error}`);
    return 0;
  }
}

/**
 * Invalidate all symbols for a commit
 */
export async function invalidateCommit(
  sha: string,
  options: InvalidationOptions = {}
): Promise<InvalidationResult> {
  const result: InvalidationResult = {
    symbolsInvalidated: 0,
    edgesInvalidated: 0,
    dependentsMarkedStale: 0,
  };

  try {
    logInfo(`[Invalidation] Invalidating all symbols for commit ${sha.substring(0, 8)}`);

    if (options.markStale) {
      const stmt = prepare(`
        UPDATE symbols SET completeness_flags = '{}' WHERE sha = ?
      `);
      const updateResult = stmt.run(sha);
      stmt.free?.();
      result.symbolsInvalidated =
        typeof updateResult === 'object' && 'changes' in updateResult
          ? (updateResult as { changes: number }).changes
          : 0;
    } else {
      // Delete all symbols and edges for this commit
      const edgeStmt = prepare(`DELETE FROM edges WHERE sha = ?`);
      const edgeResult = edgeStmt.run(sha);
      edgeStmt.free?.();
      result.edgesInvalidated =
        typeof edgeResult === 'object' && 'changes' in edgeResult
          ? (edgeResult as { changes: number }).changes
          : 0;

      const symbolStmt = prepare(`DELETE FROM symbols WHERE sha = ?`);
      const symbolResult = symbolStmt.run(sha);
      symbolStmt.free?.();
      result.symbolsInvalidated =
        typeof symbolResult === 'object' && 'changes' in symbolResult
          ? (symbolResult as { changes: number }).changes
          : 0;
    }

    // Reset commit analysis status so pipeline will re-index
    await resetCommitAnalysisStatus(sha);

    logDebug(
      `[Invalidation] Invalidated commit: ${result.symbolsInvalidated} symbols, ${result.edgesInvalidated} edges`
    );
  } catch (error) {
    logWarn(`[Invalidation] Error invalidating commit: ${error}`);
  }

  return result;
}

/**
 * Check if a file needs re-analysis based on completeness
 */
export function isFileStale(sha: string, filePath: string): boolean {
  try {
    const stmt = prepare(`
      SELECT completeness_flags FROM symbols
      WHERE sha = ? AND path = ?
      LIMIT 1
    `);
    const row = stmt.get(sha, filePath) as { completeness_flags: string } | undefined;
    stmt.free?.();

    if (!row) {
      return true; // No symbols found = stale
    }

    // Check if completeness_flags is empty or not set
    if (!row.completeness_flags || row.completeness_flags === '{}') {
      return true;
    }

    try {
      const flags = JSON.parse(row.completeness_flags);
      return !flags.symbols; // Stale if symbols not extracted
    } catch {
      return true;
    }
  } catch (error) {
    logWarn(`[Invalidation] Error checking staleness: ${error}`);
    return true;
  }
}
