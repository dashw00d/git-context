import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { RefactorBundleFacts } from '../facts/types';
import { getGitRoot } from '../utils/config';

export class ActiveBundleProvider {
  public lastBundleFacts: RefactorBundleFacts | null = null;
  private bundleExpandedState = vscode.TreeItemCollapsibleState.Expanded;

  constructor(private context: vscode.ExtensionContext) {
    // Load bundle facts from file if available
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
      console.debug('Failed to load bundle facts:', error);
    }
  }

  refresh(): void {
    this.loadBundleFacts();
    // TreeView removed - no event firing needed
  }

  exportBundleFacts(): RefactorBundleFacts | null {
    return this.lastBundleFacts;
  }
}