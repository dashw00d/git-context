/**
 * Incompleteness Detector Adapter
 *
 * Adapter for incompleteness detection using simplified logic
 * Based on patterns from driftDetector.ts but adapted for test data.
 */

export interface IncompletenessMetrics {
  missingSymbols: number;
  zombieSymbols: number;
  divergentSymbols: number;
  incompleteMigrations: number;
  migrationProgress: number;
  deadSymbols: number;
  suggestedConsolidations: number;
}

/**
 * Detect incompleteness from symbol and edge data
 */
export function detectIncompletenessFromFacts(
  symbols: Array<{ id: string; zombie?: boolean; status: string }>,
  edges: Array<{ from: string; to: string }>
): IncompletenessMetrics {
  // Detect missing symbols (edges pointing to non-existent symbols)
  const knownSymbolIds = new Set(symbols.map(s => s.id));
  const missingSymbols = new Set<string>();

  for (const edge of edges) {
    if (!knownSymbolIds.has(edge.to)) {
      missingSymbols.add(edge.to);
    }
  }

  // Detect zombie symbols (explicitly marked as zombies)
  const zombieSymbols = symbols.filter(s => s.zombie === true).length;

  // Detect divergent symbols (versioned or duplicate implementations)
  const divergentSymbols = detectDivergentSymbols(symbols);

  // Detect incomplete migrations
  const incompleteMigrations = detectIncompleteMigrations(symbols, edges);

  // Calculate migration progress
  const migrationProgress = symbols.filter(s => s.status === 'added').length / Math.max(1, symbols.length);

  // Detect dead symbols (defined but never referenced)
  const referencedSymbols = new Set<string>();
  for (const edge of edges) {
    referencedSymbols.add(edge.to);
  }
  const deadSymbols = symbols.filter(s => !referencedSymbols.has(s.id)).length;

  // Detect suggested consolidations (duplicate name patterns)
  const suggestedConsolidations = detectSuggestedConsolidations(symbols);

  return {
    missingSymbols: missingSymbols.size,
    zombieSymbols,
    divergentSymbols,
    incompleteMigrations,
    migrationProgress,
    deadSymbols,
    suggestedConsolidations
  };
}

function detectDivergentSymbols(symbols: Array<{ id: string; zombie?: boolean; status: string }>): number {
  // Detect symbols with version/duplicate indicators
  const versionPatterns = [
    /v\d+/i,           // V1, V2, v3
    /version\d+/i,     // version1, version2
    /old|new/i,        // Old/New prefix
    /legacy/i,         // Legacy prefix
    /\d+$/,            // Trailing numbers: validateEmail1, validateEmail2
  ];

  // Also detect similar function names that might be duplicates
  const nameGroups = new Map<string, any[]>();

  for (const symbol of symbols) {
    // Check if symbol has version/duplicate indicators
    const hasVersionPattern = versionPatterns.some(pattern => pattern.test(symbol.id));

    if (hasVersionPattern) {
      // This symbol is explicitly versioned/duplicated
      continue; // Will be counted later
    }

    // Group by base name to detect implicit duplicates
    // Only group functions/methods with similar base names
    if (symbol.id.includes('validate') || symbol.id.includes('check') || symbol.id.includes('is')) {
      const basePattern = symbol.id.toLowerCase().replace(/email|user|valid|ok|good/gi, '').trim();
      if (basePattern.length > 0) {
        if (!nameGroups.has(basePattern)) {
          nameGroups.set(basePattern, []);
        }
        nameGroups.get(basePattern)!.push(symbol);
      }
    }
  }

  // Count symbols with explicit version patterns
  const versionedSymbols = symbols.filter(s =>
    versionPatterns.some(pattern => pattern.test(s.id))
  ).length;

  // Count symbols in duplicate name groups (need 2+ members)
  let duplicateCount = 0;
  for (const group of nameGroups.values()) {
    if (group.length > 1) {
      duplicateCount += group.length;
    }
  }

  return versionedSymbols + duplicateCount;
}

function detectIncompleteMigrations(
  symbols: Array<{ id: string; zombie?: boolean; status: string }>,
  edges: Array<{ from: string; to: string }>
): number {
  // Look for patterns where old and new versions of the same thing exist
  const migrationPatterns = [
    { old: 'V1', new: 'V2' },
    { old: 'Legacy', new: 'New' },
    { old: 'Old', new: 'New' }
  ];

  let incompleteCount = 0;

  for (const pattern of migrationPatterns) {
    const oldSymbols = symbols.filter(s =>
      s.id.includes(pattern.old) && s.status === 'modified'
    );
    const newSymbols = symbols.filter(s =>
      s.id.includes(pattern.new) && s.status === 'added'
    );

    if (oldSymbols.length > 0 && newSymbols.length > 0) {
      // Check if old symbols are still being used
      const stillUsed = oldSymbols.some(oldSym =>
        edges.some((edge: any) => edge.to === oldSym.id)
      );

      if (stillUsed) {
        incompleteCount++;
      }
    }
  }

  return incompleteCount;
}

function detectSuggestedConsolidations(symbols: Array<{ id: string; zombie?: boolean; status: string }>): number {
  // Count divergent symbol groups that could be consolidated
  const nameGroups = new Map<string, any[]>();

  for (const symbol of symbols) {
    const baseName = symbol.id.toLowerCase().replace(/\d+$/, '').replace(/v\d+$/, '');
    if (!nameGroups.has(baseName)) {
      nameGroups.set(baseName, []);
    }
    nameGroups.get(baseName)!.push(symbol);
  }

  // Count groups with multiple members (potential consolidations)
  let consolidationCount = 0;
  for (const group of nameGroups.values()) {
    if (group.length > 1) {
      consolidationCount++;
    }
  }

  return consolidationCount;
}
