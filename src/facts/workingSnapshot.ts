import * as fs from 'fs';
import * as path from 'path';
import { DependencyExtractor } from '../analysis/dependencies';
import { GitOperations } from '../analysis/git';
import { assignDNAIds } from '../analysis/symbolDna';
import { SymbolExtractor } from '../analysis/symbols';
import { EdgeContext, SymbolContext } from '../contracts/llmContext';
import { getGitRoot, detectLanguage } from '../utils/config';
import { logError, logInfo, logWarn, logDebug } from '../utils/logger';

export interface WorkingSnapshot {
  symbolsById: Map<string, SymbolContext>;
  symbolsByFile: Map<string, SymbolContext[]>;
  edges: EdgeContext[];
  analyzedPaths: Set<string>;
}

/**
 * Extract DNA hash from a normalized edge ID (filePath:symbolId or just symbolId)
 * This is useful when comparing edge IDs or looking up symbols in symbolsById
 */
export function extractDnaHash(edgeId: string): string {
  if (edgeId.includes(':') && !edgeId.startsWith('unknown:')) {
    // Format: filePath:symbolId or filePath:file or filePath:name:symbolId
    // DNA hash is always the last part after the last colon
    const parts = edgeId.split(':');
    return parts[parts.length - 1];
  }
  // No path prefix, assume it's already the DNA hash
  return edgeId;
}

/**
 * Build a symbolsByName index for fuzzy matching
 * Maps base name (without prefixes like function_, method_) to all matching symbols
 */
function buildSymbolsByName(symbolsById: Map<string, SymbolContext>): Map<string, SymbolContext[]> {
  const result = new Map<string, SymbolContext[]>();

  for (const symbol of symbolsById.values()) {
    const name = symbol.name;
    if (!result.has(name)) {
      result.set(name, []);
    }
    result.get(name)!.push(symbol);
  }

  return result;
}

/**
 * Extract base name from a symbol ID by removing common prefixes
 * e.g., "function_doThing" -> "doThing", "method_handleClick" -> "handleClick"
 */
function extractBaseName(symbolId: string): string {
  return symbolId.replace(/^(function_|method_|class_|variable_|object_|property_)/, '');
}

/**
 * Try to resolve an unknown symbol using fuzzy name matching
 * Returns the resolved filePath:symbolId or null if can't resolve with confidence
 */
function fuzzyResolveSymbol(
  symbolId: string,
  symbolsByName: Map<string, SymbolContext[]>
): string | null {
  const baseName = extractBaseName(symbolId);

  // Find all symbols with matching base name
  const candidates = symbolsByName.get(baseName) || [];

  if (candidates.length === 1) {
    // Single match - high confidence
    const match = candidates[0];
    return `${match.filePath}:${match.symbol_id}`;
  }

  if (candidates.length > 1) {
    // Multiple matches - try to narrow down by kind
    const isPrefixed = symbolId.startsWith('function_') || symbolId.startsWith('method_');
    if (isPrefixed) {
      const prefix = symbolId.split('_')[0];
      const kindFiltered = candidates.filter(c => {
        if (prefix === 'function') return c.kind === 'function';
        if (prefix === 'method') return c.kind === 'method';
        if (prefix === 'class') return c.kind === 'class';
        return false;
      });

      if (kindFiltered.length === 1) {
        const match = kindFiltered[0];
        return `${match.filePath}:${match.symbol_id}`;
      }
    }
  }

  // Can't resolve with confidence
  return null;
}

/**
 * Normalize a symbol ID to include file path prefix
 * Input can be: filePath:symbolId, filePath:file, or just symbolId (DNA hash)
 * Output: filePath:symbolId or unknown:symbolId
 *
 * Uses three resolution strategies:
 * 1. Direct DNA hash lookup in symbolsById
 * 2. Fuzzy name matching if direct lookup fails
 * 3. Mark as unknown if all strategies fail
 */
