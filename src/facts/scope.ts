import { GitOperations } from '../analysis/git';
import { getDatabaseManager } from '../storage/database';
import { getExtensionConfig } from '../utils/config';

export interface ScopeSet {
  commitFiles: Set<string>;        // Files touched by selected commits
  workingChanged: Set<string>;     // Files changed in working tree
  blastRadius: Set<string>;        // Neighbor files from dependency analysis
  allPaths: Set<string>;           // Union of all paths to analyze
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
 * Compute blast-radius neighbor files from commit metadata
 */
async function computeBlastRadiusNeighbors(
  commitShas: string[],
  commitFiles: Set<string>,
  workingChangedFiles: Set<string>,
  maxNeighbors: number
): Promise<string[]> {
  const db = getDatabaseManager().getDatabase();

  // Extract symbol IDs that changed in selected commits
  const changedSymbols = new Set<string>();
  for (const sha of commitShas) {
    const symbolsStmt = db.prepare(`
      SELECT symbol_id FROM symbols WHERE sha = ?
    `);
    const symbols = symbolsStmt.all(sha) as any[];
    symbols.forEach(s => changedSymbols.add(s.symbol_id));
  }

  // Extract symbols from working tree changes (simplified - use file paths to find related symbols)
  const workingSymbols = new Set<string>();
  for (const filePath of workingChangedFiles) {
    const symbolsStmt = db.prepare(`
      SELECT symbol_id FROM symbols
      WHERE path LIKE ? AND change_type IN ('added', 'modified', 'removed')
      ORDER BY date DESC
      LIMIT 50  -- Limit per file to avoid explosion
    `);
    const symbols = symbolsStmt.all(`${filePath}%`) as any[];
    symbols.forEach(s => workingSymbols.add(s.symbol_id));
  }

  // Merge working symbols into changed symbols for BFS
  for (const symbolId of workingSymbols) {
    changedSymbols.add(symbolId);
  }

  // Build full repo adjacency map from all edges (not just selected commits)
  const adjacencyMap = new Map<string, Array<{neighborId: string, confidence: number}>>();
  const edgesStmt = db.prepare(`
    SELECT from_symbol_id, to_symbol_id, confidence
    FROM edges
    ORDER BY confidence DESC
    LIMIT 5000  -- Reasonable limit for full repo analysis
  `);
  const allEdges = edgesStmt.all() as any[];

  // Build bidirectional adjacency map
  for (const edge of allEdges) {
    const fromId = edge.from_symbol_id;
    const toId = edge.to_symbol_id;
    const confidence = edge.confidence || 1.0;

    // Add forward edge
    if (!adjacencyMap.has(fromId)) {
      adjacencyMap.set(fromId, []);
    }
    adjacencyMap.get(fromId)!.push({ neighborId: toId, confidence });

    // Add reverse edge (bidirectional)
    if (!adjacencyMap.has(toId)) {
      adjacencyMap.set(toId, []);
    }
    adjacencyMap.get(toId)!.push({ neighborId: fromId, confidence });
  }

  // Depth-limited BFS from changed symbols (depth 2-3)
  const queue: Array<{symbolId: string, depth: number}> = Array.from(changedSymbols).map(id => ({symbolId: id, depth: 0}));
  const visited = new Set<string>(changedSymbols);
  const maxDepth = 3;
  const maxTotalFiles = Math.max(maxNeighbors * 2, 50); // Allow more files for BFS exploration
  const neighborFiles = new Map<string, number>();

  while (queue.length > 0 && neighborFiles.size < maxTotalFiles) {
    const {symbolId, depth} = queue.shift()!;
    if (depth > maxDepth || visited.has(symbolId)) continue;
    visited.add(symbolId);

    const neighbors = adjacencyMap.get(symbolId) || [];
    for (const {neighborId, confidence} of neighbors) {
      if (changedSymbols.has(neighborId)) continue; // Skip changed symbols

      const filePath = extractFileFromSymbolId(neighborId);
      if (filePath && !commitFiles.has(filePath)) {
        // Weight by depth: closer neighbors get higher scores
        const depthWeight = 1.0 / (depth + 1);
        const weightedConfidence = confidence * depthWeight;
        neighborFiles.set(filePath, (neighborFiles.get(filePath) || 0) + weightedConfidence);

        // Continue BFS to next depth
        if (depth < maxDepth) {
          queue.push({symbolId: neighborId, depth: depth + 1});
        }
      }
    }
  }

  // Return top N neighbors by weighted confidence score
  return Array.from(neighborFiles.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxNeighbors)
    .map(([file]) => file);
}

/**
 * Compute scoped analysis set for refactor bundle
 */
export async function computeScope(
  commitShas: string[],
  workspaceParts?: Set<'staged' | 'unstaged'>
): Promise<ScopeSet> {
  const { ensureDatabaseInitialized } = await import('../storage/database');

  await ensureDatabaseInitialized();
  const git = new GitOperations();

  const scope: ScopeSet = {
    commitFiles: new Set(),
    workingChanged: new Set(),
    blastRadius: new Set(),
    allPaths: new Set()
  };

  // 1. Files touched by selected commits
  for (const sha of commitShas) {
    const commitFiles = git.getFileChanges(sha);
    commitFiles.forEach(f => scope.commitFiles.add(f.path));
  }

  // 2. Files changed in working tree (filtered by workspaceParts)
  const workingChanges = await git.getWorkingDirectoryChanges();

  if (workspaceParts) {
    const includeStaged = workspaceParts.has('staged');
    const includeUnstaged = workspaceParts.has('unstaged');

    // Get staged and unstaged files separately
    const stagedFiles = await git.getStagedFiles();
    const unstagedFiles = await git.getUnstagedFiles();

    if (includeStaged) {
      stagedFiles.forEach(f => scope.workingChanged.add(f.path));
    }

    if (includeUnstaged) {
      unstagedFiles.forEach(f => scope.workingChanged.add(f.path));
    }
  } else {
    // Default: include all working changes
    workingChanges.forEach(f => scope.workingChanged.add(f.path));
  }

  // 3. Blast-radius neighbors (top N by confidence)
  const blastRadiusFiles = await computeBlastRadiusNeighbors(commitShas, scope.commitFiles, scope.workingChanged, 20); // Max 20 extra files
  blastRadiusFiles.forEach(f => scope.blastRadius.add(f));

  // Union all paths
  const allPaths = new Set([
    ...scope.commitFiles,
    ...scope.workingChanged,
    ...scope.blastRadius
  ]);

  // Filter out build artifacts and ignored directories
  const filteredPaths = new Set<string>();
  for (const p of allPaths) {
    const normalized = p.replace(/\\/g, '/');
    if (normalized.startsWith('out/') ||
      normalized.startsWith('dist/') ||
      normalized.startsWith('node_modules/') ||
      normalized.includes('/node_modules/')) {
      continue;
    }

    if (git.isIgnored(p)) {
      continue;
    }

    // Check custom ignore paths
    const config = getExtensionConfig();
    if (config.customIgnorePaths && config.customIgnorePaths.length > 0) {
      let ignored = false;
      for (const pattern of config.customIgnorePaths) {
        // Simple glob matching support
        // Convert glob to regex: . -> \., * -> .*, ? -> .
        const regexStr = '^' + pattern
          .replace(/\./g, '\\.')
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.') + '$';
        const regex = new RegExp(regexStr);

        if (regex.test(p) || p.includes(pattern)) {
          ignored = true;
          break;
        }
      }
      if (ignored) continue;
    }

    filteredPaths.add(p);
  }

  scope.allPaths = filteredPaths;

  return scope;
}
