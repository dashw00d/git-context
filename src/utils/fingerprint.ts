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
        prompt: promptVersion
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
