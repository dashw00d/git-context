import * as vscode from 'vscode';
import { TreeItem } from '../types';
export declare class CommitTrackerProvider implements vscode.TreeDataProvider<TreeItem> {
    private context;
    private _onDidChangeTreeData;
    readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void>;
    constructor(context: vscode.ExtensionContext);
    refresh(): void;
    getTreeItem(element: TreeItem): vscode.TreeItem;
    getChildren(element?: TreeItem): Promise<TreeItem[]>;
    private getRecentCommits;
    private getCommitChildren;
    private getCommitDetails;
}
//# sourceMappingURL=commitTracker.d.ts.map