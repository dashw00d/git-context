"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCommands = void 0;
const vscode = __importStar(require("vscode"));
const analyze_1 = require("../cli/analyze");
const config_1 = require("../utils/config");
const summarizer_1 = require("../llm/summarizer");
function registerCommands(context, commitTracker, symbolHistory) {
    try {
        // Analyze last N commits
        const analyzeLastCommitsCmd = vscode.commands.registerCommand('git-context.analyzeLastCommits', async () => {
            const config = (0, config_1.getExtensionConfig)();
            const count = await vscode.window.showInputBox({
                prompt: 'Number of commits to analyze',
                value: config.defaultCommitCount.toString(),
                validateInput: (value) => {
                    const num = parseInt(value);
                    if (isNaN(num) || num <= 0) {
                        return 'Please enter a positive number';
                    }
                    return undefined;
                }
            });
            if (count) {
                vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Analyzing commits...',
                    cancellable: false
                }, async (progress) => {
                    try {
                        await (0, analyze_1.analyzeLastCommits)(parseInt(count));
                        commitTracker.refresh();
                        vscode.window.showInformationMessage(`Analyzed last ${count} commits`);
                    }
                    catch (error) {
                        vscode.window.showErrorMessage(`Failed to analyze commits: ${error}`);
                    }
                });
            }
        });
        // Analyze staged changes
        const analyzeStagedCmd = vscode.commands.registerCommand('git-context.analyzeStagedChanges', async () => {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Analyzing staged changes...',
                cancellable: false
            }, async (progress) => {
                try {
                    await (0, analyze_1.analyzeStagedChanges)();
                    commitTracker.refresh();
                    vscode.window.showInformationMessage('Analyzed staged changes');
                }
                catch (error) {
                    vscode.window.showErrorMessage(`Failed to analyze staged changes: ${error}`);
                }
            });
        });
        // Compare files to commit
        const compareFilesCmd = vscode.commands.registerCommand('git-context.compareFilesToCommit', async () => {
            // Pick commit
            const commit = await vscode.window.showQuickPick(await getRecentCommits(), {
                placeHolder: 'Select commit to compare against'
            });
            if (!commit)
                return;
            // Pick files
            const files = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: true,
                openLabel: 'Compare Selected Files'
            });
            if (!files || files.length === 0)
                return;
            // Get current commit
            const currentCommit = await getCurrentCommit();
            if (!currentCommit) {
                vscode.window.showErrorMessage('Could not determine current commit');
                return;
            }
            // Compare files
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Comparing files...',
                cancellable: false
            }, async (progress) => {
                try {
                    const llm = new summarizer_1.LLMSummarizer();
                    const filePaths = files.map(f => vscode.workspace.asRelativePath(f.fsPath));
                    const explanation = await llm.compareFiles(currentCommit, 'HEAD', commit.detail || commit.label, commit.description || 'Selected commit', filePaths, 'File comparison requested', []);
                    // Show result in new document
                    const doc = await vscode.workspace.openTextDocument({
                        content: `# File Comparison: HEAD vs ${commit.label}\n\n${explanation}`,
                        language: 'markdown'
                    });
                    await vscode.window.showTextDocument(doc);
                }
                catch (error) {
                    vscode.window.showErrorMessage(`Failed to compare files: ${error}`);
                }
            });
        });
        // Explain symbol change
        const explainSymbolCmd = vscode.commands.registerCommand('git-context.explainSymbolChange', async () => {
            // Get symbol from current cursor position or selection
            const symbol = await getSymbolAtCursor();
            if (!symbol) {
                vscode.window.showErrorMessage('No symbol found at cursor position');
                return;
            }
            // Get commit to compare against
            const commit = await vscode.window.showQuickPick(await getRecentCommits(), {
                placeHolder: 'Select commit to compare symbol against'
            });
            if (!commit)
                return;
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Explaining symbol changes...',
                cancellable: false
            }, async (progress) => {
                try {
                    const llm = new summarizer_1.LLMSummarizer();
                    // TODO: Get actual symbol code before/after
                    const explanation = await llm.explainSymbolChange(symbol.name, 'modified', symbol.file, symbol.line, '// Previous code', '// Current code', commit.detail || commit.label, commit.description || 'Selected commit');
                    // Show result in new document
                    const doc = await vscode.workspace.openTextDocument({
                        content: `# Symbol Change: ${symbol.name}\n\n${explanation}`,
                        language: 'markdown'
                    });
                    await vscode.window.showTextDocument(doc);
                }
                catch (error) {
                    vscode.window.showErrorMessage(`Failed to explain symbol: ${error}`);
                }
            });
        });
        // Search symbols
        const searchSymbolsCmd = vscode.commands.registerCommand('git-context.searchSymbols', async () => {
            const query = await vscode.window.showInputBox({
                placeHolder: 'Search for a symbol (e.g. function name, class name)',
                prompt: 'Enter symbol name to search history'
            });
            if (query !== undefined) {
                symbolHistory.setSearchQuery(query);
            }
        });
        context.subscriptions.push(analyzeLastCommitsCmd, analyzeStagedCmd, compareFilesCmd, explainSymbolCmd, searchSymbolsCmd);
        console.log('Git Context commands registered successfully');
    }
    catch (error) {
        console.error('Failed to register Git Context commands:', error);
        vscode.window.showErrorMessage(`Failed to register Git Context commands: ${error}`);
    }
}
exports.registerCommands = registerCommands;
async function getRecentCommits() {
    // TODO: Get commits from database
    // For now, return dummy data
    return [
        {
            label: 'HEAD',
            description: 'Current commit',
            detail: 'Most recent commit'
        },
        {
            label: 'HEAD~1',
            description: 'Previous commit',
            detail: 'One commit back'
        }
    ];
}
async function getCurrentCommit() {
    try {
        const { GitOperations } = await Promise.resolve().then(() => __importStar(require('../analysis/git')));
        const git = new GitOperations();
        return git.getHeadSha();
    }
    catch {
        return 'HEAD';
    }
}
async function getSymbolAtCursor() {
    const editor = vscode.window.activeTextEditor;
    if (!editor)
        return undefined;
    const document = editor.document;
    const position = editor.selection.active;
    // Get word at cursor
    const range = document.getWordRangeAtPosition(position);
    if (!range)
        return undefined;
    const symbolName = document.getText(range);
    const filePath = vscode.workspace.asRelativePath(document.uri);
    const line = position.line + 1;
    return {
        name: symbolName,
        file: filePath,
        line
    };
}
//# sourceMappingURL=commands.js.map