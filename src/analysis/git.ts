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

  /**
   * Execute a git command and return the output
   */
  private execGit(args: string[]): string {
    try {
      return execSync(`git ${args.join(' ')}`, {
        cwd: this.gitRoot,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      }).trim();
    } catch (error: any) {
      throw new Error(`Git command failed: git ${args.join(' ')}\n${error.message}`);
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
    const output = this.execGit(['show', '--name-status', '--pretty=format:', sha]);

    const changes: FileChange[] = [];
    const lines = output.split('\n').filter(line => line.trim());

    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length >= 2) {
        const status = parts[0];
        const filePath = parts[1];
        let oldPath: string | undefined;

        // Handle renamed files
        if (status.startsWith('R')) {
          oldPath = parts[2];
        }

        changes.push({
          path: filePath,
          status: status.charAt(0) as FileChange['status'],
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
      return this.getFileContent(sha, filePath);
    } catch (error: any) {
      const msg = error.message || String(error);
      // Check for common git errors indicating file doesn't exist
      if (
        msg.includes('exists on disk, but not in') ||
        msg.includes('did not match any file') ||
        msg.includes('does not exist in')
      ) {
        return '';
      }
      throw error;
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
  getWorkingDirectoryChanges(): FileChange[] {
    const output = this.execGit(['status', '--porcelain']);

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
