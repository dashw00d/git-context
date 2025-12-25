import * as path from 'path';
import { getGitRoot } from '../utils/config';

/**
 * PathService - Centralized service for path normalization and conversion.
 * 
 * This service ensures all paths handled by the application are consistent:
 * - Project-relative (relative to git root)
 * - POSIX-style (forward slashes '/')
 * - Clean (no leading/trailing slashes, no './' prefix)
 */
export class PathService {
  private static instance: PathService;
  private gitRoot: string;

  private constructor() {
    this.gitRoot = getGitRoot() || process.cwd();
  }

  /**
   * Get the singleton instance of PathService.
   */
  public static getInstance(): PathService {
    if (!PathService.instance) {
      PathService.instance = new PathService();
    }
    return PathService.instance;
  }

  /**
   * Refreshes the git root from configuration.
   * Useful when the workspace folder changes.
   */
  public refreshRoot(): void {
    this.gitRoot = getGitRoot() || process.cwd();
  }

  /**
   * Normalizes any path (absolute or relative) to be project-relative and POSIX-compliant.
   * 
   * @param p The path to normalize.
   * @returns A clean, POSIX-style relative path.
   */
  public toRelative(p: string | undefined): string {
    if (!p) return '';
    
    // 1. Convert Windows backslashes to forward slashes for consistent processing
    let normalized = p.replace(/\\/g, '/');
    
    // 2. Prepare root with forward slashes
    const root = this.gitRoot.replace(/\\/g, '/');
    
    // 3. Strip root if it's an absolute path within the project
    if (normalized.startsWith(root)) {
      normalized = normalized.substring(root.length);
    } else if (path.isAbsolute(p)) {
      // If it's absolute but starts differently (e.g. symlinks or case mismatch on Windows),
      // use path.relative for a more robust check
      const absoluteP = path.resolve(p);
      const relative = path.relative(this.gitRoot, absoluteP);
      if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
        normalized = relative.replace(/\\/g, '/');
      }
    }
    
    // 4. Final cleanup: remove leading './', leading slashes, and trailing slashes
    return normalized
      .replace(/^\.\//, '')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '');
  }

  /**
   * Converts a project-relative path back to an absolute system path.
   * 
   * @param p The relative path.
   * @returns An absolute path using the current OS separators.
   */
  public toAbsolute(p: string): string {
    const posixP = this.normalize(p);
    const posixRoot = this.normalize(this.gitRoot);

    // If it already starts with the project root, it's already absolute and correct
    if (posixP.startsWith(posixRoot + '/') || posixP === posixRoot) {
      return path.normalize(p);
    }

    // Otherwise, treat as relative to root, stripping leading slashes or './'
    const cleanPath = p.replace(/^(\.\/|\/)/, '');
    return path.join(this.gitRoot, cleanPath);
  }

  /**
   * Normalizes a path to use POSIX separators without changing its relative/absolute status.
   * 
   * @param p The path to normalize.
   * @returns The path with forward slashes and collapsed redundant separators.
   */
  public normalize(p: string): string {
    if (!p) return '';
    return p.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
  }

  /**
   * Returns the current git root used by the service.
   */
  public getRoot(): string {
    return this.gitRoot;
  }
}

/**
 * Convenience function to get the PathService instance.
 */
export function getPathService(): PathService {
  return PathService.getInstance();
}
