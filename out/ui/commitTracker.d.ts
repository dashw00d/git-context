import * as vscode from 'vscode';
import { TreeNode } from '../contracts/treeNodes';
export declare class CommitTrackerProvider implements vscode.TreeDataProvider<TreeNode> {
    private context;
    private _onDidChangeTreeData;
    readonly onDidChangeTreeData: vscode.Event<TreeNode | undefined | null | void>;
    selectedCommits: Set<string>;
    toggleCommitSelection(sha: string): void;
    clearSelection(): void;
    constructor(context: vscode.ExtensionContext);
    refresh(): void;
    getTreeItem(element: TreeNode): vscode.TreeItem;
    getChildren(element?: TreeNode): Promise<TreeNode[]>;
    private getRecentCommits;
    private getCommitChildren;
    private getCommitDetails;
    private createSymbolItem;
}
//# sourceMappingURL=commitTracker.d.ts.map