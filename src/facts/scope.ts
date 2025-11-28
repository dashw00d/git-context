import { GitOperations } from '../analysis/git';
import { getDatabaseManager } from '../storage/database';
import { getExtensionConfig, getSupportedExtensions, createCustomIgnoreMatcher } from '../utils/config';
import { filterPath } from '../utils/pathFilter';
import { logDebug } from '../utils/logger';

export interface ScopeSet {
  commitFiles: Set<string>;        // Files touched by selected commits
  workingChanged: Set<string>;     // Files changed in working tree (backward compat)
  stagedFiles: Set<string>;        // Files in staged working tree
  unstagedFiles: Set<string>;      // Files in unstaged working tree
  blastRadius: Set<string>;        // Neighbor files from dependency analysis
  allPaths: Set<string>;           // Union of all paths to analyze
  fileVersionMap?: Map<string, string>;  // filePath → first version in timeline where it appeared
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

  // Extract symbol IDs that changed in selected commits (batched query)
  const changedSymbols = new Set<string>();
  if (commitShas.length > 0) {
    const placeholders = commitShas.map(() => '?').join(',');
    const symbolsStmt = db.prepare(`
      SELECT symbol_id FROM symbols WHERE sha IN (${placeholders})
    `);
    const allSymbols = symbolsStmt.all(...commitShas) as any[];
    allSymbols.forEach(s => changedSymbols.add(s.symbol_id));
  }

  // Extract symbols from working tree changes (batched by directory prefix)
  const workingSymbols = new Set<string>();
  if (workingChangedFiles.size > 0) {
    // Group files by directory prefix to batch queries
    const dirPrefixes = new Set<string>();
    for (const filePath of workingChangedFiles) {
      const dir = filePath.substring(0, filePath.lastIndexOf('/') + 1);
      if (dir) {
        dirPrefixes.add(dir);
      } else {
        // Root-level file, query by exact path
        dirPrefixes.add(filePath);
      }
    }

    // Batch query by directory prefix
    for (const prefix of dirPrefixes) {
      const symbolsStmt = db.prepare(`
        SELECT symbol_id FROM symbols
        WHERE path LIKE ? AND change_type IN ('added', 'modified', 'removed')
        LIMIT 50  -- Limit per prefix to avoid explosion
      `);
      const pattern = prefix.includes('/') ? `${prefix}%` : prefix;
      const symbols = symbolsStmt.all(pattern) as any[];
      symbols.forEach(s => workingSymbols.add(s.symbol_id));
    }
  }

  // Merge working symbols into changed symbols for BFS
  for (const symbolId of workingSymbols) {
    changedSymbols.add(symbolId);
  }

  // Build full repo adjacency map from all edges (not just selected commits)
  const adjacencyMap = new Map<string, Array<{ neighborId: string, confidence: number }>>();
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
  const queue: Array<{ symbolId: string, depth: number }> = Array.from(changedSymbols).map(id => ({ symbolId: id, depth: 0 }));
  const visited = new Set<string>(changedSymbols);
  const maxDepth = 3;
  const maxTotalFiles = Math.max(maxNeighbors * 2, 50); // Allow more files for BFS exploration
  const neighborFiles = new Map<string, number>();

  while (queue.length > 0 && neighborFiles.size < maxTotalFiles) {
    const { symbolId, depth } = queue.shift()!;
    if (depth > maxDepth || visited.has(symbolId)) continue;
    visited.add(symbolId);

    const neighbors = adjacencyMap.get(symbolId) || [];
    for (const { neighborId, confidence } of neighbors) {
      if (changedSymbols.has(neighborId)) continue; // Skip changed symbols

      const filePath = extractFileFromSymbolId(neighborId);
      if (filePath && !commitFiles.has(filePath)) {
        // Weight by depth: closer neighbors get higher scores
        const depthWeight = 1.0 / (depth + 1);
        const weightedConfidence = confidence * depthWeight;
        neighborFiles.set(filePath, (neighborFiles.get(filePath) || 0) + weightedConfidence);

        // Continue BFS to next depth
        if (depth < maxDepth) {
          queue.push({ symbolId: neighborId, depth: depth + 1 });
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
  workspaceParts?: Set<'staged' | 'unstaged'>,
  explicitTimeline?: string[]
): Promise<ScopeSet> {
  const { ensureDatabaseInitialized } = await import('../storage/database');

  await ensureDatabaseInitialized();
  const git = new GitOperations();

  const scope: ScopeSet = {
    commitFiles: new Set(),
    workingChanged: new Set(),
    stagedFiles: new Set(),
    unstagedFiles: new Set(),
    blastRadius: new Set(),
    allPaths: new Set()
  };

  // 1. Files touched by selected commits
  for (const sha of commitShas) {
    const commitFiles = await git.getFileChanges(sha);
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
      stagedFiles.forEach(f => {
        scope.workingChanged.add(f.path);
        scope.stagedFiles.add(f.path);
      });
    }

    if (includeUnstaged) {
      unstagedFiles.forEach(f => {
        scope.workingChanged.add(f.path);
        scope.unstagedFiles.add(f.path);
      });
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

  // Filter out build artifacts, ignored directories, and unsupported extensions
  // Use centralized path filter (scope doesn't have commitSha/gitRoot for size checks,
  // but that's acceptable since scope is pre-filtered by commitIndexer/workspaceIndexer)
  const filteredPaths = new Set<string>();
  
  for (const p of allPaths) {
    if (await filterPath(p, { git })) {
      filteredPaths.add(p);
    }
  }

  scope.allPaths = filteredPaths;

  // Track which version each file first appeared in (if timeline provided)
  if (explicitTimeline && explicitTimeline.length > 0) {
    const fileVersionMap = new Map<string, string>();
    
    // Iterate through timeline from oldest to newest to find first appearance
    // (timeline is newest → oldest, so reverse to get chronological order)
    for (let i = explicitTimeline.length - 1; i >= 0; i--) {
      const version = explicitTimeline[i];
      let versionFiles: Set<string>;
      
      if (version === 'workspace-unstaged') {
        versionFiles = scope.unstagedFiles;
      } else if (version === 'workspace-staged') {
        versionFiles = scope.stagedFiles;
      } else if (version === 'HEAD') {
        // HEAD is typically the newest commit, use commitFiles
        versionFiles = scope.commitFiles;
      } else {
        // Specific commit SHA - check if this commit touched the file
        const git = new GitOperations();
        const commitFiles = await git.getFileChanges(version);
        versionFiles = new Set(commitFiles.map(f => f.path));
      }
      
      // Track first appearance (oldest version wins - this is the first time it appeared)
      for (const filePath of versionFiles) {
        if (filteredPaths.has(filePath) && !fileVersionMap.has(filePath)) {
          fileVersionMap.set(filePath, version);
        }
      }
    }
    
    // Also track blast radius files (they entered scope when blast radius was computed)
    for (const filePath of scope.blastRadius) {
      if (filteredPaths.has(filePath) && !fileVersionMap.has(filePath)) {
        // Blast radius files entered scope at the newest version (workspace or HEAD)
        const newestVersion = explicitTimeline[0] || 'HEAD';
        fileVersionMap.set(filePath, newestVersion);
      }
    }
    
    scope.fileVersionMap = fileVersionMap;
  }

  // Log scope composition for debugging
  logDebug(`[Scope] staged=${scope.stagedFiles.size}, unstaged=${scope.unstagedFiles.size}, total working=${scope.workingChanged.size}, commits=${scope.commitFiles.size}, blast=${scope.blastRadius.size}, all=${scope.allPaths.size}`);

  return scope;
}
