import crypto from 'crypto';

export const PIPELINE_VERSION = '2.0';
export const PROMPT_VERSION = '1.2';

export function makeSymbolVersionId(
  sha: string,
  path: string,
  name: string,
  bodyHash: string
): string {
  const input = `${sha}:${path}:${name}:${bodyHash}`;
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function makeBundleFingerprint(
  shas: string[],
  mode: 'selection' | 'staged' | 'unstaged' | 'lastN' | 'full' | 'partial',
  pipelineVersion: string = PIPELINE_VERSION,
  promptVersion: string = PROMPT_VERSION
): string {
  const sorted = [...shas].sort();

  const input = JSON.stringify({
    shas: sorted,
    mode,
    pipeline: pipelineVersion,
    prompt: promptVersion,
  });

  return crypto.createHash('sha256').update(input).digest('hex');
}

export function makeWorkspaceSymbolVersionId(
  path: string,
  name: string,
  contentHash: string
): string {
  const input = `workspace:${path}:${name}:${contentHash}`;
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function computeFingerprint(obj: any, algorithm: 'md5' | 'sha256' = 'sha256'): string {
  if (obj === null) return 'null';
  if (obj === undefined) return 'undefined';

  if (typeof obj !== 'object') {
    return String(obj);
  }

  if (Array.isArray(obj)) {
    const sorted = obj.map(item => computeFingerprint(item, algorithm)).sort();
    const input = JSON.stringify(sorted);
    return crypto.createHash(algorithm).update(input).digest('hex');
  }

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

    if (seen.has(value)) {
      return '[Circular]';
    }

    seen.add(value);

    try {
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
