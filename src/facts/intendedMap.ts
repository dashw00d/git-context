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

  return intended;
}
