import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { getExtensionConfig } from '../utils/config';
import { logWarn } from '../utils/logger';
import { getPathService } from '../services/pathService';

export interface DifftasticResult {
  highlights: string[];
  morphs: MorphHighlight[];
  hasStructuralChanges: boolean;
  hunks?: DiffHunk[];
  tags?: Map<number, string[]>;
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

    if (config.difftasticPath && fs.existsSync(config.difftasticPath)) {
      return config.difftasticPath;
    }

    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const workspaceRoot = getPathService().getRoot();

    const commonPaths = [
      path.join(homeDir, 'bin', 'difftastic'),

      path.join(workspaceRoot, 'resources', 'difftastic'),

      '/usr/local/bin/difftastic',
      '/usr/bin/difftastic',
      '/opt/homebrew/bin/difftastic',
      '/home/linuxbrew/.linuxbrew/bin/difftastic',
      'difftastic',
    ];

    for (const binPath of commonPaths) {
      if (this.isValidDifftasticPath(binPath)) {
        return binPath;
      }
    }

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
      const tempDir = require('os').tmpdir();
      const oldFile = path.join(tempDir, `old_${Date.now()}_${path.basename(oldFilePath)}`);
      const newFile = path.join(tempDir, `new_${Date.now()}_${path.basename(newFilePath)}`);

      try {
        fs.writeFileSync(oldFile, oldContent);
        fs.writeFileSync(newFile, newContent);

        const width = '200';
        const difft = spawn(
          this.difftasticPath,
          ['--color=never', '--exit-code', '--width', width, oldFile, newFile],
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
          try {
            fs.unlinkSync(oldFile);
            fs.unlinkSync(newFile);
          } catch {
            //empty
          }

          if (code !== null && code > 1) {
            reject(new Error(`Difftastic failed: ${stderr}`));
            return;
          }

          const result = this.parseDifftasticOutput(stdout, code === 1);
          resolve(result);
        });

        difft.on('error', error => {
          try {
            fs.unlinkSync(oldFile);
            fs.unlinkSync(newFile);
          } catch {
            //empty
          }
          reject(error);
        });
      } catch (error) {
        try {
          fs.unlinkSync(oldFile);
          fs.unlinkSync(newFile);
        } catch {
          //empty
        }
        reject(error);
      }
    });
  }

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

    const controlFlowKeywords =
      /\b(if|while|for|switch|return|throw|catch|try|else|do|break|continue)\b/;
    const interfaceKeywords =
      /\b(function|class|interface|type|export|import|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=)\b/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed.startsWith('File ')) {
        continue;
      }

      const hunkMatch = trimmed.match(/^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
      if (hunkMatch) {
        if (currentHunk && currentHunk.lines) {
          hunks.push(currentHunk as DiffHunk);
        }

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

        highlights.push(trimmed);
        continue;
      }

      if (inHunkContext && currentHunk) {
        currentHunk.lines!.push(line);

        if (line.startsWith('+') && !line.startsWith('+++')) {
          currentHunk.linesAdded!++;
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          currentHunk.linesRemoved!++;
        }

        if (controlFlowKeywords.test(line)) {
          const lineTags = tags.get(i + 1) || [];
          lineTags.push('control-flow');
          tags.set(i + 1, lineTags);
        }

        if (interfaceKeywords.test(line)) {
          const lineTags = tags.get(i + 1) || [];
          lineTags.push('interface');
          tags.set(i + 1, lineTags);
        }
      }

      if (trimmed) {
        highlights.push(trimmed);
      }
    }

    if (currentHunk && currentHunk.lines) {
      hunks.push(currentHunk as DiffHunk);
    }

    return {
      highlights,
      morphs,
      hasStructuralChanges: true,
      hunks,
      tags,
    };
  }

  private extractLocationFromLine(_line: string): { file: string; line: number } | undefined {
    return undefined;
  }

  async getCommitStructuralHighlights(
    sha: string,
    filePath: string,
    oldPath?: string
  ): Promise<DifftasticResult> {
    try {
      const git = new (require('./git').GitOperations)();
      const commitInfo = git.getCommitInfo(sha);

      if (!commitInfo.parent) {
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

let difftasticInstance: DifftasticIntegration | null = null;

export function getDifftasticIntegration(): DifftasticIntegration {
  if (!difftasticInstance) {
    difftasticInstance = new DifftasticIntegration();
  }
  return difftasticInstance;
}
