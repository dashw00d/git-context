import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { GitOperations } from '../analysis/git';
import { ExtensionConfig } from '../types';
import { logError, logInfo } from './logger';
import {
  detectLanguage,
  getAugmentableLanguages,
  getJSLanguages,
  getSupportedExtensions,
  getSupportedLanguages,
  getTestFilePattern,
  invalidateCache as invalidateSupportedLanguagesCache,
  isCstOnlyLanguage,
  isJSLanguage,
  isPHPLanguage,
  LANGUAGES,
  type Language,
} from './supportedLanguages';

let vscode: any;
try {
  vscode = require('vscode');
} catch {
  //empty
}

let cachedPackageJson: any = null;
function getPackageJson(): any {
  if (!cachedPackageJson) {
    try {
      const packageJsonPath = path.join(__dirname, '../../package.json');
      const content = fs.readFileSync(packageJsonPath, 'utf-8');
      cachedPackageJson = JSON.parse(content);
    } catch (error) {
      logError('[CONFIG] Failed to load package.json', error);
      cachedPackageJson = {};
    }
  }
  return cachedPackageJson;
}

export function getPackageJsonDefault(key: string): any {
  const packageJson = getPackageJson();
  const props = packageJson?.contributes?.configuration?.properties || {};
  const fullKey = `git-context.${key}`;
  return (props as Record<string, any>)[fullKey]?.default;
}

let cachedFileConfig: Partial<ExtensionConfig> | null | undefined = undefined;

function loadConfigFile(): Partial<ExtensionConfig> | null {
  if (cachedFileConfig !== undefined) {
    return cachedFileConfig;
  }

  try {
    const configPath = path.join(process.cwd(), '.git-context.config.json');
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(content);
      logInfo('[CONFIG] Loaded config from .git-context.config.json');
      cachedFileConfig = config;
      return config;
    }
  } catch (error) {
    logError('[CONFIG] Failed to load .git-context.config.json', error);
  }

  cachedFileConfig = null;
  return null;
}

export function createCustomIgnoreMatcher(
  ignorePaths: string[] | null | undefined
): (filePath: string) => boolean {
  if (!ignorePaths || ignorePaths.length === 0) {
    return () => false;
  }

  const ignore = require('ignore');
  const ig = ignore();

  const cleanedPatterns = ignorePaths.map(pattern => pattern.trim()).filter(Boolean);

  if (cleanedPatterns.length === 0) {
    return () => false;
  }

  ig.add(cleanedPatterns);

  return (filePath: string): boolean => {
    const normalizedPath = GitOperations.normalizePath(filePath);
    return ig.ignores(normalizedPath);
  };
}

