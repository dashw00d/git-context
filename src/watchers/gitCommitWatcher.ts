import * as fs from 'fs';
import * as path from 'path';
import { debounce } from 'lodash';
import * as vscode from 'vscode';
import { GitOperations } from '../analysis/git';
import { RefactorPipeline } from '../analysis/refactorPipeline';
import { CockpitOrchestrator } from '../state/cockpitOrchestrator';
import { getGitRoot } from '../utils/config';
import { logDebug, logError } from '../utils/logger';

export class GitCommitWatcher implements vscode.Disposable {
  private watcher: fs.FSWatcher | null = null;

  constructor(
    private pipeline: RefactorPipeline,
    private orchestrator: CockpitOrchestrator,
    private onCommit?: (sha: string) => Promise<void>
  ) {
    //empty
  }

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
      const git = new GitOperations();
      const newSha = await git.getHeadSha();

      await this.pipeline.indexCommits([newSha]);

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
