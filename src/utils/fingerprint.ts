import crypto from 'crypto';

/**
 * Pipeline and prompt versions for cache invalidation
 */
export const PIPELINE_VERSION = '2.0';
export const PROMPT_VERSION = '1.2';

/**
 * Generate stable symbol version ID for embedding caching.
 * Key = hash(sha + path + name + bodyHash)
 * Same symbol version = same ID = reuse embedding
 */
export function makeSymbolVersionId(
  sha: string,
  path: string,
  name: string,
  bodyHash: string
): string {
  const input = `${sha}:${path}:${name}:${bodyHash}`;
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Generate stable bundle fingerprint for report caching.
 * Key = hash(sorted_shas + mode + pipeline_ver + prompt_ver)
 * Same selection = same fingerprint = reuse report
 */
export function makeBundleFingerprint(
  shas: string[],
  mode: 'selection' | 'staged' | 'unstaged' | 'lastN' | 'full' | 'partial',
  pipelineVersion: string = PIPELINE_VERSION,
  promptVersion: string = PROMPT_VERSION
): string {
  // Sort SHAs for stable fingerprint
  const sorted = [...shas].sort();

  const input = JSON.stringify({
    shas: sorted,
    mode,
    pipeline: pipelineVersion,
    prompt: promptVersion,
  });

  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Generate workspace symbol version ID (for uncommitted changes)
 */
export function makeWorkspaceSymbolVersionId(
  path: string,
  name: string,
  contentHash: string
): string {
  const input = `workspace:${path}:${name}:${contentHash}`;
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Compute stable fingerprint for any object/value
 * Handles circular references and sorts object keys for stable hashing
 *
 * @param obj - Object or value to fingerprint
 * @param algorithm - Hash algorithm to use ('md5' or 'sha256')
 * @returns Stable hash string
 */
export function computeFingerprint(obj: any, algorithm: 'md5' | 'sha256' = 'sha256'): string {
  if (obj === null) return 'null';
  if (obj === undefined) return 'undefined';

  // Handle primitives
  if (typeof obj !== 'object') {
    return String(obj);
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    const sorted = obj.map(item => computeFingerprint(item, algorithm)).sort();
    const input = JSON.stringify(sorted);
    return crypto.createHash(algorithm).update(input).digest('hex');
  }

  // Handle objects - use a replacer to handle circular references and sort keys
  const seen = new WeakSet();

  function stableStringify(value: any): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';

    if (typeof value !== 'object') {
      return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
      return '[' + value.map(item => stableStringify(item)).join(',') + ']';
    }

    // Check for circular reference
    if (seen.has(value)) {
      return '[Circular]';
    }

    seen.add(value);

    try {
      // Sort keys for stable output
      const keys = Object.keys(value).sort();
      const pairs = keys.map(key => {
        return JSON.stringify(key) + ':' + stableStringify(value[key]);
      });
      return '{' + pairs.join(',') + '}';
    } finally {
      seen.delete(value);
    }
  }

  const serialized = stableStringify(obj);
  return crypto.createHash(algorithm).update(serialized).digest('hex');
}
