import { BaseDetector, DetectorConfig } from '../analysis/detectors/BaseDetector';
import { GitOperations } from '../analysis/git';
import { SymbolContext } from '../contracts/llmContext';
import { prepare } from '../storage/statement-wrapper';
import { logInfo } from '../utils/logger';
import { IntendedState } from './intendedMap';
import { ScopeSet } from './scope';
import { WorkingSnapshot } from './workingSnapshot';

export interface LegacyAuditResult {
  dead: SymbolContext[];
  legacyUsed: SymbolContext[];
  replacedLeftovers: Array<{
    old: SymbolContext;
    new: SymbolContext;
    confidence: number;
  }>;
}

export async function auditLegacy(
  intended: Map<string, IntendedState>,
  working: WorkingSnapshot,
  scope: ScopeSet
): Promise<LegacyAuditResult> {
  if (intended.size === 0) {
    const hotspotStmt = prepare(`
      SELECT DISTINCT sh.symbol_id, sh.file_path, sh.symbol_name, sh.hotspot_score
      FROM symbol_hotspots sh
      WHERE sh.hotspot_score >= 40
      AND sh.symbol_id NOT IN (
        SELECT symbol_id FROM symbol_versions WHERE sha IN (
          SELECT sha FROM commits_metadata ORDER BY date DESC LIMIT 10
        )
      )
      ORDER BY sh.hotspot_score DESC
      LIMIT 50
    `);
    const hotspotSymbols = hotspotStmt.all() as any[];

    for (const hotspot of hotspotSymbols) {
      const symbolId = hotspot.symbol_id;
      if (!working.symbolsById.has(symbolId)) {
        intended.set(symbolId, {
          expect: 'absent',
          lastSha: 'unknown',
          lastName: hotspot.symbol_name,
        });
      }
    }

    if (intended.size > 0) {
      logInfo(`Using fallback: inferred ${intended.size} legacy symbols from hotspots`);
    }
  }

  const inboundGraph = new Map<string, Set<string>>();
  for (const edge of working.edges) {
    if (!inboundGraph.has(edge.to_symbol_id)) {
      inboundGraph.set(edge.to_symbol_id, new Set());
    }
    inboundGraph.get(edge.to_symbol_id)!.add(edge.from_symbol_id);
  }

  const roots = findEntryPoints(working, scope);

  const reachable = new Set<string>();
  const queue = Array.from(roots);

  while (queue.length > 0) {
    const symbolId = queue.shift()!;
    if (reachable.has(symbolId)) continue;

    reachable.add(symbolId);

    for (const edge of working.edges) {
      if (edge.from_symbol_id === symbolId) {
        queue.push(edge.to_symbol_id);
      }
    }
  }

  const dead: SymbolContext[] = [];
  for (const [symbolId, symbol] of working.symbolsById) {
    if (!reachable.has(symbolId) && isInScope(symbolId, scope)) {
      if (!roots.has(symbolId) && !isLikelyUtilityFunction(symbol) && hasSomeComplexity(symbol)) {
        dead.push(symbol);
      }
    }
  }

  const legacyUsed: SymbolContext[] = [];
  for (const [symbolId, expected] of intended) {
    if (expected.expect === 'absent') {
      const symbol = working.symbolsById.get(symbolId);
      if (symbol && inboundGraph.has(symbolId)) {
        legacyUsed.push(symbol);
      }
    }
  }

  const replacedLeftovers = findReplacedLeftovers(intended, working, inboundGraph);

  return { dead, legacyUsed, replacedLeftovers };
}

