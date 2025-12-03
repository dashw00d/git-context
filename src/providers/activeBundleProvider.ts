import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { RefactorBundleFacts } from '../facts/types';
import { getGitRoot } from '../utils/config';
import { logDebug } from '../utils/logger';

export class ActiveBundleProvider {
  public lastBundleFacts: RefactorBundleFacts | null = null;
  private bundleExpandedState = vscode.TreeItemCollapsibleState.Expanded;

  constructor(private context: vscode.ExtensionContext) {
    this.loadBundleFacts();
  }

  private async loadBundleFacts() {
    try {
      const gitRoot = getGitRoot();
      if (!gitRoot) return;

      const factsPath = path.join(gitRoot, '.git/commit-tracker/last-bundle-facts.json');
      if (fs.existsSync(factsPath)) {
        const factsContent = fs.readFileSync(factsPath, 'utf8');
        this.lastBundleFacts = JSON.parse(factsContent);
      }
    } catch (error) {
      logDebug(`Failed to load bundle facts: ${error}`);
    }
  }

  refresh(): void {
    this.loadBundleFacts();
  }

  exportBundleFacts(): RefactorBundleFacts | null {
    return this.lastBundleFacts;
  }
}
