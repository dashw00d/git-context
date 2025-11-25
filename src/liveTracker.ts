import * as vscode from 'vscode';
import { debounce } from 'lodash';
import { SymbolExtractor } from './analysis/symbols';
import { GitOperations } from './analysis/git';
import { logDebug, logInfo, logError } from './utils/logger';

interface ThresholdConfig {
    lines: number;
    symbols: number;
}

interface LiveChange {
    uri: string;
    content: string; // Full content (snapshot)
    originalContent: string; // From HEAD
    deltas: vscode.TextDocumentContentChangeEvent[];
}

export class LiveDiffTracker {
    private changeBuffers = new Map<string, vscode.TextDocumentContentChangeEvent[]>();
    private threshold: ThresholdConfig = { lines: 50, symbols: 5 };
    private disposables: vscode.Disposable[] = [];
    private symbolExtractor: SymbolExtractor;
    private git: GitOperations;
    private autoRunAfterEdits: number = 50;
    private editCounts = new Map<string, number>();

    constructor() {
        this.git = new GitOperations();
        this.symbolExtractor = new SymbolExtractor(this.git);

        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument(this.handleChange, this),
            vscode.workspace.onDidSaveTextDocument(this.resetBuffer, this),
            vscode.workspace.createFileSystemWatcher('**/*.{php,js,ts,tsx,jsx}') // Configurable patterns
        );

        this.updateConfig();
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('commitTracker')) {
                this.updateConfig();
            }
        });
    }

    private updateConfig() {
        const config = vscode.workspace.getConfiguration('commitTracker');
        const liveConfig = config.get<{ thresholds: ThresholdConfig; autoRunAfterEdits: number }>('live') || {
            thresholds: { lines: 50, symbols: 5 },
            autoRunAfterEdits: 50
        };
        this.threshold = liveConfig.thresholds;
        this.autoRunAfterEdits = liveConfig.autoRunAfterEdits;
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

        // If we hit thresholds, notify orchestrator
        logDebug(`[LiveTracker] Threshold reached for ${uri} (lines: ${linesChanged}, edits: ${editCount})`);

        // Notify orchestrator about pending changes
        // We'll implement the actual analysis trigger later in Phase 3
        vscode.commands.executeCommand('git-context.live.thresholdReached', {
            uri,
            linesChanged,
            editCount
        });

    }, 500);

    private resetBuffer(doc: vscode.TextDocument) {
        this.changeBuffers.delete(doc.uri.toString());
        this.editCounts.delete(doc.uri.toString());
        logDebug(`[LiveTracker] Reset buffer for ${doc.uri.toString()}`);
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
