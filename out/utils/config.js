"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGitRoot = exports.getWorkspaceRoot = exports.getExtensionConfig = void 0;
let vscode;
try {
    vscode = require('vscode');
}
catch {
    // Ignore, running in CLI
}
function getExtensionConfig() {
    if (vscode) {
        const config = vscode.workspace.getConfiguration('git-context');
        return {
            openRouterApiKey: config.get('openRouterApiKey') || process.env.OPENROUTER_API_KEY,
            openRouterModel: config.get('openRouterModel', 'anthropic/claude-3-haiku:beta'),
            apiEndpoint: config.get('apiEndpoint', 'https://openrouter.ai/api/v1'),
            difftasticPath: config.get('difftasticPath'),
            defaultCommitCount: config.get('defaultCommitCount', 5)
        };
    }
    else {
        // CLI fallback
        return {
            openRouterApiKey: process.env.OPENROUTER_API_KEY,
            openRouterModel: process.env.OPENROUTER_MODEL || 'anthropic/claude-3-haiku:beta',
            apiEndpoint: process.env.API_ENDPOINT || 'https://openrouter.ai/api/v1',
            difftasticPath: process.env.DIFFTASTIC_PATH,
            defaultCommitCount: parseInt(process.env.DEFAULT_COMMIT_COUNT || '5')
        };
    }
}
exports.getExtensionConfig = getExtensionConfig;
function getWorkspaceRoot() {
    if (vscode) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        return workspaceFolders?.[0]?.uri?.fsPath;
    }
    else {
        return process.cwd();
    }
}
exports.getWorkspaceRoot = getWorkspaceRoot;
function getGitRoot() {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot)
        return undefined;
    // TODO: Find .git directory by walking up from workspace root
    return workspaceRoot;
}
exports.getGitRoot = getGitRoot;
//# sourceMappingURL=config.js.map