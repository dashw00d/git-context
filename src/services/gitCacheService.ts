/**
 * GitCacheService - Batched git operations with in-memory caching and DB persistence
 *
 * This service runs expensive git operations ONCE per analysis scope,
 * then provides instant lookups. This eliminates individual git calls.
 *
 * Usage:
 *   const cache = getGitCacheService();
 *   cache.setDatabase(db);
 *   await cache.planAndWarm(shas);
 *   const content = cache.getContent(sha, path);
 */

import { spawn } from 'child_process';
import { GitOperations } from '../analysis/git';
import { FileChange } from '../types';
import { logInfo, logWarn } from '../utils/logger';

interface TreeEntry {
  mode: string;
  type: string;
  sha: string;
  path: string;
}

interface CacheStats {
  ignoreHits: number;
  ignoreMisses: number;
  treeHits: number;
  treeMisses: number;
  contentHits: number;
  contentMisses: number;
  lastWarmTime: number;
}

export interface ContentPlan {
  // All blob SHAs we need to fetch (deduplicated)
  blobsToFetch: Set<string>;

  // Mapping: blobSha -> [{commitSha, filePath}]
  blobUsage: Map<string, Array<{ commitSha: string; filePath: string }>>;

  // For each commit, the FileChange[] (includes newSha, oldSha)
  fileChanges: Map<string, FileChange[]>;
}

export class GitCacheService {
  private static instance: GitCacheService;

  // In-memory caches
  private ignoredPaths = new Set<string>();
  private treeCache = new Map<string, Map<string, TreeEntry>>(); // sha → (path → entry)
  private contentCache = new Map<string, string>(); // "sha:path" → content
  private sizeCache = new Map<string, number>(); // "sha:path" → size
  private blobCache = new Map<string, string>(); // blobSha → content
  private fileChangesCache = new Map<string, FileChange[]>(); // sha → FileChange[]

  // Cache state
  private ignoreWarmed = false;
  private treesWarmed = new Set<string>();
  private contentWarmed = new Set<string>();
  private sizesWarmed = new Set<string>();

  // Stats for debugging
  private stats: CacheStats = {
    ignoreHits: 0,
    ignoreMisses: 0,
    treeHits: 0,
    treeMisses: 0,
    contentHits: 0,
    contentMisses: 0,
    lastWarmTime: 0,
  };

  private git: GitOperations | null = null;
  private db: any | null = null;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  static getInstance(): GitCacheService {
    if (!GitCacheService.instance) {
      GitCacheService.instance = new GitCacheService();
    }
    return GitCacheService.instance;
  }

  setGit(git: GitOperations): void {
    this.git = git;
  }

  setDatabase(db: any): void {
    this.db = db;
  }

  private getGit(): GitOperations {
    if (!this.git) {
      this.git = new GitOperations();
    }
    return this.git;
  }

  clear(): void {
    this.ignoredPaths.clear();
    this.treeCache.clear();
    this.contentCache.clear();
    this.sizeCache.clear();
    this.blobCache.clear();
    this.fileChangesCache.clear();
    this.ignoreWarmed = false;
    this.treesWarmed.clear();
    this.contentWarmed.clear();
    this.sizesWarmed.clear();
    this.stats = {
      ignoreHits: 0,
      ignoreMisses: 0,
      treeHits: 0,
      treeMisses: 0,
      contentHits: 0,
      contentMisses: 0,
      lastWarmTime: 0,
    };
    logInfo('[GitCacheService] Cache cleared');
  }

