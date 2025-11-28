import { getDatabaseManager } from '../storage/database';

export interface IntendedState {
  expect: 'present' | 'absent';
  lastName?: string;
  lastPath?: string;
  lastSig?: string;
  lastSha: string;
  isRenamed?: boolean; // Indicates if this symbol was renamed
}

/**
 * Build intended refactor map by folding selected commits oldest→newest, respecting renames
 */
export async function buildIntendedMap(commitShas: string[]): Promise<Map<string, IntendedState>> {
  const db = getDatabaseManager().getDatabase();

  // Sort SHAs oldest → newest (reverse chronological order)
  const placeholders = commitShas.map(() => '?').join(',');
  const shaOrderStmt = db.prepare(`
    SELECT sha FROM commits_metadata
    WHERE sha IN (${placeholders})
    ORDER BY date ASC
  `);
  const orderedShas = shaOrderStmt.all(...commitShas).map((row: any) => row.sha);

  const intended = new Map<string, IntendedState>();

  for (const sha of orderedShas) {
    // Load symbol deltas for this commit
    const symbolsStmt = db.prepare(`
      SELECT symbol_id, name, path, signature_post, signature_pre, change_type, mod_reason
      FROM symbols WHERE sha = ?
    `);
    const symbols = symbolsStmt.all(sha) as any[];

    // Load renames from renames table
    const renamesStmt = db.prepare(`
      SELECT old_symbol_id, new_symbol_id, old_name, new_name, confidence
      FROM renames WHERE sha = ?
    `);
    const renames = renamesStmt.all(sha) as any[];

    // Process additions/modifications
    for (const symbol of symbols) {
      const key = symbol.symbol_id || `${symbol.path}:${symbol.kind}:${symbol.name}`;

      if (symbol.change_type === 'added') {
        intended.set(key, {
          expect: 'present',
          lastName: symbol.name,
          lastPath: symbol.path,
          lastSig: symbol.signature_post || symbol.signature_pre,
          lastSha: sha
        });
      } else if (symbol.change_type === 'modified') {
        const prev = intended.get(key);
        intended.set(key, {
          expect: 'present',
          lastName: symbol.name,
          lastPath: symbol.path,
          lastSig: symbol.signature_post || symbol.signature_pre,
          lastSha: sha
        });
      }
    }

    // Process renames - treat as continuity (not delete+add)
    // Create a set of renamed old symbol IDs to skip them in removals
    const renamedOldIds = new Set<string>();
    for (const rename of renames) {
      const oldKey = rename.old_symbol_id;
      const newKey = rename.new_symbol_id;
      renamedOldIds.add(oldKey);

      // If the old symbol was intended to be present, map it to the new symbol
      const oldState = intended.get(oldKey);
      if (oldState && oldState.expect === 'present') {
        // Remove the old symbol entry
        intended.delete(oldKey);
        
        // Set new symbol as present, marking it as renamed
        intended.set(newKey, {
          expect: 'present',
          lastName: rename.new_name,
          lastPath: rename.new_symbol_id.split(':')[0], // Extract path from symbol ID
          lastSig: oldState.lastSig, // Preserve signature from old state
          lastSha: sha,
          isRenamed: true // Mark as renamed
        });
      } else {
        // Old symbol wasn't in intended map yet, just add the new one
        intended.set(newKey, {
          expect: 'present',
          lastName: rename.new_name,
          lastPath: rename.new_symbol_id.split(':')[0],
          lastSha: sha,
          isRenamed: true
        });
      }
    }

    // Process removals (but skip symbols that were renamed)
    for (const symbol of symbols) {
      if (symbol.change_type === 'removed') {
        const key = symbol.symbol_id || `${symbol.path}:${symbol.kind}:${symbol.name}`;
        
        // Skip if this symbol was renamed (continuity, not removal)
        if (renamedOldIds.has(key)) {
          continue;
        }
        
        intended.set(key, {
          expect: 'absent',
          lastSha: sha
        });
      }
    }
  }

  // Log rename continuity summary
  const renamedCount = Array.from(intended.values()).filter(s => s.isRenamed).length;
  console.log(`Intended map: ${intended.size} symbols, ${renamedCount} renamed`);

  // Fallback: if intended is empty, use hotspots and moved blocks to infer baseline
  if (intended.size === 0 && commitShas.length > 0) {
    console.log(`[IntendedMap] Intended map is empty, using fallback heuristics from hotspots and moved blocks`);
    const fallbackIntended = await buildIntendedMapFallback(commitShas, db);
    for (const [key, state] of fallbackIntended) {
      intended.set(key, state);
    }
    console.log(`[IntendedMap] Fallback added ${fallbackIntended.size} symbols from hotspots/moved blocks`);
  }

  if (intended.size === 0) {
    console.warn(`[IntendedMap] WARNING: Intended map is still empty after fallback. No symbols found in commits.`);
  }

  return intended;
}

/**
 * Fallback: Build intended map from hotspots (high churn = divergent) and moved blocks (DNA continuity)
 */
async function buildIntendedMapFallback(
  commitShas: string[],
  db: any
): Promise<Map<string, IntendedState>> {
  const intended = new Map<string, IntendedState>();
  const churnThreshold = 40; // Hotspot score threshold for high churn

  // Get hotspot symbols with high churn (likely divergent/refactored)
  const hotspotStmt = db.prepare(`
    SELECT DISTINCT sh.symbol_id, sh.file_path, sh.symbol_name, sh.hotspot_score
    FROM symbol_hotspots sh
    WHERE sh.hotspot_score >= ?
    ORDER BY sh.hotspot_score DESC
    LIMIT 100
  `);
  const hotspots = hotspotStmt.all(churnThreshold) as any[];

  for (const hotspot of hotspots) {
    const key = hotspot.symbol_id;
    if (!intended.has(key)) {
      intended.set(key, {
        expect: 'present',
        lastName: hotspot.symbol_name,
        lastPath: hotspot.file_path,
        lastSha: commitShas[commitShas.length - 1] || 'unknown'
      });
    }
  }

  // Get moved blocks to infer DNA continuity (symbols that moved = present)
  const movedStmt = db.prepare(`
    SELECT DISTINCT dest_symbol_id, dest_file
    FROM moved_blocks
    WHERE commit_sha IN (${commitShas.map(() => '?').join(',')})
    AND dest_symbol_id IS NOT NULL
  `);
  const movedBlocks = movedStmt.all(...commitShas) as any[];

  for (const move of movedBlocks) {
    const key = move.dest_symbol_id;
    if (!intended.has(key)) {
      intended.set(key, {
        expect: 'present',
        lastPath: move.dest_file,
        lastSha: commitShas[commitShas.length - 1] || 'unknown',
        isRenamed: true // Moved blocks indicate continuity/rename
      });
    }
  }

  return intended;
}
