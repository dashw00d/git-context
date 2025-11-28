import * as path from 'path';
import * as fs from 'fs';
import { GitOperations } from '../analysis/git';
import { getExtensionConfig, getSupportedExtensions, createCustomIgnoreMatcher } from './config';
import { logDebug } from './logger';
import { LRUCache } from 'lru-cache';

export interface PathFilterOptions {
  git?: GitOperations;
  gitRoot?: string;
  status?: 'A' | 'M' | 'D' | 'R' | 'C' | 'U';  // File status for size checks (matches FileChange status)
  commitSha?: string;  // For historical gitignore + blob size
  skipSizeCheck?: boolean;  // Skip file size check (e.g., for deleted files)
}

export interface PathFilterResult {
  shouldProcess: boolean;
  reason?: string;  // Why it was filtered out
}

// Default excluded prefixes (can be overridden by config)
const DEFAULT_EXCLUDED_PREFIXES = ['out/', 'dist/', 'node_modules/', '.git/', 'build/', 'coverage/'];

// LRU cache for size/ignore checks to avoid repeated git/filesystem calls
// Key format: `${path}:${commitSha || 'workspace'}:${checkType}`
// checkType: 'size' | 'gitignore' | 'gitignore-commit'
const filterCache = new LRUCache<string, boolean>({
  max: 1000,
  ttl: 3600000, // 1 hour
  updateAgeOnGet: true
});

/**
 * Centralized path filter that all code paths must use
 * Checks: extension, git ignore, custom ignore paths, file size, hardcoded exclusions
 */
export function shouldProcessPath(
  filePath: string,
  options: PathFilterOptions = {}
): PathFilterResult {
  // 0. Validate file path
  if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') {
    return { shouldProcess: false, reason: 'invalid path' };
  }

  const normalized = filePath.replace(/\\/g, '/');

  // 1. Check hardcoded exclusions (build artifacts, node_modules)
  const config = getExtensionConfig();
  const excludedPrefixes = config.excludedPrefixes || DEFAULT_EXCLUDED_PREFIXES;
  
  for (const prefix of excludedPrefixes) {
    if (normalized.startsWith(prefix) || normalized.includes('/' + prefix)) {
      return { shouldProcess: false, reason: `hardcoded exclusion: ${prefix}` };
    }
  }

  // 2. Check extension
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const allowedExtensions = new Set(getSupportedExtensions());
  if (!ext || !allowedExtensions.has(ext)) {
    return { shouldProcess: false, reason: `extension .${ext} not allowed` };
  }

  // 3. Check git ignore (current workspace)
  if (options.git) {
    const cacheKey = `${filePath}:workspace:gitignore`;
    let isIgnored: boolean;
    
    const cached = filterCache.get(cacheKey);
    if (cached !== undefined) {
      isIgnored = cached;
    } else {
      isIgnored = options.git.isIgnored(filePath);
      filterCache.set(cacheKey, isIgnored);
    }
    
    if (isIgnored) {
      return { shouldProcess: false, reason: 'ignored by git' };
    }
  }

  // 4. Check historical git ignore (commit-specific)
  if (options.git && options.commitSha) {
    const cacheKey = `${filePath}:${options.commitSha}:gitignore-commit`;
    let isIgnored: boolean;
    
    const cached = filterCache.get(cacheKey);
    if (cached !== undefined) {
      isIgnored = cached;
    } else {
      // Check if GitOperations has isIgnoredAtCommit method
      if (typeof (options.git as any).isIgnoredAtCommit === 'function') {
        isIgnored = (options.git as any).isIgnoredAtCommit(options.commitSha, filePath);
      } else {
        // Fallback to current workspace ignore if method not available
        isIgnored = options.git.isIgnored(filePath);
      }
      filterCache.set(cacheKey, isIgnored);
    }
    
    if (isIgnored) {
      return { shouldProcess: false, reason: `ignored by git at commit ${options.commitSha.substring(0, 8)}` };
    }
  }

  // 5. Check custom ignore paths (gitignore-like patterns)
  const ignoreMatcher = createCustomIgnoreMatcher(config.customIgnorePaths);
  if (ignoreMatcher(filePath)) {
    return { shouldProcess: false, reason: 'matched custom ignore path' };
  }

  // 6. Check file size (if not deleted and size check not skipped)
  if (!options.skipSizeCheck && options.status !== 'D') {
    const maxFileSize = config.maxFileSize ?? 102400;
    let fileSize: number | null = null;

    if (options.commitSha && options.git) {
      // For commit files, use blob size
      const cacheKey = `${filePath}:${options.commitSha}:size`;
      const cachedSize = filterCache.get(cacheKey);
      
      if (cachedSize !== undefined) {
        // Cache stores boolean (true = should process), but we need actual size
        // So we'll fetch it fresh if not in cache
        try {
          fileSize = options.git.getBlobSize(options.commitSha, filePath);
          // Cache the size check result (true if under limit, false if over)
          filterCache.set(cacheKey, fileSize <= maxFileSize);
        } catch (e) {
          // If blob doesn't exist, skip size check
          fileSize = null;
        }
      } else {
        try {
          fileSize = options.git.getBlobSize(options.commitSha, filePath);
          filterCache.set(cacheKey, fileSize <= maxFileSize);
        } catch (e) {
          fileSize = null;
        }
      }
    } else if (options.gitRoot) {
      // For workspace files, use filesystem size
      const cacheKey = `${filePath}:workspace:size`;
      const cached = filterCache.get(cacheKey);
      
      if (cached !== undefined) {
        // We cached the boolean result, but need actual size
        // Fetch fresh if we need the actual value
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
export function filterPath(filePath: string, options: PathFilterOptions = {}): boolean {
  return shouldProcessPath(filePath, options).shouldProcess;
}

/**
 * Log filtered paths for debugging
 */
export function shouldProcessPathWithLog(
  filePath: string,
  options: PathFilterOptions = {},
  context?: string  // e.g., 'CommitIndexer', 'WorkspaceIndexer'
): PathFilterResult {
  const result = shouldProcessPath(filePath, options);
  if (!result.shouldProcess && result.reason) {
    logDebug(`[${context || 'PathFilter'}] Skipping ${filePath}: ${result.reason}`);
  }
  return result;
}