function normalizeSymbolId(
  symbolId: string,
  symbolsById: Map<string, SymbolContext>,
  symbolsByName: Map<string, SymbolContext[]>
): string {
  // Already has file path prefix and not unknown?
  if (symbolId.includes(':') && !symbolId.startsWith('unknown:')) {
    // Extract the DNA hash (last part after colon)
    const parts = symbolId.split(':');
    const dnaHash = parts[parts.length - 1];

    // Skip special markers like "file", "module"
    if (dnaHash === 'file' || dnaHash === 'module') {
      return symbolId; // Keep as-is
    }

    // Validate path exists by checking if dnaHash is in symbolsById
    const symbol = symbolsById.get(dnaHash);
    if (symbol && symbol.filePath) {
      // Use the filePath from symbolsById (more reliable than parsing)
      return `${symbol.filePath}:${dnaHash}`;
    }

    // If symbol not found but we have a valid-looking path, try fuzzy matching
    const fuzzyMatch = fuzzyResolveSymbol(dnaHash, symbolsByName);
    if (fuzzyMatch) {
      return fuzzyMatch;
    }

    // Keep original format if looks like a full path
    if (parts.length >= 2 && parts[0].includes('/')) {
      return symbolId;
    }
  }

  // No path prefix - lookup in symbolsById using symbolId as DNA hash
  const symbol = symbolsById.get(symbolId);
  if (symbol && symbol.filePath) {
    return `${symbol.filePath}:${symbolId}`;
  }

  // Try fuzzy matching by name
  const fuzzyMatch = fuzzyResolveSymbol(symbolId, symbolsByName);
  if (fuzzyMatch) {
    return fuzzyMatch;
  }

  // Unresolved - mark it
  return `unknown:${symbolId}`;
}

/**
 * Normalize all edges to include file paths in from_symbol_id and to_symbol_id
 * This ensures consistent format: filePath:symbolId (or unknown:symbolId for unresolved)
 */
function normalizeEdgesWithFilePaths(
  edges: EdgeContext[],
  symbolsById: Map<string, SymbolContext>
): EdgeContext[] {
  // Build name index for fuzzy matching
  const symbolsByName = buildSymbolsByName(symbolsById);

  let normalized = 0;
  let fuzzyResolved = 0;
  let unresolved = 0;

  const result = edges.map(edge => {
    const originalFrom = edge.from_symbol_id;
    const originalTo = edge.to_symbol_id;

    const normalizedFrom = normalizeSymbolId(edge.from_symbol_id, symbolsById, symbolsByName);
    const normalizedTo = normalizeSymbolId(edge.to_symbol_id, symbolsById, symbolsByName);

    if (normalizedFrom !== originalFrom || normalizedTo !== originalTo) {
      normalized++;

      // Track fuzzy resolutions (changed from unknown format to resolved)
      if (
        !originalTo.includes(':') &&
        normalizedTo.includes(':') &&
        !normalizedTo.startsWith('unknown:')
      ) {
        fuzzyResolved++;
      }
    }
    if (normalizedTo.startsWith('unknown:')) {
      unresolved++;
    }

    return {
      ...edge,
      from_symbol_id: normalizedFrom,
      to_symbol_id: normalizedTo,
    };
  });

  logInfo(
    `[WorkingSnapshot] Edge normalization: ${normalized} normalized, ${fuzzyResolved} fuzzy-resolved, ${unresolved} unresolved`
  );

  return result;
}

/**
 * Get scoped working tree snapshot using real SymbolExtractor + DependencyExtractor
 */
