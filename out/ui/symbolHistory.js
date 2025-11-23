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
        return {
            id: element.id,
            label: element.label,
            description: element.description,
            tooltip: element.tooltip,
            collapsibleState: element.children
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None,
            command: element.command,
            iconPath: element.icon ? new vscode.ThemeIcon(element.icon) : undefined,
            contextValue: element.contextValue
        };
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
        if (!this.searchQuery) {
            return [{
                    id: 'search-placeholder',
                    label: 'Search symbols...',
                    description: 'Type to search symbol history',
                    icon: 'search'
                }];
        }
        try {
            const { getSearchIndex } = await Promise.resolve().then(() => __importStar(require('../storage/index')));
            const { ensureDatabaseInitialized } = await Promise.resolve().then(() => __importStar(require('../storage/database')));
            await ensureDatabaseInitialized();
            const searchIndex = getSearchIndex();
            const results = searchIndex.searchSymbols(this.searchQuery, 10);
            if (results.length === 0) {
                return [{
                        id: 'no-results',
                        label: 'No symbols found',
                        description: `No matches for "${this.searchQuery}"`,
                        icon: 'search'
                    }];
            }
            // Group results by symbol name
            const symbolGroups = new Map();
            for (const result of results) {
                if (!symbolGroups.has(result.name)) {
                    symbolGroups.set(result.name, []);
                }
                symbolGroups.get(result.name).push(result);
            }
            const items = [];
            for (const [symbolName, occurrences] of symbolGroups) {
                const latest = occurrences[0]; // Results are ordered by relevance
                items.push({
                    id: `symbol-${symbolName}`,
                    label: symbolName,
                    description: `${occurrences.length} commits`,
                    tooltip: `Found in ${occurrences.length} commits\nLatest: ${latest.sha.substring(0, 8)}`,
                    children: occurrences.map(occ => ({
                        id: `symbol-${symbolName}-${occ.sha}`,
                        label: occ.sha.substring(0, 8),
                        description: occ.path,
                        tooltip: occ.summary_snippet || 'Symbol occurrence',
                        icon: 'git-commit'
                    })),
                    icon: 'symbol-variable' // Default icon, could be more specific
                });
            }
            return items;
        }
        catch (error) {
            console.error('Failed to search symbols:', error);
            return [{
                    id: 'search-error',
                    label: 'Search failed',
                    description: 'Error searching symbols',
                    icon: 'error'
                }];
        }
    }
    async getSymbolTimeline(symbol) {
        // The children are already populated in getSymbolSearchResults
        return symbol.children || [];
    }
    setSearchQuery(query) {
        this.searchQuery = query;
        this.refresh();
    }
}
exports.SymbolHistoryProvider = SymbolHistoryProvider;
//# sourceMappingURL=symbolHistory.js.map