import { ExtensionConfig } from '../types';

let vscode: any;
try {
  vscode = require('vscode');
} catch {
  // Ignore, running in CLI
}

export function getExtensionConfig(): ExtensionConfig {
  if (vscode) {
    const config = vscode.workspace.getConfiguration('git-context');
    return {
      openRouterApiKey: config.get('openRouterApiKey') || process.env.OPENROUTER_API_KEY,
      openRouterModel: config.get('openRouterModel', 'anthropic/claude-3-haiku:beta'),
      apiEndpoint: config.get('apiEndpoint', 'https://openrouter.ai/api/v1'),
      difftasticPath: config.get('difftasticPath'),
      defaultCommitCount: config.get('defaultCommitCount', 5),
      tokensPerStep: config.get('tokensPerStep'),
      customPrompts: config.get('customPrompts'),
      customIgnorePaths: config.get('customIgnorePaths')
    };
  } else {
    // CLI fallback
    return {
      openRouterApiKey: process.env.OPENROUTER_API_KEY,
      openRouterModel: process.env.OPENROUTER_MODEL || 'anthropic/claude-3-haiku:beta',
      apiEndpoint: process.env.API_ENDPOINT || 'https://openrouter.ai/api/v1',
      difftasticPath: process.env.DIFFTASTIC_PATH,
      defaultCommitCount: parseInt(process.env.DEFAULT_COMMIT_COUNT || '5'),
      tokensPerStep: process.env.TOKENS_PER_STEP ? JSON.parse(process.env.TOKENS_PER_STEP) : undefined,
      customPrompts: process.env.CUSTOM_PROMPTS ? JSON.parse(process.env.CUSTOM_PROMPTS) : undefined,
      customIgnorePaths: process.env.CUSTOM_IGNORE_PATHS ? process.env.CUSTOM_IGNORE_PATHS.split(',') : undefined
    };
  }
}

export function getWorkspaceRoot(): string | undefined {
  if (vscode) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    return workspaceFolders?.[0]?.uri?.fsPath;
  } else {
    return process.cwd();
  }
}

export function getGitRoot(): string | undefined {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) return undefined;

  // TODO: Find .git directory by walking up from workspace root
  return workspaceRoot;
}
