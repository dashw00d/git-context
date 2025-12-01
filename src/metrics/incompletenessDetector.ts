/**
 * Incompleteness Detector Adapter
 *
 * Adapter for incompleteness detection using DriftDetector V2
 * This adapter transforms test data to call the same detector used by driftStep.ts
 *
 * NOTE: Tests in benchmarks/mocks/metrics/incompleteness.test.ts may call detectDrift() directly.
 * This adapter uses V2 detector for consistency with the pipeline.
 */

import { EdgeContext, SymbolContext } from '../contracts/llmContext';
import { DriftDetector } from '../facts/driftDetector';
import { IntendedState } from '../facts/intendedMap';
import { WorkingSnapshot } from '../facts/workingSnapshot';

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
 * Detect incompleteness from symbol and edge data using DriftDetector V2
 * This calls the same detector used by driftStep.ts in the runner
 */
export async function detectIncompletenessFromFacts(
  symbols: Array<{
    id: string;
    zombie?: boolean;
    status: string;
    filePath?: string;
    type?: string;
    lineNumber?: number;
  }>,
  edges: Array<{ from: string; to: string; type?: string; confidence?: number }>
): Promise<IncompletenessMetrics> {
  // Transform test data to IntendedState and WorkingSnapshot format
  const intended = new Map<string, IntendedState>();
  const workingSymbols = new Map<string, SymbolContext>();
  const workingSymbolsByFile = new Map<string, SymbolContext[]>();

  // Build intended map and working snapshot from test symbols
  for (const symbol of symbols) {
    const key = symbol.id;
    const filePath = symbol.filePath || 'test.ts';

    const symbolContext: SymbolContext = {
      id: 0,
      symbol_id: key,
      name: key.split('.').pop() || key,
      kind: (symbol.type as any) || 'function',
      signature: '',
      loc_post: {
        start: { line: symbol.lineNumber || 0, column: 0 },
        end: { line: symbol.lineNumber || 0, column: 0 },
      },
    };

    if (symbol.status === 'added' || symbol.status === 'modified') {
      intended.set(key, {
        expect: 'present',
        lastSha: 'test-sha',
      });
      workingSymbols.set(key, symbolContext);

      if (!workingSymbolsByFile.has(filePath)) {
        workingSymbolsByFile.set(filePath, []);
      }
      workingSymbolsByFile.get(filePath)!.push(symbolContext);
    } else if (symbol.status === 'removed') {
      intended.set(key, {
        expect: 'absent',
        lastSha: 'test-sha',
      });
    }

    // Zombie symbols: should be absent but still exist in working
    if (symbol.zombie === true) {
      intended.set(key, {
        expect: 'absent',
        lastSha: 'test-sha',
      });
      workingSymbols.set(key, symbolContext);

      if (!workingSymbolsByFile.has(filePath)) {
        workingSymbolsByFile.set(filePath, []);
      }
      workingSymbolsByFile.get(filePath)!.push(symbolContext);
    }
  }

  // Build working snapshot
  const working: WorkingSnapshot = {
    symbolsById: workingSymbols,
    symbolsByFile: workingSymbolsByFile,
    edges: edges.map(e => ({
      from_symbol_id: e.from,
      to_symbol_id: e.to,
      edge_type: (e.type || 'calls') as any,
      confidence: e.confidence || 1.0,
      change_type: 'added' as const,
      is_resolved: true,
    })) as EdgeContext[],
    analyzedPaths: new Set(Array.from(workingSymbolsByFile.keys())),
  };

  // Use V2 detector with BaseDetector enhancements (same as driftStep.ts)
  const driftDetector = new DriftDetector();
  const driftFindings = await driftDetector.detect({
    intended,
    working,
    commitShas: undefined, // Test data doesn't have commit SHAs
  });

  // Transform drift findings to test metrics
  const missingSymbols = driftFindings.missing_symbols.length;
  const zombieSymbols = driftFindings.zombie_symbols.length;
  const divergentSymbols = driftFindings.divergent_symbols.length;

  // Additional test-specific metrics (not provided by detectDrift)
  const knownSymbolIds = new Set(symbols.map(s => s.id));
  const missingDependencies = new Set<string>();
  for (const edge of edges) {
    if (!knownSymbolIds.has(edge.to)) {
      missingDependencies.add(edge.to);
    }
  }

  // Detect incomplete migrations (test-specific heuristic)
  const incompleteMigrations = detectIncompleteMigrations(symbols, edges);

  // Calculate migration progress
  const migrationProgress =
    symbols.filter(s => s.status === 'added').length / Math.max(1, symbols.length);

  // Detect dead symbols (defined but never referenced)
  const referencedSymbols = new Set<string>();
  for (const edge of edges) {
    referencedSymbols.add(edge.to);
  }
  const deadSymbols = symbols.filter(s => !referencedSymbols.has(s.id)).length;

  // Detect suggested consolidations (duplicate name patterns)
  const suggestedConsolidations = detectSuggestedConsolidations(symbols);

  return {
    missingSymbols: missingSymbols + missingDependencies.size, // Combine drift missing + test-specific missing deps
    zombieSymbols,
    divergentSymbols,
    incompleteMigrations,
    migrationProgress,
    deadSymbols,
    suggestedConsolidations,
  };
}

/**
 * Test-specific helper: Detect incomplete migrations
 * NOTE: This is a simplified heuristic. Real migration detection would use DriftDetector V2 findings.
 */
function detectIncompleteMigrations(
  symbols: Array<{ id: string; zombie?: boolean; status: string }>,
  edges: Array<{ from: string; to: string }>
): number {
  // Look for patterns where old and new versions of the same thing exist
  const migrationPatterns = [
    { old: 'V1', new: 'V2' },
    { old: 'Legacy', new: 'New' },
    { old: 'Old', new: 'New' },
  ];

  let incompleteCount = 0;

  for (const pattern of migrationPatterns) {
    const oldSymbols = symbols.filter(s => s.id.includes(pattern.old) && s.status === 'modified');
    const newSymbols = symbols.filter(s => s.id.includes(pattern.new) && s.status === 'added');

    if (oldSymbols.length > 0 && newSymbols.length > 0) {
      // Check if old symbols are still being used
      const stillUsed = oldSymbols.some(oldSym => edges.some((edge: any) => edge.to === oldSym.id));

      if (stillUsed) {
        incompleteCount++;
      }
    }
  }

  return incompleteCount;
}

/**
 * Test-specific helper: Detect suggested consolidations
 * NOTE: This is a simplified heuristic for test metrics.
 */
function detectSuggestedConsolidations(
  symbols: Array<{ id: string; zombie?: boolean; status: string }>
): number {
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
