import { GitOperations } from '../analysis/git';
import { logDebug, logInfo } from '../utils/logger';
import { filterPath } from '../utils/pathFilter';

export interface BundleConfig {
  mode: 'repo' | 'module' | 'changes' | 'custom';
  roots: string[];
  includeConnected: boolean;
  exclusions: string[];
}

export interface ContextSkeleton {
  files: string[];
  roots: string[];
  mode: string;
}

export class ContextSkeletonService {
  private git: GitOperations;

  constructor() {
    this.git = new GitOperations();
  }

  async resolveSkeleton(config: BundleConfig): Promise<ContextSkeleton> {
    logInfo(`[ContextSkeleton] Resolving skeleton for mode: ${config.mode}`);
    let files: string[] = [];
    const roots: string[] = [];

    try {
      switch (config.mode) {
        case 'repo':
          files = await this.getAllRepoFiles();
          roots.push('/');
          break;
        case 'module':
          // TODO: Enhance this to accept 'activeFile' context.
          if (config.roots.length > 0) {
            files = await this.getFilesFromRoots(config.roots);
            roots.push(...config.roots);
          } else {
            files = await this.getAllRepoFiles();
            roots.push('/');
          }
          break;
        case 'changes':
          files = await this.getChangedFiles();
          roots.push('changes');
          break;
        case 'custom':
          files = await this.getFilesFromRoots(config.roots);
          roots.push(...config.roots);
          break;
        default:
          files = await this.getAllRepoFiles();
          roots.push('/');
      }

      if (config.exclusions && config.exclusions.length > 0) {
        files = this.applyExclusions(files, config.exclusions);
      }

      logInfo(`[ContextSkeleton] Resolved ${files.length} files`);
      return { files, roots, mode: config.mode };
    } catch (error) {
      logDebug(`[ContextSkeleton] Error resolving skeleton: ${error}`);
      return { files: [], roots: [], mode: config.mode };
    }
  }

  private async getAllRepoFiles(): Promise<string[]> {
    const allFiles = await this.git.getAllFiles();
    return this.filterFiles(allFiles);
  }

  private async getChangedFiles(): Promise<string[]> {
    const staged = await this.git.getStagedFiles();
    const unstaged = await this.git.getUnstagedFiles();
    const paths = new Set([...staged, ...unstaged].map(f => f.path));
    return this.filterFiles(Array.from(paths));
  }

  private async getFilesFromRoots(roots: string[]): Promise<string[]> {
    const allFiles = await this.getAllRepoFiles();
    return allFiles.filter(file => {
      return roots.some(root => {
        if (file === root) return true;
        if (file.startsWith(root + '/')) return true;
        return false;
      });
    });
  }

  private applyExclusions(files: string[], exclusions: string[]): string[] {
    return files.filter(file => {
      return !exclusions.some(ex => {
        const pattern = ex.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*');
        const regex = new RegExp(`^${pattern}$`);
        return regex.test(file) || file.includes(ex.replace('**', ''));
      });
    });
  }

  private async filterFiles(files: string[]): Promise<string[]> {
    const gitRoot = this.git.getRoot();
    const filtered: string[] = [];

    for (const file of files) {
      if (
        await filterPath(file, {
          git: this.git,
          gitRoot,
          status: 'M',
          skipSizeCheck: true,
        })
      ) {
        filtered.push(file);
      }
    }
    return filtered;
  }
}
