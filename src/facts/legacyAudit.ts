import { SymbolContext, EdgeContext } from '../contracts/llmContext';
import { IntendedState } from './intendedMap';
import { WorkingSnapshot } from './workingSnapshot';
import { ScopeSet } from './scope';

export interface LegacyAuditResult {
  dead: SymbolContext[];
  legacyUsed: SymbolContext[];
  replacedLeftovers: Array<{old: SymbolContext, new: SymbolContext, confidence: number}>;
}

/**
 * Scoped reachability analysis for dead/legacy/replaced detection
 */
export async function auditLegacy(
  intended: Map<string, IntendedState>,
  working: WorkingSnapshot,
  scope: ScopeSet
): Promise<LegacyAuditResult> {
  // Build inbound graph: Map<symbol_id, Set<caller_symbol_ids>>
  const inboundGraph = new Map<string, Set<string>>();
  for (const edge of working.edges) {
    if (!inboundGraph.has(edge.to_symbol_id)) {
      inboundGraph.set(edge.to_symbol_id, new Set());
    }
    inboundGraph.get(edge.to_symbol_id)!.add(edge.from_symbol_id);
  }

  // Seed roots: exported symbols, public APIs, entry points (detect by naming patterns)
  const roots = findEntryPoints(working, scope);

  // BFS from roots to find reachable symbols
  const reachable = new Set<string>();
  const queue = Array.from(roots);

  while (queue.length > 0) {
    const symbolId = queue.shift()!;
    if (reachable.has(symbolId)) continue;

    reachable.add(symbolId);

    // Find symbols that call this one (outbound from current symbol)
    for (const edge of working.edges) {
      if (edge.from_symbol_id === symbolId) {
        queue.push(edge.to_symbol_id);
      }
    }
  }

  // Find dead symbols: in scope, not reachable from roots
  const dead: SymbolContext[] = [];
  for (const [symbolId, symbol] of working.symbolsById) {
    if (!reachable.has(symbolId) && isInScope(symbolId, scope)) {
      // Only consider as dead if:
      // 1. Not an entry point itself
      // 2. Has some complexity (not just simple getters/setters)
      // 3. Not a generic utility function
      if (!roots.has(symbolId) &&
          !isLikelyUtilityFunction(symbol) &&
          hasSomeComplexity(symbol)) {
        dead.push(symbol);
      }
    }
  }

  // Find legacy used symbols (intended absent but still have inbound edges)
  const legacyUsed: SymbolContext[] = [];
  for (const [symbolId, expected] of intended) {
    if (expected.expect === 'absent') {
      const symbol = working.symbolsById.get(symbolId);
      if (symbol && inboundGraph.has(symbolId)) {
        legacyUsed.push(symbol);
      }
    }
  }

  // Find replaced leftovers: symbols intended absent with similar names/signatures and low inbound count
  const replacedLeftovers = findReplacedLeftovers(intended, working, inboundGraph);

  return { dead, legacyUsed, replacedLeftovers };
}

/**
 * Find entry points (roots) for reachability analysis
 */
function findEntryPoints(working: WorkingSnapshot, scope: ScopeSet): Set<string> {
  const roots = new Set<string>();

  // Build inbound graph to check for symbols with no callers
  const inboundGraph = new Map<string, Set<string>>();
  for (const edge of working.edges) {
    if (!inboundGraph.has(edge.to_symbol_id)) {
      inboundGraph.set(edge.to_symbol_id, new Set());
    }
    inboundGraph.get(edge.to_symbol_id)!.add(edge.from_symbol_id);
  }

  for (const [symbolId, symbol] of working.symbolsById) {
    if (!isInScope(symbolId, scope)) continue;

    const filePath = symbolId.split(':')[0];
    const filePathLower = filePath.toLowerCase();

    // Prioritize exported + no inbound = root (highest priority)
    if ((symbol.name.startsWith('export ') ||
         (symbol.signature && symbol.signature.includes('export')) ||
         symbol.name.startsWith('public ')) &&
        (!inboundGraph.has(symbolId) || inboundGraph.get(symbolId)!.size === 0)) {
      roots.add(symbolId);
      continue;
    }

    // Limit framework patterns to scoped files only
    if (filePathLower.includes('controller') && !scope.allPaths.has(filePath)) continue;
    if (filePathLower.includes('service') && !scope.allPaths.has(filePath)) continue;

    // Remove generic getters/setters unless in controller/service
    if ((/^(get|set|is|has|can)[A-Z]/.test(symbol.name)) &&
        !filePathLower.includes('controller') &&
        !filePathLower.includes('service')) {
      continue; // Skip generic getters/setters outside controllers/services
    }

    // 1. Exported/public symbols (if not already added above)
    if (symbol.name.startsWith('export ') ||
        (symbol.signature && symbol.signature.includes('export')) ||
        symbol.name.startsWith('public ')) {
      roots.add(symbolId);
      continue;
    }

    // 2. Entry point functions (main functions, event handlers, lifecycle methods)
    // Exclude generic getters/setters (already filtered above)
    if (symbol.kind === 'function' || symbol.kind === 'method') {
      const name = symbol.name.toLowerCase();
      if (/^(main|run|start|init|setup|bootstrap|create|build)$/.test(name) ||
          /^on[A-Z]/.test(symbol.name) || // onClick, onLoad, etc.
          ['handle', 'process', 'execute', 'render', 'mount', 'unmount', 'destroy'].some(pattern =>
            name.includes(pattern))) {
        roots.add(symbolId);
        continue;
      }
    }

    // 3. Classes that are likely entry points
    if (symbol.kind === 'class') {
      const name = symbol.name.toLowerCase();
      if (name.includes('controller') || name.includes('service') || name.includes('provider') ||
          name.includes('component') || name.includes('view') || name.includes('page')) {
        roots.add(symbolId);
        continue;
      }
    }

    // 4. Framework-specific entry points (only if file is in scope)
    if (scope.allPaths.has(filePath)) {
      if (filePathLower.includes('controller') || filePathLower.includes('route') ||
          filePathLower.includes('middleware') || filePathLower.includes('bootstrap') ||
          filePathLower.includes('app.') || filePathLower.includes('main.') ||
          filePathLower.includes('index.')) {
        roots.add(symbolId);
        continue;
      }
    }

    // 5. Symbols with no inbound edges (leaf entry points)
    if (!inboundGraph.has(symbolId) || inboundGraph.get(symbolId)!.size === 0) {
      // Only consider as roots if they have outbound edges (they call other things)
      const hasOutbound = working.edges.some(edge => edge.from_symbol_id === symbolId);
      if (hasOutbound) {
        roots.add(symbolId);
      }
    }
  }

  return roots;
}