function findEntryPoints(working: WorkingSnapshot, scope: ScopeSet): Set<string> {
  const roots = new Set<string>();

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
    // Normalize path for consistent Set membership checks
    const normalizedFilePath = GitOperations.normalizePath(filePath);
    const filePathLower = filePath.toLowerCase();

    if (
      (symbol.name.startsWith('export ') ||
        (symbol.signature && symbol.signature.includes('export')) ||
        symbol.name.startsWith('public ')) &&
      (!inboundGraph.has(symbolId) || inboundGraph.get(symbolId)!.size === 0)
    ) {
      roots.add(symbolId);
      continue;
    }

    if (filePathLower.includes('controller') && !scope.allPaths.has(normalizedFilePath)) continue;
    if (filePathLower.includes('service') && !scope.allPaths.has(normalizedFilePath)) continue;

    if (
      /^(get|set|is|has|can)[A-Z]/.test(symbol.name) &&
      !filePathLower.includes('controller') &&
      !filePathLower.includes('service')
    ) {
      continue;
    }

    if (
      symbol.name.startsWith('export ') ||
      (symbol.signature && symbol.signature.includes('export')) ||
      symbol.name.startsWith('public ')
    ) {
      roots.add(symbolId);
      continue;
    }

    if (symbol.kind === 'function' || symbol.kind === 'method') {
      const name = symbol.name.toLowerCase();
      if (
        /^(main|run|start|init|setup|bootstrap|create|build)$/.test(name) ||
        /^on[A-Z]/.test(symbol.name) ||
        ['handle', 'process', 'execute', 'render', 'mount', 'unmount', 'destroy'].some(pattern =>
          name.includes(pattern)
        )
      ) {
        roots.add(symbolId);
        continue;
      }
    }

    if (symbol.kind === 'class') {
      const name = symbol.name.toLowerCase();
      if (
        name.includes('controller') ||
        name.includes('service') ||
        name.includes('provider') ||
        name.includes('component') ||
        name.includes('view') ||
        name.includes('page')
      ) {
        roots.add(symbolId);
        continue;
      }
    }

    if (scope.allPaths.has(normalizedFilePath)) {
      if (
        filePathLower.includes('controller') ||
        filePathLower.includes('route') ||
        filePathLower.includes('middleware') ||
        filePathLower.includes('bootstrap') ||
        filePathLower.includes('app.') ||
        filePathLower.includes('main.') ||
        filePathLower.includes('index.')
      ) {
        roots.add(symbolId);
        continue;
      }
    }

    if (!inboundGraph.has(symbolId) || inboundGraph.get(symbolId)!.size === 0) {
      const hasOutbound = working.edges.some(edge => edge.from_symbol_id === symbolId);
      if (hasOutbound) {
        roots.add(symbolId);
      }
    }
  }

  return roots;
}

function isInScope(symbolId: string, scope: ScopeSet): boolean {
  const filePath = symbolId.split(':')[0];
  // Normalize path for consistent Set membership checks
  const normalizedFilePath = GitOperations.normalizePath(filePath);
  return scope.allPaths.has(normalizedFilePath);
}

function isLikelyUtilityFunction(symbol: SymbolContext): boolean {
  const name = symbol.name.toLowerCase();
  const genericNames = [
    'get',
    'set',
    'is',
    'has',
    'can',
    'should',
    'validate',
    'format',
    'parse',
    'convert',
    'toString',
    'equals',
    'hashCode',
  ];

  if (genericNames.some(generic => name.startsWith(generic)) && symbol.kind === 'method') {
    return true;
  }

  if (symbol.signature && symbol.signature.length < 50) {
    return true;
  }

  return false;
}

function isEntryPointLike(symbol: SymbolContext): boolean {
  const name = symbol.name.toLowerCase();
  const filePath = symbol.symbol_id.split(':')[0].toLowerCase();

  if (
    filePath.includes('controller') ||
    filePath.includes('handler') ||
    filePath.includes('route') ||
    filePath.includes('middleware')
  ) {
    return true;
  }

  if (symbol.kind === 'function' || symbol.kind === 'method') {
    if (
      /^(handle|process|execute|run|on[A-Z])/.test(symbol.name) ||
      ['main', 'start', 'init', 'bootstrap', 'mount', 'render'].includes(name)
    ) {
      return true;
    }
  }

  return false;
}

function hasSomeComplexity(symbol: SymbolContext): boolean {
  if (symbol.signature && symbol.signature.length > 20) {
    return true;
  }

  if (
    symbol.signature &&
    (symbol.signature.includes('{') ||
      symbol.signature.includes('if') ||
      symbol.signature.includes('for') ||
      symbol.signature.includes('while') ||
      symbol.signature.includes('=>'))
  ) {
    return true;
  }

  return false;
}