export function getExtensionConfig(): ExtensionConfig {
  const fileConfig = loadConfigFile();

  if (vscode) {
    const config = vscode.workspace.getConfiguration('git-context');

    const apiEndpoint = fileConfig?.apiEndpoint || config.get('apiEndpoint');
    const embeddingProvider =
      fileConfig?.embeddingProvider || config.get('embeddingProvider') || apiEndpoint;

    return {
      openRouterApiKey:
        fileConfig?.openRouterApiKey ||
        config.get('openRouterApiKey') ||
        process.env.OPENROUTER_API_KEY,
      openRouterModel: fileConfig?.openRouterModel || config.get('openRouterModel'),
      apiEndpoint,
      difftasticPath:
        fileConfig?.difftasticPath || config.get('difftasticPath') || process.env.DIFFTASTIC_PATH,
      defaultCommitCount: fileConfig?.defaultCommitCount || config.get('defaultCommitCount'),
      tokensPerStep: fileConfig?.tokensPerStep || config.get('tokensPerStep'),
      customPrompts: fileConfig?.customPrompts || config.get('customPrompts'),
      customIgnorePaths: fileConfig?.customIgnorePaths || config.get('customIgnorePaths'),
      rerankingWeights: fileConfig?.rerankingWeights || config.get('rerankingWeights'),

      qdrantUrl:
        fileConfig?.qdrantUrl || config.get('qdrantUrl') || getPackageJsonDefault('qdrantUrl'),
      qdrantApiKey:
        fileConfig?.qdrantApiKey ||
        config.get('qdrantApiKey') ||
        getPackageJsonDefault('qdrantApiKey'),

      embeddingProvider,
      embeddingModel:
        fileConfig?.embeddingModel ||
        config.get('embeddingModel') ||
        getPackageJsonDefault('embeddingModel'),
      allowedExtensions: fileConfig?.allowedExtensions || config.get('allowedExtensions'),
      maxFileSize: fileConfig?.maxFileSize || config.get('maxFileSize'),

      perProjectQdrantCollections:
        fileConfig?.perProjectQdrantCollections || config.get('perProjectQdrantCollections'),

      enableCstTracking: fileConfig?.enableCstTracking ?? config.get('enableCstTracking') ?? true,
      enableCstAugmentation:
        fileConfig?.enableCstAugmentation ?? config.get('enableCstAugmentation') ?? false,
      cstLanguages: fileConfig?.cstLanguages ||
        config.get('cstLanguages') || ['markdown', 'json', 'yaml', 'css'],

      snapshotCacheEnabled:
        fileConfig?.snapshotCacheEnabled ?? config.get('snapshotCacheEnabled') ?? true,
      snapshotCacheSize: fileConfig?.snapshotCacheSize || config.get('snapshotCacheSize') || 50,
      snapshotCacheTTL: fileConfig?.snapshotCacheTTL || config.get('snapshotCacheTTL') || 3600,

      excludedPrefixes: fileConfig?.excludedPrefixes || config.get('excludedPrefixes'),

      detectorThresholds: fileConfig?.detectorThresholds || config.get('detectorThresholds'),
    };
  } else {
    const apiEndpoint =
      fileConfig?.apiEndpoint || process.env.API_ENDPOINT || getPackageJsonDefault('apiEndpoint');
    const embeddingProvider =
      fileConfig?.embeddingProvider ||
      process.env.EMBEDDING_PROVIDER ||
      getPackageJsonDefault('embeddingProvider') ||
      apiEndpoint;

    const enableCstAugmentation =
      fileConfig?.enableCstAugmentation ??
      (process.env.ENABLE_CST_AUGMENTATION === 'true'
        ? true
        : process.env.ENABLE_CST_AUGMENTATION === 'false'
          ? false
          : (getPackageJsonDefault('enableCstAugmentation') ?? false));

    return {
      openRouterApiKey:
        fileConfig?.openRouterApiKey ||
        process.env.OPENROUTER_API_KEY ||
        getPackageJsonDefault('openRouterApiKey'),
      openRouterModel:
        fileConfig?.openRouterModel ||
        process.env.OPENROUTER_MODEL ||
        getPackageJsonDefault('openRouterModel'),
      apiEndpoint,
      difftasticPath: fileConfig?.difftasticPath || process.env.DIFFTASTIC_PATH,
      defaultCommitCount:
        fileConfig?.defaultCommitCount ||
        parseInt(
          process.env.DEFAULT_COMMIT_COUNT ||
            String(getPackageJsonDefault('defaultCommitCount') || '5')
        ),
      tokensPerStep:
        fileConfig?.tokensPerStep ||
        (process.env.TOKENS_PER_STEP
          ? JSON.parse(process.env.TOKENS_PER_STEP)
          : getPackageJsonDefault('tokensPerStep')),
      customPrompts:
        fileConfig?.customPrompts ||
        (process.env.CUSTOM_PROMPTS
          ? JSON.parse(process.env.CUSTOM_PROMPTS)
          : getPackageJsonDefault('customPrompts')),
      customIgnorePaths:
        fileConfig?.customIgnorePaths ||
        (process.env.CUSTOM_IGNORE_PATHS
          ? process.env.CUSTOM_IGNORE_PATHS.split(',')
              .map(s => s.trim())
              .filter(Boolean)
          : getPackageJsonDefault('customIgnorePaths')),

      qdrantUrl:
        fileConfig?.qdrantUrl || process.env.QDRANT_URL || getPackageJsonDefault('qdrantUrl'),
      qdrantApiKey:
        fileConfig?.qdrantApiKey ||
        process.env.QDRANT_API_KEY ||
        getPackageJsonDefault('qdrantApiKey'),

      embeddingProvider,
      embeddingModel:
        fileConfig?.embeddingModel ||
        process.env.EMBEDDING_MODEL ||
        getPackageJsonDefault('embeddingModel'),
      allowedExtensions:
        fileConfig?.allowedExtensions ||
        (process.env.ALLOWED_EXTENSIONS
          ? process.env.ALLOWED_EXTENSIONS.split(',')
          : getPackageJsonDefault('allowedExtensions')),
      maxFileSize:
        fileConfig?.maxFileSize ||
        (process.env.MAX_FILE_SIZE
          ? parseInt(process.env.MAX_FILE_SIZE)
          : getPackageJsonDefault('maxFileSize')),

      perProjectQdrantCollections:
        fileConfig?.perProjectQdrantCollections ||
        process.env.PER_PROJECT_QDRANT_COLLECTIONS === 'true' ||
        getPackageJsonDefault('perProjectQdrantCollections'),

      enableCstTracking:
        fileConfig?.enableCstTracking ??
        (process.env.ENABLE_CST_TRACKING === 'false'
          ? false
          : process.env.ENABLE_CST_TRACKING === 'true'
            ? true
            : (getPackageJsonDefault('enableCstTracking') ?? true)),
      enableCstAugmentation,
      cstLanguages:
        fileConfig?.cstLanguages ||
        (process.env.CST_LANGUAGES
          ? process.env.CST_LANGUAGES.split(',')
          : getPackageJsonDefault('cstLanguages') || ['markdown', 'json', 'yaml', 'css']),

      snapshotCacheEnabled:
        fileConfig?.snapshotCacheEnabled ??
        (process.env.SNAPSHOT_CACHE_ENABLED === 'false'
          ? false
          : process.env.SNAPSHOT_CACHE_ENABLED === 'true'
            ? true
            : (getPackageJsonDefault('snapshotCacheEnabled') ?? true)),
      snapshotCacheSize:
        fileConfig?.snapshotCacheSize ||
        (process.env.SNAPSHOT_CACHE_SIZE
          ? parseInt(process.env.SNAPSHOT_CACHE_SIZE)
          : getPackageJsonDefault('snapshotCacheSize') || 50),
      snapshotCacheTTL:
        fileConfig?.snapshotCacheTTL ||
        (process.env.SNAPSHOT_CACHE_TTL
          ? parseInt(process.env.SNAPSHOT_CACHE_TTL)
          : getPackageJsonDefault('snapshotCacheTTL') || 3600),

      excludedPrefixes:
        fileConfig?.excludedPrefixes ||
        (process.env.EXCLUDED_PREFIXES
          ? process.env.EXCLUDED_PREFIXES.split(',')
              .map(s => s.trim())
              .filter(Boolean)
          : getPackageJsonDefault('excludedPrefixes')),

      detectorThresholds:
        fileConfig?.detectorThresholds ||
        (process.env.DETECTOR_THRESHOLDS
          ? JSON.parse(process.env.DETECTOR_THRESHOLDS)
          : getPackageJsonDefault('detectorThresholds')),
    };
  }
}