/**
 * Check if a symbol is within the analysis scope
 */
function isInScope(symbolId: string, scope: ScopeSet): boolean {
  const filePath = symbolId.split(':')[0];
  return scope.allPaths.has(filePath);
}

/**
 * Check if a symbol is likely a utility function (shouldn't be marked as dead)
 */
function isLikelyUtilityFunction(symbol: SymbolContext): boolean {
  const name = symbol.name.toLowerCase();
  const genericNames = ['get', 'set', 'is', 'has', 'can', 'should', 'validate', 'format', 'parse', 'convert', 'toString', 'equals', 'hashCode'];

  // Simple getter/setter patterns
  if (genericNames.some(generic => name.startsWith(generic)) && symbol.kind === 'method') {
    return true;
  }

  // Very short functions (likely simple utilities)
  if (symbol.signature && symbol.signature.length < 50) {
    return true;
  }

  return false;
}

/**
 * Check if a symbol is entry-point-like (controllers, handlers, etc.)
 */
function isEntryPointLike(symbol: SymbolContext): boolean {
  const name = symbol.name.toLowerCase();
  const filePath = symbol.symbol_id.split(':')[0].toLowerCase();

  // Framework entry points
  if (filePath.includes('controller') || filePath.includes('handler') ||
      filePath.includes('route') || filePath.includes('middleware')) {
    return true;
  }

  // Method patterns that suggest entry points
  if (symbol.kind === 'function' || symbol.kind === 'method') {
    if (/^(handle|process|execute|run|on[A-Z])/.test(symbol.name) ||
        ['main', 'start', 'init', 'bootstrap', 'mount', 'render'].includes(name)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a symbol has some complexity (not just a simple one-liner)
 */
function hasSomeComplexity(symbol: SymbolContext): boolean {
  // Check signature length as a proxy for complexity
  if (symbol.signature && symbol.signature.length > 20) {
    return true;
  }

  // Check if it contains multiple statements or complex patterns
  if (symbol.signature && (
    symbol.signature.includes('{') ||
    symbol.signature.includes('if') ||
    symbol.signature.includes('for') ||
    symbol.signature.includes('while') ||
    symbol.signature.includes('=>')
  )) {
    return true;
  }

  return false;
}

/**
 * Find symbols that were replaced but old versions remain
 */
function findReplacedLeftovers(
  intended: Map<string, IntendedState>,
  working: WorkingSnapshot,
  inboundGraph: Map<string, Set<string>>
): Array<{old: SymbolContext, new: SymbolContext, confidence: number}> {
  const leftovers: Array<{old: SymbolContext, new: SymbolContext, confidence: number}> = [];

  // Find symbols intended to be absent
  const absentSymbols = new Map<string, IntendedState>();
  for (const [symbolId, expected] of intended) {
    if (expected.expect === 'absent') {
      absentSymbols.set(symbolId, expected);
    }
  }

  for (const [absentId, expected] of absentSymbols) {
    const absentSymbol = working.symbolsById.get(absentId);
    if (!absentSymbol) continue;

    // Check inbound count (low = likely replaced, but not still heavily used)
    const inboundCount = inboundGraph.get(absentId)?.size || 0;
    if (inboundCount > 10) continue; // Too many callers, probably still in active use

    // Skip if the symbol is still being used by entry points
    const callers = inboundGraph.get(absentId) || new Set();
    const hasEntryPointCallers = Array.from(callers).some(callerId =>
      working.symbolsById.has(callerId) && isEntryPointLike(working.symbolsById.get(callerId)!)
    );
    if (hasEntryPointCallers && inboundCount > 3) continue;

    // Find similar symbols in working tree
    const candidates: Array<{symbol: SymbolContext, similarity: number}> = [];

    for (const [workingId, workingSymbol] of working.symbolsById) {
      if (workingId === absentId) continue;

      const similarity = calculateSimilarity(absentSymbol, workingSymbol, expected);
      if (similarity > 0.7) { // Lower threshold to catch more potential replacements
        candidates.push({ symbol: workingSymbol, similarity });
      }
    }

    // Sort by similarity and take top candidates
    candidates.sort((a, b) => b.similarity - a.similarity);

    // Only include if we have a clear best match
    if (candidates.length > 0) {
      const bestMatch = candidates[0];
      // Require the best match to be significantly better than others (if any)
      const secondBest = candidates[1]?.similarity || 0;
      if (bestMatch.similarity > secondBest + 0.2 || candidates.length === 1) {
        leftovers.push({
          old: absentSymbol,
          new: bestMatch.symbol,
          confidence: bestMatch.similarity
        });
      }
    }
  }

  return leftovers;
}

/**
 * Calculate similarity between old and new symbols
 */
function calculateSimilarity(
  oldSymbol: SymbolContext,
  newSymbol: SymbolContext,
  expected: IntendedState
): number {
  let score = 0;
  let total = 0;

  // Name similarity (weighted heavily)
  total += 4;
  if (oldSymbol.name === expected.lastName) {
    score += 1.5; // Old name matches expected
  }
  if (oldSymbol.name === newSymbol.name) {
    score += 2.5; // Same name
  } else {
    // Check for common rename patterns
    const similarity = calculateStringSimilarity(oldSymbol.name, newSymbol.name);
    score += similarity * 2; // Partial name match
  }

  // Kind similarity
  total += 1;
  if (oldSymbol.kind === newSymbol.kind) {
    score += 1;
  }

  // File location similarity (symbols in same/similar files are more likely replacements)
  total += 1;
  const oldPath = oldSymbol.symbol_id.split(':')[0];
  const newPath = newSymbol.symbol_id.split(':')[0];
  if (oldPath === newPath) {
    score += 1; // Same file
  } else if (oldPath.replace(/\.old|\.bak|\.backup/, '') === newPath.replace(/\.new|\.updated/, '')) {
    score += 0.8; // Likely rename pattern
  } else if (calculatePathSimilarity(oldPath, newPath) > 0.5) {
    score += 0.5; // Similar paths
  }

  // Signature similarity
  total += 2;
  if (oldSymbol.signature && newSymbol.signature) {
    const oldSig = normalizeSignature(oldSymbol.signature);
    const newSig = normalizeSignature(newSymbol.signature);

    if (oldSig === newSig) {
      score += 2; // Exact match
    } else {
      // Check parameter similarity
      const oldParams = extractParameters(oldSig);
      const newParams = extractParameters(newSig);

      if (oldParams.length === newParams.length) {
        score += 1;
        // Check parameter type similarity
        let paramMatches = 0;
        for (let i = 0; i < Math.min(oldParams.length, newParams.length); i++) {
          if (oldParams[i] === newParams[i]) {
            paramMatches += 1;
          }
        }
        score += (paramMatches / oldParams.length) * 0.5;
      }
    }
  }

  return Math.min(score / total, 1.0); // Cap at 1.0
}

/**
 * Calculate string similarity (simple Levenshtein-like metric)
 */
function calculateStringSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;

  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;

  if (longer.length === 0) return 1.0;

  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

/**
 * Simple Levenshtein distance
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,     // deletion
        matrix[j - 1][i] + 1,     // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate path similarity
 */
function calculatePathSimilarity(path1: string, path2: string): number {
  const parts1 = path1.split('/');
  const parts2 = path2.split('/');

  let matches = 0;
  const maxLength = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < maxLength; i++) {
    if (parts1[i] === parts2[i]) {
      matches++;
    } else {
      break;
    }
  }

  return matches / maxLength;
}

/**
 * Normalize signature for comparison
 */
function normalizeSignature(signature: string): string {
  return signature
    .replace(/\s+/g, ' ')
    .replace(/public\s+|private\s+|protected\s+/g, '')
    .replace(/async\s+|static\s+/g, '')
    .trim();
}

/**
 * Extract parameters from signature
 */
function extractParameters(signature: string): string[] {
  const paramMatch = signature.match(/\(([^)]*)\)/);
  if (!paramMatch) return [];

  return paramMatch[1]
    .split(',')
    .map(param => param.trim().split(':')[1]?.trim() || param.trim())
    .filter(param => param.length > 0);
}