function findReplacedLeftovers(
  intended: Map<string, IntendedState>,
  working: WorkingSnapshot,
  inboundGraph: Map<string, Set<string>>
): Array<{ old: SymbolContext; new: SymbolContext; confidence: number }> {
  const leftovers: Array<{
    old: SymbolContext;
    new: SymbolContext;
    confidence: number;
  }> = [];

  const absentSymbols = new Map<string, IntendedState>();
  for (const [symbolId, expected] of intended) {
    if (expected.expect === 'absent') {
      absentSymbols.set(symbolId, expected);
    }
  }

  for (const [absentId, expected] of absentSymbols) {
    const absentSymbol = working.symbolsById.get(absentId);
    if (!absentSymbol) continue;

    const inboundCount = inboundGraph.get(absentId)?.size || 0;
    if (inboundCount > 10) continue;

    const callers = inboundGraph.get(absentId) || new Set();
    const hasEntryPointCallers = Array.from(callers).some(
      callerId =>
        working.symbolsById.has(callerId) && isEntryPointLike(working.symbolsById.get(callerId)!)
    );
    if (hasEntryPointCallers && inboundCount > 3) continue;

    const candidates: Array<{ symbol: SymbolContext; similarity: number }> = [];

    for (const [workingId, workingSymbol] of working.symbolsById) {
      if (workingId === absentId) continue;

      const similarity = calculateSimilarity(absentSymbol, workingSymbol, expected);
      if (similarity > 0.6) {
        candidates.push({ symbol: workingSymbol, similarity });
      }
    }

    candidates.sort((a, b) => b.similarity - a.similarity);

    if (candidates.length > 0) {
      const bestMatch = candidates[0];

      const secondBest = candidates[1]?.similarity || 0;
      if (bestMatch.similarity > secondBest + 0.2 || candidates.length === 1) {
        leftovers.push({
          old: absentSymbol,
          new: bestMatch.symbol,
          confidence: bestMatch.similarity,
        });
      }
    }
  }

  return leftovers;
}

function calculateSimilarity(
  oldSymbol: SymbolContext,
  newSymbol: SymbolContext,
  expected: IntendedState
): number {
  let score = 0;
  let total = 0;

  total += 4;
  if (oldSymbol.name === expected.lastName) {
    score += 1.5;
  }
  if (oldSymbol.name === newSymbol.name) {
    score += 2.5;
  } else {
    const similarity = calculateStringSimilarity(oldSymbol.name, newSymbol.name);
    score += similarity * 2;
  }

  total += 1;
  if (oldSymbol.kind === newSymbol.kind) {
    score += 1;
  }

  total += 1;
  const oldPath = oldSymbol.symbol_id.split(':')[0];
  const newPath = newSymbol.symbol_id.split(':')[0];
  if (oldPath === newPath) {
    score += 1;
  } else if (
    oldPath.replace(/\.old|\.bak|\.backup/, '') === newPath.replace(/\.new|\.updated/, '')
  ) {
    score += 0.8;
  } else if (calculatePathSimilarity(oldPath, newPath) > 0.5) {
    score += 0.5;
  }

  total += 2;
  if (oldSymbol.signature && newSymbol.signature) {
    const oldSig = normalizeSignature(oldSymbol.signature);
    const newSig = normalizeSignature(newSymbol.signature);

    if (oldSig === newSig) {
      score += 2;
    } else {
      const oldParams = extractParameters(oldSig);
      const newParams = extractParameters(newSig);

      if (oldParams.length === newParams.length) {
        score += 1;

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

  return Math.min(score / total, 1.0);
}

function calculateStringSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;

  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;

  if (longer.length === 0) return 1.0;

  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix = Array(b.length + 1)
    .fill(null)
    .map(() => Array(a.length + 1).fill(null));

  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }

  return matrix[b.length][a.length];
}

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

function normalizeSignature(signature: string): string {
  return signature
    .replace(/\s+/g, ' ')
    .replace(/public\s+|private\s+|protected\s+/g, '')
    .replace(/async\s+|static\s+/g, '')
    .trim();
}

function extractParameters(signature: string): string[] {
  let paramMatch = signature.match(/\(([^)]*)\)/);

  if (!paramMatch) {
    paramMatch = signature.match(/^([^=]+)=>/);
    if (paramMatch) {
      const arrowParams = paramMatch[1].trim();

      const cleaned =
        arrowParams.startsWith('(') && arrowParams.endsWith(')')
          ? arrowParams.slice(1, -1)
          : arrowParams;
      return cleaned
        .split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0);
    }
    return [];
  }

  return paramMatch[1]
    .split(',')
    .map(param => {
      const trimmed = param.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        return trimmed;
      }

      const typeMatch = trimmed.match(/^([^:=\s]+)/);
      return typeMatch ? typeMatch[1] : trimmed;
    })
    .filter(param => param.length > 0);
}

export interface LegacyDetectorInput {
  intended: Map<string, IntendedState>;
  working: WorkingSnapshot;
  scope: ScopeSet;
}

export class LegacyDetector extends BaseDetector<LegacyDetectorInput, LegacyAuditResult> {
  constructor(config: Partial<DetectorConfig> = {}) {
    super({
      enableCaching: false,
      ...config,
    });
  }

  async detect(input: LegacyDetectorInput): Promise<LegacyAuditResult> {
    return this.getCachedResult(
      this.generateCacheKey(input.intended, input.working, input.scope),
      async () => {
        return await auditLegacy(input.intended, input.working, input.scope);
      }
    );
  }
}
