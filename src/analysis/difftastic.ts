import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { getExtensionConfig } from '../utils/config';
import { logWarn } from '../utils/logger';

export interface DifftasticResult {
  highlights: string[];
  morphs: MorphHighlight[];
  hasStructuralChanges: boolean;
  hunks?: DiffHunk[];
  tags?: Map<number, string[]>; // line number -> array of tags
}

export interface DiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: string[];
  linesAdded: number;
  linesRemoved: number;
}

export interface MorphHighlight {
  type: 'signature_change' | 'moved_block' | 'refactor' | 'rename';
  description: string;
  location?: {
    file: string;
    line: number;
  };
}

export class DifftasticIntegration {
  private difftasticPath: string;

  constructor() {
    this.difftasticPath = this.findDifftasticPath();
  }

  /**
   * Find difftastic binary path
   */
  private findDifftasticPath(): string {
    const config = getExtensionConfig();

    // Check configured path first
    if (config.difftasticPath && fs.existsSync(config.difftasticPath)) {
      return config.difftasticPath;
    }

    // Check common installation paths
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const workspaceRoot = path.join(__dirname, '..', '..');

    const commonPaths = [
      // User-specific paths (for testing)
      path.join(homeDir, 'bin', 'difftastic'),
      // Extension resources folder (bundled or for tests)
      path.join(workspaceRoot, 'resources', 'difftastic'),
      // System paths
      '/usr/local/bin/difftastic',
      '/usr/bin/difftastic',
      '/opt/homebrew/bin/difftastic', // macOS Homebrew
      '/home/linuxbrew/.linuxbrew/bin/difftastic', // Linux Homebrew
      'difftastic', // In PATH
    ];

    for (const binPath of commonPaths) {
      if (this.isValidDifftasticPath(binPath)) {
        return binPath;
      }
    }

    // Return empty string if not found (optional dependency)
    logWarn('[DIFFTASTIC] Binary not found. Structural diff analysis will be disabled.');
    logWarn(`[DIFFTASTIC] Searched paths: ${commonPaths.slice(0, 3).join(', ')}`);
    return '';
  }

