/**
 * Completeness tracking utilities
 * Manages granular completeness flags for symbols and files
 */

import { getDatabaseManager } from '../../storage/database';
import {
  CompletenessFlags,
  parseCompletenessFlags,
  serializeCompletenessFlags,
} from '../../storage/migrations/add_completeness_flags';
import { prepare } from '../../storage/statement-wrapper';
import { logDebug, logWarn } from '../../utils/logger';

/**
 * Get completeness flags for a symbol
 */
export function getSymbolCompleteness(sha: string, dnaId: string): CompletenessFlags {
  try {
    const db = getDatabaseManager().getDatabase();
    const stmt = prepare('SELECT completeness_flags FROM symbols WHERE sha = ? AND dna_id = ?');
    const row = stmt.get(sha, dnaId) as { completeness_flags: string } | undefined;
    stmt.free?.();

    if (!row) {
      return parseCompletenessFlags(null);
    }

    return parseCompletenessFlags(row.completeness_flags);
  } catch (error) {
    logWarn(`[Completeness] Failed to get symbol completeness for ${dnaId}: ${error}`);
    return parseCompletenessFlags(null);
  }
}

/**
 * Update completeness flags for a symbol
 */
export function updateSymbolCompleteness(
  sha: string,
  dnaId: string,
  flags: Partial<CompletenessFlags>
): void {
  try {
    const current = getSymbolCompleteness(sha, dnaId);
    const updated: CompletenessFlags = {
      ...current,
      ...flags,
    };

    const stmt = prepare('UPDATE symbols SET completeness_flags = ? WHERE sha = ? AND dna_id = ?');
    stmt.run(serializeCompletenessFlags(updated), sha, dnaId);
    stmt.free?.();

    logDebug(
      `[Completeness] Updated flags for ${dnaId}@${sha.substring(0, 8)}: ${JSON.stringify(flags)}`
    );
  } catch (error) {
    logWarn(`[Completeness] Failed to update symbol completeness for ${dnaId}: ${error}`);
  }
}

/**
 * Bulk update completeness flags for multiple symbols
 */
export function bulkUpdateSymbolCompleteness(
  sha: string,
  dnaIds: string[],
  flags: Partial<CompletenessFlags>
): void {
  if (dnaIds.length === 0) return;

  try {
    const db = getDatabaseManager().getDatabase();

    // Strategy: Fetch all current flags for these dnaIds, merge with new flags,
    // and then update in batches. This avoids the N+1 SELECT/UPDATE pattern.
    // However, since we usually update the same dimensions for all symbols in a batch,
    // we can optimize if we assume the initial state is similar or if we don't mind
    // fetching current state first.

    db.run('BEGIN TRANSACTION');
    try {
      // Fetch current flags for all symbols in this batch
      const placeholders = dnaIds.map(() => '?').join(',');
      const selectStmt = prepare(
        `SELECT dna_id, completeness_flags FROM symbols WHERE sha = ? AND dna_id IN (${placeholders})`
      );
      const rows = selectStmt.all(sha, ...dnaIds) as Array<{
        dna_id: string;
        completeness_flags: string;
      }>;
      selectStmt.free?.();

      const updateStmt = prepare(
        'UPDATE symbols SET completeness_flags = ? WHERE sha = ? AND dna_id = ?'
      );
      for (const row of rows) {
        const current = parseCompletenessFlags(row.completeness_flags);
        const updated = serializeCompletenessFlags({ ...current, ...flags });
        updateStmt.run(updated, sha, row.dna_id);
      }
      updateStmt.free?.();
      db.run('COMMIT');
    } catch (err) {
      db.run('ROLLBACK');
      logWarn(`[Completeness] Transaction failed during bulk update: ${err}`);
      // Don't throw - return gracefully (best-effort)
      return;
    }

    logDebug(
      `[Completeness] Bulk updated ${dnaIds.length} symbols for ${sha.substring(0, 8)}: ${JSON.stringify(flags)}`
    );
  } catch (error) {
    logWarn(`[Completeness] Failed to bulk update symbol completeness: ${error}`);
  }
}

/**
 * Get symbols that need specific analysis dimension
 * @param dimension The completeness dimension to check
 * @param sha Optional commit SHA to filter by
 */
export function getIncompleteSymbols(
  dimension: keyof CompletenessFlags,
  sha?: string
): Array<{ sha: string; dna_id: string; path: string }> {
  try {
    // SQLite JSON functions may not be available in sql.js
    // Fall back to fetching all and filtering in JS
    let query = 'SELECT sha, dna_id, path, completeness_flags FROM symbols';
    if (sha) {
      query += ' WHERE sha = ?';
    }

    const stmt = prepare(query);
    const results = sha ? stmt.all(sha) : stmt.all();
    stmt.free?.();

    // Filter in JS since JSON_EXTRACT may not be available
    return (
      results as Array<{ sha: string; dna_id: string; path: string; completeness_flags: string }>
    )
      .filter(row => {
        const flags = parseCompletenessFlags(row.completeness_flags);
        return !flags[dimension];
      })
      .map(({ sha, dna_id, path }) => ({ sha, dna_id, path }));
  } catch (error) {
    logWarn(`[Completeness] Failed to get incomplete symbols: ${error}`);
    return [];
  }
}

/**
 * Get file-level completeness
 */
export function getFileCompleteness(sha: string, path: string): CompletenessFlags {
  try {
    const stmt = prepare('SELECT completeness_flags FROM files WHERE sha = ? AND path = ?');
    const row = stmt.get(sha, path) as { completeness_flags: string } | undefined;
    stmt.free?.();

    if (!row) {
      return parseCompletenessFlags(null);
    }

    return parseCompletenessFlags(row.completeness_flags);
  } catch (error) {
    logWarn(`[Completeness] Failed to get file completeness for ${path}: ${error}`);
    return parseCompletenessFlags(null);
  }
}

/**
 * Update file-level completeness
 */
export function updateFileCompleteness(
  sha: string,
  path: string,
  flags: Partial<CompletenessFlags>
): void {
  try {
    const current = getFileCompleteness(sha, path);
    const updated: CompletenessFlags = {
      ...current,
      ...flags,
    };

    const stmt = prepare('UPDATE files SET completeness_flags = ? WHERE sha = ? AND path = ?');
    stmt.run(serializeCompletenessFlags(updated), sha, path);
    stmt.free?.();

    logDebug(
      `[Completeness] Updated file flags for ${path}@${sha.substring(0, 8)}: ${JSON.stringify(flags)}`
    );
  } catch (error) {
    logWarn(`[Completeness] Failed to update file completeness for ${path}: ${error}`);
  }
}

/**
 * Check if a symbol has all required completeness flags
 */
export function isSymbolComplete(
  sha: string,
  dnaId: string,
  requiredDimensions: Array<keyof CompletenessFlags>
): boolean {
  const flags = getSymbolCompleteness(sha, dnaId);
  return requiredDimensions.every(dim => flags[dim]);
}

/**
 * Check if a file has all required completeness flags
 */
export function isFileComplete(
  sha: string,
  path: string,
  requiredDimensions: Array<keyof CompletenessFlags>
): boolean {
  const flags = getFileCompleteness(sha, path);
  return requiredDimensions.every(dim => flags[dim]);
}
