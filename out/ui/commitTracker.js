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
exports.CommitTrackerProvider = void 0;
const vscode = __importStar(require("vscode"));
class CommitTrackerProvider {
    toggleCommitSelection(sha) {
        if (this.selectedCommits.has(sha)) {
            this.selectedCommits.delete(sha);
        }
        else {
            this.selectedCommits.add(sha);
        }
        this.refresh();
    }
    clearSelection() {
        this.selectedCommits.clear();
        this.refresh();
    }
    constructor(context) {
        this.context = context;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        // Track selected commits for multi-report generation
        this.selectedCommits = new Set();
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        // Determine if this element should be expandable
        let collapsibleState = vscode.TreeItemCollapsibleState.None;
        if (element.contextValue === 'commit') {
            // Commits are always expandable
            collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        }
        else if (element.children && element.children.length > 0) {
            // Items with pre-populated children (like risks, file groups)
            collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        }
        else if (element.id && !element.command) {
            // Categories without commands (like "Added Symbols") are expandable
            // Individual symbols have commands so they won't be expandable
            if (element.id.match(/-(added|modified|removed|files)$/)) {
                collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
            }
        }
        return {
            id: element.id,
            label: element.label,
            description: element.description,
            tooltip: element.tooltip,
            collapsibleState,
            iconPath: element.icon ? new vscode.ThemeIcon(element.icon) : undefined,
            command: element.command,
            contextValue: element.contextValue
        };
    }
    async getChildren(element) {
        if (!element) {
            // Root level - show recent commits
            return this.getRecentCommits();
        }
        // Child level - show commit details
        return this.getCommitDetails(element);
    }
    async getRecentCommits() {
        try {
            const { getDatabaseManager, ensureDatabaseInitialized } = await Promise.resolve().then(() => __importStar(require('../storage/database')));
            await ensureDatabaseInitialized();
            const db = getDatabaseManager().getDatabase();
            const stmt = db.prepare(`
        SELECT sha, author, date, message, files_changed, symbols_added, symbols_modified, symbols_removed, risks
        FROM commits
        ORDER BY date DESC
        LIMIT 20
      `);
            const commits = stmt.all();
            return commits.map(commit => {
                const shortSha = commit.sha.substring(0, 8);
                const isSelected = this.selectedCommits.has(commit.sha);
                const checkbox = isSelected ? '☑ ' : '☐ ';
                return {
                    id: commit.sha,
                    type: 'commit',
                    sha: commit.sha,
                    message: commit.message,
                    author: commit.author,
                    date: commit.date,
                    isSelected,
                    label: `${checkbox}${shortSha} - ${commit.message.split('\n')[0]}`,
                    description: `${commit.author} · ${new Date(commit.date).toLocaleDateString()}`,
                    tooltip: `${commit.message}\n\nClick to expand\nRight-click to toggle selection for report`,
                    contextValue: 'commit'
                };
            });
        }
        catch (error) {
            console.error('Failed to load commits:', error);
            // @ts-ignore
            const errorMessage = error instanceof Error ? error.message : String(error);
            return [{
                    id: 'error',
                    type: 'risk',
                    label: 'Error loading commits',
                    description: errorMessage,
                    icon: 'error'
                }];
        }
    }
    async getCommitChildren(commit) {
        const children = [];
        // Add summary if available
        if (commit.summary_md) {
            children.push({
                id: `${commit.sha}-summary`,
                type: 'risk',
                label: '📝 Summary',
                description: commit.summary_md.split('\n')[0].substring(0, 50) + '...',
                tooltip: commit.summary_md,
                icon: 'note'
            });
        }
        // Add files changed
        if (commit.files_changed > 0) {
            children.push({
                id: `${commit.sha}-files`,
                type: 'category',
                categoryType: 'added',
                parentId: commit.sha,
                count: commit.files_changed,
                label: `📁 Files Changed (${commit.files_changed})`,
                icon: 'files'
            });
        }
        // Add symbol changes
        if (commit.symbols_added > 0) {
            children.push({
                id: `${commit.sha}-added`,
                type: 'category',
                categoryType: 'added',
                parentId: commit.sha,
                count: commit.symbols_added,
                label: `➕ Added Symbols (${commit.symbols_added})`,
                children: [],
                icon: 'add'
            });
        }
        if (commit.symbols_modified > 0) {
            children.push({
                id: `${commit.sha}-modified`,
                type: 'category',
                categoryType: 'modified',
                parentId: commit.sha,
                count: commit.symbols_modified,
                label: `✏️ Modified Symbols (${commit.symbols_modified})`,
                children: [],
                icon: 'edit'
            });
        }
        if (commit.symbols_removed > 0) {
            children.push({
                id: `${commit.sha}-removed`,
                type: 'category',
                categoryType: 'removed',
                parentId: commit.sha,
                count: commit.symbols_removed,
                label: `➖ Removed Symbols (${commit.symbols_removed})`,
                children: [],
                icon: 'remove'
            });
        }
        // Note: Semantic categories (renames, moves) will be loaded dynamically in getChildren
        // when the commit node is expanded to avoid async issues here
        // Add risks if any
        const risks = JSON.parse(commit.risks || '[]');
        if (risks.length > 0) {
            children.push({
                id: `${commit.sha}-risks`,
                type: 'category',
                categoryType: 'risks',
                parentId: commit.sha,
                count: risks.length,
                label: `⚠️ Risks (${risks.length})`,
                children: risks.map((risk, idx) => ({
                    id: `${commit.sha}-risk-${idx}`,
                    type: 'risk',
                    label: risk,
                    icon: 'warning'
                })),
                icon: 'warning'
            });
        }
        return children;
    }
    async getCommitDetails(element) {
        try {
            const { getDatabaseManager, ensureDatabaseInitialized } = await Promise.resolve().then(() => __importStar(require('../storage/database')));
            await ensureDatabaseInitialized();
            const db = getDatabaseManager().getDatabase();
            // Check if this is a commit (SHA only) or a category
            const parts = element.id.split('-');
            if (parts.length === 1) {
                // This is a commit - fetch and return its children grouped by file
                const sha = element.id;
                // Get all symbols for this commit
                const symbolsStmt = db.prepare(`
          SELECT name, kind, path, change_type, loc_post, id
          FROM symbols
          WHERE sha = ?
          ORDER BY path, change_type, name
        `);
                const allSymbols = symbolsStmt.all(sha);
                if (allSymbols.length === 0) {
                    return [{
                            id: `${sha}-no-symbols`,
                            type: 'risk',
                            label: 'No symbols found',
                            icon: 'info'
                        }];
                }
                // Group by file path
                const fileGroups = new Map();
                for (const symbol of allSymbols) {
                    if (!fileGroups.has(symbol.path)) {
                        fileGroups.set(symbol.path, []);
                    }
                    fileGroups.get(symbol.path).push(symbol);
                }
                const children = [];
                for (const [filePath, symbols] of fileGroups) {
                    const added = symbols.filter(s => s.change_type === 'added');
                    const modified = symbols.filter(s => s.change_type === 'modified' || s.change_type === 'signature_changed');
                    const removed = symbols.filter(s => s.change_type === 'removed');
                    const fileName = filePath.split('/').pop() || filePath;
                    const changeDesc = [];
                    if (added.length > 0)
                        changeDesc.push(`+${added.length}`);
                    if (modified.length > 0)
                        changeDesc.push(`~${modified.length}`);
                    if (removed.length > 0)
                        changeDesc.push(`-${removed.length}`);
                    const fileChildren = [];
                    // Add "Added" category if any
                    if (added.length > 0) {
                        fileChildren.push({
                            id: `${sha}-${filePath}-added`,
                            type: 'category',
                            categoryType: 'added',
                            parentId: `${sha}-${filePath}`,
                            count: added.length,
                            label: `➕ Added (${added.length})`,
                            children: added.map(s => this.createSymbolItem(sha, s)),
                            icon: 'add'
                        });
                    }
                    // Add "Modified" category if any
                    if (modified.length > 0) {
                        fileChildren.push({
                            id: `${sha}-${filePath}-modified`,
                            type: 'category',
                            categoryType: 'modified',
                            parentId: `${sha}-${filePath}`,
                            count: modified.length,
                            label: `✏️ Modified (${modified.length})`,
                            children: modified.map(s => this.createSymbolItem(sha, s)),
                            icon: 'edit'
                        });
                    }
                    // Add "Removed" category if any
                    if (removed.length > 0) {
                        fileChildren.push({
                            id: `${sha}-${filePath}-removed`,
                            type: 'category',
                            categoryType: 'removed',
                            parentId: `${sha}-${filePath}`,
                            count: removed.length,
                            label: `➖ Removed (${removed.length})`,
                            children: removed.map(s => this.createSymbolItem(sha, s)),
                            icon: 'remove'
                        });
                    }
                    children.push({
                        id: `${sha}-file-${filePath}`,
                        type: 'file',
                        path: filePath,
                        sha: sha,
                        stats: {
                            added: added.length,
                            modified: modified.length,
                            removed: removed.length
                        },
                        label: fileName,
                        description: `${changeDesc.join(' ')} · ${filePath}`,
                        tooltip: filePath,
                        children: fileChildren,
                        icon: 'file'
                    });
                }
                // Add risks at the end
                const commitStmt = db.prepare(`SELECT risks FROM commits WHERE sha = ?`);
                const commit = commitStmt.get(sha);
                const risks = JSON.parse(commit?.risks || '[]');
                if (risks.length > 0) {
                    children.push({
                        id: `${sha}-risks`,
                        type: 'category',
                        categoryType: 'risks',
                        parentId: sha,
                        count: risks.length,
                        label: `⚠️ Risks (${risks.length})`,
                        children: risks.map((risk, idx) => ({
                            id: `${sha}-risk-${idx}`,
                            type: 'risk',
                            label: risk,
                            icon: 'warning'
                        })),
                        icon: 'warning'
                    });
                }
                return children;
            }
            else if (parts.length >= 2 && (parts[1] === 'added' || parts[1] === 'modified' || parts[1] === 'removed')) {
                // Handle symbol categories (added, modified, removed)
                const sha = parts[0];
                const categoryType = parts[1];
                const symbolsStmt = db.prepare(`
          SELECT id, name, kind, path, change_type, mod_reason, confidence
          FROM symbols
          WHERE sha = ? AND change_type = ?
          ORDER BY path, name
        `);
                const symbols = symbolsStmt.all(sha, categoryType);
                return symbols.map(symbol => this.createSymbolItem(sha, symbol));
            }
            else if (parts.length >= 2 && (parts[1] === 'renames' || parts[1] === 'moves')) {
                // Handle renames or moves category
                const sha = parts[0];
                const changeType = parts[1] === 'renames' ? 'renamed' : 'moved';
                const symbolsStmt = db.prepare(`
          SELECT id, name, kind, path, confidence
          FROM symbols
          WHERE sha = ? AND change_type = ?
          ORDER BY confidence DESC, name
        `);
                const symbols = symbolsStmt.all(sha, changeType);
                return symbols.map(symbol => ({
                    id: `${sha}-${changeType}-symbol-${symbol.id}`,
                    type: 'symbol',
                    symbolId: symbol.id,
                    semanticId: symbol.id,
                    name: symbol.name,
                    kind: symbol.kind,
                    path: symbol.path,
                    sha: sha,
                    label: `${symbol.name} (${symbol.kind}) - ${Math.round(symbol.confidence * 100)}%`,
                    icon: changeType === 'renamed' ? 'arrow-right' : 'arrow-right',
                    tooltip: `${changeType === 'renamed' ? 'Renamed' : 'Moved'} symbol with ${Math.round(symbol.confidence * 100)}% confidence`
                }));
            }
        }
        catch (error) {
            console.error('Failed to load commit details:', error);
            return [{
                    id: `${element.id}-error`,
                    type: 'risk',
                    label: 'Error loading details',
                    description: String(error),
                    icon: 'error'
                }];
        }
        return [];
    }
    createSymbolItem(sha, symbol) {
        // Parse location if available
        let range;
        try {
            const loc = symbol.loc_post ? JSON.parse(symbol.loc_post) : null;
            if (loc && loc.start) {
                range = new vscode.Range(new vscode.Position(loc.start.line - 1, loc.start.column || 0), new vscode.Position(loc.end?.line - 1 || loc.start.line - 1, loc.end?.column || 0));
            }
        }
        catch (e) {
            // Ignore parse errors
        }
        return {
            id: `${sha}-symbol-${symbol.id}`,
            type: 'symbol',
            symbolId: symbol.id,
            semanticId: symbol.symbol_id,
            name: symbol.name,
            kind: symbol.kind,
            path: symbol.path,
            sha: sha,
            loc: symbol.loc_post ? JSON.parse(symbol.loc_post) : undefined,
            label: `${symbol.kind} ${symbol.name}`,
            icon: `symbol-${symbol.kind}`,
            command: symbol.path ? {
                command: 'git-context.openSymbol',
                title: 'Open Symbol',
                arguments: [sha, symbol.path, range]
            } : undefined
        };
    }
}
exports.CommitTrackerProvider = CommitTrackerProvider;
//# sourceMappingURL=commitTracker.js.map