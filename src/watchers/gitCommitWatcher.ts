import * as fs from 'fs';
import * as path from 'path';
import { debounce } from 'lodash';
import { getGitRoot } from '../utils/config';
import { getRefactorPipeline } from '../extension';
import { GitOperations } from '../analysis/git';
import { logError, logDebug } from '../utils/logger';

export class GitCommitWatcher {
  private watcher: fs.FSWatcher | null = null;

  constructor(private onCommit?: (sha: string) => Promise<void>) { }

  async start(): Promise<void> {
    const gitRoot = getGitRoot();
    if (!gitRoot) {
      return;
    }
    const headLog = path.join(gitRoot, '.git', 'logs', 'HEAD');
    if (!fs.existsSync(headLog)) {
      return;
    }

    const handler = debounce(() => {
      this.handleCommit().catch(error => logError('[GitCommitWatcher] Failed', error));
    }, 250);

    this.watcher = fs.watch(headLog, handler);
  }

  private async handleCommit(): Promise<void> {
    try {
      // No migration needed in new architecture - workspace SHA is separate
      // Just re-index the new commit
      const pipeline = await getRefactorPipeline();
      const git = new GitOperations();
      const newSha = await git.getHeadSha();

      await pipeline.indexCommits([newSha]);

      logDebug(`[GitCommitWatcher] Detected and indexed new commit ${newSha.substring(0, 8)}`);
      if (this.onCommit) {
        await this.onCommit(newSha);
      }
    } catch (error) {
      logError('[GitCommitWatcher] Failed to handle commit', error);
    }
  }

  dispose(): void {
    this.watcher?.close();
    this.watcher = null;
  }
}
