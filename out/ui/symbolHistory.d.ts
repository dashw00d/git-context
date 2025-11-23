import * as vscode from 'vscode';
import { TreeItem } from '../types';
export declare class SymbolHistoryProvider implements vscode.TreeDataProvider<TreeItem> {
    private context;
    private _onDidChangeTreeData;
    readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void>;
    private searchQuery;
    constructor(context: vscode.ExtensionContext);
    refresh(): void;
    getTreeItem(element: TreeItem): vscode.TreeItem;
    getChildren(element?: TreeItem): Promise<TreeItem[]>;
    private getSymbolSearchResults;
    private getSymbolTimeline;
    setSearchQuery(query: string): void;
}
//# sourceMappingURL=symbolHistory.d.ts.map