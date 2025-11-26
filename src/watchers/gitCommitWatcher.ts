import * as fs from 'fs';
import * as path from 'path';
import { debounce } from 'lodash';
import { getGitRoot } from '../utils/config';
import { getAnalysisPipeline } from '../analysis/pipeline';
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
      const pipeline = await getAnalysisPipeline();
      const git = new GitOperations();
      const newSha = git.getHeadSha();
      await pipeline.migrateWorkspaceToCommit(newSha);
      logDebug(`[GitCommitWatcher] Detected new commit ${newSha.substring(0, 8)}`);
      if (this.onCommit) {
        await this.onCommit(newSha);
      }
    } catch (error) {
      logError('[GitCommitWatcher] Failed to migrate workspace analysis', error);
    }
  }

  dispose(): void {
    this.watcher?.close();
    this.watcher = null;
  }
}
