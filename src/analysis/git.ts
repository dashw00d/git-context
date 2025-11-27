import { execSync, spawn } from 'child_process';
import * as path from 'path';
import { CommitInfo, FileChange } from '../types';
import { getGitRoot } from '../utils/config';

export class GitOperations {
  private gitRoot: string;

  constructor() {
    const root = getGitRoot();
    if (!root) {
      throw new Error('Not in a git repository');
    }
    this.gitRoot = root;
  }

  public getRoot(): string {
    return this.gitRoot;
  }

  /**
   * Execute a git command and return the output
   */
  /**
   * Execute a git command and return the output
   */
  private execGit(args: string[], options: { suppressLog?: boolean } = {}): string {
    const start = Date.now();
    const cmd = `git ${args.join(' ')}`;
    try {
      const out = execSync(cmd, {
        cwd: this.gitRoot,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      }).trim();
      const duration = Date.now() - start;
      // Log slow commands or errors (optional: could be verbose logging)
      if (duration > 1000 && !options.suppressLog) {
        console.log(`[Git] Slow command: ${cmd} (${duration}ms)`);
      }
      return out;
    } catch (error: any) {
      const duration = Date.now() - start;
      if (!options.suppressLog) {
        console.error(`[Git] Command failed: ${cmd} (${duration}ms)`);
      }
      throw new Error(`Git command failed: ${cmd}\n${error.message}`);
    }
  }

  /**
   * Get basic commit information
   */
  getCommitInfo(sha: string): CommitInfo {
    const format = '--pretty=format:%H%n%an%n%ad%n%s%n%p';
    const output = this.execGit(['show', '--no-patch', '--date=iso', format, sha]);

    const lines = output.split('\n');
    if (lines.length < 4) {
      throw new Error(`Invalid commit format for SHA: ${sha}`);
    }

    return {
      sha: lines[0],
      author: lines[1],
      date: lines[2],
      message: lines[3],
      parent: lines[4] || undefined
    };
  }

  /**
   * Get list of commits (newest first)
   */
  getRecentCommits(count: number = 5): CommitInfo[] {
    const format = '--pretty=format:%H%n%an%n%ad%n%s%n%p';
    const output = this.execGit(['log', '--no-merges', `-${count}`, '--date=iso', format]);

    const commits: CommitInfo[] = [];
    const lines = output.split('\n');

    for (let i = 0; i < lines.length; i += 5) {
      if (lines[i]) {
        commits.push({
          sha: lines[i],
          author: lines[i + 1],
          date: lines[i + 2],
          message: lines[i + 3],
          parent: lines[i + 4] || undefined
        });
      }
    }

    return commits;
  }

