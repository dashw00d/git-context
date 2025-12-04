import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { getExtensionConfig } from '../utils/config';
import { logWarn, logError } from '../utils/logger';

export interface DifftasticResult {
  highlights: MorphHighlight[];
  morphs: any[]; // Assuming any[] for now, can refine if schema is known
  hasStructuralChanges: boolean;
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
    const workspaceRoot = path.join(__dirname, '..', '..');

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

        const difft = spawn(
          this.difftasticPath,
          ['--display=json', oldFile, newFile],
          {
            stdio: ['pipe', 'pipe', 'pipe'],
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
    // If there are no differences, return an empty result
    if (!hasDifferences) {
      return {
        highlights: [],
        morphs: [],
        hasStructuralChanges: false,
      };
    }

    try {
      const parsedJson = JSON.parse(output);
      // Assuming parsedJson directly contains highlights, morphs, hasStructuralChanges
      // Add default empty arrays/false in case properties are missing
      return {
        highlights: parsedJson.highlights || [],
        morphs: parsedJson.morphs || [],
        hasStructuralChanges: parsedJson.hasStructuralChanges || false,
      };
    } catch (error) {
      logError('[DIFFTASTIC] Error parsing JSON output:', error);
      return {
        highlights: [],
        morphs: [],
        hasStructuralChanges: false,
      };
    }
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