  getStats(): CacheStats & {
    cacheSize: { ignored: number; trees: number; content: number; sizes: number; blobs: number };
  } {
    return {
      ...this.stats,
      cacheSize: {
        ignored: this.ignoredPaths.size,
        trees: this.treeCache.size,
        content: this.contentCache.size,
        sizes: this.sizeCache.size,
        blobs: this.blobCache.size,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PLANNING & WARMING
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Plan all content needs for the given commits
   */
  async planAllContentNeeds(shas: string[], includeParents: boolean = true): Promise<ContentPlan> {
    const plan: ContentPlan = {
      blobsToFetch: new Set(),
      blobUsage: new Map(),
      fileChanges: new Map(),
    };

    const git = this.getGit();

    // 1. Get file changes for each commit (includes blob SHAs from diff-tree)
    for (const sha of shas) {
      if (sha.startsWith('workspace')) continue; // Skip workspace pseudo-SHAs for now

      try {
        // Use cache if available
        let files = this.fileChangesCache.get(sha);
        if (!files) {
          files = await git.getFileChanges(sha);
          this.fileChangesCache.set(sha, files);
        }
        plan.fileChanges.set(sha, files);

        for (const file of files) {
          // Need current version content
          if (file.newSha && file.status !== 'D') {
            this.addBlobNeed(plan, file.newSha, sha, file.path);
          }

          // Need parent version content (for diffs)
          if (includeParents && file.oldSha && file.status !== 'A') {
            const commitInfo = await git.getCommitInfo(sha);
            if (commitInfo.parent) {
              this.addBlobNeed(plan, file.oldSha, commitInfo.parent, file.oldPath || file.path);
            }
          }
        }
      } catch (error) {
        logWarn(`[GitCacheService] Failed to plan for ${sha}: ${error}`);
      }
    }

    // 2. Filter out blobs already in DB or cache
    const neededBlobs = Array.from(plan.blobsToFetch);
    const missingBlobs = await this.filterExistingBlobs(neededBlobs);

    // 3. For blobs that were already in cache, populate contentCache now
    // (They won't be fetched again, so we need to set up their path mappings)
    const existingBlobs = neededBlobs.filter(sha => !missingBlobs.includes(sha));
    for (const blobSha of existingBlobs) {
      const content = this.blobCache.get(blobSha);
      if (content !== undefined) {
        const usages = plan.blobUsage.get(blobSha) || [];
        for (const { commitSha, filePath } of usages) {
          this.setContentByPath(commitSha, filePath, content);
        }
      }
    }

    // Update plan to only fetch missing
    plan.blobsToFetch = new Set(missingBlobs);

    return plan;
  }

  /**
   * Get cached file changes for a commit. Falls back to git if not cached.
   * This should be called AFTER planAllContentNeeds has been run.
   */
  async getCachedFileChanges(sha: string): Promise<FileChange[]> {
    const cached = this.fileChangesCache.get(sha);
    if (cached) {
      return cached;
    }

    // Fallback to git and cache
    const git = this.getGit();
    const files = await git.getFileChanges(sha);
    this.fileChangesCache.set(sha, files);
    return files;
  }

  private addBlobNeed(
    plan: ContentPlan,
    blobSha: string,
    commitSha: string,
    filePath: string
  ): void {
    plan.blobsToFetch.add(blobSha);
    if (!plan.blobUsage.has(blobSha)) {
      plan.blobUsage.set(blobSha, []);
    }
    plan.blobUsage.get(blobSha)!.push({ commitSha, filePath });
  }

  /**
   * Filter out blobs that are already in memory or DB
   */
  private async filterExistingBlobs(blobShas: string[]): Promise<string[]> {
    const missing: string[] = [];

    for (const sha of blobShas) {
      // Check memory
      if (this.blobCache.has(sha)) {
        // Ensure mapped to paths
        continue;
      }

      // Check DB
      if (this.db) {
        const row = this.db.prepare('SELECT content FROM blob_content WHERE blob_sha = ?').get(sha);
        if (row) {
          this.blobCache.set(sha, row.content);
          continue;
        }
      }

      missing.push(sha);
    }

    return missing;
  }

  /**
   * Batch fetch blobs using git cat-file --batch
   */
  async batchFetchBlobs(blobShas: string[]): Promise<Map<string, string>> {
    if (blobShas.length === 0) return new Map();

    const results = new Map<string, string>();
    const startTime = Date.now();
    const git = this.getGit();

    logInfo(`[GitCacheService] Batch fetching ${blobShas.length} blobs via cat-file --batch`);

    const catFile = spawn('git', ['cat-file', '--batch'], {
      cwd: git.getRoot(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return new Promise((resolve, reject) => {
      let stdout = Buffer.alloc(0);
      let currentBlobIndex = 0;
      let errorOutput = '';

      catFile.stderr.on('data', data => {
        errorOutput += data.toString();
      });

      catFile.stdout.on('data', (chunk: Buffer) => {
        stdout = Buffer.concat([stdout, chunk]);

        // Parse output: "<sha> <type> <size>\n<content>\n"
        while (currentBlobIndex < blobShas.length) {
          const headerEnd = stdout.indexOf('\n');
          if (headerEnd === -1) break;

          const header = stdout.slice(0, headerEnd).toString();
          const [sha, type, sizeStr] = header.split(' ');

          if (type === 'missing') {
            results.set(blobShas[currentBlobIndex], '');
            stdout = stdout.slice(headerEnd + 1);
            currentBlobIndex++;
            continue;
          }

          const size = parseInt(sizeStr, 10);
          const contentStart = headerEnd + 1;
          const contentEnd = contentStart + size;

          if (stdout.length < contentEnd + 1) break; // Wait for more data

          const content = stdout.slice(contentStart, contentEnd).toString('utf-8');
          results.set(sha, content);

          stdout = stdout.slice(contentEnd + 1); // Skip trailing newline
          currentBlobIndex++;
        }
      });

      catFile.on('close', code => {
        if (code !== 0 && errorOutput) {
          logWarn(`[GitCacheService] cat-file --batch exited with code ${code}: ${errorOutput}`);
        }
        logInfo(
          `[GitCacheService] Batch fetched ${results.size} blobs in ${Date.now() - startTime}ms`
        );
        resolve(results);
      });

      catFile.on('error', reject);

      // Write all blob SHAs to stdin
      for (const sha of blobShas) {
        catFile.stdin.write(sha + '\n');
      }
      catFile.stdin.end();
    });
  }

  /**
   * Store blob in cache and DB
   */
  async storeBlob(blobSha: string, content: string): Promise<void> {
    this.blobCache.set(blobSha, content);

    if (this.db) {
      try {
        this.db
          .prepare(
            `
          INSERT OR IGNORE INTO blob_content (blob_sha, content, size, created_at)
          VALUES (?, ?, ?, ?)
        `
          )
          .run(blobSha, content, content.length, new Date().toISOString());
      } catch (error) {
        logWarn(`[GitCacheService] Failed to store blob ${blobSha}: ${error}`);
      }
    }
  }

  /**
   * Warm content cache for specific paths at a commit.
   * Uses tree cache to get blob SHAs and batch fetches content.
   * Useful for workspace changes that need HEAD content.
   */
  async warmContentForPaths(sha: string, paths: string[]): Promise<void> {
    const treeMap = this.treeCache.get(sha);
    if (!treeMap) {
      logWarn(`[GitCacheService] Tree cache not warmed for ${sha}, skipping content warm`);
      return;
    }

    // Find blob SHAs for paths that aren't already cached
    const blobsToFetch = new Map<string, { commitSha: string; filePath: string }[]>();

    for (const path of paths) {
      const key = `${sha}:${path}`;
      if (this.contentCache.has(key)) continue;

      const entry = treeMap.get(path);
      if (!entry || entry.type !== 'blob') continue;

      // Check if blob is already in cache
      if (this.blobCache.has(entry.sha)) {
        this.setContentByPath(sha, path, this.blobCache.get(entry.sha)!);
        continue;
      }

      if (!blobsToFetch.has(entry.sha)) {
        blobsToFetch.set(entry.sha, []);
      }
      blobsToFetch.get(entry.sha)!.push({ commitSha: sha, filePath: path });
    }

    if (blobsToFetch.size === 0) return;

    logInfo(`[GitCacheService] Warming content for ${blobsToFetch.size} blobs at ${sha}`);

    // Batch fetch
    const contents = await this.batchFetchBlobs(Array.from(blobsToFetch.keys()));

    for (const [blobSha, content] of contents) {
      await this.storeBlob(blobSha, content);
      const usages = blobsToFetch.get(blobSha) || [];
      for (const { commitSha, filePath } of usages) {
        this.setContentByPath(commitSha, filePath, content);
      }
    }
  }

  /**
   * Map a blob content to a specific commit/path
   */
  setContentByPath(commitSha: string, filePath: string, content: string): void {
    const key = `${commitSha}:${filePath}`;
    this.contentCache.set(key, content);
    this.sizeCache.set(key, content.length);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // LEGACY WARMING (Optimized)
  // ─────────────────────────────────────────────────────────────────────────────

  async warmIgnoreCache(files: string[]): Promise<void> {
    if (this.ignoreWarmed || files.length === 0) return;

    const startTime = Date.now();
    const git = this.getGit();

    try {
      const CHUNK_SIZE = 2000;
      const chunks: string[][] = [];
      for (let i = 0; i < files.length; i += CHUNK_SIZE) {
        chunks.push(files.slice(i, i + CHUNK_SIZE));
      }

      logInfo(
        `[GitCacheService] Checking ignores for ${files.length} files in ${chunks.length} chunks`
      );

      const limit = require('p-limit')(4);
      await Promise.all(
        chunks.map(chunk =>
          limit(async () => {
            const ignoreMap = await git.areIgnored(chunk);
            for (const [path, isIgnored] of ignoreMap) {
              if (isIgnored) {
                this.ignoredPaths.add(path);
              }
            }
          })
        )
      );

      this.ignoreWarmed = true;
      logInfo(`[GitCacheService] Ignore cache warmed in ${Date.now() - startTime}ms`);
    } catch (error) {
      logWarn(`[GitCacheService] Failed to warm ignore cache: ${error}`);
    }
  }

  /**
   * Warm tree cache for a commit (fetches all tree entries via ls-tree -r)
   * This allows getBlobSha to return cached results
   */
  async warmTreeCache(sha: string): Promise<void> {
    if (this.treesWarmed.has(sha)) return;

    const startTime = Date.now();
    const git = this.getGit();

    return new Promise(resolve => {
      const lsTree = spawn('git', ['ls-tree', '-r', sha], {
        cwd: git.getRoot(),
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      lsTree.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      lsTree.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      lsTree.on('close', code => {
        if (code !== 0) {
          logWarn(`[GitCacheService] Failed to warm tree cache for ${sha}: ${stderr}`);
          resolve();
          return;
        }

        const lines = stdout
          .trim()
          .split('\n')
          .filter((l: string) => l.trim());
        const treeMap = new Map<string, TreeEntry>();

        for (const line of lines) {
          // Format: <mode> <type> <sha>\t<path>
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

        this.treeCache.set(sha, treeMap);
        this.treesWarmed.add(sha);
        logInfo(
          `[GitCacheService] Tree cache warmed for ${sha} with ${treeMap.size} entries in ${Date.now() - startTime}ms`
        );
        resolve();
      });

      lsTree.on('error', error => {
        logWarn(`[GitCacheService] Failed to spawn ls-tree for ${sha}: ${error}`);
        resolve();
      });
    });
  }

  /**
   * Warm size cache for a list of specific (sha, path) items
   * Uses git cat-file --batch-check for efficiency
   */
  async warmSizeCacheForItems(items: { sha: string; path: string }[]): Promise<void> {
    const missingItems = items.filter(item => !this.isSizeCached(item.sha, item.path));
    if (missingItems.length === 0) return;

    logInfo(`[GitCacheService] Warming sizes for ${missingItems.length} items`);
    const startTime = Date.now();
    const git = this.getGit();

    const catFile = spawn('git', ['cat-file', '--batch-check'], {
      cwd: git.getRoot(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return new Promise((resolve, reject) => {
      let stdout = Buffer.alloc(0);
      let currentIndex = 0;
      let errorOutput = '';

      catFile.stderr.on('data', data => {
        errorOutput += data.toString();
      });

      catFile.stdout.on('data', (chunk: Buffer) => {
        stdout = Buffer.concat([stdout, chunk]);

        while (currentIndex < missingItems.length) {
          const lineEnd = stdout.indexOf('\n');
          if (lineEnd === -1) break;

          const line = stdout.slice(0, lineEnd).toString();
          const parts = line.split(' ');

          // Format: <sha> <type> <size> OR <input> missing
          // If successful: "blob_sha blob 1234"
          if (parts.length >= 3 && parts[1] === 'blob') {
            const size = parseInt(parts[2], 10);
            if (!isNaN(size)) {
              const item = missingItems[currentIndex];
              this.sizeCache.set(`${item.sha}:${item.path}`, size);
            }
          }

          stdout = stdout.slice(lineEnd + 1);
          currentIndex++;
        }
      });

      catFile.on('close', code => {
        if (code !== 0 && errorOutput) {
          logWarn(
            `[GitCacheService] cat-file --batch-check exited with code ${code}: ${errorOutput}`
          );
        }
        logInfo(`[GitCacheService] Warmed sizes in ${Date.now() - startTime}ms`);
        resolve();
      });

      catFile.on('error', reject);

      for (const item of missingItems) {
        catFile.stdin.write(`${item.sha}:${item.path}\n`);
      }
      catFile.stdin.end();
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // LOOKUPS
  // ─────────────────────────────────────────────────────────────────────────────

  isIgnored(path: string): boolean {
    if (!this.ignoreWarmed) {
      this.stats.ignoreMisses++;
      return false;
    }
    this.stats.ignoreHits++;
    return this.ignoredPaths.has(path);
  }

  isIgnoreCacheWarmed(): boolean {
    return this.ignoreWarmed;
  }

  getBlobSha(sha: string, path: string): string | undefined {
    // We don't really use treeCache anymore with the new plan,
    // but keep it if populated
    const tree = this.treeCache.get(sha);
    if (tree) {
      const entry = tree.get(path);
      if (entry) return entry.sha;
    }
    return undefined;
  }

  isTreeCached(sha: string): boolean {
    return this.treesWarmed.has(sha);
  }

  getContent(sha: string, path: string): string | undefined {
    const key = `${sha}:${path}`;
    const content = this.contentCache.get(key);

    if (content !== undefined) {
      this.stats.contentHits++;
      return content;
    }

    this.stats.contentMisses++;
    return undefined;
  }

  isContentCached(sha: string, path: string): boolean {
    return this.contentCache.has(`${sha}:${path}`);
  }

  getSize(sha: string, path: string): number | undefined {
    const key = `${sha}:${path}`;
    if (this.sizeCache.has(key)) {
      return this.sizeCache.get(key);
    }
    const content = this.contentCache.get(key);
    if (content !== undefined) {
      return content.length;
    }
    return undefined;
  }

  isSizeCached(sha: string, path: string): boolean {
    return this.sizeCache.has(`${sha}:${path}`) || this.contentCache.has(`${sha}:${path}`);
  }
}

export function getGitCacheService(): GitCacheService {
  return GitCacheService.getInstance();
}
