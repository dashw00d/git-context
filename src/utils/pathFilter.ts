import * as fs from 'fs';
import { LRUCache } from 'lru-cache';
import * as path from 'path';
import { GitOperations } from '../analysis/git';
import { createCustomIgnoreMatcher, getExtensionConfig, getSupportedExtensions } from './config';
import { logDebug } from './logger';

export interface PathFilterOptions {
  git?: GitOperations;
  gitRoot?: string;
  status?: 'A' | 'M' | 'D' | 'R' | 'C' | 'U';
  commitSha?: string;
  skipSizeCheck?: boolean;
}

export interface PathFilterResult {
  shouldProcess: boolean;
  reason?: string;
}

const DEFAULT_EXCLUDED_PREFIXES = [
  'out/',
  'dist/',
  'node_modules/',
  '.git/',
  'build/',
  'coverage/',
];

const filterCache = new LRUCache<string, boolean>({
  max: 1000,
  ttl: 3600000,
  updateAgeOnGet: true,
});

/**
 * Centralized path filter that all code paths must use
 * Checks: extension, git ignore, custom ignore paths, file size, hardcoded exclusions
 */
export async function shouldProcessPath(
  filePath: string,
  options: PathFilterOptions = {}
): Promise<PathFilterResult> {
  if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') {
    return { shouldProcess: false, reason: 'invalid path' };
  }

  const normalized = filePath.replace(/\\/g, '/');

  const config = getExtensionConfig();
  const excludedPrefixes = config.excludedPrefixes || DEFAULT_EXCLUDED_PREFIXES;

  for (const prefix of excludedPrefixes) {
    if (normalized.startsWith(prefix) || normalized.includes('/' + prefix)) {
      return { shouldProcess: false, reason: `hardcoded exclusion: ${prefix}` };
    }
  }

  const ext = path.extname(filePath).slice(1).toLowerCase();
  const allowedExtensions = new Set(getSupportedExtensions());
  if (!ext || !allowedExtensions.has(ext)) {
    return { shouldProcess: false, reason: `extension .${ext} not allowed` };
  }

  if (options.git) {
    const cacheKey = `${filePath}:workspace:gitignore`;
    let isIgnored: boolean;

    const cached = filterCache.get(cacheKey);
    if (cached !== undefined) {
      isIgnored = cached;
    } else {
      isIgnored = await options.git.isIgnored(filePath);
      filterCache.set(cacheKey, isIgnored);
    }

    if (isIgnored) {
      return { shouldProcess: false, reason: 'ignored by git' };
    }
  }

  if (options.git && options.commitSha) {
    const cacheKey = `${filePath}:${options.commitSha}:gitignore-commit`;
    let isIgnored: boolean;

    const cached = filterCache.get(cacheKey);
    if (cached !== undefined) {
      isIgnored = cached;
    } else {
      if (typeof (options.git as any).isIgnoredAtCommit === 'function') {
        isIgnored = await (options.git as any).isIgnoredAtCommit(options.commitSha, filePath);
      } else {
        isIgnored = await options.git.isIgnored(filePath);
      }
      filterCache.set(cacheKey, isIgnored);
    }

    if (isIgnored) {
      return {
        shouldProcess: false,
        reason: `ignored by git at commit ${options.commitSha.substring(0, 8)}`,
      };
    }
  }

  const ignoreMatcher = createCustomIgnoreMatcher(config.customIgnorePaths);
  if (ignoreMatcher(filePath)) {
    return { shouldProcess: false, reason: 'matched custom ignore path' };
  }

  if (!options.skipSizeCheck && options.status !== 'D') {
    const maxFileSize = config.maxFileSize ?? 102400;
    let fileSize: number | null = null;

    if (options.commitSha && options.git) {
      const cacheKey = `${filePath}:${options.commitSha}:size`;
      const cachedSize = filterCache.get(cacheKey);

      if (cachedSize !== undefined) {
        try {
          fileSize = await options.git.getBlobSize(options.commitSha, filePath);

          filterCache.set(cacheKey, fileSize <= maxFileSize);
        } catch (e) {
          fileSize = null;
        }
      } else {
        try {
          fileSize = await options.git.getBlobSize(options.commitSha, filePath);
          filterCache.set(cacheKey, fileSize <= maxFileSize);
        } catch (e) {
          fileSize = null;
        }
      }
    } else if (options.gitRoot) {
      const cacheKey = `${filePath}:workspace:size`;
      const cached = filterCache.get(cacheKey);

      if (cached !== undefined) {
        try {
          const fullPath = path.join(options.gitRoot, filePath);
          if (fs.existsSync(fullPath)) {
            const stats = fs.statSync(fullPath);
            fileSize = stats.size;
            filterCache.set(cacheKey, fileSize <= maxFileSize);
          }
        } catch (e) {
          fileSize = null;
        }
      } else {
        try {
          const fullPath = path.join(options.gitRoot, filePath);
          if (fs.existsSync(fullPath)) {
            const stats = fs.statSync(fullPath);
            fileSize = stats.size;
            filterCache.set(cacheKey, fileSize <= maxFileSize);
          }
        } catch (e) {
          fileSize = null;
        }
      }
    }

    if (fileSize !== null && fileSize > maxFileSize) {
      return { shouldProcess: false, reason: `size ${fileSize} > ${maxFileSize}` };
    }
  }

  return { shouldProcess: true };
}

/**
 * Convenience wrapper that returns boolean (for filter() usage)
 */
export async function filterPath(
  filePath: string,
  options: PathFilterOptions = {}
): Promise<boolean> {
  const result = await shouldProcessPath(filePath, options);
  return result.shouldProcess;
}

/**
 * Log filtered paths for debugging
 */
export async function shouldProcessPathWithLog(
  filePath: string,
  options: PathFilterOptions = {},
  context?: string
): Promise<PathFilterResult> {
  const result = await shouldProcessPath(filePath, options);
  if (!result.shouldProcess && result.reason) {
    logDebug(`[${context || 'PathFilter'}] Skipping ${filePath}: ${result.reason}`);
  }
  return result;
}
