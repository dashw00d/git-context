import * as path from 'path';

/**
 * Ensures a path is relative to the git root.
 * Handles absolute paths and ensures forward slashes.
 */
export function normalizeToRelative(p: string | undefined, gitRoot: string | undefined): string {
  if (!p || !gitRoot) return p || '';
  let normalized = p.replace(/\\/g, '/');
  if (path.isAbsolute(normalized)) {
    const root = gitRoot.replace(/\\/g, '/');
    if (normalized.startsWith(root)) {
      normalized = normalized.substring(root.length);
      if (normalized.startsWith('/')) {
        normalized = normalized.substring(1);
      }
    }
  }
  return normalized;
}

/**
 * Ensures a path is absolute, joining with gitRoot if necessary.
 */
export function normalizeToAbsolute(p: string, gitRoot: string): string {
  if (path.isAbsolute(p)) return p;
  // If it's a relative path starting with / or ./, clean it up
  const cleanPath = p.replace(/^(\.\/|\/)/, '');
  return path.join(gitRoot, cleanPath);
}