if (vscode) {
  vscode.workspace.onDidChangeConfiguration((e: any) => {
    if (
      e.affectsConfiguration('git-context.allowedExtensions') ||
      e.affectsConfiguration('git-context.enableCstTracking') ||
      e.affectsConfiguration('git-context.enableCstAugmentation') ||
      e.affectsConfiguration('git-context.cstLanguages')
    ) {
      invalidateSupportedLanguagesCache();

      (async () => {
        try {
          const { getSupportedExtensions, getRequiredLanguagesForExtensions } =
            await import('./supportedLanguages');
          const fs = require('fs');
          const path = require('path');

          const extensions = getSupportedExtensions();
          const requiredLangs = getRequiredLanguagesForExtensions(extensions);
          const wasmDir = path.join(__dirname, '..', '..', 'out', 'wasm');

          const missingLangs = requiredLangs.filter((lang: string) => {
            const wasmPath = path.join(wasmDir, `tree-sitter-${lang}.wasm`);

            const oldWasmPath = path.join(__dirname, '..', '..', 'out', `tree-sitter-${lang}.wasm`);
            return !fs.existsSync(wasmPath) && !fs.existsSync(oldWasmPath);
          });

          if (missingLangs.length > 0) {
            const action = await vscode.window.showInformationMessage(
              `Missing WASM files for languages: ${missingLangs.join(
                ', '
              )}. Would you like to download them?`,
              'Download',
              'Later'
            );

            if (action === 'Download') {
              vscode.commands.executeCommand('git-context.downloadWasmFiles');
            }
          }
        } catch (error) {
          logError('[Config] Failed to check for missing WASM files', error);
        }
      })();
    }
  });
}

export {
  detectLanguage,
  getAugmentableLanguages,
  getJSLanguages,
  getSupportedExtensions,
  getSupportedLanguages,
  getTestFilePattern,
  isCstOnlyLanguage,
  isJSLanguage,
  isPHPLanguage,
  LANGUAGES,
  type Language,
};

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
    for (const folder of vscode.workspace.workspaceFolders) {
      const root = findGitRootForPath(folder.uri.fsPath);
      if (root) return root;
    }
    // Fallback to process.cwd() if no git root found in workspace folders
    return findGitRootForPath(process.cwd());
  } else {
    return findGitRootForPath(process.cwd());
  }
}

export async function getProjectId(): Promise<string | undefined> {
  const gitRoot = getGitRoot();
  if (!gitRoot) return undefined;

  try {
    const { GitOperations } = require('../analysis/git');
    const git = GitOperations.getSimpleGit(gitRoot);
    try {
      const config = await git.getConfig('remote.origin.url');
      const remoteUrl = config.value || '';

      if (remoteUrl) {
        const hash = crypto.createHash('sha256').update(remoteUrl).digest('hex').substring(0, 16);
        return `project_${hash}`;
      }
    } catch {
      //empty
    }

    const folderName = path.basename(gitRoot.replace(/[/\\]$/, ''));
    const rootHash = crypto.createHash('sha256').update(gitRoot).digest('hex').substring(0, 12);
    return `project_${folderName}_${rootHash}`;
  } catch {
    const hash = crypto.createHash('sha256').update(gitRoot).digest('hex').substring(0, 16);
    return `project_${hash}`;
  }
}

function findGitRootForPath(startPath: string): string | undefined {
  if (!startPath) return undefined;
  let currentPath = startPath;
  const parsed = path.parse(currentPath);
  if (!parsed) return undefined;
  const rootPath = parsed.root;

  while (currentPath !== rootPath) {
    const gitPath = path.join(currentPath, '.git');

    if (fs.existsSync(gitPath)) {
      const normalized = path.resolve(currentPath);

      if (normalized !== path.parse(normalized).root) {
        return normalized;
      }
      return normalized;
    }

    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      break;
    }
    currentPath = parentPath;
  }

  return undefined;
}
