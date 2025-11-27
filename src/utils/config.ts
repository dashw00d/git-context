import { ExtensionConfig } from '../types';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

let vscode: any;
try {
  vscode = require('vscode');
} catch {
  // Ignore, running in CLI
}

/**
 * Load configuration from file if it exists
 */
let cachedFileConfig: Partial<ExtensionConfig> | null | undefined = undefined;

function loadConfigFile(): Partial<ExtensionConfig> | null {
  // Return cached value if already loaded
  if (cachedFileConfig !== undefined) {
    return cachedFileConfig;
  }

  try {
    const configPath = path.join(process.cwd(), '.git-context.config.json');
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(content);
      console.log('[CONFIG] Loaded config from .git-context.config.json');
      cachedFileConfig = config;
      return config;
    }
  } catch (error) {
    console.warn('[CONFIG] Failed to load .git-context.config.json:', error);
  }

  cachedFileConfig = null;
  return null;
}

export function getExtensionConfig(): ExtensionConfig {
  // Priority: 1. Local config file, 2. VS Code settings, 3. Environment variables
  const fileConfig = loadConfigFile();

  if (vscode) {
    const config = vscode.workspace.getConfiguration('git-context');
    const apiEndpoint = fileConfig?.apiEndpoint || config.get('apiEndpoint', 'https://openrouter.ai/api/v1');
    const embeddingProvider = fileConfig?.embeddingProvider || config.get('embeddingProvider', '');

    return {
      openRouterApiKey: fileConfig?.openRouterApiKey || config.get('openRouterApiKey') || process.env.OPENROUTER_API_KEY,
      openRouterModel: fileConfig?.openRouterModel || config.get('openRouterModel', 'anthropic/claude-3-haiku:beta'),
      apiEndpoint,
      difftasticPath: fileConfig?.difftasticPath || config.get('difftasticPath') || process.env.DIFFTASTIC_PATH,
      defaultCommitCount: fileConfig?.defaultCommitCount || config.get('defaultCommitCount', 5),
      tokensPerStep: fileConfig?.tokensPerStep || config.get('tokensPerStep'),
      customPrompts: fileConfig?.customPrompts || config.get('customPrompts'),
      customIgnorePaths: fileConfig?.customIgnorePaths || config.get('customIgnorePaths'),
      // Qdrant config
      qdrantUrl: fileConfig?.qdrantUrl || config.get('qdrantUrl', ''),
      qdrantApiKey: fileConfig?.qdrantApiKey || config.get('qdrantApiKey', ''),
      // Embedding config
      embeddingProvider: embeddingProvider || apiEndpoint,
      embeddingModel: fileConfig?.embeddingModel || config.get('embeddingModel', 'text-embedding-3-small'),
      allowedExtensions: fileConfig?.allowedExtensions || config.get('allowedExtensions', ['php', 'js', 'ts', 'tsx', 'jsx']),
      maxFileSize: fileConfig?.maxFileSize || config.get('maxFileSize', 100 * 1024), // 100KB default
      // Qdrant isolation config
      perProjectQdrantCollections: fileConfig?.perProjectQdrantCollections || config.get('perProjectQdrantCollections', false)
    };
  } else {
    // CLI/Test fallback: config file > environment variables
    const apiEndpoint = fileConfig?.apiEndpoint || process.env.API_ENDPOINT || 'https://openrouter.ai/api/v1';
    const embeddingProvider = fileConfig?.embeddingProvider || process.env.EMBEDDING_PROVIDER || '';

    return {
      openRouterApiKey: fileConfig?.openRouterApiKey || process.env.OPENROUTER_API_KEY,
      openRouterModel: fileConfig?.openRouterModel || process.env.OPENROUTER_MODEL || 'anthropic/claude-3-haiku:beta',
      apiEndpoint,
      difftasticPath: fileConfig?.difftasticPath || process.env.DIFFTASTIC_PATH,
      defaultCommitCount: fileConfig?.defaultCommitCount || parseInt(process.env.DEFAULT_COMMIT_COUNT || '5'),
      tokensPerStep: fileConfig?.tokensPerStep || (process.env.TOKENS_PER_STEP ? JSON.parse(process.env.TOKENS_PER_STEP) : undefined),
      customPrompts: fileConfig?.customPrompts || (process.env.CUSTOM_PROMPTS ? JSON.parse(process.env.CUSTOM_PROMPTS) : undefined),
      customIgnorePaths: fileConfig?.customIgnorePaths || (process.env.CUSTOM_IGNORE_PATHS ? process.env.CUSTOM_IGNORE_PATHS.split(',') : undefined),
      // Qdrant config
      qdrantUrl: fileConfig?.qdrantUrl || process.env.QDRANT_URL || '',
      qdrantApiKey: fileConfig?.qdrantApiKey || process.env.QDRANT_API_KEY || '',
      // Embedding config
      embeddingProvider: embeddingProvider || apiEndpoint,
      embeddingModel: fileConfig?.embeddingModel || process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
      allowedExtensions: fileConfig?.allowedExtensions || (process.env.ALLOWED_EXTENSIONS ? process.env.ALLOWED_EXTENSIONS.split(',') : ['php', 'js', 'ts', 'tsx', 'jsx']),
      maxFileSize: fileConfig?.maxFileSize || (process.env.MAX_FILE_SIZE ? parseInt(process.env.MAX_FILE_SIZE) : 100 * 1024),
      // Qdrant isolation config
      perProjectQdrantCollections: fileConfig?.perProjectQdrantCollections || (process.env.PER_PROJECT_QDRANT_COLLECTIONS === 'true')
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

/**
 * Get a unique project identifier for Qdrant isolation
 * Uses git remote URL if available, otherwise folder name + hash
 */
export function getProjectId(): string | undefined {
  const gitRoot = getGitRoot();
  if (!gitRoot) return undefined;

  try {
    // Try to get git remote URL (most unique identifier)
    const { execSync } = require('child_process');
    try {
      const remoteUrl = execSync('git config --get remote.origin.url', {
        cwd: gitRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim();

      if (remoteUrl) {
        // Hash the remote URL for a stable, unique ID
        const hash = crypto.createHash('sha256')
          .update(remoteUrl)
          .digest('hex')
          .substring(0, 16);
        return `project_${hash}`;
      }
    } catch {
      // No remote configured, fall through
    }

    // Fallback: folder name + hash of git root
    const folderName = path.basename(gitRoot.replace(/[/\\]$/, '')); // Remove trailing separator
    const rootHash = crypto.createHash('sha256')
      .update(gitRoot)
      .digest('hex')
      .substring(0, 12);
    return `project_${folderName}_${rootHash}`;
  } catch {
    // Final fallback: just hash of git root
    const hash = crypto.createHash('sha256')
      .update(gitRoot)
      .digest('hex')
      .substring(0, 16);
    return `project_${hash}`;
  }
}

function findGitRootForPath(startPath: string): string | undefined {
  let currentPath = startPath;
  const rootPath = path.parse(currentPath).root;

  while (currentPath !== rootPath) {
    const gitPath = path.join(currentPath, '.git');

    // Check if .git exists (as directory or file for worktrees/submodules)
    if (fs.existsSync(gitPath)) {
      // Normalize: ensure trailing path separator and consistent casing
      const normalized = path.resolve(currentPath);
      // Add trailing separator if not root
      if (normalized !== path.parse(normalized).root) {
        return normalized + path.sep;
      }
      return normalized;
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
