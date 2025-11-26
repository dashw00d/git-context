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
  maxNeighbors: number
): Promise<string[]> {
  const db = getDatabaseManager().getDatabase();

  const neighborFiles = new Map<string, number>(); // file -> confidence score

  // Get edges from selected commits
  const placeholders = commitShas.map(() => '?').join(',');
  const edgesStmt = db.prepare(`
    SELECT from_symbol_id, to_symbol_id, confidence, change_type
    FROM edges
    WHERE sha IN (${placeholders}) AND change_type IS NOT NULL
    ORDER BY confidence DESC
    LIMIT 200
  `);
  const edges = edgesStmt.all(...commitShas) as any[];

  // Extract symbol IDs that changed
  const changedSymbols = new Set<string>();
  for (const sha of commitShas) {
    const symbolsStmt = db.prepare(`
      SELECT symbol_id FROM symbols WHERE sha = ?
    `);
    const symbols = symbolsStmt.all(sha) as any[];
    symbols.forEach(s => changedSymbols.add(s.symbol_id));
  }

  // For each edge connected to changed symbols, find the file containing the other end
  for (const edge of edges) {
    const fromChanged = changedSymbols.has(edge.from_symbol_id);
    const toChanged = changedSymbols.has(edge.to_symbol_id);

    // Only consider edges where one end is changed (to find neighbors)
    if (fromChanged !== toChanged) {
      const neighborSymbolId = fromChanged ? edge.to_symbol_id : edge.from_symbol_id;
      const confidence = edge.confidence || 1.0;

      // Extract file path from symbol ID (simplified heuristic)
      const filePath = extractFileFromSymbolId(neighborSymbolId);
      if (filePath && !commitFiles.has(filePath)) {
        neighborFiles.set(filePath, (neighborFiles.get(filePath) || 0) + confidence);
      }
    }
  }

  // Return top N neighbors by confidence score
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
  const blastRadiusFiles = await computeBlastRadiusNeighbors(commitShas, scope.commitFiles, 20); // Max 20 extra files
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
