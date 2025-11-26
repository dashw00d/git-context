import { ExtensionConfig } from '../types';
import * as fs from 'fs';
import * as path from 'path';

let vscode: any;
try {
  vscode = require('vscode');
} catch {
  // Ignore, running in CLI
}

export function getExtensionConfig(): ExtensionConfig {
  if (vscode) {
    const config = vscode.workspace.getConfiguration('git-context');
    const apiEndpoint = config.get('apiEndpoint', 'https://openrouter.ai/api/v1');
    const embeddingProvider = config.get('embeddingProvider', ''); // Blank = use LLM provider

    return {
      openRouterApiKey: config.get('openRouterApiKey') || process.env.OPENROUTER_API_KEY,
      openRouterModel: config.get('openRouterModel', 'anthropic/claude-3-haiku:beta'),
      apiEndpoint,
      difftasticPath: config.get('difftasticPath'),
      defaultCommitCount: config.get('defaultCommitCount', 5),
      tokensPerStep: config.get('tokensPerStep'),
      customPrompts: config.get('customPrompts'),
      customIgnorePaths: config.get('customIgnorePaths'),
      // Qdrant config
      qdrantUrl: config.get('qdrantUrl', ''),
      qdrantApiKey: config.get('qdrantApiKey', ''),
      // Embedding config
      embeddingProvider: embeddingProvider || apiEndpoint, // Fallback to LLM provider
      embeddingModel: config.get('embeddingModel', 'text-embedding-3-small')
    };
  } else {
    // CLI fallback
    const apiEndpoint = process.env.API_ENDPOINT || 'https://openrouter.ai/api/v1';
    const embeddingProvider = process.env.EMBEDDING_PROVIDER || '';

    return {
      openRouterApiKey: process.env.OPENROUTER_API_KEY,
      openRouterModel: process.env.OPENROUTER_MODEL || 'anthropic/claude-3-haiku:beta',
      apiEndpoint,
      difftasticPath: process.env.DIFFTASTIC_PATH,
      defaultCommitCount: parseInt(process.env.DEFAULT_COMMIT_COUNT || '5'),
      tokensPerStep: process.env.TOKENS_PER_STEP ? JSON.parse(process.env.TOKENS_PER_STEP) : undefined,
      customPrompts: process.env.CUSTOM_PROMPTS ? JSON.parse(process.env.CUSTOM_PROMPTS) : undefined,
      customIgnorePaths: process.env.CUSTOM_IGNORE_PATHS ? process.env.CUSTOM_IGNORE_PATHS.split(',') : undefined,
      // Qdrant config
      qdrantUrl: process.env.QDRANT_URL || '',
      qdrantApiKey: process.env.QDRANT_API_KEY || '',
      // Embedding config
      embeddingProvider: embeddingProvider || apiEndpoint,
      embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small'
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
  if (vscode && vscode.workspace.workspaceFolders) {
    // Check all workspace folders
    for (const folder of vscode.workspace.workspaceFolders) {
      const root = findGitRootForPath(folder.uri.fsPath);
      if (root) return root;
    }
    return undefined;
  } else {
    // CLI fallback
    return findGitRootForPath(process.cwd());
  }
}

function findGitRootForPath(startPath: string): string | undefined {
  let currentPath = startPath;
  const rootPath = path.parse(currentPath).root;

  while (currentPath !== rootPath) {
    const gitPath = path.join(currentPath, '.git');

    // Check if .git exists (as directory or file for worktrees/submodules)
    if (fs.existsSync(gitPath)) {
      return currentPath;
    }

    // Move up one directory
    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      break;
    }
    currentPath = parentPath;
  }

  return undefined;
}
