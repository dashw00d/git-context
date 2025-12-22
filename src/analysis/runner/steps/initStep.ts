import { spawn } from 'child_process';
import pLimit = require('p-limit');
import { getGitCacheService } from '../../../services/gitCacheService';
import { getDatabase } from '../../../storage/database';
import { logDebug, logInfo, logWarn } from '../../../utils/logger';
import { GitOperations } from '../../git';
import { PipelineState, PipelineStep, PlanData, TreeEntry } from '../pipelineTypes';

const MAX_FILE_SIZE = 1024 * 1024; // 1MB

export function createInitStep(git: GitOperations): PipelineStep {
  return {
    id: 'init',
    label: 'Quick Scan (Data Gathering)',
    deps: [],

    async run(state: PipelineState) {
      logDebug('🚀 [InitStep] Starting Data Gathering');
      const startTime = Date.now();

      // Initialize plan data structure
      const plan: PlanData = {
        fileChanges: new Map(),
        content: new Map(),
        trees: new Map(),
        sizes: new Map(),
        ignoredPaths: new Set(),
      };

      // Initialize cache service for DB persistence
      const cacheService = getGitCacheService();
      cacheService.setGit(git);
      cacheService.setDatabase(getDatabase());

      // 1. Determine all commits to analyze
      const allShas = ['HEAD', ...(state.selectedCommitShas || [])];
      logInfo(`[InitStep] Gathering data for ${allShas.length} commits`);

      // 2. Get file changes for all commits in PARALLEL (populates plan.fileChanges)
      const parentShas = new Set<string>();
      const limit = pLimit(8); // Parallelize up to 8 commits

      const commitTasks = allShas
        .filter(sha => !sha.startsWith('workspace'))
        .map(sha =>
          limit(async () => {
            try {
              const files = await git.getFileChanges(sha);
              plan.fileChanges.set(sha, files);
              // Also cache in gitCacheService for other code paths
              cacheService.cacheFileChanges(sha, files);

              // Track parent commits for parent content
              const commitInfo = await git.getCommitInfo(sha);
              if (commitInfo.parent) {
                parentShas.add(commitInfo.parent);
              }
            } catch (error) {
              logWarn(`[InitStep] Failed to get file changes for ${sha}: ${error}`);
            }
          })
        );

      await Promise.all(commitTasks);

      // 3. Get workspace changes
      const staged = await git.getStagedFiles();
      const unstaged = await git.getUnstagedFiles();
      const workspacePaths = [...staged, ...unstaged].map(f => f.path);

      // 4. Warm ignore cache
      const allTrackedFiles = await git.getAllFiles();
      const allPaths = [...new Set([...allTrackedFiles, ...workspacePaths])];
      await warmIgnoreCache(git, allPaths, plan.ignoredPaths);

      // Also warm the GitCacheService singleton so other code paths can use it
      await cacheService.warmIgnoreCache(allPaths);

      // 5. Get tree for HEAD (needed for workspace file lookups)
      const headTree = await getFullTree(git, 'HEAD');
      plan.trees.set('HEAD', headTree);

      // 6. Collect all blobs needed
      const blobUsage = new Map<string, { sha: string; path: string }[]>();

      for (const [sha, files] of plan.fileChanges) {
        const commitInfo = await git.getCommitInfo(sha);
        for (const file of files) {
          // Current version
          if (file.newSha && file.status !== 'D') {
            if (!blobUsage.has(file.newSha)) blobUsage.set(file.newSha, []);
            blobUsage.get(file.newSha)!.push({ sha, path: file.path });
          }
          // Parent version (for diffs)
          if (file.oldSha && file.status !== 'A' && commitInfo.parent) {
            if (!blobUsage.has(file.oldSha)) blobUsage.set(file.oldSha, []);
            blobUsage
              .get(file.oldSha)!
              .push({ sha: commitInfo.parent, path: file.oldPath || file.path });
          }
        }
      }

      // Add HEAD content for workspace files
      for (const filePath of workspacePaths) {
        const entry = headTree.get(filePath);
        if (entry && entry.type === 'blob') {
          if (!blobUsage.has(entry.sha)) blobUsage.set(entry.sha, []);
          blobUsage.get(entry.sha)!.push({ sha: 'HEAD', path: filePath });
        }
      }

      // 7. Warm sizes and filter large files
      const allItems = Array.from(blobUsage.entries()).flatMap(([blobSha, usages]) =>
        usages.map(u => ({ blobSha, sha: u.sha, path: u.path }))
      );
      await warmSizes(git, allItems, plan.sizes);

      // Filter out large blobs
      const blobsToFetch = new Set<string>();
      for (const [blobSha, usages] of blobUsage) {
        const firstUsage = usages[0];
        const size = plan.sizes.get(`${firstUsage.sha}:${firstUsage.path}`);
        if (size === undefined || size <= MAX_FILE_SIZE) {
          blobsToFetch.add(blobSha);
        }
      }

      logInfo(
        `[InitStep] Fetching ${blobsToFetch.size} blobs (${blobUsage.size - blobsToFetch.size} filtered as large)`
      );

      // 8. Batch fetch all blob content
      const blobContent = await batchFetchBlobs(git, Array.from(blobsToFetch));

      // 9. Map blob content to sha:path keys
      for (const [blobSha, content] of blobContent) {
        const usages = blobUsage.get(blobSha) || [];
        for (const { sha, path } of usages) {
          plan.content.set(`${sha}:${path}`, content);
        }
        // Also persist to DB via cache service
        await cacheService.storeBlob(blobSha, content);
      }

      // 10. Store plan in state
      state.plan = plan;

      const duration = Date.now() - startTime;
      logInfo(`🚀 [InitStep] Data gathering completed in ${duration}ms`);
      logInfo(`   - ${plan.fileChanges.size} commits with file changes`);
      logInfo(`   - ${plan.content.size} file contents cached`);
      logInfo(`   - ${plan.sizes.size} file sizes cached`);
      logInfo(`   - ${plan.ignoredPaths.size} ignored paths`);
    },
  };
}

