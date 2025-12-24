import { EventEmitter } from 'events';
import { debounce } from 'lodash';
import * as vscode from 'vscode';
import { getCstTimelineManager } from './analysis/cstTimeline';
import { GitOperations } from './analysis/git';
import { SymbolExtractor } from './analysis/symbols';
import { getTreeSitterParser } from './analysis/tree-sitter';
import { getStore } from './state/store';
import {
  detectLanguage,
  getExtensionConfig,
  getSupportedExtensions,
  isCstOnlyLanguage,
} from './utils/config';
import { logDebug, logError, logInfo } from './utils/logger';
import type { SymbolInfo } from './types';

interface ThresholdConfig {
  lines: number;
  symbols: number;
  extensions: string[];
}

export class LiveDiffTracker extends EventEmitter {
  private changeBuffers = new Map<string, vscode.TextDocumentContentChangeEvent[]>();
  private threshold: ThresholdConfig = {
    lines: 50,
    symbols: 5,
    extensions: getSupportedExtensions(),
  };
  private disposables: vscode.Disposable[] = [];
  private watcher: vscode.FileSystemWatcher | undefined;
  private git: GitOperations;
  private symbolExtractor: SymbolExtractor;
  private symbolCache = new Map<string, SymbolInfo[]>();
  private autoRunAfterEdits: number = 50;
  private editCounts = new Map<string, number>();
  private cstTimelineManager = getCstTimelineManager();
  private parser = getTreeSitterParser();

  private isTracking: boolean = false;

