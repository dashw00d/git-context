import * as fs from 'fs';
import * as path from 'path';
import simpleGit, { SimpleGit } from 'simple-git';
import { CommitInfo, FileChange } from '../types';
import { withTimeout } from '../utils/async';
import { getGitRoot } from '../utils/config';
import { logDebug, logError, logWarn } from '../utils/logger';

export class GitOperations {
  private gitRoot: string;
  private git: SimpleGit;
  private static hotspotCache: Map<string, { expires: number; data: HotspotStat[] }> = new Map();
  private static headShaCache?: { value: string; expires: number };
  private static statusCache?: { output: string; expires: number };
  private static untrackedCache?: { files: string[]; expires: number };
  // Pending promise caches to deduplicate concurrent requests
  private static pendingStatusPromise?: Promise<string>;
  private static pendingUntrackedPromise?: Promise<string[]>;
  private static pendingHeadShaPromise?: Promise<string>;
  private commitInfoCache = new Map<string, CommitInfo>();
  private static sharedCommitInfoCache = new Map<string, CommitInfo>();

  private static gitInstances: Map<string, SimpleGit> = new Map();

  constructor() {
    const root = getGitRoot();
    if (!root) {
      logError('GitOperations: Not in a git repository');
      this.gitRoot = '';
      if (!GitOperations.gitInstances.has('')) {
        GitOperations.gitInstances.set('', simpleGit(''));
      }
      this.git = GitOperations.gitInstances.get('')!;
      return;
    }
    this.gitRoot = root;
    if (!GitOperations.gitInstances.has(root)) {
      GitOperations.gitInstances.set(root, simpleGit(root));
    }
    this.git = GitOperations.gitInstances.get(root)!;
  }

  public getRoot(): string {
    return this.gitRoot;
  }

  /**
   * Get the shared SimpleGit instance for a given root.
   * Use this instead of creating new simpleGit() instances to avoid queue contention.
   */
  public static getSimpleGit(root?: string): SimpleGit {
    const actualRoot = root || getGitRoot() || '';
    if (!GitOperations.gitInstances.has(actualRoot)) {
      GitOperations.gitInstances.set(actualRoot, simpleGit(actualRoot));
    }
    return GitOperations.gitInstances.get(actualRoot)!;
  }

  /**
   * Get basic commit information
   */
  async getCommitInfo(sha: string): Promise<CommitInfo> {
    // Check shared static cache first (survives across instances)
    if (GitOperations.sharedCommitInfoCache.has(sha)) {
      return GitOperations.sharedCommitInfoCache.get(sha)!;
    }
    // Check instance cache
    if (this.commitInfoCache.has(sha)) {
      return this.commitInfoCache.get(sha)!;
    }

    try {
      // Use git log instead of show - it's faster for getting commit metadata
      const format = '--pretty=format:%H%n%an%n%ad%n%s%n%p';
      const output = await withTimeout(
        this.git.raw(['log', '-1', '--date=iso', format, sha]),
        10000, // Reduced timeout from 30s to 10s
        'Git show commit info'
      );

      const lines = output.split('\n');
      if (lines.length < 4) {
        logError(`Invalid commit format for SHA: ${sha}`);
        return { sha, author: '', date: '', message: '', parent: undefined };
      }

      const info = {
        sha: lines[0],
        author: lines[1] || '',
        date: lines[2] || '',
        message: lines[3] || '',
        parent: lines[4] || undefined,
      };

      // Cache the result in both instance and shared cache
      this.commitInfoCache.set(sha, info);
      GitOperations.sharedCommitInfoCache.set(sha, info);
      return info;
    } catch (error: any) {
      logError(`Failed to get commit info for ${sha}: ${error.message}`);
      return { sha, author: '', date: '', message: '', parent: undefined };
    }
  }

  /**
   * Get list of commits (newest first)
   */
  async getRecentCommits(count: number = 5): Promise<CommitInfo[]> {
    try {
      const format = '--pretty=format:%H%n%an%n%ad%n%s%n%p';
      const output = await withTimeout(
        this.git.raw(['log', '--no-merges', `-${count}`, '--date=iso', format]),
        30000,
        'Git log recent commits'
      );

      return this.parseCommitLog(output);
    } catch (error: any) {
      logError(`Failed to get recent commits: ${error.message}`);
      return [];
    }
  }

  async getCommitsInRange(range: string): Promise<CommitInfo[]> {
    try {
      const format = '--pretty=format:%H%n%an%n%ad%n%s%n%p';
      const output = await withTimeout(
        this.git.raw(['log', '--no-merges', range, '--date=iso', format]),
        30000,
        'Git log range commits'
      );

      return this.parseCommitLog(output);
    } catch (error: any) {
      logError(`Failed to get commits in range ${range}: ${error.message}`);
      return [];
    }
  }

  private parseCommitLog(output: string): CommitInfo[] {
    const commits: CommitInfo[] = [];
    const lines = output.split('\n');
    const blockSize = 5;

    for (let i = 0; i < lines.length; i += blockSize) {
      if (!lines[i] || !lines[i].trim()) continue;

      commits.push({
        sha: lines[i],
        author: lines[i + 1] || '',
        date: lines[i + 2] || '',
        message: lines[i + 3] || '',
        parent: lines[i + 4] || undefined,
      });
    }
    return commits;
  }

