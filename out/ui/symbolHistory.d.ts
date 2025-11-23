import * as vscode from 'vscode';
import { TreeNode } from '../contracts/treeNodes';
export declare class SymbolHistoryProvider implements vscode.TreeDataProvider<TreeNode> {
    private context;
    private _onDidChangeTreeData;
    readonly onDidChangeTreeData: vscode.Event<TreeNode | undefined | null | void>;
    private searchQuery;
    constructor(context: vscode.ExtensionContext);
    refresh(): void;
    getTreeItem(element: TreeNode): vscode.TreeItem;
    getChildren(element?: TreeNode): Promise<TreeNode[]>;
    private getSymbolSearchResults;
    private getSymbolTimeline;
    setSearchQuery(query: string): void;
}
//# sourceMappingURL=symbolHistory.d.ts.map