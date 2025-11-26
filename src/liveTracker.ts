import * as vscode from 'vscode';
import { debounce } from 'lodash';
import { GitOperations } from './analysis/git';
import { logDebug, logInfo } from './utils/logger';

interface ThresholdConfig {
    lines: number;
    symbols: number;
    extensions: string[];
}

export class LiveDiffTracker {
    private changeBuffers = new Map<string, vscode.TextDocumentContentChangeEvent[]>();
    private threshold: ThresholdConfig = { lines: 50, symbols: 5, extensions: ['php', 'js', 'ts', 'tsx', 'jsx'] };
    private disposables: vscode.Disposable[] = [];
    private watcher: vscode.FileSystemWatcher | undefined;
    private git: GitOperations;
    private autoRunAfterEdits: number = 50;
    private editCounts = new Map<string, number>();

    constructor() {
        this.git = new GitOperations();

        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument(this.handleChange, this),
            vscode.workspace.onDidSaveTextDocument(this.resetBuffer, this)
        );

        this.updateConfig();
        this.setupWatcher();

        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('commitTracker')) {
                this.updateConfig();
                this.setupWatcher();
            }
        });
    }

    private updateConfig() {
        const config = vscode.workspace.getConfiguration('commitTracker');
        const liveConfig = config.get<{ thresholds: ThresholdConfig; autoRunAfterEdits: number }>('live') || {
            thresholds: { lines: 50, symbols: 5, extensions: ['php', 'js', 'ts', 'tsx', 'jsx'] },
            autoRunAfterEdits: 50
        };
        this.threshold = {
            ...liveConfig.thresholds,
            extensions: liveConfig.thresholds.extensions || ['php', 'js', 'ts', 'tsx', 'jsx']
        };
        this.autoRunAfterEdits = liveConfig.autoRunAfterEdits;
    }

    private setupWatcher() {
        if (this.watcher) {
            this.watcher.dispose();
            // Remove old watcher from disposables if it was added there (it wasn't in previous code, but good practice)
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

        // Cap buffer size to prevent memory leaks
        if (buffer.length > 1000) {
            buffer = buffer.slice(-1000);
        }

        this.changeBuffers.set(uri, buffer);

        // Update edit count
        const currentCount = this.editCounts.get(uri) || 0;
        this.editCounts.set(uri, currentCount + 1);

        this.debouncedCheck(uri);
    }

    private debouncedCheck = debounce(async (uri: string) => {
        const buffer = this.changeBuffers.get(uri);
        if (!buffer || buffer.length === 0) return;

        const editCount = this.editCounts.get(uri) || 0;
        const linesChanged = buffer.reduce((sum, c) => sum + (c.text.split('\n').length - 1), 0);

        // Check thresholds
        if (linesChanged < this.threshold.lines && editCount < this.autoRunAfterEdits) {
            return;
        }

        const doc = vscode.workspace.textDocuments.find(d => d.uri.toString() === uri);
        if (!doc) return;

        logDebug(`[LiveTracker] Threshold reached for ${uri} (lines: ${linesChanged}, edits: ${editCount})`);

        const relativePath = vscode.workspace.asRelativePath(doc.uri, false);
        const stagedFiles = await this.git.getStagedFiles();
        const isStaged = stagedFiles.some(f => f.path === relativePath);
        const commandId = isStaged ? 'git-context.analyzeStagedChanges' : 'git-context.analyzeUnstagedChanges';
        const mode = isStaged ? 'staged' : 'unstaged';

        if (this.autoRunAfterEdits > 0) {
            logInfo(`Live threshold reached for ${mode} changes, triggering analysis`);
            await vscode.commands.executeCommand(commandId);
            this.clearBuffer(doc.uri);
        } else {
            const choice = await vscode.window.showInformationMessage(
                `${mode} changes threshold reached. Analyze now?`,
                'Analyze',
                'Later'
            );
            if (choice === 'Analyze') {
                await vscode.commands.executeCommand(commandId);
                this.clearBuffer(doc.uri);
            }
        }
    }, 500);

    private resetBuffer(doc: vscode.TextDocument) {
        this.clearBuffer(doc.uri);
    }

    private clearBuffer(uri: vscode.Uri) {
        this.changeBuffers.delete(uri.toString());
        this.editCounts.delete(uri.toString());
        logDebug(`[LiveTracker] Cleared buffer for ${uri.toString()}`);
    }

    public clearAllBuffers() {
        this.changeBuffers.clear();
        this.editCounts.clear();
    }

    public hasPendingChanges(): { files: number; totalEdits: number } {
        return {
            files: this.changeBuffers.size,
            totalEdits: Array.from(this.editCounts.values()).reduce((a, b) => a + b, 0)
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
        this.disposables.forEach(d => d.dispose());
        this.changeBuffers.clear();
        this.editCounts.clear();
    }
}
