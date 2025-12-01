import * as fs from 'fs';
import * as path from 'path';
import simpleGit, { SimpleGit } from 'simple-git';
import { CommitInfo, FileChange } from '../types';
import { getGitRoot } from '../utils/config';
import { logDebug, logWarn, logError } from '../utils/logger';

export class GitOperations {
  private gitRoot: string;
  private git: SimpleGit;
  private static hotspotCache: Map<string, { expires: number; data: HotspotStat[] }> = new Map();

  constructor() {
    const root = getGitRoot();
    if (!root) {
      throw new Error('Not in a git repository');
    }
    this.gitRoot = root;
    this.git = simpleGit(root);
  }

  public getRoot(): string {
    return this.gitRoot;
  }

  /**
   * Get basic commit information
   */
  async getCommitInfo(sha: string): Promise<CommitInfo> {
    try {
      const format = '--pretty=format:%H%n%an%n%ad%n%s%n%p';
      const output = await this.git.raw(['show', '--no-patch', '--date=iso', format, sha]);

      const lines = output.split('\n');
      if (lines.length < 4) {
        throw new Error(`Invalid commit format for SHA: ${sha}`);
      }

      return {
        sha: lines[0],
        author: lines[1] || '',
        date: lines[2] || '',
        message: lines[3] || '',
        parent: lines[4] || undefined
      };
    } catch (error: any) {
      throw new Error(`Failed to get commit info for ${sha}: ${error.message}`);
    }
  }