/**
 * Get full tree for a commit
 */
async function getFullTree(git: GitOperations, sha: string): Promise<Map<string, TreeEntry>> {
  return new Promise(resolve => {
    const treeMap = new Map<string, TreeEntry>();

    const lsTree = spawn('git', ['ls-tree', '-r', sha], {
      cwd: git.getRoot(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    lsTree.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    lsTree.on('close', code => {
      if (code !== 0) {
        resolve(treeMap);
        return;
      }

      const lines = stdout
        .trim()
        .split('\n')
        .filter((l: string) => l.trim());
      for (const line of lines) {
        const tabIndex = line.indexOf('\t');
        if (tabIndex === -1) continue;

        const meta = line.slice(0, tabIndex).split(' ');
        const path = line.slice(tabIndex + 1);

        if (meta.length >= 3) {
          treeMap.set(path, {
            mode: meta[0],
            type: meta[1],
            sha: meta[2],
            path,
          });
        }
      }
      resolve(treeMap);
    });

    lsTree.on('error', () => resolve(treeMap));
  });
}

/**
 * Warm ignore cache
 */
async function warmIgnoreCache(
  git: GitOperations,
  paths: string[],
  ignoredSet: Set<string>
): Promise<void> {
  if (paths.length === 0) return;

  const CHUNK_SIZE = 100;
  const chunks: string[][] = [];
  for (let i = 0; i < paths.length; i += CHUNK_SIZE) {
    chunks.push(paths.slice(i, i + CHUNK_SIZE));
  }

  const limit = pLimit(4);

  await Promise.all(
    chunks.map(chunk =>
      limit(async () => {
        const ignoreMap = await git.areIgnored(chunk);
        for (const [path, isIgnored] of ignoreMap) {
          if (isIgnored) {
            ignoredSet.add(path);
          }
        }
      })
    )
  );
}

/**
 * Warm sizes using git cat-file --batch-check
 */
async function warmSizes(
  git: GitOperations,
  items: { blobSha: string; sha: string; path: string }[],
  sizesMap: Map<string, number>
): Promise<void> {
  if (items.length === 0) return;

  return new Promise(resolve => {
    const catFile = spawn('git', ['cat-file', '--batch-check'], {
      cwd: git.getRoot(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = Buffer.alloc(0);
    let currentIndex = 0;

    catFile.stdout.on('data', (chunk: Buffer) => {
      stdout = Buffer.concat([stdout, chunk]);

      while (currentIndex < items.length) {
        const lineEnd = stdout.indexOf('\n');
        if (lineEnd === -1) break;

        const line = stdout.slice(0, lineEnd).toString();
        const parts = line.split(' ');

        if (parts.length >= 3 && parts[1] === 'blob') {
          const size = parseInt(parts[2], 10);
          if (!isNaN(size)) {
            const item = items[currentIndex];
            sizesMap.set(`${item.sha}:${item.path}`, size);
          }
        }

        stdout = stdout.slice(lineEnd + 1);
        currentIndex++;
      }
    });

    catFile.on('close', () => resolve());
    catFile.on('error', () => resolve());

    // Send all blob SHAs to stdin
    for (const item of items) {
      catFile.stdin.write(item.blobSha + '\n');
    }
    catFile.stdin.end();
  });
}

/**
 * Batch fetch blob content using git cat-file --batch
 */
async function batchFetchBlobs(
  git: GitOperations,
  blobShas: string[]
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  if (blobShas.length === 0) return results;

  return new Promise(resolve => {
    const catFile = spawn('git', ['cat-file', '--batch'], {
      cwd: git.getRoot(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = Buffer.alloc(0);
    let currentIndex = 0;

    catFile.stdout.on('data', (chunk: Buffer) => {
      stdout = Buffer.concat([stdout, chunk]);

      while (currentIndex < blobShas.length) {
        const headerEnd = stdout.indexOf('\n');
        if (headerEnd === -1) break;

        const header = stdout.slice(0, headerEnd).toString();
        const [sha, type, sizeStr] = header.split(' ');

        if (type === 'missing') {
          results.set(blobShas[currentIndex], '');
          stdout = stdout.slice(headerEnd + 1);
          currentIndex++;
          continue;
        }

        const size = parseInt(sizeStr, 10);
        const contentStart = headerEnd + 1;
        const contentEnd = contentStart + size;

        if (stdout.length < contentEnd + 1) break;

        const content = stdout.slice(contentStart, contentEnd).toString('utf-8');
        results.set(sha, content);

        stdout = stdout.slice(contentEnd + 1);
        currentIndex++;
      }
    });

    catFile.on('close', () => resolve(results));
    catFile.on('error', () => resolve(results));

    for (const sha of blobShas) {
      catFile.stdin.write(sha + '\n');
    }
    catFile.stdin.end();
  });
}
