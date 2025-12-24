/**
 * Branded types for semantic type safety
 * Prevents mixing up semantically different string types at compile time
 */

/**
 * Symbol ID: Can be DNA hash or readable ID format
 * Format: 16-char hex hash or "symbol:123" or "path:kind:name"
 */
export type SymbolId = string & { readonly __brand: 'SymbolId' };

/**
 * DNA Hash: Stable hash for symbol identity across renames
 * Format: 16-char hex string (e.g., "9780191b73844aca")
 */
export type DnaHash = string & { readonly __brand: 'DnaHash' };

/**
 * Commit SHA: Git commit hash
 * Format: 40-char hex string
 */
export type CommitSha = string & { readonly __brand: 'CommitSha' };

// ============================================================================
// Type Guards (Validators)
// ============================================================================

/**
 * Check if string is a valid SymbolId format
 */
export function isValidSymbolId(id: string): id is SymbolId {
  if (!id || typeof id !== 'string') return false;
  // Accept 16-char hex DNA hash, symbol ID format, or path:kind:name format
  return (
    /^[a-f0-9]{16}$/.test(id) || /^symbol:\d+$/.test(id) || /.+:.+:.+/.test(id) // path:kind:name
  );
}

/**
 * Check if string is a valid DNA hash format
 */
export function isValidDnaHash(hash: string): hash is DnaHash {
  if (!hash || typeof hash !== 'string') return false;
  return /^[a-f0-9]{16}$/.test(hash);
}

/**
 * Check if string is a valid commit SHA format
 */
export function isValidCommitSha(sha: string): sha is CommitSha {
  if (!sha || typeof sha !== 'string') return false;
  return /^[a-f0-9]{40}$/.test(sha);
}

// ============================================================================
// Converters (with validation)
// ============================================================================

/**
 * Convert string to SymbolId (throws if invalid)
 */
export function toSymbolId(id: string): SymbolId {
  if (!isValidSymbolId(id)) {
    // eslint-disable-next-line no-restricted-syntax
    throw new Error(`Invalid SymbolId format: ${id}`);
  }
  return id;
}

/**
 * Convert string to DnaHash (throws if invalid)
 */
export function toDnaHash(hash: string): DnaHash {
  if (!isValidDnaHash(hash)) {
    // eslint-disable-next-line no-restricted-syntax
    throw new Error(`Invalid DnaHash format: ${hash}`);
  }
  return hash;
}

/**
 * Convert string to CommitSha (throws if invalid)
 */
export function toCommitSha(sha: string): CommitSha {
  if (!isValidCommitSha(sha)) {
    // eslint-disable-next-line no-restricted-syntax
    throw new Error(`Invalid CommitSha format: ${sha}`);
  }
  return sha;
}

// ============================================================================
// Safe Converters (return undefined instead of throwing)
// ============================================================================

/**
 * Try to convert string to SymbolId (returns undefined if invalid)
 */
export function trySymbolId(id: string): SymbolId | undefined {
  return isValidSymbolId(id) ? id : undefined;
}

/**
 * Try to convert string to DnaHash (returns undefined if invalid)
 */
export function tryDnaHash(hash: string): DnaHash | undefined {
  return isValidDnaHash(hash) ? hash : undefined;
}

/**
 * Try to convert string to CommitSha (returns undefined if invalid)
 */
export function tryCommitSha(sha: string): CommitSha | undefined {
  return isValidCommitSha(sha) ? sha : undefined;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Extract the raw string from a branded type
 */
export type Unbrand<T> = T extends string & { readonly __brand: unknown } ? string : T;