  /**
   * Get list of commits (newest first)
   */
  async getRecentCommits(count: number = 5): Promise<CommitInfo[]> {
    try {
      const format = '--pretty=format:%H%n%an%n%ad%n%s%n%p';
      const output = await this.git.raw(['log', '--no-merges', `-${count}`, '--date=iso', format]);

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
          parent: lines[i + 4] || undefined
        });
      }

      return commits;
    } catch (error: any) {
      throw new Error(`Failed to get recent commits: ${error.message}`);
    }
  }

  /**
   * Get file changes for a commit
   */
  async getFileChanges(sha: string): Promise<FileChange[]> {
    try {
      let output: string;
      try {
        output = await this.git.raw(['diff-tree', '-r', '--no-commit-id', '--name-status', sha]);
      } catch (e) {
        // Fallback for root commits - compare with empty tree
        try {
          // 4b825dc642cb6eb9a060e54bf8d69288fbee4904 is the hash of an empty tree in git
          output = await this.git.raw(['diff-tree', '-r', '--no-commit-id', '--name-status', '4b825dc642cb6eb9a060e54bf8d69288fbee4904', sha]);
        } catch (innerError) {
          logWarn(`Failed to get file changes for ${sha} (even with empty tree fallback): ${innerError}`);
          return [];
        }
      }

      const changes: FileChange[] = [];
      const lines = output.split('\n').filter(line => line.trim());

      for (const line of lines) {
        const parts = line.split('\t');
        if (parts.length >= 2) {
          const status = parts[0];
          const filePath = parts[1];
          let oldPath: string | undefined;

          // Handle renamed and copied files
          if (status.startsWith('R') || status.startsWith('C')) {
            oldPath = parts[2];
          }

          changes.push({
            path: filePath,
            status: status.charAt(0) as FileChange['status'],  // A/M/D/R/C
            oldPath
          });
        }
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
      return await this.git.show([sha, '--pretty=format:']);
    } catch (error: any) {
      throw new Error(`Failed to get commit diff for ${sha}: ${error.message}`);
    }
  }

  /**
   * Get diff for a specific file in a commit
   */
  async getFileDiff(sha: string, filePath: string): Promise<string> {
    try {
      return await this.git.show([sha, '--pretty=format:', '--patch', '--', filePath]);
    } catch (error: any) {
      throw new Error(`Failed to get file diff for ${filePath} at ${sha}: ${error.message}`);
    }
  }

  /**
   * Get diff for a file across a range of commits (bundle)
   */
  async getBundleDiff(startSha: string, endSha: string, filePath: string): Promise<string> {
    try {
      return await this.git.diff([`${startSha}~1..${endSha}`, '--', filePath]);
    } catch (e) {
      // Fallback if no parent (e.g. shallow clone or root)
      try {
        return await this.git.diff([`${startSha}..${endSha}`, '--', filePath]);
      } catch (error: any) {
        throw new Error(`Failed to get bundle diff for ${filePath}: ${error.message}`);
      }
    }
  }

  /**
   * Get staged changes diff
   */
  async getStagedDiff(): Promise<string> {
    try {
      return await this.git.diff(['--cached']);
    } catch (error: any) {
      throw new Error(`Failed to get staged diff: ${error.message}`);
    }
  }

  /**
   * Get file content at specific commit
   */
  async getFileContent(sha: string, filePath: string): Promise<string> {
    try {
      return await this.git.show([`${sha}:${filePath}`]);
    } catch (error: any) {
      throw new Error(`Failed to get file content for ${filePath} at ${sha}: ${error.message}`);
    }
  }

  /**
   * Safely get file content, returning empty string if file doesn't exist
   */
  async safeGetFileContent(sha: string, filePath: string): Promise<string> {
    try {
      return await this.git.show([`${sha}:${filePath}`]);
    } catch (error: any) {
      if (this.isGitPathMissing(error)) {
        return '';
      }
      throw error;
    }
  }

  /**
   * Get staged file content (from index)
   */
  async getStagedContent(filePath: string): Promise<string> {
    try {
      return await this.git.show([`:${filePath}`]);
    } catch (error: any) {
      throw new Error(`Failed to get staged content for ${filePath}: ${error.message}`);
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
      throw error;
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
      // File doesn't exist in working directory
      return '';
    }
  }

  /**
   * Check if a file is ignored by git
   */
  async isIgnored(filePath: string): Promise<boolean> {
    try {
      const result = await this.git.checkIgnore([filePath]);
      if (result.length > 0) {
        console.log(`[GitDebug] ${filePath} IS IGNORED. Result: ${JSON.stringify(result)}`);
      }
      return result.length > 0;
    } catch (error) {
      // console.log(`[GitDebug] checkIgnore error for ${filePath}: ${error}`);
      return false;
    }
  }

  /**
   * Check if a file is ignored by git at a specific commit
   * Note: For historical checking, we use the current workspace ignore rules
   * as .gitignore rules rarely change dramatically between commits.
   * This is a reasonable approximation for path filtering purposes.
   */
  async isIgnoredAtCommit(sha: string, filePath: string): Promise<boolean> {
    // Use current workspace ignore check as approximation
    // Historical .gitignore checking would require complex git worktree manipulation
    // and the current rules are usually sufficient for filtering
    return this.isIgnored(filePath);
  }

  /**
   * Get current HEAD SHA
   */
  async getHeadSha(): Promise<string> {
    try {
      return await this.git.revparse(['HEAD']);
    } catch (error: any) {
      throw new Error(`Failed to get HEAD SHA: ${error.message}`);
    }
  }

  /**
   * Get blob SHA for a file at a specific commit
   * @throws Error if file doesn't exist at the given commit
   */
  async getBlobSha(sha: string, filePath: string): Promise<string> {
    try {
      const output = await this.git.raw(['ls-tree', '-r', sha, '--', filePath]);
      const lines = output.trim().split('\n').filter(l => l.trim());

      for (const line of lines) {
        const parsed = this.parseLsTreeLine(line);
        if (parsed && parsed.path === filePath) {
          return parsed.sha;
        }
      }

      logWarn(`No matching ls-tree entry for ${filePath} at ${sha}`);
      throw new Error(`File ${filePath} not found at commit ${sha}`);
    } catch (error: any) {
      throw new Error(`Failed to get blob SHA for ${filePath} at ${sha}: ${error.message}`);
    }
  }

  /**
   * Get size of a blob in bytes
   */
  async getBlobSize(sha: string, filePath: string): Promise<number> {
    try {
      // git cat-file -s <sha>:<path>
      const output = await this.git.raw(['cat-file', '-s', `${sha}:${filePath}`]);
      return parseInt(output.trim(), 10) || 0;
    } catch (error) {
      // If file doesn't exist or other error, return 0 (safe fallback)
      return 0;
    }
  }

  /**
   * Get current branch name (null when detached)
   */
  async getCurrentBranch(): Promise<string | null> {
    try {
      const branch = await this.git.revparse(['--abbrev-ref', 'HEAD']);
      if (!branch || branch === 'HEAD') {
        return null;
      }
      return branch;
    } catch {
      return null;
    }
  }

  /**
   * Get commits reachable from a branch (newest first)
   */
  async getBranchCommits(branch: string, limit: number = 100): Promise<string[]> {
    try {
      const log = await this.git.log({
        from: branch,
        maxCount: limit,
        format: {
          hash: '%H'
        }
      });
      return log.all.map(commit => commit.hash);
    } catch {
      return [];
    }
  }

  /**
   * Check if repository is clean (no uncommitted changes)
   */
  async isClean(): Promise<boolean> {
    try {
      await this.git.diff(['--quiet']);
      await this.git.diff(['--cached', '--quiet']);
      return true;
    } catch {
      return false;
    }
  }


  /**
   * Get list of changed files in working directory
   */
  async getWorkingDirectoryChanges(): Promise<FileChange[]> {
    try {
      const output = await this.git.raw(['status', '--porcelain']);

      const changes: FileChange[] = [];
      const lines = output.split('\n').filter(line => line.trim());

      for (const line of lines) {
        const status = line.substring(0, 2).trim();
        const filePath = this.parseGitPath(line.substring(3));

        // Map git status codes to our status types
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
          changeStatus = 'M'; // Default to modified
        }

        changes.push({
          path: filePath,
          status: changeStatus
        });
      }

      return changes;
    } catch (error) {
      logError('Failed to get working directory changes:', error);
      return [];
    }
  }

  /**
   * Parse file path from git status output, handling quoted paths and octal escapes.
   * Call on all line.substring(3) from porcelain output.
   */
  private parseGitPath(rawPath: string): string {
    // Git quotes paths with special characters and uses octal escapes
    if (rawPath.startsWith('"') && rawPath.endsWith('"')) {
      // Remove quotes and decode escape sequences
      const unquoted = rawPath.slice(1, -1);
      // Replace octal escapes (e.g., \141 -> 'a')
      return unquoted.replace(/\\(\d{3})/g, (_, oct) =>
        String.fromCharCode(parseInt(oct, 8))
      ).replace(/\\\\/g, '\\'); // Replace \\\\ with \\
    }
    return rawPath;
  }

  /**
   * Parse a single line from git ls-tree output (mode<TAB>type<TAB>sha<TAB>path)
   * Handles paths with spaces correctly using TAB separation.
   */
  private parseLsTreeLine(rawLine: string): { mode: string, type: string, sha: string, path: string } | null {
    const tabIdx = rawLine.lastIndexOf('\t');
    if (tabIdx === -1 || tabIdx < 1) return null;

    const path = rawLine.slice(tabIdx + 1);
    const preSha = rawLine.slice(0, tabIdx).trim();
    const preParts = preSha.split(/\s+/);  // split on whitespace

    if (preParts.length < 3) return null;

    return { mode: preParts[0], type: preParts[1], sha: preParts[2], path };
  }

  /**
   * Check if a git error indicates a missing file path
   * Handles various git error message formats for missing files.
   */
  private isGitPathMissing(error: any): boolean {
    const msg = (error.message || String(error)).toLowerCase();
    return (
      msg.includes('does not exist') ||
      msg.includes('did not match any file') ||
      msg.includes('exists on disk, but not in') ||
      msg.includes('neither on disk nor in')
    );
  }


  /**
   * Parse git file list output (one file per line)
   * Normalizes whitespace and filters empty lines.
   */
  private parseFileList(raw: string): string[] {
    return raw.trim().split('\n').map(l => l.trim()).filter(Boolean);
  }

  /**
   * Get staged files only
   */
  async getStagedFiles(): Promise<FileChange[]> {
    try {
      const output = await this.git.raw(['status', '--porcelain']);

      const staged: FileChange[] = [];
      const lines = output.split('\n').filter(line => line.trim());

      for (const line of lines) {
        const status = line.substring(0, 2);
        const filePath = this.parseGitPath(line.substring(3));

        // First character indicates staged status (not space, not ?)
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
            status: changeStatus
          });
        }
      }

      return staged;
    } catch (error) {
      logError('Failed to get staged files:', error);
      return [];
    }
  }

  /**
   * Get unstaged files only (including untracked files)
   */
  async getUnstagedFiles(): Promise<FileChange[]> {
    try {
      const output = await this.git.raw(['status', '--porcelain']);

      const unstaged: FileChange[] = [];
      const lines = output.split('\n').filter(line => line.trim());

      for (const line of lines) {
        const status = line.substring(0, 2);
        const filePath = this.parseGitPath(line.substring(3));

        // Second character indicates unstaged status (not space)
        // Include untracked files (?) as unstaged
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
            // Untracked files are considered unstaged
            changeStatus = 'U';
          } else {
            changeStatus = 'M';
          }

          unstaged.push({
            path: filePath,
            status: changeStatus
          });
        }
      }

      // Also include untracked files from ls-files
      try {
        const untrackedOutput = await this.git.raw(['ls-files', '--others', '--exclude-standard']);
        const untrackedFiles = this.parseFileList(untrackedOutput);
        for (const filePath of untrackedFiles) {
          // Only add if not already in unstaged (avoid duplicates)
          if (!unstaged.some(f => f.path === filePath)) {
            unstaged.push({
              path: filePath,
              status: 'U' // U = untracked
            });
          }
        }
      } catch (error) {
        // Silently ignore if ls-files fails (e.g., no untracked files)
      }

      return unstaged;
    } catch (error) {
      logError('Failed to get unstaged files:', error);
      return [];
    }
  }

  /**
   * Get diff stats for a specific file (added/removed lines)
   */
  async getFileDiffStats(filePath: string, staged: boolean = false): Promise<{ added: number; removed: number }> {
    try {
      const args = staged ? ['diff', '--cached', '--numstat', '--', filePath] : ['diff', '--numstat', '--', filePath];
      const output = await this.git.raw(args);

      if (!output.trim()) {
        return { added: 0, removed: 0 };
      }

      // --numstat output format: "added<TAB>removed<TAB>file"
      const parts = output.trim().split('\t');
      if (parts.length >= 2) {
        const added = parseInt(parts[0], 10) || 0;
        const removed = parseInt(parts[1], 10) || 0;
        return { added, removed };
      }

      return { added: 0, removed: 0 };
    } catch (error) {
      // If git diff fails (e.g., file not tracked), return zero stats
      return { added: 0, removed: 0 };
    }
  }

  /**
   * Get all tracked files in the repository
   */
  async getAllFiles(): Promise<string[]> {
    try {
      const output = await this.git.raw(['ls-files', '--cached', '--exclude-standard']);
      return this.parseFileList(output);
    } catch (error: any) {
      logError(`Failed to get all files: ${error.message}`);
      return [];
    }
  }

  /**
   * Get commit history for a specific file
   */
  async getFileHistory(filePath: string, limit: number = 10): Promise<any[]> {
    try {
      // Format: hash|author|date|message
      const { stdout } = await this.spawnGit([
        'log',
        `-${limit}`,
        '--format=%h|%an|%aI|%s',
        '--',
        filePath
      ]);

      return stdout.trim().split('\n').filter(Boolean).map(line => {
        const [hash, author, date, message] = line.split('|');
        return { hash, author, date, message, virtual: false };
      });
    } catch (error: any) {
      logError(`Failed to get file history for ${filePath}: ${error.message}`);
      return [];
    }
  }

  /**
   * Get recent commits for a file with added/removed stats.
   */
  async getFileHistoryWithStats(filePath: string, limit: number = 10): Promise<any[]> {
    try {
      // Format: hash|author|date|message\nnumstat lines
      const { stdout } = await this.spawnGit([
        'log',
        `-${limit}`,
        '--format=%H|%an|%aI|%s',
        '--numstat',
        '--',
        filePath
      ]);

      const lines = stdout.trim().split('\n');
      const entries: any[] = [];
      let current: any = null;
      for (const line of lines) {
        if (!line.trim()) continue;
        if (line.includes('|') && line.split('|').length >= 4) {
          const [hash, author, date, message] = line.split('|');
          if (current) entries.push(current);
          current = { hash, author, date, message, stats: { additions: 0, deletions: 0 } };
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
   * Get top modified files (hotspots) based on commit history
   */
  async getHotspots(limit: number = 20): Promise<HotspotStat[]> {
    try {
      // Cache hotspots per HEAD for 5 minutes to avoid repeated heavy git log calls
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
          '--since="3 months ago"' // Configurable?
        ]);

        const fileCounts = new Map<string, { count: number; added: number; removed: number }>();
        const lines = stdout.split('\n');
        for (const line of lines) {
          // numstat lines: added<TAB>removed<TAB>path OR commit hash line
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

        // Load sizes once for weighting
        const sizes = await this.getFileSizes(Array.from(fileCounts.keys()));

        const data: HotspotStat[] = Array.from(fileCounts.entries())
          .map(([path, stats]) => ({ path, count: stats.count, added: stats.added, removed: stats.removed, size: sizes.get(path) }))
          .sort((a, b) => b.count - a.count);

        GitOperations.hotspotCache.set(key, { expires: now + 5 * 60 * 1000, data });
        return data.slice(0, limit);
      } catch (cacheError) {
        logWarn(`Hotspot caching failed, falling back: ${cacheError}`);
      }

      // Get all file names from log, count occurrences, plus added/removed
      const { stdout } = await this.spawnGit([
        'log',
        '--pretty=format:%H',
        '--numstat',
        '--no-merges',
        '--since="3 months ago"' // Configurable?
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
        .map(([path, stats]) => ({ path, count: stats.count, added: stats.added, removed: stats.removed }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
      return data;

    } catch (error: any) {
      logError(`Failed to get hotspots: ${error.message}`);
      return [];
    }
  }

  /**
   * Get diff stats for staged or unstaged changes (added/removed totals)
   */
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

  /**
   * Spawn a git command asynchronously (using simple-git raw)
   */
  async spawnGit(args: string[]): Promise<{ stdout: string; stderr: string }> {
    try {
      const stdout = await this.git.raw(args);
      return { stdout, stderr: '' };
    } catch (error: any) {
      // simple-git throws errors, but we want to return stderr
      return { stdout: '', stderr: error.message || String(error) };
    }
  }

  /**
   * Get file sizes (in bytes) for a list of paths
   */
  async getFileSizes(paths: string[]): Promise<Map<string, number>> {
    const sizes = new Map<string, number>();
    for (const p of paths) {
      try {
        const stat = fs.statSync(path.join(this.gitRoot, p));
        if (stat.isFile()) {
          sizes.set(p, stat.size);
        }
      } catch {
        // ignore missing files
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
