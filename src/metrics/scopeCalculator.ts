/**
 * Scope Calculator
 *
 * Adapter for scope calculation logic
 * Tests file and blast radius scoping
 */

import { ScopeSet } from '../facts/scope';

export interface ScopeMetrics {
  commitFiles: number;
  workingChanged: number;
  blastRadius: number;
  totalFiles: number;
}

/**
 * Calculate scope from commits and symbols
 * Simplified calculation for tests - real scope calculation requires git operations.
 * This provides test metrics based on commit/symbol/edge data.
 */
export function calculateScopeFromFacts(
  commits: Array<{
    files?: string[];
    symbols?: Array<{ id: string; filePath?: string }>;
  }>,
  symbols: Array<{ id: string; filePath?: string }>,
  edges: Array<{ from: string; to: string }>
): ScopeMetrics {
  // Extract commit files
  const commitFiles = new Set<string>();
  for (const commit of commits) {
    if (commit.files) {
      commit.files.forEach(file => commitFiles.add(file));
    }
    if (commit.symbols) {
      commit.symbols.forEach(symbol => {
        if (symbol.filePath) {
          commitFiles.add(symbol.filePath);
        } else {
          // Extract file from symbol ID
          const file = extractFileFromSymbolId(symbol.id);
          if (file) commitFiles.add(file);
        }
      });
    }
  }

  // Working changed files (simplified - assume all symbol files are changed)
  const workingChanged = new Set<string>();
  symbols.forEach(symbol => {
    if (symbol.filePath) {
      workingChanged.add(symbol.filePath);
    } else {
      const file = extractFileFromSymbolId(symbol.id);
      if (file) workingChanged.add(file);
    }
  });

  // Blast radius (simplified - files that have dependencies)
  const blastRadius = new Set<string>();
  const symbolToFile = new Map<string, string>();

  // Build symbol to file mapping
  [...symbols, ...commits.flatMap(c => c.symbols || [])].forEach(symbol => {
    const file = symbol.filePath || extractFileFromSymbolId(symbol.id);
    if (file) symbolToFile.set(symbol.id, file);
  });

  // Add files that have incoming or outgoing edges
  edges.forEach(edge => {
    const fromFile = symbolToFile.get(edge.from);
    const toFile = symbolToFile.get(edge.to);
    if (fromFile) blastRadius.add(fromFile);
    if (toFile) blastRadius.add(toFile);
  });

  // Union of all files
  const allPaths = new Set([...commitFiles, ...workingChanged, ...blastRadius]);

  return {
    commitFiles: commitFiles.size,
    workingChanged: workingChanged.size,
    blastRadius: blastRadius.size,
    totalFiles: allPaths.size
  };
}

/**
 * Extract file path from symbol ID (heuristic)
 */
function extractFileFromSymbolId(symbolId: string): string | null {
  // Symbol IDs are typically like "path/to/file.ts:ClassName" or "path/to/file:functionName"
  const parts = symbolId.split(':');
  if (parts.length >= 2) {
    return parts[0];
  }
  return null;
}

/**
 * Create ScopeSet from metrics
 */
export function createScopeSet(metrics: ScopeMetrics): ScopeSet {
  // Create dummy sets for the interface
  const dummyFiles = Array.from({ length: metrics.commitFiles }, (_, i) => `commit-file-${i}.ts`);
  const dummyWorking = Array.from({ length: metrics.workingChanged }, (_, i) => `working-file-${i}.ts`);
  const dummyBlast = Array.from({ length: metrics.blastRadius }, (_, i) => `blast-file-${i}.ts`);

  return {
    commitFiles: new Set(dummyFiles),
    workingChanged: new Set(dummyWorking),
    blastRadius: new Set(dummyBlast),
    allPaths: new Set([...dummyFiles, ...dummyWorking, ...dummyBlast])
  };
}
