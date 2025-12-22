import * as path from 'path';
import { GitOperations } from '../analysis/git';
import { getGitCacheService } from '../services/gitCacheService';
import { prepare } from '../storage/statement-wrapper';
import { FileChange } from '../types';
import { getGitRoot } from '../utils/config';
import { logDebug } from '../utils/logger';
import { normalizeToRelative } from '../utils/path';
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
 * Extract file path from symbol DNA hash by querying the database
 * Since symbolId is now a DNA hash, we need to look it up in the symbols table
 */
function extractFileFromSymbolId(
  symbolId: string,
  dnaToPathCache: Map<string, string>
): string | null {
  return dnaToPathCache.get(symbolId) || null;
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

  // Build a cache of dna_id -> path for efficient lookups
  // Since symbolId in edges table is now DNA hash, we need to map it to file paths
  // Use symbol_versions table which has both dna_id and path
  const dnaToPathCache = new Map<string, string>();
  const symbolVersionsStmt = prepare(`
    SELECT DISTINCT dna_id, path FROM symbol_versions
    WHERE dna_id IS NOT NULL AND path IS NOT NULL
  `);
  const symbolVersions = symbolVersionsStmt.all() as Array<{ dna_id: string; path: string }>;
  for (const row of symbolVersions) {
    dnaToPathCache.set(row.dna_id, normalizeToRelative(row.path, getGitRoot()));
  }
  logDebug(`🟩 [computeBlastRadius] Built DNA->path cache with ${dnaToPathCache.size} entries`);

  const adjacencyMap = new Map<string, Array<{ neighborId: string; confidence: number }>>();
  logDebug('🟩 [computeBlastRadius] Querying edges table...');
  const edgesStmt = prepare(`
    SELECT from_symbol_id, to_symbol_id, confidence
    FROM edges
    ORDER BY confidence DESC
    LIMIT 5000  -- Reasonable limit for full repo analysis
  `);
  const allEdges = edgesStmt.all() as any[];
  logDebug(`🟩 [computeBlastRadius] Got ${allEdges.length} edges`);

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

      const filePath = extractFileFromSymbolId(neighborId, dnaToPathCache);
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
  const gitRoot = getGitRoot();

  const scope: ScopeSet = {
    commitFiles: new Set(),
    workingChanged: new Set(),
    stagedFiles: new Set(),
    unstagedFiles: new Set(),
    blastRadius: new Set(),
    allPaths: new Set(),
  };

  const cacheService = getGitCacheService();

  for (const sha of commitShas) {
    const commitFiles = await cacheService.getCachedFileChanges(sha);
    commitFiles.forEach(f => scope.commitFiles.add(normalizeToRelative(f.path, gitRoot)));
  }

  const workingChanges = await git.getWorkingDirectoryChanges();

  if (workspaceParts) {
    const includeStaged = workspaceParts.has('staged');
    const includeUnstaged = workspaceParts.has('unstaged');

    const stagedFiles = await git.getStagedFiles();
    const unstagedFiles = await git.getUnstagedFiles();

    if (includeStaged) {
      stagedFiles.forEach(f => {
        const normalized = normalizeToRelative(f.path, gitRoot);
        scope.workingChanged.add(normalized);
        scope.stagedFiles.add(normalized);
      });
    }

    if (includeUnstaged) {
      unstagedFiles.forEach(f => {
        const normalized = normalizeToRelative(f.path, gitRoot);
        scope.workingChanged.add(normalized);
        scope.unstagedFiles.add(normalized);
      });
    }
  } else {
    workingChanges.forEach(f => scope.workingChanged.add(normalizeToRelative(f.path, gitRoot)));
  }

  if (liveOverridePaths) {
    for (const p of liveOverridePaths) {
      const normalized = normalizeToRelative(p, gitRoot);
      scope.workingChanged.add(normalized);

      if (!workspaceParts || workspaceParts.has('unstaged')) {
        scope.unstagedFiles.add(normalized);
      }
    }
  }

  logDebug('[computeScope] Calling computeBlastRadiusNeighbors...');
  const blastRadiusFiles = await computeBlastRadiusNeighbors(
    commitShas,
    scope.commitFiles,
    scope.workingChanged,
    20
  );
  logDebug('[computeScope] computeBlastRadiusNeighbors returned');
  blastRadiusFiles.forEach(f => scope.blastRadius.add(f));

  const allPaths = new Set([...scope.commitFiles, ...scope.workingChanged, ...scope.blastRadius]);

  const filteredPaths = new Set<string>();

  // Batch git check-ignore to avoid 196 individual calls (each taking ~113ms)
  const pathsArray = Array.from(allPaths);
  logDebug(`[Scope] Batch checking ${pathsArray.length} paths for git-ignore...`);
  const ignoreMap = await git.areIgnored(pathsArray);
  logDebug(`[Scope] Found ${Array.from(ignoreMap.values()).filter(v => v).length} ignored paths`);

  // Now filter paths with cached ignore results
  const limit = require('p-limit')(16);
  const filterPromises = pathsArray.map(p =>
    limit(async () => {
      const shouldInclude = await filterPath(p, { git, skipGitIgnore: true }); // Skip since we already checked
      // Apply the batch ignore check result
      if (shouldInclude && !ignoreMap.get(p)) {
        filteredPaths.add(p);
      }
    })
  );
  await Promise.all(filterPromises);

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
        const commitFiles = await cacheService.getCachedFileChanges(version);
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
