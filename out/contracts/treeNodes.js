"use strict";
/**
 * Tree Node Type System
 *
 * Discriminated unions for tree view nodes to eliminate regex-based
 * collapsibility logic and make node handling type-safe.
 *
 * INVARIANT: Every node type explicitly declares its collapsibility behavior.
 */
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
exports.toVSCodeTreeItem = exports.getCollapsibleState = exports.isRiskNode = exports.isSymbolNode = exports.isCategoryNode = exports.isFileNode = exports.isCommitNode = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Type guards
 */
function isCommitNode(node) {
    return node.type === "commit";
}
exports.isCommitNode = isCommitNode;
function isFileNode(node) {
    return node.type === "file";
}
exports.isFileNode = isFileNode;
function isCategoryNode(node) {
    return node.type === "category";
}
exports.isCategoryNode = isCategoryNode;
function isSymbolNode(node) {
    return node.type === "symbol";
}
exports.isSymbolNode = isSymbolNode;
function isRiskNode(node) {
    return node.type === "risk";
}
exports.isRiskNode = isRiskNode;
/**
 * Get collapsibility for a node type
 *
 * INVARIANT: Collapsibility is determined by node type, not ID patterns
 */
function getCollapsibleState(node) {
    switch (node.type) {
        case "commit":
        case "file":
        case "category":
            return vscode.TreeItemCollapsibleState.Collapsed;
        case "symbol":
        case "risk":
            return vscode.TreeItemCollapsibleState.None;
    }
}
exports.getCollapsibleState = getCollapsibleState;
/**
 * Convert TreeNode to VS Code TreeItem
 */
function toVSCodeTreeItem(node, command) {
    return {
        id: node.id,
        label: node.label,
        description: node.description,
        tooltip: node.tooltip,
        collapsibleState: getCollapsibleState(node),
        iconPath: node.icon ? new vscode.ThemeIcon(node.icon) : undefined,
        command: command,
        contextValue: node.contextValue || node.type
    };
}
exports.toVSCodeTreeItem = toVSCodeTreeItem;
//# sourceMappingURL=treeNodes.js.map