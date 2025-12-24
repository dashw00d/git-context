/**
 * Migration: Add completeness_flags to symbols and files tables
 * Tracks granular completeness per analysis dimension
 */

import { logError, logInfo } from '../../utils/logger';
import { getDatabaseManager } from '../database';

/**
 * Completeness flags for tracking analysis progress per symbol/file
 */
export interface CompletenessFlags {
  /** Symbols extracted */
  symbols: boolean;
  /** Edges extracted */
  edges: boolean;
  /** Hotspots calculated */
  hotspots: boolean;
  /** Drift analysis done */
  drift: boolean;
  /** Legacy audit done */
  legacy: boolean;
  /** Embeddings indexed */
  embeddings: boolean;
  /** LLM analysis done */
  llm: boolean;
}

/**
 * Default (empty) completeness flags
 */
export function defaultCompletenessFlags(): CompletenessFlags {
  return {
    symbols: false,
    edges: false,
    hotspots: false,
    drift: false,
    legacy: false,
    embeddings: false,
    llm: false,
  };
}

/**
 * Migration function to add completeness_flags column
 */
export async function addCompletenessFlags(): Promise<void> {
  const db = getDatabaseManager().getDatabase();

  try {
    // Add completeness_flags column to symbols table as JSON text
    db.run(`
      ALTER TABLE symbols ADD COLUMN completeness_flags TEXT DEFAULT '{}';
    `);
    logInfo('[Migration] Added completeness_flags to symbols table');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Column might already exist
    if (errorMessage.includes('duplicate column') || errorMessage.includes('already exists')) {
      logInfo('[Migration] completeness_flags column already exists in symbols, skipping');
    } else {
      logError(`[Migration] Failed to add completeness_flags to symbols: ${errorMessage}`);
    }
  }

  try {
    // Add completeness_flags to files table (file-level completeness)
    db.run(`
      ALTER TABLE files ADD COLUMN completeness_flags TEXT DEFAULT '{}';
    `);
    logInfo('[Migration] Added completeness_flags to files table');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('duplicate column') || errorMessage.includes('already exists')) {
      logInfo('[Migration] completeness_flags column already exists in files, skipping');
    } else {
      logError(`[Migration] Failed to add completeness_flags to files: ${errorMessage}`);
    }
  }
}

/**
 * Parse completeness flags from JSON string
 */
export function parseCompletenessFlags(flagsJson: string | null): CompletenessFlags {
  if (!flagsJson) {
    return defaultCompletenessFlags();
  }

  try {
    const parsed = JSON.parse(flagsJson);
    return {
      symbols: parsed.symbols ?? false,
      edges: parsed.edges ?? false,
      hotspots: parsed.hotspots ?? false,
      drift: parsed.drift ?? false,
      legacy: parsed.legacy ?? false,
      embeddings: parsed.embeddings ?? false,
      llm: parsed.llm ?? false,
    };
  } catch {
    return defaultCompletenessFlags();
  }
}

/**
 * Serialize completeness flags to JSON string
 */
export function serializeCompletenessFlags(flags: Partial<CompletenessFlags>): string {
  return JSON.stringify({
    symbols: flags.symbols ?? false,
    edges: flags.edges ?? false,
    hotspots: flags.hotspots ?? false,
    drift: flags.drift ?? false,
    legacy: flags.legacy ?? false,
    embeddings: flags.embeddings ?? false,
    llm: flags.llm ?? false,
  });
}
