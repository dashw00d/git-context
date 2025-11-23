import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { getExtensionConfig } from '../utils/config';

export interface DifftasticResult {
  highlights: string[];
  morphs: MorphHighlight[];
  hasStructuralChanges: boolean;
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
    const commonPaths = [
      '/usr/local/bin/difftastic',
      '/usr/bin/difftastic',
      '/opt/homebrew/bin/difftastic', // macOS Homebrew
      '/home/linuxbrew/.linuxbrew/bin/difftastic', // Linux Homebrew
      'difftastic' // In PATH
    ];

    for (const binPath of commonPaths) {
      if (this.isValidDifftasticPath(binPath)) {
        return binPath;
      }
    }

    throw new Error('Difftastic binary not found. Please install difftastic or configure the path in settings.');
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

        // Run difftastic
        const difft = spawn(this.difftasticPath, [
          '--color=never', // No ANSI colors for parsing
          '--exit-code',   // Exit with code based on differences
          oldFile,
          newFile
        ], { stdio: ['pipe', 'pipe', 'pipe'] });

        let stdout = '';
        let stderr = '';

        difft.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        difft.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        difft.on('close', (code) => {
          // Clean up temp files
          try {
            fs.unlinkSync(oldFile);
            fs.unlinkSync(newFile);
          } catch {
            // Ignore cleanup errors
          }

          if (code !== null && code > 1) { // 1 is success with differences, >1 is error
            reject(new Error(`Difftastic failed: ${stderr}`));
            return;
          }

          const result = this.parseDifftasticOutput(stdout, code === 1);
          resolve(result);
        });

        difft.on('error', (error) => {
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
   * Parse difftastic output to extract structural highlights
   */
  private parseDifftasticOutput(output: string, hasDifferences: boolean): DifftasticResult {
    const highlights: string[] = [];
    const morphs: MorphHighlight[] = [];

    if (!hasDifferences) {
      return {
        highlights: [],
        morphs: [],
        hasStructuralChanges: false
      };
    }

    const lines = output.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Look for structural change indicators
      if (line.includes('function') && (line.includes('->') || line.includes('changed'))) {
        highlights.push(`Function signature change: ${line.trim()}`);
        morphs.push({
          type: 'signature_change',
          description: `Function modified: ${line.trim()}`,
          location: this.extractLocationFromLine(line)
        });
      }

      if (line.includes('class') && (line.includes('->') || line.includes('changed'))) {
        highlights.push(`Class structure change: ${line.trim()}`);
        morphs.push({
          type: 'refactor',
          description: `Class modified: ${line.trim()}`,
          location: this.extractLocationFromLine(line)
        });
      }

      // Look for moved blocks
      if (line.includes('moved') || line.includes('relocated')) {
        highlights.push(`Code block moved: ${line.trim()}`);
        morphs.push({
          type: 'moved_block',
          description: `Block relocated: ${line.trim()}`,
          location: this.extractLocationFromLine(line)
        });
      }

      // Look for renames
      if (line.includes('renamed') || (line.includes('->') && !line.includes('function') && !line.includes('class'))) {
        highlights.push(`Symbol renamed: ${line.trim()}`);
        morphs.push({
          type: 'rename',
          description: `Symbol renamed: ${line.trim()}`,
          location: this.extractLocationFromLine(line)
        });
      }
    }

    return {
      highlights,
      morphs,
      hasStructuralChanges: highlights.length > 0
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
  async getCommitStructuralHighlights(sha: string, filePath: string): Promise<DifftasticResult> {
    try {
      // Get file content at commit and its parent
      const git = new (require('./git').GitOperations)();
      const commitInfo = git.getCommitInfo(sha);

      if (!commitInfo.parent) {
        // First commit, no parent to compare
        return {
          highlights: [],
          morphs: [],
          hasStructuralChanges: false
        };
      }

      const newContent = git.getFileContent(sha, filePath);
      const oldContent = git.getFileContent(commitInfo.parent, filePath);

      return await this.runDifftastic(oldContent, newContent, filePath, filePath);
    } catch (error) {
      console.warn(`Failed to get structural highlights for ${filePath} at ${sha}:`, error);
      return {
        highlights: [],
        morphs: [],
        hasStructuralChanges: false
      };
    }
  }

  /**
   * Check if difftastic is available
   */
  isAvailable(): boolean {
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