  private async getSharedStatus(ttlMs = 10000): Promise<string> {
    const now = Date.now();
    // Check cache first
    if (GitOperations.statusCache && GitOperations.statusCache.expires > now) {
      return GitOperations.statusCache.output;
    }

    // If there's already a pending request, wait for it instead of making a new one
    if (GitOperations.pendingStatusPromise) {
      return GitOperations.pendingStatusPromise;
    }

    // Create new request using spawn directly (bypasses simple-git queue)
    GitOperations.pendingStatusPromise = (async () => {
      try {
        const { spawn } = await import('child_process');
        const startTime = Date.now();
        logDebug(`[GitOperations] Starting git status --porcelain in ${this.gitRoot}`);

        const output = await new Promise<string>((resolve, reject) => {
          // Use GIT_OPTIONS to skip hooks and optional locks for faster execution
          // This helps avoid hangs from slow hooks or lock contention
          const env = {
            ...process.env,
            GIT_OPTIONS: '--no-optional-locks',
          };

          const proc = spawn('git', ['status', '--porcelain'], {
            cwd: this.gitRoot,
            stdio: ['pipe', 'pipe', 'pipe'],
            env,
          });

          let stdout = '';
          let stderr = '';
          let hasOutput = false;

          proc.stdout.on('data', (data: Buffer) => {
            stdout += data.toString();
            hasOutput = true;
            const elapsed = Date.now() - startTime;
            if (elapsed > 5000 && elapsed % 10000 < 100) {
              // Log progress every 10 seconds after 5 seconds
              logDebug(
                `[GitOperations] git status still running, ${elapsed}ms elapsed, ${stdout.length} bytes received`
              );
            }
          });

          proc.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
            logWarn(`[GitOperations] git status stderr: ${data.toString().trim()}`);
          });

          // Set timeout - increased from 30s to 120s for large repos
          const timeout = setTimeout(() => {
            const elapsed = Date.now() - startTime;
            logWarn(
              `[GitOperations] git status --porcelain timed out after ${elapsed}ms. stdout length: ${stdout.length}, hasOutput: ${hasOutput}, stderr: ${stderr || '(none)'}`
            );
            proc.kill('SIGKILL'); // Force kill if SIGTERM doesn't work
            const errorMsg = stderr
              ? `git status --porcelain timed out after ${elapsed}ms. stderr: ${stderr}`
              : `git status --porcelain timed out after ${elapsed}ms`;
            reject(new Error(errorMsg));
          }, 120000); // 120 seconds

          proc.on('close', code => {
            clearTimeout(timeout);
            const elapsed = Date.now() - startTime;
            if (code === 0) {
              logDebug(
                `[GitOperations] git status --porcelain completed in ${elapsed}ms, ${stdout.length} bytes`
              );
              resolve(stdout);
            } else {
              const errorMsg = stderr
                ? `git status --porcelain exited with code ${code} after ${elapsed}ms. stderr: ${stderr}`
                : `git status --porcelain exited with code ${code} after ${elapsed}ms`;
              logWarn(`[GitOperations] ${errorMsg}`);
              reject(new Error(errorMsg));
            }
          });

          proc.on('error', err => {
            clearTimeout(timeout);
            logError(`[GitOperations] git status --porcelain spawn error:`, err);
            reject(err);
          });
        });

        // Calculate expiration AFTER operation completes, not before
        const expiresAt = Date.now() + ttlMs;
        GitOperations.statusCache = { output, expires: expiresAt };
        GitOperations.untrackedCache = undefined;
        return output;
      } finally {
        // Clear pending promise when done (success or failure)
        GitOperations.pendingStatusPromise = undefined;
      }
    })();

    return GitOperations.pendingStatusPromise;
  }

  private async getSharedUntracked(ttlMs = 10000): Promise<string[]> {
    const now = Date.now();
    // Check cache first
    if (GitOperations.untrackedCache && GitOperations.untrackedCache.expires > now) {
      return GitOperations.untrackedCache.files;
    }

    // If there's already a pending request, wait for it instead of making a new one
    if (GitOperations.pendingUntrackedPromise) {
      return GitOperations.pendingUntrackedPromise;
    }

    // Create new request using spawn directly (bypasses simple-git queue)
    GitOperations.pendingUntrackedPromise = (async () => {
      try {
        const { spawn } = await import('child_process');
        const startTime = Date.now();
        logDebug(`[GitOperations] Starting git ls-files --others in ${this.gitRoot}`);

        const output = await new Promise<string>((resolve, reject) => {
          // Use GIT_OPTIONS to skip hooks and optional locks for faster execution
          const env = {
            ...process.env,
            GIT_OPTIONS: '--no-optional-locks',
          };

          const proc = spawn('git', ['ls-files', '--others', '--exclude-standard'], {
            cwd: this.gitRoot,
            stdio: ['pipe', 'pipe', 'pipe'],
            env,
          });

          let stdout = '';
          let stderr = '';
          let hasOutput = false;

          proc.stdout.on('data', (data: Buffer) => {
            stdout += data.toString();
            hasOutput = true;
            const elapsed = Date.now() - startTime;
            if (elapsed > 5000 && elapsed % 10000 < 100) {
              // Log progress every 10 seconds after 5 seconds
              logDebug(
                `[GitOperations] git ls-files still running, ${elapsed}ms elapsed, ${stdout.length} bytes received`
              );
            }
          });

          proc.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
            logWarn(`[GitOperations] git ls-files stderr: ${data.toString().trim()}`);
          });

          // Set timeout - increased from 30s to 120s for large repos
          const timeout = setTimeout(() => {
            const elapsed = Date.now() - startTime;
            logWarn(
              `[GitOperations] git ls-files --others timed out after ${elapsed}ms. stdout length: ${stdout.length}, hasOutput: ${hasOutput}, stderr: ${stderr || '(none)'}`
            );
            proc.kill('SIGKILL'); // Force kill if SIGTERM doesn't work
            const errorMsg = stderr
              ? `git ls-files --others timed out after ${elapsed}ms. stderr: ${stderr}`
              : `git ls-files --others timed out after ${elapsed}ms`;
            reject(new Error(errorMsg));
          }, 120000); // 120 seconds

          proc.on('close', code => {
            clearTimeout(timeout);
            const elapsed = Date.now() - startTime;
            if (code === 0) {
              logDebug(
                `[GitOperations] git ls-files --others completed in ${elapsed}ms, ${stdout.length} bytes`
              );
              resolve(stdout);
            } else {
              const errorMsg = stderr
                ? `git ls-files --others exited with code ${code} after ${elapsed}ms. stderr: ${stderr}`
                : `git ls-files --others exited with code ${code} after ${elapsed}ms`;
              logWarn(`[GitOperations] ${errorMsg}`);
              reject(new Error(errorMsg));
            }
          });

          proc.on('error', err => {
            clearTimeout(timeout);
            logError(`[GitOperations] git ls-files --others spawn error:`, err);
            reject(err);
          });
        });

        const files = this.parseFileList(output);
        // Calculate expiration AFTER operation completes, not before
        const expiresAt = Date.now() + ttlMs;
        GitOperations.untrackedCache = { files, expires: expiresAt };
        return files;
      } finally {
        // Clear pending promise when done (success or failure)
        GitOperations.pendingUntrackedPromise = undefined;
      }
    })();

    return GitOperations.pendingUntrackedPromise;
  }

  /**
   * Get file changes for a commit
   */
  async getFileChanges(sha: string): Promise<FileChange[]> {
    try {
      let output: string;
      try {
        // Use raw format to get blob SHAs
        output = await withTimeout(
          this.git.raw(['diff-tree', '-r', '--no-commit-id', sha]),
          30000,
          'Git diff-tree'
        );
      } catch (e) {
        try {
          output = await withTimeout(
            this.git.raw([
              'diff-tree',
              '-r',
              '--no-commit-id',
              '4b825dc642cb6eb9a060e54bf8d69288fbee4904', // Empty tree SHA
              sha,
            ]),
            30000,
            'Git diff-tree empty fallback'
          );
        } catch (innerError) {
          logWarn(
            `Failed to get file changes for ${sha} (even with empty tree fallback): ${innerError}`
          );
          return [];
        }
      }

      const changes: FileChange[] = [];
      const lines = output.split('\n').filter(line => line.trim());

      for (const line of lines) {
        // Format: :<old-mode> <new-mode> <old-sha> <new-sha> <status>\t<path>
        // Or for rename: :<old-mode> <new-mode> <old-sha> <new-sha> <status>\t<old-path>\t<new-path>
        if (!line.startsWith(':')) continue;

        const parts = line.split('\t');
        const meta = parts[0].substring(1).split(' '); // Remove leading ':' and split by space

        if (meta.length < 5) continue;

        const oldSha = meta[2];
        const newSha = meta[3];
        const statusRaw = meta[4];
        const statusChar = statusRaw.charAt(0);

        const filePath = parts[1]; // This is the path (or old path for rename?)
        // For rename/copy, parts[1] is old path, parts[2] is new path
        // Wait, git diff-tree output for rename:
        // :100644 100644 <old-sha> <new-sha> R100\told-path\tnew-path

        let path = filePath;
        let oldPath: string | undefined;
        let status: FileChange['status'] = 'M';

        if (statusChar === 'R' || statusChar === 'C') {
          oldPath = parts[1];
          path = parts[2];
          status = statusChar as FileChange['status'];
        } else if (['A', 'M', 'D', 'U'].includes(statusChar)) {
          status = statusChar as FileChange['status'];
          path = parts[1];
        }

        changes.push({
          path,
          status,
          oldPath,
          newSha,
          oldSha,
        });
      }

      return changes;
    } catch (error: any) {
      logWarn(`Failed to get file changes for ${sha}: ${error}`);
      return [];
    }
  }

  /**
   * Get raw diff for a commit
   */
  async getCommitDiff(sha: string): Promise<string> {
    try {
      return await withTimeout(
        this.git.show([sha, '--pretty=format:']),
        30000,
        'Git show commit diff'
      );
    } catch (error: any) {
      logError(`Failed to get commit diff for ${sha}: ${error.message}`);
      return '';
    }
  }

  /**
   * Get diff for a specific file in a commit
   */
  async getFileDiff(sha: string, filePath: string): Promise<string> {
    try {
      return await withTimeout(
        this.git.show([sha, '--pretty=format:', '--patch', '--', filePath]),
        30000,
        'Git show file diff'
      );
    } catch (error: any) {
      logError(`Failed to get file diff for ${filePath} at ${sha}: ${error.message}`);
      return '';
    }
  }

  /**
   * Get diff for a file across a range of commits (bundle)
   */
  async getBundleDiff(startSha: string, endSha: string, filePath: string): Promise<string> {
    try {
      return await withTimeout(
        this.git.diff([`${startSha}~1..${endSha}`, '--', filePath]),
        30000,
        'Git diff bundle'
      );
    } catch (e) {
      try {
        return await withTimeout(
          this.git.diff([`${startSha}..${endSha}`, '--', filePath]),
          30000,
          'Git diff bundle fallback'
        );
      } catch (error: any) {
        logError(`Failed to get bundle diff for ${filePath}: ${error.message}`);
        return '';
      }
    }
  }

  /**
   * Get staged changes diff
   */
  async getStagedDiff(): Promise<string> {
    try {
      return await withTimeout(this.git.diff(['--cached']), 30000, 'Git diff staged');
    } catch (error: any) {
      logError(`Failed to get staged diff: ${error.message}`);
      return '';
    }
  }

  /**
   * Get file content at specific commit
   */
  async getFileContent(sha: string, filePath: string): Promise<string> {
    try {
      return await withTimeout(
        this.git.show([`${sha}:${filePath}`]),
        30000,
        'Git show file content'
      );
    } catch (error: any) {
      logError(`Failed to get file content for ${filePath} at ${sha}: ${error.message}`);
      return '';
    }
  }

  /**
   * Safely get file content, returning empty string if file doesn't exist
   * Uses cache if available, falls back to direct call
   */
  async safeGetFileContent(sha: string, filePath: string): Promise<string> {
    // Check cache first
    try {
      const { getGitCacheService } = await import('../services/gitCacheService');
      const cache = getGitCacheService();
      const cached = cache.getContent(sha, filePath);
      if (cached !== undefined) {
        return cached;
      }
    } catch {
      // Cache not available
    }

    // If not in cache, this should not happen if cache was warmed properly
    // But fail fast rather than timing out
    logWarn(
      `[GitOperations] File content not in cache: ${sha}:${filePath} - cache should have been warmed`
    );
    return '';
  }

  /**
   * Get staged file content (from index)
   */
  async getStagedContent(filePath: string): Promise<string> {
    try {
      return await withTimeout(this.git.show([`:${filePath}`]), 30000, 'Git show staged content');
    } catch (error: any) {
      logError(`Failed to get staged content for ${filePath}: ${error.message}`);
      return '';
    }
  }

  /**
   * Safely get staged file content, returning empty string if file doesn't exist in index
   */
  async safeGetStagedContent(filePath: string): Promise<string> {
    try {
      return await this.getStagedContent(filePath);
    } catch (error: any) {
      if (this.isGitPathMissing(error)) {
        return '';
      }
      logError(`Failed to get staged content for ${filePath}: ${error.message}`);
      return '';
    }
  }

  /**
   * Get working directory file content
   */
  getWorkingContent(filePath: string): string {
    const fullPath = path.join(this.gitRoot, filePath);
    return fs.readFileSync(fullPath, 'utf8');
  }

  /**
   * Safely get working directory file content, returning empty string if file doesn't exist
   */
  safeGetWorkingContent(filePath: string): string {
    try {
      return this.getWorkingContent(filePath);
    } catch (error: any) {
      return '';
    }
  }

  /**
   * Check if multiple files are ignored by git in a single call
   * Uses spawn directly to bypass simple-git queue for parallelism
   */
  async areIgnored(filePaths: string[]): Promise<Map<string, boolean>> {
    const result = new Map<string, boolean>();
    if (filePaths.length === 0) return result;

    // Check cache first
    try {
      const { getGitCacheService } = await import('../services/gitCacheService');
      const cache = getGitCacheService();
      if (cache.isIgnoreCacheWarmed()) {
        for (const p of filePaths) {
          result.set(p, cache.isIgnored(p));
        }
        return result;
      }
    } catch {
      // Cache not available
    }

    // Initialize all as not ignored
    for (const p of filePaths) {
      result.set(p, false);
    }

    // Use spawn directly with --stdin to bypass simple-git queue
    try {
      const { spawn } = await import('child_process');
      const ignored = await new Promise<string[]>(resolve => {
        const proc = spawn('git', ['check-ignore', '--stdin'], {
          cwd: this.gitRoot,
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        let stdout = '';
        proc.stdout.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        proc.on('close', () => {
          // check-ignore exits with 1 if no files are ignored, 0 if some are
          // Either way, parse stdout for ignored files
          const ignoredPaths = stdout
            .trim()
            .split('\n')
            .filter(line => line.trim());
          resolve(ignoredPaths);
        });

        proc.on('error', () => resolve([]));

        // Write all paths to stdin
        proc.stdin.write(filePaths.join('\n'));
        proc.stdin.end();
      });

      // Mark the ignored files
      for (const p of ignored) {
        result.set(p, true);
      }
    } catch (error) {
      // If check-ignore fails, assume none are ignored
    }

    return result;
  }

  /**
   * Check if a file is ignored by git
   * Uses cache if available, falls back to areIgnored (spawn-based)
   */
  async isIgnored(filePath: string): Promise<boolean> {
    // Check cache first (import dynamically to avoid circular deps)
    try {
      const { getGitCacheService } = await import('../services/gitCacheService');
      const cache = getGitCacheService();
      if (cache.isIgnoreCacheWarmed()) {
        return cache.isIgnored(filePath);
      }
    } catch {
      // Cache not available, fall through to direct call
    }

    // Use areIgnored which uses spawn directly (bypasses simple-git queue)
    try {
      const result = await this.areIgnored([filePath]);
      const isIgn = result.get(filePath) ?? false;
      if (isIgn) {
        logDebug(`${filePath} IS IGNORED.`);
      }
      return isIgn;
    } catch (error) {
      return false;
    }
  }

  async isIgnoredAtCommit(sha: string, filePath: string): Promise<boolean> {
    return this.isIgnored(filePath);
  }

  async getHeadSha(): Promise<string> {
    try {
      const now = Date.now();
      // Check cache first
      if (GitOperations.headShaCache && GitOperations.headShaCache.expires > now) {
        return GitOperations.headShaCache.value;
      }

      // If there's already a pending request, wait for it instead of making a new one
      if (GitOperations.pendingHeadShaPromise) {
        return GitOperations.pendingHeadShaPromise;
      }

      // Create new request and cache the promise
      // Use spawn directly to bypass simple-git's queue (like getFullTree does)
      // This avoids waiting behind other queued git operations
      GitOperations.pendingHeadShaPromise = (async () => {
        try {
          const { spawn } = await import('child_process');
          const result = await new Promise<string>((resolve, reject) => {
            const proc = spawn('git', ['rev-parse', 'HEAD'], {
              cwd: this.gitRoot,
              stdio: ['pipe', 'pipe', 'pipe'],
            });

            let stdout = '';
            proc.stdout.on('data', (data: Buffer) => {
              stdout += data.toString();
            });

            proc.on('close', code => {
              if (code === 0) {
                resolve(stdout.trim());
              } else {
                reject(new Error(`git rev-parse HEAD exited with code ${code}`));
              }
            });

            proc.on('error', reject);
          });

          // Calculate expiration AFTER operation completes, not before
          // HEAD SHA only changes on commit/checkout, so cache for 30 seconds
          const expiresAt = Date.now() + 30000;
          GitOperations.headShaCache = { value: result, expires: expiresAt };
          return result;
        } finally {
          // Clear pending promise when done (success or failure)
          GitOperations.pendingHeadShaPromise = undefined;
        }
      })();

      return GitOperations.pendingHeadShaPromise;
    } catch (error: any) {
      logError(`Failed to get HEAD SHA: ${error.message}`);
      return '';
    }
  }

  /**
   * Get blob SHA for multiple file paths in a single git ls-tree call
   * Much more efficient than calling getBlobSha for each file individually
   */
  async getBlobShas(sha: string, filePaths: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (filePaths.length === 0) return result;

    try {
      const output = await withTimeout(
        this.git.raw(['ls-tree', '-r', sha, '--', ...filePaths]),
        30000,
        'Git ls-tree'
      );
      const lines = output
        .trim()
        .split('\n')
        .filter(l => l.trim());

      for (const line of lines) {
        const parsed = this.parseLsTreeLine(line);
        if (parsed) {
          result.set(parsed.path, parsed.sha);
        }
      }
    } catch (error: any) {
      logError(`Failed to get blob SHAs at ${sha}: ${error.message}`);
    }

    return result;
  }

  async getBlobSha(sha: string, filePath: string): Promise<string> {
    // Check cache first
    try {
      const { getGitCacheService } = await import('../services/gitCacheService');
      const cache = getGitCacheService();
      if (cache.isTreeCached(sha)) {
        const cached = cache.getBlobSha(sha, filePath);
        if (cached) return cached;
        // File not in tree at this commit
        return '';
      }
    } catch {
      // Cache not available, fall through to direct call
    }

    // Direct call (cold start only)
    try {
      const output = await withTimeout(
        this.git.raw(['ls-tree', '-r', sha, '--', filePath]),
        30000,
        'Git ls-tree'
      );
      const lines = output
        .trim()
        .split('\n')
        .filter(l => l.trim());

      for (const line of lines) {
        const parsed = this.parseLsTreeLine(line);
        if (parsed && parsed.path === filePath) {
          return parsed.sha;
        }
      }

      logWarn(`No matching ls-tree entry for ${filePath} at ${sha}`);
      return '';
    } catch (error: any) {
      logError(`Failed to get blob SHA for ${filePath} at ${sha}: ${error.message}`);
      return '';
    }
  }

  async getBlobSize(sha: string, filePath: string): Promise<number> {
    // Check cache first
    try {
      const { getGitCacheService } = await import('../services/gitCacheService');
      const cache = getGitCacheService();
      const cachedSize = cache.getSize(sha, filePath);
      if (cachedSize !== undefined) {
        return cachedSize;
      }
    } catch {
      // Cache not available
    }

    try {
      const output = await withTimeout(
        this.git.raw(['cat-file', '-s', `${sha}:${filePath}`]),
        5000,
        'Git cat-file size'
      );
      return parseInt(output.trim(), 10) || 0;
    } catch (error) {
      return 0;
    }
  }

  async getCurrentBranch(): Promise<string | null> {
    try {
      const branch = await withTimeout(
        this.git.revparse(['--abbrev-ref', 'HEAD']),
        5000,
        'Git revparse branch'
      );
      if (!branch || branch === 'HEAD') {
        return null;
      }
      return branch;
    } catch {
      return null;
    }
  }

  async getBranchCommits(branch: string, limit: number = 100): Promise<string[]> {
    try {
      const log = await withTimeout(
        this.git.log({
          from: branch,
          maxCount: limit,
          format: {
            hash: '%H',
          },
        }),
        30000,
        'Git log branch commits'
      );
      return log.all.map(commit => commit.hash);
    } catch {
      return [];
    }
  }

  async isClean(): Promise<boolean> {
    try {
      await withTimeout(this.git.diff(['--quiet']), 5000, 'Git diff quiet');
      await withTimeout(this.git.diff(['--cached', '--quiet']), 5000, 'Git diff cached quiet');
      return true;
    } catch {
      return false;
    }
  }

  async getWorkingDirectoryChanges(): Promise<FileChange[]> {
    try {
      const output = await this.getSharedStatus();

      const changes: FileChange[] = [];
      const lines = output.split('\n').filter(line => line.trim());

      for (const line of lines) {
        const status = line.substring(0, 2).trim();
        const filePath = this.parseGitPath(line.substring(3));

        let changeStatus: FileChange['status'];
        if (status.includes('A')) {
          changeStatus = 'A';
        } else if (status.includes('M')) {
          changeStatus = 'M';
        } else if (status.includes('D')) {
          changeStatus = 'D';
        } else if (status.includes('R')) {
          changeStatus = 'R';
        } else if (status.includes('C')) {
          changeStatus = 'C';
        } else if (status.includes('U')) {
          changeStatus = 'U';
        } else {
          changeStatus = 'M';
        }

        changes.push({
          path: filePath,
          status: changeStatus,
        });
      }

      return changes;
    } catch (error) {
      logError('Failed to get working directory changes:', error);
      return [];
    }
  }

  private parseGitPath(rawPath: string): string {
    if (rawPath.startsWith('"') && rawPath.endsWith('"')) {
      const unquoted = rawPath.slice(1, -1);

      return unquoted
        .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
        .replace(/\\\\/g, '\\');
    }
    return rawPath;
  }

  private parseLsTreeLine(
    rawLine: string
  ): { mode: string; type: string; sha: string; path: string } | null {
    const tabIdx = rawLine.lastIndexOf('\t');
    if (tabIdx === -1 || tabIdx < 1) return null;

    const path = rawLine.slice(tabIdx + 1);
    const preSha = rawLine.slice(0, tabIdx).trim();
    const preParts = preSha.split(/\s+/);

    if (preParts.length < 3) return null;

    return { mode: preParts[0], type: preParts[1], sha: preParts[2], path };
  }

  private isGitPathMissing(error: any): boolean {
    const msg = (error.message || String(error)).toLowerCase();
    return (
      msg.includes('does not exist') ||
      msg.includes('did not match any file') ||
      msg.includes('exists on disk, but not in') ||
      msg.includes('neither on disk nor in')
    );
  }

  private parseFileList(raw: string): string[] {
    return raw
      .trim()
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);
  }

  async getStagedFiles(): Promise<FileChange[]> {
    try {
      const output = await this.getSharedStatus();

      const staged: FileChange[] = [];
      const lines = output.split('\n').filter(line => line.trim());

      for (const line of lines) {
        const status = line.substring(0, 2);
        const filePath = this.parseGitPath(line.substring(3));

        if (status.charAt(0) !== ' ' && status.charAt(0) !== '?') {
          let changeStatus: FileChange['status'];
          if (status.charAt(0) === 'A') {
            changeStatus = 'A';
          } else if (status.charAt(0) === 'M') {
            changeStatus = 'M';
          } else if (status.charAt(0) === 'D') {
            changeStatus = 'D';
          } else if (status.charAt(0) === 'R') {
            changeStatus = 'R';
          } else {
            changeStatus = 'M';
          }

          staged.push({
            path: filePath,
            status: changeStatus,
          });
        }
      }

      return staged;
    } catch (error) {
      logError('Failed to get staged files:', error);
      return [];
    }
  }

  async getUnstagedFiles(): Promise<FileChange[]> {
    try {
      const output = await this.getSharedStatus();

      const unstaged: FileChange[] = [];
      const lines = output.split('\n').filter(line => line.trim());

      for (const line of lines) {
        const status = line.substring(0, 2);
        const filePath = this.parseGitPath(line.substring(3));

        if (status.charAt(1) !== ' ') {
          let changeStatus: FileChange['status'];
          if (status.charAt(1) === 'A') {
            changeStatus = 'A';
          } else if (status.charAt(1) === 'M') {
            changeStatus = 'M';
          } else if (status.charAt(1) === 'D') {
            changeStatus = 'D';
          } else if (status.charAt(1) === 'R') {
            changeStatus = 'R';
          } else if (status.charAt(1) === '?') {
            changeStatus = 'U';
          } else {
            changeStatus = 'M';
          }

          unstaged.push({
            path: filePath,
            status: changeStatus,
          });
        }
      }

      try {
        const untrackedFiles = await this.getSharedUntracked();
        for (const filePath of untrackedFiles) {
          if (!unstaged.some(f => f.path === filePath)) {
            unstaged.push({
              path: filePath,
              status: 'U',
            });
          }
        }
      } catch (error) {
        //empty
      }

      return unstaged;
    } catch (error) {
      logError('Failed to get unstaged files:', error);
      return [];
    }
  }

  async getFileDiffStats(
    filePath: string,
    staged: boolean = false
  ): Promise<{ added: number; removed: number }> {
    try {
      const args = staged
        ? ['diff', '--cached', '--numstat', '--', filePath]
        : ['diff', '--numstat', '--', filePath];
      const output = await withTimeout(this.git.raw(args), 30000, 'Git diff numstat');

      if (!output.trim()) {
        return { added: 0, removed: 0 };
      }

      const parts = output.trim().split('\t');
      if (parts.length >= 2) {
        const added = parseInt(parts[0], 10) || 0;
        const removed = parseInt(parts[1], 10) || 0;
        return { added, removed };
      }

      return { added: 0, removed: 0 };
    } catch (error) {
      return { added: 0, removed: 0 };
    }
  }

  async getAllFiles(): Promise<string[]> {
    try {
      const output = await withTimeout(
        this.git.raw(['ls-files', '--cached', '--exclude-standard']),
        30000,
        'Git ls-files all'
      );
      return this.parseFileList(output);
    } catch (error: any) {
      logError(`Failed to get all files: ${error.message}`);
      return [];
    }
  }

  async getFileHistory(filePath: string, limit: number = 10): Promise<any[]> {
    try {
      // Ensure filePath is relative to git root (remove leading slash if present)
      const normalizedPath = filePath.replace(/^\/+/, '');

      // Use simple-git's log() method instead of raw() for better argument handling
      // The issue with raw() is that it might not handle the -- separator correctly
      const logResult = await withTimeout(
        this.git.log({
          maxCount: limit,
          file: normalizedPath,
          format: {
            hash: '%H',
            author_name: '%an',
            date: '%aI',
            message: '%s',
          },
        }),
        30000,
        'Git log file history'
      );

      const result = logResult.all.map(commit => ({
        hash: commit.hash,
        author: commit.author_name || 'Unknown',
        date: commit.date || '',
        message: commit.message || '',
        virtual: false,
      }));

      // Debug logging
      if (result.length === 1 && limit > 1) {
        logWarn(
          `[GitOperations] getFileHistory returned only 1 commit for ${filePath} (normalized: ${normalizedPath}, requested ${limit}). This might mean the file only has 1 commit in history.`
        );
      } else if (result.length > 0) {
        logDebug(
          `[GitOperations] getFileHistory returned ${result.length} commits for ${filePath} (requested ${limit})`
        );
      }

      return result;
    } catch (error: any) {
      logError(`Failed to get file history for ${filePath}: ${error.message}`);
      return [];
    }
  }

  async getFileHistoryWithStats(filePath: string, limit: number = 10): Promise<any[]> {
    try {
      const { stdout } = await this.spawnGit([
        'log',
        `-${limit}`,
        '--format=%H|%an|%aI|%s',
        '--numstat',
        '--',
        filePath,
      ]);

      const lines = stdout.trim().split('\n');
      const entries: any[] = [];
      let current: any = null;
      for (const line of lines) {
        if (!line.trim()) continue;
        if (line.includes('|') && line.split('|').length >= 4) {
          const [hash, author, date, message] = line.split('|');
          if (current) entries.push(current);
          current = {
            hash,
            author,
            date,
            message,
            stats: { additions: 0, deletions: 0 },
          };
        } else if (current) {
          const parts = line.split('\t');
          if (parts.length === 3) {
            const add = parseInt(parts[0], 10);
            const del = parseInt(parts[1], 10);
            if (!isNaN(add)) current.stats.additions += add;
            if (!isNaN(del)) current.stats.deletions += del;
          }
        }
      }
      if (current) entries.push(current);
      return entries;
    } catch (error: any) {
      logError(`Failed to get file history with stats for ${filePath}: ${error.message}`);
      return [];
    }
  }

  /**
   * Get line-by-line commit information using git blame
   * Returns array of { line, commitSha, author, date } for each line
   */
  async getFileBlame(
    filePath: string
  ): Promise<Array<{ line: number; commitSha: string; author: string; date: string }>> {
    try {
      const { stdout } = await this.spawnGit(['blame', '-l', '--line-porcelain', '--', filePath]);

      const lines = stdout.trim().split('\n');
      const result: Array<{ line: number; commitSha: string; author: string; date: string }> = [];
      let currentLineNumber = 1;
      let currentCommitSha = '';
      let currentAuthor = '';
      let currentDate = '';
      let inMetadata = false;

      for (const line of lines) {
        // Check if this is a header line: <commit-sha> <original-line> <final-line> <num-lines>
        const headerMatch = line.match(/^([0-9a-f]{40})\s+(\d+)\s+(\d+)\s+(\d+)$/);
        if (headerMatch) {
          // Save previous commit's data if we have it
          if (currentCommitSha && currentLineNumber > 0) {
            // We'll add this when we see the content line
          }
          currentCommitSha = headerMatch[1];
          currentLineNumber = parseInt(headerMatch[3], 10); // final-line is the current line number
          inMetadata = true;
          // Reset metadata
          currentAuthor = '';
          currentDate = '';
        } else if (inMetadata) {
          if (line.startsWith('author ')) {
            currentAuthor = line.substring(7).trim();
          } else if (line.startsWith('author-time ')) {
            const timestamp = parseInt(line.substring(12).trim(), 10);
            if (!isNaN(timestamp)) {
              currentDate = new Date(timestamp * 1000).toISOString();
            }
          } else if (line.startsWith('\t')) {
            // Content line starts with tab - this means we're done with metadata
            // Add the current line to results
            result.push({
              line: currentLineNumber,
              commitSha: currentCommitSha,
              author: currentAuthor,
              date: currentDate,
            });
            currentLineNumber++;
            inMetadata = false;
          }
        } else if (line.startsWith('\t')) {
          // Continuation of previous commit's lines (same commit, next line)
          result.push({
            line: currentLineNumber,
            commitSha: currentCommitSha,
            author: currentAuthor,
            date: currentDate,
          });
          currentLineNumber++;
        }
      }

      return result;
    } catch (error: any) {
      logError(`Failed to get file blame for ${filePath}: ${error.message}`);
      return [];
    }
  }

  async getHotspots(limit: number = 20): Promise<HotspotStat[]> {
    try {
      try {
        const head = await this.git.revparse(['HEAD']);
        const key = `${head}`;
        const cached = GitOperations.hotspotCache.get(key);
        const now = Date.now();
        if (cached && cached.expires > now) {
          return cached.data.slice(0, limit);
        }
        const { stdout } = await this.spawnGit([
          'log',
          '--pretty=format:%H',
          '--numstat',
          '--no-merges',
          '--since="3 months ago"',
        ]);

        const fileCounts = new Map<string, { count: number; added: number; removed: number }>();
        const lines = stdout.split('\n');
        for (const line of lines) {
          const parts = line.trim().split('\t');
          if (parts.length === 3) {
            const added = parseInt(parts[0], 10);
            const removed = parseInt(parts[1], 10);
            const p = parts[2];
            if (!fileCounts.has(p)) fileCounts.set(p, { count: 0, added: 0, removed: 0 });
            const entry = fileCounts.get(p)!;
            entry.count += 1;
            if (!isNaN(added)) entry.added += added;
            if (!isNaN(removed)) entry.removed += removed;
          }
        }

        const sizes = await this.getFileSizes(Array.from(fileCounts.keys()));

        const data: HotspotStat[] = Array.from(fileCounts.entries())
          .map(([path, stats]) => ({
            path,
            count: stats.count,
            added: stats.added,
            removed: stats.removed,
            size: sizes.get(path),
          }))
          .sort((a, b) => b.count - a.count);

        GitOperations.hotspotCache.set(key, {
          expires: now + 5 * 60 * 1000,
          data,
        });
        return data.slice(0, limit);
      } catch (cacheError) {
        logWarn(`Hotspot caching failed, falling back: ${cacheError}`);
      }

      const { stdout } = await this.spawnGit([
        'log',
        '--pretty=format:%H',
        '--numstat',
        '--no-merges',
        '--since="3 months ago"',
      ]);

      const fileCounts = new Map<string, { count: number; added: number; removed: number }>();
      const lines = stdout.split('\n');

      for (const line of lines) {
        const parts = line.trim().split('\t');
        if (parts.length === 3) {
          const added = parseInt(parts[0], 10);
          const removed = parseInt(parts[1], 10);
          const p = parts[2];
          if (!fileCounts.has(p)) fileCounts.set(p, { count: 0, added: 0, removed: 0 });
          const entry = fileCounts.get(p)!;
          entry.count += 1;
          if (!isNaN(added)) entry.added += added;
          if (!isNaN(removed)) entry.removed += removed;
        }
      }

      const data: HotspotStat[] = Array.from(fileCounts.entries())
        .map(([path, stats]) => ({
          path,
          count: stats.count,
          added: stats.added,
          removed: stats.removed,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
      return data;
    } catch (error: any) {
      logError(`Failed to get hotspots: ${error.message}`);
      return [];
    }
  }

  async getDiffStats(mode: 'staged' | 'unstaged'): Promise<{ added: number; removed: number }> {
    try {
      const args = mode === 'staged' ? ['diff', '--cached', '--numstat'] : ['diff', '--numstat'];
      const { stdout } = await this.spawnGit(args);
      let added = 0;
      let removed = 0;
      stdout.split('\n').forEach(line => {
        const parts = line.trim().split('\t');
        if (parts.length >= 3) {
          const a = parseInt(parts[0], 10);
          const r = parseInt(parts[1], 10);
          if (!isNaN(a)) added += a;
          if (!isNaN(r)) removed += r;
        }
      });
      return { added, removed };
    } catch (error: any) {
      logError(`Failed to get diff stats (${mode}): ${error.message}`);
      return { added: 0, removed: 0 };
    }
  }

  async spawnGit(args: string[]): Promise<{ stdout: string; stderr: string }> {
    try {
      const stdout = await withTimeout(this.git.raw(args), 60000, `Git raw ${args[0]}`);
      return { stdout, stderr: '' };
    } catch (error: any) {
      return { stdout: '', stderr: error.message || String(error) };
    }
  }

  async getFileSizes(paths: string[]): Promise<Map<string, number>> {
    const sizes = new Map<string, number>();
    for (const p of paths) {
      try {
        const stat = fs.statSync(path.join(this.gitRoot, p));
        if (stat.isFile()) {
          sizes.set(p, stat.size);
        }
      } catch {
        //empty
      }
    }
    return sizes;
  }
}

export interface HotspotStat {
  path: string;
  count: number;
  size?: number;
  added?: number;
  removed?: number;
}