  constructor() {
    super();
    this.git = new GitOperations();
    this.symbolExtractor = new SymbolExtractor(this.git);

    this.updateConfig();

    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('git-context.live')) {
        this.updateConfig();
        if (this.isTracking) {
          this.setupWatcher();
        }
      }
    });
  }

  public startTracking() {
    if (this.isTracking) return;

    this.isTracking = true;
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(this.handleChange, this),
      vscode.workspace.onDidSaveTextDocument(this.resetBuffer, this)
    );
    this.setupWatcher();

    getStore().dispatch({ type: 'LIVE_ANALYSIS_UPDATED', payload: { isTracking: true } });

    logInfo('[LiveTracker] Started tracking live changes');
  }

  public stopTracking() {
    if (!this.isTracking) return;

    this.isTracking = false;
    this.disposeWatchers();

    getStore().dispatch({ type: 'LIVE_ANALYSIS_UPDATED', payload: { isTracking: false } });

    logInfo('[LiveTracker] Stopped tracking live changes');
  }

  private disposeWatchers() {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
    if (this.watcher) {
      this.watcher.dispose();
      this.watcher = undefined;
    }
  }

  private updateConfig() {
    const config = vscode.workspace.getConfiguration('git-context.live');

    const enabled = config.get<boolean>('enabled');
    if (!enabled) {
      return;
    }

    const linesThreshold = config.get<number>('thresholds.lines');
    const symbolsThreshold = config.get<number>('thresholds.symbols');
    const extensions = config.get<string[]>('extensions') || getSupportedExtensions();
    const autoRunAfterEdits = config.get<number>('autoRunAfterEdits');

    this.threshold = {
      lines: linesThreshold ?? 50,
      symbols: symbolsThreshold ?? 5,
      extensions: extensions.length > 0 ? extensions : getSupportedExtensions(),
    };
    this.autoRunAfterEdits = autoRunAfterEdits ?? 50;
  }

  private setupWatcher() {
    if (this.watcher) {
      this.watcher.dispose();

      const idx = this.disposables.indexOf(this.watcher);
      if (idx !== -1) {
        this.disposables.splice(idx, 1);
      }
    }

    const pattern = `**/*.{${this.threshold.extensions.join(',')}}`;
    this.watcher = vscode.workspace.createFileSystemWatcher(pattern);
    this.disposables.push(this.watcher);
  }

  private handleChange(e: vscode.TextDocumentChangeEvent) {
    if (e.document.uri.scheme !== 'file') return;

    const uri = e.document.uri.toString();
    let buffer = this.changeBuffers.get(uri) || [];
    buffer.push(...e.contentChanges);

    if (buffer.length > 1000) {
      buffer = buffer.slice(-1000);
    }

    this.changeBuffers.set(uri, buffer);

    const currentCount = this.editCounts.get(uri) || 0;
    this.editCounts.set(uri, currentCount + 1);

    this.debouncedCheck(uri);
  }

  private async triggerAnalysis(staged: boolean): Promise<void> {
    try {
      const { getRefactorPipeline } = await import('./services/pipelineFactory');
      const pipeline = await getRefactorPipeline();
      const workspaceIndexer = pipeline.workspaceIndexer;

      const facts = await workspaceIndexer.analyzeWorkspace(staged ? 'staged' : 'unstaged');

      if (facts) {
        const dispatcher = getStore();
        dispatcher.dispatch({
          type: 'WORKSPACE_FACTS_UPDATED',
          payload: { workspaceFacts: facts },
        });
        dispatcher.dispatch({
          type: 'SECTION_CHANGED',
          payload: { section: 'live' },
        });
      }
    } catch (error) {
      logError('[LiveTracker] Analysis failed', error);
    }
  }

  private async parseLiveDiff(doc: vscode.TextDocument): Promise<{
    symbols: SymbolInfo[];
    delta: {
      added: SymbolInfo[];
      removed: SymbolInfo[];
      modified: import('./types').SymbolDelta[];
    };
  }> {
    const uri = doc.uri.toString();
    const prevSymbols = this.symbolCache.get(uri) || [];
    const buffer = this.changeBuffers.get(uri) || [];
    const content = doc.getText();
    const path = doc.uri.fsPath;

    const result = await this.symbolExtractor.extractIncremental(
      prevSymbols,
      buffer,
      content,
      path
    );

    this.symbolCache.set(uri, result.symbols);

    return result;
  }

  private debouncedCheck = debounce(async (uri: string) => {
    const buffer = this.changeBuffers.get(uri);
    if (!buffer || buffer.length === 0) return;

    const editCount = this.editCounts.get(uri) || 0;
    const linesChanged = buffer.reduce((sum, c) => sum + (c.text.split('\n').length - 1), 0);

    const doc = vscode.workspace.textDocuments.find(d => d.uri.toString() === uri);
    if (!doc) return;

    let symbolDelta: {
      added: SymbolInfo[];
      removed: SymbolInfo[];
      modified: import('./types').SymbolDelta[];
    } = {
      added: [],
      removed: [],
      modified: [],
    };
    let symbolCount = 0;
    try {
      const parseResult = await this.parseLiveDiff(doc);
      symbolDelta = parseResult.delta;
      symbolCount = symbolDelta.added.length + symbolDelta.modified.length;
    } catch (error) {
      logError('[LiveTracker] Failed to parse symbols', error);
    }

    const linesThresholdMet = linesChanged >= this.threshold.lines;
    const symbolsThresholdMet = symbolCount >= this.threshold.symbols;
    const editsThresholdMet = editCount >= this.autoRunAfterEdits;

    if (!linesThresholdMet && !symbolsThresholdMet && !editsThresholdMet) {
      this.emit('changesUpdated', {
        uri,
        pendingChanges: this.hasPendingChanges(),
        linesChanged,
        symbolCount,
        editCount,
      });
      return;
    }

    logDebug(
      `[LiveTracker] Threshold reached for ${uri} (lines: ${linesChanged}, symbols: ${symbolCount}, edits: ${editCount})`
    );

    const relativePath = vscode.workspace.asRelativePath(doc.uri, false);
    const stagedFiles = await this.git.getStagedFiles();
    const isStaged = stagedFiles.some(f => f.path === relativePath);
    const mode = isStaged ? 'staged' : 'unstaged';

    this.emit('changesUpdated', {
      uri,
      pendingChanges: this.hasPendingChanges(),
      linesChanged,
      symbolCount,
      editCount,
      thresholdReached: true,
    });

    await this.extractAndSaveHybridFacts(doc, isStaged);

    if (this.autoRunAfterEdits > 0) {
      logInfo(`Live threshold reached for ${mode} changes, triggering analysis`);
      await this.triggerAnalysis(isStaged);
      this.clearBuffer(doc.uri);
    } else {
      const choice = await vscode.window.showInformationMessage(
        `${mode} changes threshold reached. Analyze now?`,
        'Analyze',
        'Later'
      );
      if (choice === 'Analyze') {
        await this.triggerAnalysis(isStaged);
        this.clearBuffer(doc.uri);
      }
    }
  }, 500);

  private resetBuffer(doc: vscode.TextDocument) {
    this.clearBuffer(doc.uri);
  }

  /**
   * Extract and save hybrid facts for a changed file
   */
  private async extractAndSaveHybridFacts(
    doc: vscode.TextDocument,
    isStaged: boolean
  ): Promise<void> {
    const config = getExtensionConfig();
    const enableCst = config.enableCstTracking ?? true;
    const enableAugment = config.enableCstAugmentation ?? false;

    if (!enableCst && !enableAugment) {
      return;
    }

    const filePath = doc.uri.fsPath;
    const language = detectLanguage(filePath);
    if (!language) return;

    const isCstOnly = isCstOnlyLanguage(language);
    if (!isCstOnly && !enableAugment) {
      return;
    }

    const content = doc.getText();
    const version = isStaged ? 'workspace-staged' : 'workspace-unstaged';

    try {
      const hybridFacts = await this.parser.extractHybridFacts(content, filePath, language);

      await this.cstTimelineManager.saveFacts(filePath, version, hybridFacts);

      if (hybridFacts.length > 0) {
        logDebug(`[LiveTracker] Saved ${hybridFacts.length} hybrid facts for ${filePath}`);
      }
    } catch (error) {
      logError(`[LiveTracker] Error extracting hybrid facts for ${filePath}`, error);
    }
  }

  private clearBuffer(uri: vscode.Uri) {
    const uriString = uri.toString();
    this.changeBuffers.delete(uriString);
    this.editCounts.delete(uriString);
    this.symbolCache.delete(uriString);
    logDebug(`[LiveTracker] Cleared buffer for ${uriString}`);
  }

  public clearAllBuffers() {
    this.changeBuffers.clear();
    this.editCounts.clear();
    this.symbolCache.clear();
  }

  public hasPendingChanges(): { files: number; totalEdits: number } {
    return {
      files: this.changeBuffers.size,
      totalEdits: Array.from(this.editCounts.values()).reduce((a, b) => a + b, 0),
    };
  }

  public getDirtyContent(): Map<string, string> {
    const dirtyContent = new Map<string, string>();
    for (const uri of this.changeBuffers.keys()) {
      const doc = vscode.workspace.textDocuments.find(d => d.uri.toString() === uri);
      if (doc) {
        dirtyContent.set(vscode.Uri.parse(uri).fsPath, doc.getText());
      }
    }
    return dirtyContent;
  }

  public dispose() {
    this.stopTracking();
    this.removeAllListeners();
    this.changeBuffers.clear();
    this.editCounts.clear();
    this.symbolCache.clear();
  }
}
