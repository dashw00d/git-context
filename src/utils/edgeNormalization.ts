/**
 * Edge normalization utilities
 * Handles conversion between path-prefixed edge IDs and pure DNA IDs
 */

/**
 * Extract DNA hash from an edge ID that may include a file path prefix
 * Edge IDs from DependencyExtractor are in format: "filePath:dna:hash"
 * Database should store just the DNA hash: "dna:hash"
 *
 * @param edgeId - Edge ID that may include path prefix (e.g., "src/file.ts:dna:abc123...")
 * @returns Pure DNA ID (e.g., "dna:abc123...")
 */
export function extractDnaFromEdgeId(edgeId: string): string {
  if (!edgeId) {
    return edgeId;
  }

  // If it contains "dna:", extract everything from "dna:" onwards
  // This handles format: "filePath:dna:hash" -> "dna:hash"
  const dnaIndex = edgeId.indexOf('dna:');
  if (dnaIndex !== -1) {
    return edgeId.substring(dnaIndex);
  }

  // If it contains a colon but no "dna:", check if it's a special marker
  if (edgeId.includes(':') && !edgeId.startsWith('unknown:')) {
    const parts = edgeId.split(':');
    const lastPart = parts[parts.length - 1];

    // Special markers like "file" or "module" should be kept as-is
    if (lastPart === 'file' || lastPart === 'module') {
      return edgeId;
    }

    // If last part looks like a hash (long hex string), return it
    // This handles legacy formats where DNA hash might not have "dna:" prefix
    if (lastPart.length > 32 && /^[a-f0-9]+$/i.test(lastPart)) {
      return lastPart;
    }
  }

  // No "dna:" found and doesn't match special cases, assume it's already a DNA ID
  return edgeId;
}

/**
 * Normalize edge IDs for database storage
 * Extracts DNA hashes from path-prefixed edge IDs to ensure consistent storage
 * This ensures edges can be properly joined with symbols table on dna_id
 *
 * @param edgeId - Edge ID that may include path prefix
 * @returns Normalized DNA ID for database storage
 */
export function normalizeEdgeIdForStorage(edgeId: string): string {
  return extractDnaFromEdgeId(edgeId);
}

export type ParsedEdgeId = {
  filePath: string | null;
  symbolId: string;
};

/**
 * Split an edge endpoint into file path and symbol ID.
 * Standard format: "filePath:dna:hash" or "filePath:file|module".
 */
export function splitEdgeId(edgeId: string): ParsedEdgeId {
  if (!edgeId) {
    return { filePath: null, symbolId: edgeId };
  }

  if (edgeId.startsWith('unknown:')) {
    return { filePath: 'unknown', symbolId: edgeId.slice('unknown:'.length) };
  }

  const dnaMarker = ':dna:';
  const dnaIndex = edgeId.indexOf(dnaMarker);
  if (dnaIndex !== -1) {
    return { filePath: edgeId.slice(0, dnaIndex), symbolId: edgeId.slice(dnaIndex + 1) };
  }

  const lastColon = edgeId.lastIndexOf(':');
  if (lastColon !== -1) {
    return { filePath: edgeId.slice(0, lastColon), symbolId: edgeId.slice(lastColon + 1) };
  }

  return { filePath: null, symbolId: edgeId };
}
