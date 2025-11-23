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
exports.SymbolHistoryProvider = void 0;
const vscode = __importStar(require("vscode"));
const treeNodes_1 = require("../contracts/treeNodes");
class SymbolHistoryProvider {
    constructor(context) {
        this.context = context;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.searchQuery = '';
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return (0, treeNodes_1.toVSCodeTreeItem)(element);
    }
    async getChildren(element) {
        if (!element) {
            // Root level - show search input and recent symbols
            return this.getSymbolSearchResults();
        }
        // Child level - show symbol history timeline
        return this.getSymbolTimeline(element);
    }
    async getSymbolSearchResults() {
        try {
            const { getDatabaseManager, ensureDatabaseInitialized } = await Promise.resolve().then(() => __importStar(require('../storage/database')));
            await ensureDatabaseInitialized();
            const db = getDatabaseManager().getDatabase();
            if (this.searchQuery) {
                // Search mode - show matching symbols
                const { getSearchIndex } = await Promise.resolve().then(() => __importStar(require('../storage/index')));
                const searchIndex = getSearchIndex();
                const results = searchIndex.searchSymbols(this.searchQuery, 20);
                if (results.length === 0) {
                    return [{
                            id: 'no-symbols',
                            type: 'risk',
                            label: 'No symbols found',
                            description: `No matches for "${this.searchQuery}"`,
                            icon: 'search'
                        }];
                }
                // Group by file for search results
                const fileGroups = new Map();
                for (const result of results) {
                    const key = result.path || 'unknown';
                    if (!fileGroups.has(key)) {
                        fileGroups.set(key, []);
                    }
                    fileGroups.get(key).push(result);
                }
                const items = [];
                for (const [filePath, symbols] of fileGroups) {
                    items.push({
                        id: `file-${filePath}`,
                        type: 'file',
                        path: filePath,
                        sha: symbols[0]?.sha || '',
                        stats: {
                            added: symbols.filter(s => s.change_type === 'added').length,
                            modified: symbols.filter(s => s.change_type === 'modified').length,
                            removed: symbols.filter(s => s.change_type === 'removed').length
                        },
                        label: filePath.split('/').pop() || filePath,
                        description: filePath,
                        tooltip: `${symbols.length} matching symbols`,
                        children: symbols.map(s => ({
                            id: `${filePath}-${s.name}`,
                            type: 'symbol',
                            symbolId: s.id || 0,
                            semanticId: s.symbol_id || '',
                            name: s.name,
                            kind: s.kind,
                            path: filePath,
                            sha: s.sha,
                            label: `${s.name} (${s.kind})`,
                            description: s.change_type,
                            icon: `symbol-${s.kind}`
                        })),
                        icon: 'file'
                    });
                }
                return items;
            }
            else {
                // Default mode - show recent files with their symbols
                const stmt = db.prepare(`
          SELECT s.path, s.name, s.kind, s.change_type, c.date, s.sha
          FROM symbols s
          JOIN commits c ON s.sha = c.sha
          ORDER BY c.date DESC, s.path, s.name
          LIMIT 100
        `);
                const results = stmt.all();
                if (results.length === 0) {
                    return [{
                            id: 'no-symbols',
                            type: 'risk',
                            label: 'No symbols analyzed yet',
                            description: 'Run "Analyze Last N Commits" to populate',
                            icon: 'search'
                        }];
                }
                // Group by file path
                const fileGroups = new Map();
                for (const result of results) {
                    const key = result.path;
                    if (!fileGroups.has(key)) {
                        fileGroups.set(key, []);
                    }
                    fileGroups.get(key).push(result);
                }
                const items = [];
                for (const [filePath, symbols] of fileGroups) {
                    const added = symbols.filter(s => s.change_type === 'added').length;
                    const modified = symbols.filter(s => s.change_type === 'modified' || s.change_type === 'signature_changed').length;
                    const removed = symbols.filter(s => s.change_type === 'removed').length;
                    const changeSummary = [];
                    if (added > 0)
                        changeSummary.push(`+${added}`);
                    if (modified > 0)
                        changeSummary.push(`~${modified}`);
                    if (removed > 0)
                        changeSummary.push(`-${removed}`);
                    items.push({
                        id: `file-${filePath}`,
                        type: 'file',
                        path: filePath,
                        sha: symbols[0]?.sha || '',
                        stats: { added, modified, removed },
                        label: filePath.split('/').pop() || filePath,
                        description: `${changeSummary.join(' ')} · ${filePath}`,
                        tooltip: `${symbols.length} total symbols\nAdded: ${added}, Modified: ${modified}, Removed: ${removed}`,
                        children: symbols.map(s => ({
                            id: `${filePath}-${s.sha}-${s.name}`,
                            type: 'symbol',
                            symbolId: s.id || 0,
                            semanticId: s.symbol_id || '',
                            name: s.name,
                            kind: s.kind,
                            path: filePath,
                            sha: s.sha,
                            label: `${s.change_type === 'added' ? '➕' : s.change_type === 'removed' ? '➖' : '✏️'} ${s.name}`,
                            description: `${s.kind}`,
                            tooltip: `${s.change_type} in ${s.sha.substring(0, 8)}`,
                            icon: `symbol-${s.kind}`
                        })),
                        icon: 'file'
                    });
                }
                return items;
            }
        }
        catch (error) {
            console.error('Failed to load symbols:', error);
            return [{
                    id: 'search-error',
                    type: 'risk',
                    label: 'Failed to load symbols',
                    description: 'Error loading symbol data',
                    icon: 'error'
                }];
        }
    }
    async getSymbolTimeline(symbol) {
        // Children are already set in getSymbolSearchResults
        return symbol.children || [];
    }
    setSearchQuery(query) {
        this.searchQuery = query;
        this.refresh();
    }
}
exports.SymbolHistoryProvider = SymbolHistoryProvider;
//# sourceMappingURL=symbolHistory.js.map