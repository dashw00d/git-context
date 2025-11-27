/**
 * Scope Calculator
 *
 * TEST-ONLY ADAPTER: Simplified scope calculation for tests
 *
 * IMPORTANT: This is a simplified version for test fixtures that don't have database/git access.
 * The real pipeline uses computeScope() from facts/scope.ts (called by scopeStep.ts).
 *
 * Real function: computeScope(commitShas, workspaceParts) in src/facts/scope.ts
 * Runner step: createScopeStep() in src/analysis/runner/steps/scopeStep.ts
 *
 * This adapter provides test metrics based on commit/symbol/edge data without requiring
 * database queries or git operations. For production, use computeScope() directly.
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

  // Blast radius using BFS algorithm matching real computeBlastRadiusNeighbors
  const blastRadius = new Set<string>();
  const symbolToFile = new Map<string, string>();
  const adjacencyMap = new Map<string, Array<{neighborId: string, confidence: number}>>();

  // Build symbol to file mapping
  [...symbols, ...commits.flatMap(c => c.symbols || [])].forEach(symbol => {
    const file = symbol.filePath || extractFileFromSymbolId(symbol.id);
    if (file) symbolToFile.set(symbol.id, file);
  });

  // Build bidirectional adjacency map from edges
  edges.forEach(edge => {
    const confidence = 1.0; // Simplified - real algorithm uses edge confidence

    // Add forward edge
    if (!adjacencyMap.has(edge.from)) {
      adjacencyMap.set(edge.from, []);
    }
    adjacencyMap.get(edge.from)!.push({ neighborId: edge.to, confidence });

    // Add reverse edge (bidirectional)
    if (!adjacencyMap.has(edge.to)) {
      adjacencyMap.set(edge.to, []);
    }
    adjacencyMap.get(edge.to)!.push({ neighborId: edge.from, confidence });
  });

  // Extract changed symbols (symbols in commits or working changes)
  const changedSymbols = new Set<string>();
  commits.forEach(commit => {
    commit.symbols?.forEach(symbol => changedSymbols.add(symbol.id));
  });
  symbols.forEach(symbol => changedSymbols.add(symbol.id));

  // BFS from changed symbols (depth 2-3, max 50 files)
  const queue: Array<{symbolId: string, depth: number}> = Array.from(changedSymbols).map(id => ({symbolId: id, depth: 0}));
  const visited = new Set<string>(changedSymbols);
  const maxDepth = 3;
  const maxFiles = 50;

  while (queue.length > 0 && blastRadius.size < maxFiles) {
    const {symbolId, depth} = queue.shift()!;
    if (depth > maxDepth || visited.has(symbolId)) continue;
    visited.add(symbolId);

    const neighbors = adjacencyMap.get(symbolId) || [];
    for (const {neighborId} of neighbors) {
      if (changedSymbols.has(neighborId)) continue; // Skip changed symbols

      const filePath = symbolToFile.get(neighborId);
      if (filePath && !commitFiles.has(filePath)) {
        blastRadius.add(filePath);

        if (depth < maxDepth) {
          queue.push({symbolId: neighborId, depth: depth + 1});
        }
      }
    }
  }

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