export async function getWorkingSnapshot(
  scopePaths: Set<string>,
  liveOverrides?: Map<string, string>
): Promise<WorkingSnapshot> {
  const gitRoot = getGitRoot();
  logDebug(`[WorkingSnapshot] gitRoot: ${gitRoot}`);
  if (!gitRoot) {
    logError('Not in a git repository');
    return {
      symbolsById: new Map(),
      symbolsByFile: new Map(),
      edges: [],
      analyzedPaths: new Set(),
    };
  }

  const symbolsById = new Map<string, SymbolContext>();
  const symbolsByFile = new Map<string, SymbolContext[]>();
  const edges: EdgeContext[] = [];
  const analyzedPaths = new Set<string>();

  const git = new GitOperations();
  const symbolExtractor = new SymbolExtractor(git);
  const dependencyExtractor = new DependencyExtractor();

  const totalFiles = scopePaths.size;
  let processedFiles = 0;
  const startTime = Date.now();

  logInfo(`[WorkingSnapshot] Processing ${totalFiles} files with concurrency 8...`);

  const limit = require('p-limit')(8);
  const promises = Array.from(scopePaths).map(filePath =>
    limit(async () => {
      try {
        // Safely construct full path, handling if filePath is already absolute (double-rooting defense)
        const fullPath = path.isAbsolute(filePath) ? filePath : path.join(gitRoot, filePath);

        if (!fs.existsSync(fullPath)) {
          logInfo(`Skipping non-existent path: ${filePath} (full: ${fullPath})`);
          return;
        }

        const stat = fs.statSync(fullPath);
        if (!stat.isFile()) {
          logInfo(`Skipping non-file (directory or link): ${filePath}`);
          return;
        }

        analyzedPaths.add(filePath);

        let content: string;
        if (liveOverrides && liveOverrides.has(fullPath)) {
          content = liveOverrides.get(fullPath)!;
          logInfo(`Using live content for: ${filePath}`);
        } else {
          content = fs.readFileSync(fullPath, 'utf8');
        }

        const symbols = await symbolExtractor.extractSymbolsFromContent(content, filePath);

        // Cache lines for DNA and potentially other uses
        const contentLines = content.split('\n');
        const bodyTexts = new Map<string, string>();
        for (const symbol of symbols) {
          if (symbol.location) {
            const bodyText = contentLines
              .slice(symbol.location.start.line - 1, symbol.location.end.line)
              .join('\n');
            // Use a unique key for each symbol's body text within the file
            // Format: filePath:temporaryId
            const key = `${symbol.filePath || filePath}:${symbol.id}`;
            bodyTexts.set(key, bodyText);
          }
        }

        const symbolsWithDNA = await assignDNAIds(
          symbols,
          bodyTexts,
          detectLanguage(filePath) || undefined
        );

        for (const symbol of symbolsWithDNA) {
          if (!symbol.id) {
            logWarn(`Invalid symbol: missing DNA ID in ${filePath}: ${symbol.name}`);
            continue;
          }

          const symbolContext: SymbolContext = {
            id: 0,
            symbol_id: symbol.id,
            name: symbol.name,
            kind: symbol.kind,
            signature: symbol.signature,
            dnaId: symbol.id,
            filePath: symbol.filePath,
            loc_pre: symbol.location
              ? {
                  start: { line: symbol.location.start.line, column: symbol.location.start.column },
                  end: { line: symbol.location.end.line, column: symbol.location.end.column },
                }
              : undefined,
          };

          symbolsById.set(symbol.id, symbolContext);

          if (!symbolsByFile.has(filePath)) {
            symbolsByFile.set(filePath, []);
          }
          symbolsByFile.get(filePath)!.push(symbolContext);
        }

        const fileEdges = dependencyExtractor.extractDependencies(
          content,
          filePath,
          symbols,
          0,
          contentLines
        );
        edges.push(
          ...fileEdges.map(edge => ({
            from_symbol_id: edge.from,
            to_symbol_id: edge.to,
            edge_type: edge.type,
            change_type: 'added' as any,
            confidence: edge.confidence || 1.0,
            is_resolved: edge.isResolved || true,
          }))
        );

        // Progress logging every 10 files
        processedFiles++;
        if (processedFiles % 10 === 0 || processedFiles === totalFiles) {
          const elapsed = Date.now() - startTime;
          const avgTime = elapsed / processedFiles;
          const remaining = (totalFiles - processedFiles) * avgTime;
          logInfo(
            `[WorkingSnapshot] Progress: ${processedFiles}/${totalFiles} (${Math.round((processedFiles / totalFiles) * 100)}%) - ` +
              `Elapsed: ${Math.round(elapsed / 1000)}s, ETA: ${Math.round(remaining / 1000)}s`
          );
        }
      } catch (error) {
        processedFiles++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        logWarn(`Skipped ${filePath}: ${errorMsg}`);
        logError(`[WorkingSnapshot] Error processing ${filePath}`, error);
      }
    })
  );

  await Promise.all(promises);

  // Normalize all edges to include file paths after all files are processed
  // This ensures symbolsById is complete and we can resolve cross-file references
  const normalizedEdges = normalizeEdgesWithFilePaths(edges, symbolsById);

  return { symbolsById, symbolsByFile, edges: normalizedEdges, analyzedPaths };
}
