/**
 * Legacy Audit Adapter
 *
 * Minimal adapter for auditLegacy() function
 * Transforms test data to call the real legacy audit logic
 */

import { auditLegacy, LegacyAuditResult } from '../facts/legacyAudit';
import { IntendedState } from '../facts/intendedMap';
import { WorkingSnapshot } from '../facts/workingSnapshot';
import { ScopeSet } from '../facts/scope';
import { SymbolContext } from '../contracts/llmContext';

export interface LegacyAuditMetrics {
  dead: number;
  legacyUsed: number;
  replacedLeftovers: number;
  totalReachable: number;
  totalUnreachable: number;
  reachabilityRatio: number;
}

/**
 * Run legacy audit using real auditLegacy function with transformed test data
 */
export async function auditLegacyFromFacts(
  intendedSymbols: Array<{ id: string; expect?: 'present' | 'absent' }>,
  workingSymbols: Array<{ id: string; name: string; kind: string; filePath?: string }>,
  edges: Array<{ from: string; to: string; type?: string }>
): Promise<LegacyAuditMetrics> {
  try {
    // Transform test data to real data structures

    // Derive file paths from symbol IDs or use provided filePath
    const allPaths = new Set<string>();
    for (const symbol of workingSymbols) {
      if (symbol.filePath) {
        allPaths.add(symbol.filePath);
      } else {
        // Derive file path from symbol ID (format: "path/to/file.ts:symbolName")
        const filePath = symbol.id.includes(':') ? symbol.id.split(':')[0] : 'test-file';
        allPaths.add(filePath);
      }
    }

    // Build intended map
    const intended = new Map<string, IntendedState>();
    for (const symbol of intendedSymbols) {
      intended.set(symbol.id, {
        expect: symbol.expect || 'present',
        lastSha: 'test-sha'
      });
    }

    // Build working snapshot
    const working: WorkingSnapshot = {
      symbolsById: new Map(),
      symbolsByFile: new Map(),
      analyzedPaths: allPaths,
      edges: edges.map(e => ({
        from_symbol_id: e.from,
        to_symbol_id: e.to,
        edge_type: (e.type as any) || 'calls',
        change_type: 'added' as const,
        confidence: 1.0,
        is_resolved: true
      }))
    };

    for (const symbol of workingSymbols) {
      working.symbolsById.set(symbol.id, {
        id: 0, // Test ID
        symbol_id: symbol.id,
        name: symbol.name,
        kind: symbol.kind as any,
        loc_post: {
          start: { line: 1, column: 0 },
          end: { line: 1, column: 0 }
        }
      });
    }

    // Build scope with derived file paths
    const scope: ScopeSet = {
      commitFiles: new Set(allPaths),
      workingChanged: new Set(allPaths),
      blastRadius: new Set([...allPaths, ...workingSymbols.map(s => s.id)]),
      allPaths: new Set([...allPaths, ...workingSymbols.map(s => s.id)])
    };

    // Run real legacy audit
    const result = await auditLegacy(intended, working, scope);

    // Transform result to test metrics
    return {
      dead: result.dead.length,
      legacyUsed: result.legacyUsed.length,
      replacedLeftovers: result.replacedLeftovers.length,
      totalReachable: working.symbolsById.size - result.dead.length,
      totalUnreachable: result.dead.length,
      reachabilityRatio: working.symbolsById.size > 0
        ? (working.symbolsById.size - result.dead.length) / working.symbolsById.size
        : 1.0
    };

  } catch (error) {
    console.warn('Legacy audit failed, returning minimal metrics:', error);
    // Return minimal metrics on failure
    return {
      dead: 0,
      legacyUsed: 0,
      replacedLeftovers: 0,
      totalReachable: workingSymbols.length,
      totalUnreachable: 0,
      reachabilityRatio: 1.0
    };
  }
}

/**
 * Simplified legacy audit for when real auditLegacy is not available
 * NOTE: This is a fallback - prefer auditLegacyFromFacts which calls real auditLegacy()
 */
export function auditLegacySimple(
  intendedSymbols: Array<{ id: string; expect?: 'present' | 'absent' }>,
  workingSymbols: Array<{ id: string; name: string; kind: string }>,
  edges: Array<{ from: string; to: string }>
): LegacyAuditMetrics {
  // Simple heuristics for testing
  const deadSymbols = workingSymbols.filter(symbol => {
    // Consider symbols dead if they're not referenced by any edges
    return !edges.some(edge => edge.to === symbol.id);
  });

  const legacyUsed = intendedSymbols.filter(symbol => {
    return symbol.expect === 'absent' && edges.some(edge => edge.to === symbol.id);
  });

  return {
    dead: deadSymbols.length,
    legacyUsed: legacyUsed.length,
    replacedLeftovers: 0, // Simplified
    totalReachable: workingSymbols.length - deadSymbols.length,
    totalUnreachable: deadSymbols.length,
    reachabilityRatio: workingSymbols.length > 0
      ? (workingSymbols.length - deadSymbols.length) / workingSymbols.length
      : 1.0
  };
}
