import * as path from 'path';

/**
 * Ensures a path is relative to the git root.
 * Handles absolute paths and ensures forward slashes.
 */
export function normalizeToRelative(p: string | undefined, gitRoot: string | undefined): string {
  if (!p) return '';
  let normalized = p.replace(/\\/g, '/');

  // If gitRoot provided, try to strip it
  if (gitRoot) {
    const root = gitRoot.replace(/\\/g, '/');
    if (normalized.startsWith(root)) {
      normalized = normalized.substring(root.length);
    } else if (path.isAbsolute(normalized)) {
      // If it's absolute but doesn't start with root, we can't really make it relative safely
      // but we should at least clean it up
    }
  }

  // Always ensure no leading slash or ./ prefix
  normalized = normalized.replace(/^\.\//, '').replace(/^\/+/, '');

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
