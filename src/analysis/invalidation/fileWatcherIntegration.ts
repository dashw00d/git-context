/**
 * File Watcher Integration for Automatic Invalidation
 * Watches for file changes and invalidates stale data
 */

import * as vscode from 'vscode';
import { logDebug, logInfo, logWarn } from '../../utils/logger';
import { GitOperations } from '../git';
import { invalidateFileSymbols, InvalidationOptions } from './invalidationService';

/**
 * Manages file watching and automatic invalidation
 */
export class FileChangeInvalidator {
  private disposables: vscode.Disposable[] = [];
  private git: GitOperations;
  private invalidateTimeout: NodeJS.Timeout | null = null;
  private pendingInvalidations = new Set<string>();
  private debounceMs: number;
  private defaultOptions: InvalidationOptions;

  constructor(options?: { debounceMs?: number; defaultOptions?: InvalidationOptions }) {
    this.git = new GitOperations();
    this.debounceMs = options?.debounceMs ?? 500;
    this.defaultOptions = options?.defaultOptions ?? { markStale: true };
  }

  /**
   * Start watching for file changes
   */
  startWatching(): void {
    const gitRoot = this.git.getRoot();
    if (!gitRoot) {
      logDebug('[FileInvalidator] Not in git repo, skipping file watcher');
      return;
    }

    // Watch common source file extensions
    const pattern = new vscode.RelativePattern(
      vscode.Uri.file(gitRoot),
      '**/*.{ts,js,tsx,jsx,py,go,rs,java,kt,swift,cpp,c,cc,h,hpp}'
    );

    const watcher = vscode.workspace.createFileSystemWatcher(pattern);

    watcher.onDidChange(async uri => {
      await this.handleFileChange(uri, 'change');
    });

    watcher.onDidDelete(async uri => {
      await this.handleFileChange(uri, 'delete');
    });

    watcher.onDidCreate(async uri => {
      await this.handleFileChange(uri, 'create');
    });

    this.disposables.push(watcher);
    logInfo('[FileInvalidator] Started watching for file changes');
  }

  /**
   * Stop watching for file changes
   */
  stopWatching(): void {
    if (this.invalidateTimeout) {
      clearTimeout(this.invalidateTimeout);
      this.invalidateTimeout = null;
    }

    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
    this.pendingInvalidations.clear();

    logInfo('[FileInvalidator] Stopped watching for file changes');
  }

  /**
   * Handle a file change event
   */
  private async handleFileChange(
    uri: vscode.Uri,
    changeType: 'change' | 'delete' | 'create'
  ): Promise<void> {
    const gitRoot = this.git.getRoot();
    if (!gitRoot) {
      return;
    }

    const filePath = vscode.workspace.asRelativePath(uri, false);
    logDebug(`[FileInvalidator] File ${changeType}: ${filePath}`);

    // Add to pending invalidations
    this.pendingInvalidations.add(filePath);

    // Debounce to handle rapid successive changes
    if (this.invalidateTimeout) {
      clearTimeout(this.invalidateTimeout);
    }

    this.invalidateTimeout = setTimeout(async () => {
      await this.processPendingInvalidations();
    }, this.debounceMs);
  }

  /**
   * Process all pending invalidations
   */
  private async processPendingInvalidations(): Promise<void> {
    if (this.pendingInvalidations.size === 0) {
      return;
    }

    const currentSha = await this.getCurrentSha();
    if (!currentSha) {
      logWarn('[FileInvalidator] Unable to get current SHA, skipping invalidation');
      this.pendingInvalidations.clear();
      return;
    }

    const filesToInvalidate = Array.from(this.pendingInvalidations);
    this.pendingInvalidations.clear();

    logInfo(`[FileInvalidator] Processing ${filesToInvalidate.length} file invalidations`);

    for (const filePath of filesToInvalidate) {
      try {
        await invalidateFileSymbols(currentSha, filePath, this.defaultOptions);
      } catch (error) {
        logWarn(`[FileInvalidator] Error invalidating ${filePath}: ${error}`);
      }
    }
  }

  /**
   * Get the current HEAD SHA
   */
  private async getCurrentSha(): Promise<string | null> {
    try {
      const sha = await this.git.getHeadSha?.();
      return sha || null;
    } catch {
      return null;
    }
  }

  /**
   * Manually invalidate a file
   */
  async invalidateFile(filePath: string, options?: InvalidationOptions): Promise<void> {
    const currentSha = await this.getCurrentSha();
    if (!currentSha) {
      logWarn('[FileInvalidator] Unable to get current SHA for manual invalidation');
      return;
    }

    await invalidateFileSymbols(currentSha, filePath, options ?? this.defaultOptions);
  }

  /**
   * Get the list of files pending invalidation
   */
  getPendingFiles(): string[] {
    return Array.from(this.pendingInvalidations);
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.stopWatching();
  }
}

/**
 * Create and start a file change invalidator
 */
export function createFileInvalidator(options?: {
  debounceMs?: number;
  defaultOptions?: InvalidationOptions;
}): FileChangeInvalidator {
  const invalidator = new FileChangeInvalidator(options);
  invalidator.startWatching();
  return invalidator;
}