  /**
   * Check if a path points to a valid difftastic binary
   */
  private isValidDifftasticPath(binPath: string): boolean {
    try {
      const result = spawn(binPath, ['--version'], { stdio: 'pipe' });
      return result.pid !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Run difftastic on two file versions
   */
  async runDifftastic(
    oldContent: string,
    newContent: string,
    oldFilePath: string,
    newFilePath: string
  ): Promise<DifftasticResult> {
    return new Promise((resolve, reject) => {
      // Create temporary files
      const tempDir = require('os').tmpdir();
      const oldFile = path.join(tempDir, `old_${Date.now()}_${path.basename(oldFilePath)}`);
      const newFile = path.join(tempDir, `new_${Date.now()}_${path.basename(newFilePath)}`);

      try {
        fs.writeFileSync(oldFile, oldContent);
        fs.writeFileSync(newFile, newContent);

        // Run difftastic with fixed width to prevent side-by-side overflow panics
        const width = '200'; // Fixed wide terminal
        const difft = spawn(
          this.difftasticPath,
          [
            '--color=never', // No ANSI colors for parsing
            '--exit-code', // Exit with code based on differences
            '--width',
            width, // Prevent panic on wide diffs
            oldFile,
            newFile,
          ],
          {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, COLUMNS: width, DIFT_WIDTH: width },
          }
        );

        let stdout = '';
        let stderr = '';

        difft.stdout.on('data', data => {
          stdout += data.toString();
        });

        difft.stderr.on('data', data => {
          stderr += data.toString();
        });

        difft.on('close', code => {
          // Clean up temp files
          try {
            fs.unlinkSync(oldFile);
            fs.unlinkSync(newFile);
          } catch {
            // Ignore cleanup errors
          }

          if (code !== null && code > 1) {
            // 1 is success with differences, >1 is error
            reject(new Error(`Difftastic failed: ${stderr}`));
            return;
          }

          const result = this.parseDifftasticOutput(stdout, code === 1);
          resolve(result);
        });

        difft.on('error', error => {
          // Clean up temp files
          try {
            fs.unlinkSync(oldFile);
            fs.unlinkSync(newFile);
          } catch {
            // Ignore cleanup errors
          }
          reject(error);
        });
      } catch (error) {
        // Clean up temp files
        try {
          fs.unlinkSync(oldFile);
          fs.unlinkSync(newFile);
        } catch {
          // Ignore cleanup errors
        }
        reject(error);
      }
    });
  }

  /**
   * Parse difftastic output to extract structural highlights, hunks, and tagged tokens
   */
  private parseDifftasticOutput(output: string, hasDifferences: boolean): DifftasticResult {
    const highlights: string[] = [];
    const morphs: MorphHighlight[] = [];
    const hunks: DiffHunk[] = [];
    const tags = new Map<number, string[]>();

    if (!hasDifferences) {
      return {
        highlights: [],
        morphs: [],
        hasStructuralChanges: false,
        hunks: [],
        tags,
      };
    }

    const lines = output.split('\n');
    let currentHunk: Partial<DiffHunk> | null = null;
    let inHunkContext = false;

    // Control-flow and interface keywords to tag
    const controlFlowKeywords =
      /\b(if|while|for|switch|return|throw|catch|try|else|do|break|continue)\b/;
    const interfaceKeywords =
      /\b(function|class|interface|type|export|import|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=)\b/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip file headers
      if (trimmed.startsWith('File ')) {
        continue;
      }

      // Parse hunk headers: @@ -oldStart,oldCount +newStart,newCount @@
      const hunkMatch = trimmed.match(/^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
      if (hunkMatch) {
        // Save previous hunk if exists
        if (currentHunk && currentHunk.lines) {
          hunks.push(currentHunk as DiffHunk);
        }

        // Start new hunk
        const [, oldStart, oldCount, newStart, newCount] = hunkMatch;
        currentHunk = {
          oldStart: parseInt(oldStart),
          oldCount: parseInt(oldCount || '1'),
          newStart: parseInt(newStart),
          newCount: parseInt(newCount || '1'),
          lines: [],
          linesAdded: 0,
          linesRemoved: 0,
        };
        inHunkContext = true;

        // Add hunk header as highlight
        highlights.push(trimmed);
        continue;
      }

      // Process lines within hunk context
      if (inHunkContext && currentHunk) {
        currentHunk.lines!.push(line);

        // Count added/removed lines
        if (line.startsWith('+') && !line.startsWith('+++')) {
          currentHunk.linesAdded!++;
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          currentHunk.linesRemoved!++;
        }

        // Tag control-flow keywords
        if (controlFlowKeywords.test(line)) {
          const lineTags = tags.get(i + 1) || [];
          lineTags.push('control-flow');
          tags.set(i + 1, lineTags);
        }

        // Tag interface keywords
        if (interfaceKeywords.test(line)) {
          const lineTags = tags.get(i + 1) || [];
          lineTags.push('interface');
          tags.set(i + 1, lineTags);
        }
      }

      // Add non-empty lines as highlights
      if (trimmed) {
        highlights.push(trimmed);
      }
    }

    // Save final hunk
    if (currentHunk && currentHunk.lines) {
      hunks.push(currentHunk as DiffHunk);
    }

    return {
      highlights,
      morphs, // Empty for now as we don't want to overfit
      hasStructuralChanges: true,
      hunks,
      tags,
    };
  }

  /**
   * Extract location information from a difftastic output line
   */
  private extractLocationFromLine(line: string): { file: string; line: number } | undefined {
    // Difftastic doesn't always include location info in basic output
    // This would need enhancement based on actual difftastic output format
    return undefined;
  }

  /**
   * Run difftastic on a git commit to get structural highlights
   */
  /**
   * Run difftastic on a git commit to get structural highlights
   */
  async getCommitStructuralHighlights(
    sha: string,
    filePath: string,
    oldPath?: string
  ): Promise<DifftasticResult> {
    try {
      // Get file content at commit and its parent
      const git = new (require('./git').GitOperations)();
      const commitInfo = git.getCommitInfo(sha);

      if (!commitInfo.parent) {
        // First commit, no parent to compare
        return {
          highlights: [],
          morphs: [],
          hasStructuralChanges: false,
        };
      }

      const newContent = git.safeGetFileContent(sha, filePath);
      const parentPath = oldPath || filePath;
      const oldContent = git.safeGetFileContent(commitInfo.parent, parentPath);

      if (!newContent && !oldContent) {
        return {
          highlights: [],
          morphs: [],
          hasStructuralChanges: false,
        };
      }

      return await this.runDifftastic(oldContent, newContent, parentPath, filePath);
    } catch (error: any) {
      const errorMsg = error.message || String(error);
      const widthRelated =
        errorMsg.includes('width') || errorMsg.includes('overflow') || errorMsg.includes('panic');
      const diagMsg = widthRelated ? 'width overflow - consider adjusting --width flag' : errorMsg;
      logWarn(`[DIFFTASTIC] Skipped ${filePath} (${diagMsg})`);
      return {
        highlights: [],
        morphs: [],
        hasStructuralChanges: false,
      };
    }
  }

  /**
   * Check if difftastic is available
   */
  isAvailable(): boolean {
    if (!this.difftasticPath) {
      return false;
    }
    try {
      return this.isValidDifftasticPath(this.difftasticPath);
    } catch {
      return false;
    }
  }
}

// Singleton instance
let difftasticInstance: DifftasticIntegration | null = null;

export function getDifftasticIntegration(): DifftasticIntegration {
  if (!difftasticInstance) {
    difftasticInstance = new DifftasticIntegration();
  }
  return difftasticInstance;
}
