import { GitOperations } from '../analysis/git';
import { prepare } from '../storage/statement-wrapper';
import { logDebug } from '../utils/logger';
import { filterPath } from '../utils/pathFilter';

export interface ScopeSet {
  commitFiles: Set<string>;
  workingChanged: Set<string>;
  stagedFiles: Set<string>;
  unstagedFiles: Set<string>;
  blastRadius: Set<string>;
  allPaths: Set<string>;
  fileVersionMap?: Map<string, string>;
}

/**
 * Extract file path from symbol ID (heuristic)
 */
function extractFileFromSymbolId(symbolId: string): string | null {
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
  const changedSymbols = new Set<string>();
  if (commitShas.length > 0) {
    const placeholders = commitShas.map(() => '?').join(',');
    const symbolsStmt = prepare(`
      SELECT symbol_id FROM symbols WHERE sha IN (${placeholders})
    `);
    const allSymbols = symbolsStmt.all(...commitShas) as any[];
    allSymbols.forEach(s => changedSymbols.add(s.symbol_id));
  }

  const workingSymbols = new Set<string>();
  if (workingChangedFiles.size > 0) {
    const dirPrefixes = new Set<string>();
    for (const filePath of workingChangedFiles) {
      const dir = filePath.substring(0, filePath.lastIndexOf('/') + 1);
      if (dir) {
        dirPrefixes.add(dir);
      } else {
        dirPrefixes.add(filePath);
      }
    }

    for (const prefix of dirPrefixes) {
      const symbolsStmt = prepare(`
        SELECT symbol_id FROM symbols
        WHERE path LIKE ? AND change_type IN ('added', 'modified', 'removed')
        LIMIT 50  -- Limit per prefix to avoid explosion
      `);
      const pattern = prefix.includes('/') ? `${prefix}%` : prefix;
      const symbols = symbolsStmt.all(pattern) as any[];
      symbols.forEach(s => workingSymbols.add(s.symbol_id));
    }
  }

  for (const symbolId of workingSymbols) {
    changedSymbols.add(symbolId);
  }

  const adjacencyMap = new Map<string, Array<{ neighborId: string; confidence: number }>>();
  console.error('🟩 [computeBlastRadius] Querying edges table...');
  const edgesStmt = prepare(`
    SELECT from_symbol_id, to_symbol_id, confidence
    FROM edges
    ORDER BY confidence DESC
    LIMIT 5000  -- Reasonable limit for full repo analysis
  `);
  const allEdges = edgesStmt.all() as any[];
  console.error(`🟩 [computeBlastRadius] Got ${allEdges.length} edges`);

  for (const edge of allEdges) {
    const fromId = edge.from_symbol_id;
    const toId = edge.to_symbol_id;
    const confidence = edge.confidence || 1.0;

    if (!adjacencyMap.has(fromId)) {
      adjacencyMap.set(fromId, []);
    }
    adjacencyMap.get(fromId)!.push({ neighborId: toId, confidence });

    if (!adjacencyMap.has(toId)) {
      adjacencyMap.set(toId, []);
    }
    adjacencyMap.get(toId)!.push({ neighborId: fromId, confidence });
  }

  const queue: Array<{ symbolId: string; depth: number }> = Array.from(changedSymbols).map(id => ({
    symbolId: id,
    depth: 0,
  }));
  const visited = new Set<string>(changedSymbols);
  const maxDepth = 3;
  const maxTotalFiles = Math.max(maxNeighbors * 2, 50);
  const neighborFiles = new Map<string, number>();

  while (queue.length > 0 && neighborFiles.size < maxTotalFiles) {
    const { symbolId, depth } = queue.shift()!;
    if (depth > maxDepth || visited.has(symbolId)) continue;
    visited.add(symbolId);

    const neighbors = adjacencyMap.get(symbolId) || [];
    for (const { neighborId, confidence } of neighbors) {
      if (changedSymbols.has(neighborId)) continue;

      const filePath = extractFileFromSymbolId(neighborId);
      if (filePath && !commitFiles.has(filePath)) {
        const depthWeight = 1.0 / (depth + 1);
        const weightedConfidence = confidence * depthWeight;
        neighborFiles.set(filePath, (neighborFiles.get(filePath) || 0) + weightedConfidence);

        if (depth < maxDepth) {
          queue.push({ symbolId: neighborId, depth: depth + 1 });
        }
      }
    }
  }

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
  explicitTimeline?: string[],
  liveOverridePaths?: Iterable<string>,
  gitInstance?: GitOperations
): Promise<ScopeSet> {
  const { ensureDatabaseInitialized } = await import('../storage/database');

  await ensureDatabaseInitialized();
  const git = gitInstance ?? new GitOperations();

  const scope: ScopeSet = {
    commitFiles: new Set(),
    workingChanged: new Set(),
    stagedFiles: new Set(),
    unstagedFiles: new Set(),
    blastRadius: new Set(),
    allPaths: new Set(),
  };

  for (const sha of commitShas) {
    const commitFiles = await git.getFileChanges(sha);
    commitFiles.forEach(f => scope.commitFiles.add(f.path));
  }

  const workingChanges = await git.getWorkingDirectoryChanges();

  if (workspaceParts) {
    const includeStaged = workspaceParts.has('staged');
    const includeUnstaged = workspaceParts.has('unstaged');

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
    workingChanges.forEach(f => scope.workingChanged.add(f.path));
  }

  if (liveOverridePaths) {
    for (const path of liveOverridePaths) {
      scope.workingChanged.add(path);

      if (!workspaceParts || workspaceParts.has('unstaged')) {
        scope.unstagedFiles.add(path);
      }
    }
  }

  console.error('🟩 [computeScope] Calling computeBlastRadiusNeighbors...');
  const blastRadiusFiles = await computeBlastRadiusNeighbors(
    commitShas,
    scope.commitFiles,
    scope.workingChanged,
    20
  );
  console.error('🟩 [computeScope] computeBlastRadiusNeighbors returned');
  blastRadiusFiles.forEach(f => scope.blastRadius.add(f));

  const allPaths = new Set([...scope.commitFiles, ...scope.workingChanged, ...scope.blastRadius]);

  const filteredPaths = new Set<string>();

  for (const p of allPaths) {
    if (await filterPath(p, { git })) {
      filteredPaths.add(p);
    }
  }

  scope.allPaths = filteredPaths;

  if (explicitTimeline && explicitTimeline.length > 0) {
    const fileVersionMap = new Map<string, string>();

    for (let i = explicitTimeline.length - 1; i >= 0; i--) {
      const version = explicitTimeline[i];
      let versionFiles: Set<string>;

      if (version === 'workspace-unstaged') {
        versionFiles = scope.unstagedFiles;
      } else if (version === 'workspace-staged') {
        versionFiles = scope.stagedFiles;
      } else if (version === 'HEAD') {
        versionFiles = scope.commitFiles;
      } else {
        const commitFiles = await git.getFileChanges(version);
        versionFiles = new Set(commitFiles.map(f => f.path));
      }

      for (const filePath of versionFiles) {
        if (filteredPaths.has(filePath) && !fileVersionMap.has(filePath)) {
          fileVersionMap.set(filePath, version);
        }
      }
    }

    for (const filePath of scope.blastRadius) {
      if (filteredPaths.has(filePath) && !fileVersionMap.has(filePath)) {
        const newestVersion = explicitTimeline[0] || 'HEAD';
        fileVersionMap.set(filePath, newestVersion);
      }
    }

    scope.fileVersionMap = fileVersionMap;
  }

  logDebug(
    `[Scope] staged=${scope.stagedFiles.size}, unstaged=${scope.unstagedFiles.size}, total working=${scope.workingChanged.size}, commits=${scope.commitFiles.size}, blast=${scope.blastRadius.size}, all=${scope.allPaths.size}`
  );

  return scope;
}