  /**
   * Get file changes for a commit
   */
  getFileChanges(sha: string): FileChange[] {
    // git diff-tree -r --no-commit-id --name-status sha : changes vs parent(s)
    let output: string;
    try {
      output = this.execGit(['diff-tree', '-r', '--no-commit-id', '--name-status', sha]);
    } catch (e) {
      // Fallback for root commits - compare with empty tree
      try {
        // 4b825dc642cb6eb9a060e54bf8d69288fbee4904 is the hash of an empty tree in git
        output = this.execGit(['diff-tree', '-r', '--no-commit-id', '--name-status', '4b825dc642cb6eb9a060e54bf8d69288fbee4904', sha]);
      } catch (innerError) {
        console.warn(`Failed to get file changes for ${sha} (even with empty tree fallback):`, innerError);
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
  }

  /**
   * Get raw diff for a commit
   */
  getCommitDiff(sha: string): string {
    return this.execGit(['show', '--pretty=format:', sha]);
  }

  /**
   * Get diff for a specific file in a commit
   */
  getFileDiff(sha: string, filePath: string): string {
    // Use show with patch format for specific file
    return this.execGit(['show', '--pretty=format:', '--patch', sha, '--', filePath]);
  }

  /**
   * Get diff for a file across a range of commits (bundle)
   */
  getBundleDiff(startSha: string, endSha: string, filePath: string): string {
    // Diff from parent of start to end
    // If startSha has no parent (root), just diff startSha..endSha (which misses startSha changes if using ..)
    // Safest is startSha~1..endSha
    try {
      return this.execGit(['diff', `${startSha}~1..${endSha}`, '--', filePath]);
    } catch (e) {
      // Fallback if no parent (e.g. shallow clone or root)
      return this.execGit(['diff', `${startSha}..${endSha}`, '--', filePath]);
    }
  }

  /**
   * Get staged changes diff
   */
  getStagedDiff(): string {
    return this.execGit(['diff', '--cached']);
  }

  /**
   * Get file content at specific commit
   */
  getFileContent(sha: string, filePath: string): string {
    return this.execGit(['show', `${sha}:${filePath}`]);
  }

  /**
   * Safely get file content, returning empty string if file doesn't exist
   */
  safeGetFileContent(sha: string, filePath: string): string {
    try {
      return this.execGit(['show', `${sha}:${filePath}`], { suppressLog: true });
    } catch (error: any) {
      const msg = error.message || String(error);
      // Check for common git errors indicating file doesn't exist
      if (msg.includes('path') && (
        msg.includes('does not exist') ||
        msg.includes('did not match any file(s)') ||
        msg.includes('exists on disk, but not in') ||
        msg.includes('neither on disk nor in the index')
      )) {
        return '';
      }
      throw error;
    }
  }

  /**
   * Get staged file content (from index)
   */
  getStagedContent(filePath: string): string {
    return this.execGit(['show', `:${filePath}`]);
  }

  /**
   * Safely get staged file content, returning empty string if file doesn't exist in index
   */
  safeGetStagedContent(filePath: string): string {
    try {
      return this.getStagedContent(filePath);
    } catch (error: any) {
      const msg = error.message || String(error);


      if (msg.includes('path') && (
        msg.includes('does not exist') ||
        msg.includes('did not match any file(s)') ||
        msg.includes('exists on disk, but not in') ||
        msg.includes('neither on disk nor in the index')
      )) {
        return '';
      }
      throw error;
    }
  }

  /**
   * Get working directory file content
   */
  getWorkingContent(filePath: string): string {
    const fs = require('fs');
    const path = require('path');
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
  isIgnored(filePath: string): boolean {
    try {
      // git check-ignore returns exit code 0 if ignored, 1 if not ignored
      this.execGit(['check-ignore', '-q', filePath]);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current HEAD SHA
   */
  getHeadSha(): string {
    return this.execGit(['rev-parse', 'HEAD']);
  }

  /**
   * Get blob SHA for a file at a specific commit
   * @throws Error if file doesn't exist at the given commit
   */
  getBlobSha(sha: string, filePath: string): string {
    try {
      const output = this.execGit(['ls-tree', '-r', sha, '--', filePath]);
      const lines = output.trim().split('\n').filter(l => l.length > 0);

      if (lines.length === 0) {
        throw new Error(`File ${filePath} not found at commit ${sha}`);
      }

      if (lines.length > 1) {
        console.warn(`Multiple blobs found for ${filePath} at ${sha}, using first match`);
      }

      const parts = lines[0].split(/\s+/);
      if (parts.length < 3) {
        throw new Error(`Invalid ls-tree output for ${filePath} at ${sha}`);
      }

      return parts[2];
    } catch (error) {
      throw new Error(`Failed to get blob SHA for ${filePath} at ${sha}: ${error}`);
    }
  }

  /**
   * Get size of a blob in bytes
   */
  getBlobSize(sha: string, filePath: string): number {
    try {
      // git cat-file -s <sha>:<path>
      const output = this.execGit(['cat-file', '-s', `${sha}:${filePath}`]);
      return parseInt(output.trim(), 10) || 0;
    } catch (error) {
      // If file doesn't exist or other error, return 0 (safe fallback)
      return 0;
    }
  }

  /**
   * Get current branch name (null when detached)
   */
  getCurrentBranch(): string | null {
    try {
      const branch = this.execGit(['branch', '--show-current']);
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
  getBranchCommits(branch: string, limit: number = 100): string[] {
    try {
      const output = this.execGit(['log', branch, `--max-count=${limit}`, '--format=%H']);
      return output.split('\n').map(line => line.trim()).filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * Check if repository is clean (no uncommitted changes)
   */
  isClean(): boolean {
    try {
      this.execGit(['diff', '--quiet']);
      this.execGit(['diff', '--cached', '--quiet']);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get list of changed files in working directory
   */
  /**
   * Execute a git command and return the output via stream (for large outputs)
   */
  private async execGitStream(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const git = spawn('git', args, {
        cwd: this.gitRoot,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      git.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      git.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      git.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`Git command failed: git ${args.join(' ')}\n${stderr}`));
        }
      });

      git.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Get list of changed files in working directory
   */
  async getWorkingDirectoryChanges(): Promise<FileChange[]> {
    try {
      const output = await this.execGitStream(['status', '--porcelain']);

      const changes: FileChange[] = [];
      const lines = output.split('\n').filter(line => line.trim());

      for (const line of lines) {
        const status = line.substring(0, 2).trim();
        const filePath = line.substring(3);

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
      console.error('Failed to get working directory changes:', error);
      return [];
    }
  }

  /**
   * Get staged files only
   */
  async getStagedFiles(): Promise<FileChange[]> {
    try {
      const output = await this.execGitStream(['status', '--porcelain']);

      const staged: FileChange[] = [];
      const lines = output.split('\n').filter(line => line.trim());

      for (const line of lines) {
        const status = line.substring(0, 2);
        const filePath = line.substring(3);

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
      console.error('Failed to get staged files:', error);
      return [];
    }
  }

  /**
   * Get unstaged files only (including untracked files)
   */
  async getUnstagedFiles(): Promise<FileChange[]> {
    try {
      const output = await this.execGitStream(['status', '--porcelain']);

      const unstaged: FileChange[] = [];
      const lines = output.split('\n').filter(line => line.trim());

      for (const line of lines) {
        const status = line.substring(0, 2);
        const filePath = line.substring(3);

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
        const untrackedOutput = await this.execGitStream(['ls-files', '--others', '--exclude-standard']);
        const untrackedLines = untrackedOutput.split('\n').filter(f => f.trim());
        for (const filePath of untrackedLines) {
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
      console.error('Failed to get unstaged files:', error);
      return [];
    }
  }

  /**
   * Get diff stats for a specific file (added/removed lines)
   */
  getFileDiffStats(filePath: string, staged: boolean = false): { added: number; removed: number } {
    try {
      const args = staged ? ['diff', '--cached', '--numstat', '--', filePath] : ['diff', '--numstat', '--', filePath];
      const output = this.execGit(args);

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
   * Spawn a git command asynchronously
   */
  async spawnGit(args: string[]): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const git = spawn('git', args, {
        cwd: this.gitRoot,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      git.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      git.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      git.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Git command failed with code ${code}: ${stderr}`));
        }
      });

      git.on('error', (error) => {
        reject(error);
      });
    });
  }
}
