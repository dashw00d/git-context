import * as fs from 'fs';
import * as path from 'path';
import {
  analyzeImportPathDrift,
  detectFileNamingConvention,
  extractImportPaths,
} from '../analysis/conventionEnhancements';
import { BaseDetector, DetectorConfig } from '../analysis/detectors/BaseDetector';
import { analyzeConventionDrift, detectNamingConvention } from '../analysis/namingConventions';
import { SymbolContext } from '../contracts/llmContext';
import { prepare } from '../storage/statement-wrapper';
import { FileNamingConvention, ImportPathConvention } from '../types/convention';
import { DriftFindings, IntendedState, UnresolvedCallerFact } from '../types/drift';
import { NamingConvention } from '../types/naming';
import { detectLanguage, getGitRoot } from '../utils/config';
import { logWarn } from '../utils/logger';
import { WorkingSnapshot, extractDnaHash } from './workingSnapshot';

export { DriftFindings, UnresolvedCallerFact };

/**
 * Safely extract line number from symbol location
 */
function extractLineFromSymbol(symbol: SymbolContext): number | undefined {
  const loc = symbol.loc_post || symbol.loc_pre;
  return loc?.start?.line;
}

/**
 * Safely extract file path from symbol
 * Uses filePath field if available, otherwise falls back to finding it in symbolsByFile
 */
function extractPathFromSymbol(symbol: SymbolContext, working?: WorkingSnapshot): string {
  if (symbol.filePath) {
    return symbol.filePath;
  }
  // Fallback: find file path from working snapshot
  if (working) {
    for (const [filePath, symbols] of working.symbolsByFile) {
      if (symbols.some(s => s.symbol_id === symbol.symbol_id)) {
        return filePath;
      }
    }
  }
  return 'unknown';
}

/**
 * Detect divergent symbol clusters using AST shape similarity and reachability analysis
 */
function detectDivergentClusters(
  working: WorkingSnapshot,
  intended: Map<string, IntendedState>
): {
  divergentClusters: Array<Set<SymbolContext>>;
  suggestedConsolidations: Array<{ symbols: string[]; similarity: number }>;
} {
  const divergentClusters: Array<Set<SymbolContext>> = [];
  const suggestedConsolidations: Array<{
    symbols: string[];
    similarity: number;
  }> = [];

  const workingIntendedSymbols = Array.from(working.symbolsById.entries())
    .filter(([symbolId]) => {
      const intendedState = intended.get(symbolId);
      return intendedState && intendedState.expect === 'present';
    })
    .map(([, symbol]) => symbol);

  if (workingIntendedSymbols.length < 2) {
    return { divergentClusters, suggestedConsolidations };
  }

  const clusters = clusterByShape(workingIntendedSymbols);

  for (const cluster of clusters) {
    if (cluster.size >= 2) {
      const symbols = Array.from(cluster);
      const names = symbols.map(s => s.name);

      const uniqueNames = new Set(names);
      const hasDifferentNames = uniqueNames.size > 1;

      const hasDifferentSignatures =
        uniqueNames.size === 1 && new Set(symbols.map(s => s.signature)).size > 1;

      if (hasDifferentNames || hasDifferentSignatures) {
        let totalSimilarity = 0;
        let pairCount = 0;

        for (let i = 0; i < symbols.length; i++) {
          for (let j = i + 1; j < symbols.length; j++) {
            const similarity = calculateSymbolSimilarity(symbols[i], symbols[j]);
            totalSimilarity += similarity;
            pairCount++;
          }
        }

        const avgSimilarity = pairCount > 0 ? totalSimilarity / pairCount : 0;

        if (avgSimilarity > 0.7) {
          divergentClusters.push(new Set(symbols));

          if (avgSimilarity > 0.9) {
            suggestedConsolidations.push({
              symbols: symbols.map(s => s.symbol_id),
              similarity: avgSimilarity,
            });
          }
        }
      }
    }
  }

  const reachableSymbols = findReachableSymbols(working, intended);
  for (const [symbolId, intendedState] of intended) {
    if (intendedState.expect === 'present' && !reachableSymbols.has(symbolId)) {
      const symbol = working.symbolsById.get(symbolId);
      if (symbol) {
        const unreachableCluster = new Set([symbol]);
        divergentClusters.push(unreachableCluster);
      }
    }
  }

  return { divergentClusters, suggestedConsolidations };
}

/**
 * Cluster symbols by AST shape similarity using symbol DNA hash
 */
function clusterByShape(symbols: SymbolContext[]): Set<SymbolContext>[] {
  const clusters: Set<SymbolContext>[] = [];

  const dnaClusters = new Map<string, Set<SymbolContext>>();
  const symbolsWithoutDna: SymbolContext[] = [];

  for (const symbol of symbols) {
    const dnaHash = symbol.dnaId || symbol.symbol_id; // symbol_id is now DNA hash

    if (dnaHash) {
      if (!dnaClusters.has(dnaHash)) {
        dnaClusters.set(dnaHash, new Set());
      }
      dnaClusters.get(dnaHash)!.add(symbol);
    } else {
      symbolsWithoutDna.push(symbol);
    }
  }

  for (const cluster of dnaClusters.values()) {
    if (cluster.size > 0) {
      clusters.push(cluster);
    }
  }

  if (symbolsWithoutDna.length > 0) {
    const signatureClusters = clusterBySignature(symbolsWithoutDna);
    clusters.push(...signatureClusters);
  }

  return clusters;
}

/**
 * Fallback clustering by signature similarity when DNA hash is not available
 */
function clusterBySignature(symbols: SymbolContext[]): Set<SymbolContext>[] {
  const clusters: Set<SymbolContext>[] = [];

  for (const symbol of symbols) {
    let foundCluster = false;

    for (const cluster of clusters) {
      const clusterSymbol = Array.from(cluster)[0];
      if (
        calculateSignatureSimilarity(symbol.signature || '', clusterSymbol.signature || '') > 0.8
      ) {
        cluster.add(symbol);
        foundCluster = true;
        break;
      }
    }

    if (!foundCluster) {
      clusters.push(new Set([symbol]));
    }
  }

  return clusters;
}

/**
 * Calculate similarity between two symbols (0-1 scale)
 */
function calculateSymbolSimilarity(a: SymbolContext, b: SymbolContext): number {
  const aDna = a.dnaId || a.symbol_id; // symbol_id is now DNA hash
  const bDna = b.dnaId || b.symbol_id; // symbol_id is now DNA hash

  if (aDna && bDna) {
    return aDna === bDna ? 1.0 : 0.0;
  }

  return calculateSignatureSimilarity(a.signature || '', b.signature || '');
}

/**
 * Calculate signature similarity using Jaccard index on tokens
 */
function calculateSignatureSimilarity(sigA: string, sigB: string): number {
  if (!sigA || !sigB) return 0;

  const tokensA = new Set(sigA.split(/\W+/).filter(t => t.length > 0));
  const tokensB = new Set(sigB.split(/\W+/).filter(t => t.length > 0));

  const intersection = new Set([...tokensA].filter(x => tokensB.has(x)));
  const union = new Set([...tokensA, ...tokensB]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Find symbols reachable from entry points (exported symbols, public APIs)
 */
function findReachableSymbols(
  working: WorkingSnapshot,
  intended: Map<string, IntendedState>
): Set<string> {
  const reachable = new Set<string>();
  const queue: string[] = [];

  for (const [symbolId, symbol] of working.symbolsById) {
    const intendedState = intended.get(symbolId);

    if (
      (intendedState && intendedState.expect === 'present') ||
      symbol.name.startsWith('main') ||
      symbol.name.startsWith('index')
    ) {
      reachable.add(symbolId);
      queue.push(symbolId);
    }
  }

  while (queue.length > 0) {
    const currentSymbolId = queue.shift()!;

    // Extract DNA hash from currentSymbolId (may be filePath:symbolId or just symbolId)
    const currentDnaHash = extractDnaHash(currentSymbolId);

    const outgoingEdges = working.edges.filter(edge => {
      // Extract DNA hash from edge.from_symbol_id for comparison
      const edgeFromDna = extractDnaHash(edge.from_symbol_id);
      return edgeFromDna === currentDnaHash;
    });

    for (const edge of outgoingEdges) {
      // Extract DNA hash from edge.to_symbol_id
      const targetSymbolId = extractDnaHash(edge.to_symbol_id);

      if (!reachable.has(targetSymbolId)) {
        reachable.add(targetSymbolId);
        queue.push(targetSymbolId);
      }
    }
  }

  return reachable;
}

/**
 * Pure comparison logic between intended and working states (no LLM)
 */
export function detectDrift(
  intended: Map<string, IntendedState>,
  working: WorkingSnapshot,
  commitShas?: string[]
): DriftFindings {
  const findings: DriftFindings = {
    missing_symbols: [],
    zombie_symbols: [],
    divergent_symbols: [],
    missing_edges: [],
    zombie_edges: [],
    hotspots: [],
  };

  for (const [symbolKey, expected] of intended) {
    let found = working.symbolsById.get(symbolKey);

    // Fallback: if DNA hash lookup fails, try matching by name and path
    if (!found && expected.lastName && expected.lastPath) {
      for (const [_, symbol] of working.symbolsById) {
        if (symbol.name === expected.lastName && symbol.filePath === expected.lastPath) {
          found = symbol;
          break;
        }
      }
    }

    if (expected.expect === 'present') {
      if (!found) {
        findings.missing_symbols.push({ symbol_id: symbolKey, expected });
      } else {
        if (expected.lastName && found.name !== expected.lastName) {
          findings.divergent_symbols.push({
            symbol_id: symbolKey,
            expected,
            found,
          });
        }
      }
    } else if (expected.expect === 'absent') {
      if (found) {
        findings.zombie_symbols.push({ symbol_id: symbolKey, expected, found });
      }
    }
  }

  // Check for symbols present in working but entirely missing from intended (also zombies)
  for (const [symbolId, found] of working.symbolsById) {
    // Check if this symbol is already tracked in intended map (by ID or name+path)
    const isTracked =
      intended.has(symbolId) ||
      Array.from(intended.values()).some(
        exp => exp.lastName === found.name && exp.lastPath === found.filePath
      );

    if (!isTracked) {
      findings.zombie_symbols.push({
        symbol_id: symbolId,
        expected: { expect: 'absent', lastSha: 'HEAD' },
        found,
      });
    }
  }

  if (commitShas && commitShas.length > 0) {
    try {
      const placeholders = commitShas.map(() => '?').join(',');

      const intendedEdgesStmt = prepare(`
        SELECT DISTINCT from_symbol_id, to_symbol_id, COALESCE(edge_type, 'unknown') AS edge_type
        FROM edges
        WHERE sha IN (${placeholders})
          AND change_type IN ('added', 'modified')
      `);

      const intendedEdges = intendedEdgesStmt.all(...commitShas) as Array<{
        from_symbol_id: string;
        to_symbol_id: string;
        edge_type: string;
      }>;

      // Build maps for readable symbol identification
      const idToSymbol = new Map<string, SymbolContext>();
      for (const [id, symbol] of working.symbolsById) {
        idToSymbol.set(id, symbol);
      }

      const getReadableId = (id: string) => {
        const dna = extractDnaHash(id);
        const symbol = idToSymbol.get(dna);
        if (symbol) {
          const path = extractPathFromSymbol(symbol, working);
          return `${path}:${symbol.name}`;
        }
        return id;
      };

      const missingEdgesSet = new Set<string>();
      for (const intendedEdge of intendedEdges) {
        // Extract DNA hashes from intended edge IDs (database may not have file path prefix)
        const intendedFromDna = extractDnaHash(intendedEdge.from_symbol_id);
        const intendedToDna = extractDnaHash(intendedEdge.to_symbol_id);

        const found = working.edges.find(e => {
          // Extract DNA hashes from working edge IDs for comparison
          const workingFromDna = extractDnaHash(e.from_symbol_id);
          const workingToDna = extractDnaHash(e.to_symbol_id);

          return (
            workingFromDna === intendedFromDna &&
            workingToDna === intendedToDna &&
            e.edge_type === intendedEdge.edge_type
          );
        });

        if (!found) {
          // intended map uses DNA hash as key, not full edge ID
          const fromIntended = intended.has(intendedFromDna);
          const toIntended = intended.has(intendedToDna);

          if (fromIntended || toIntended) {
            const fromReadable = getReadableId(intendedEdge.from_symbol_id);
            const toReadable = getReadableId(intendedEdge.to_symbol_id);
            const edgeKey = `${fromReadable}->${toReadable}:${intendedEdge.edge_type}`;

            if (!missingEdgesSet.has(edgeKey)) {
              missingEdgesSet.add(edgeKey);
              findings.missing_edges.push({
                from: fromReadable,
                to: toReadable,
                type: intendedEdge.edge_type,
                expected: intended.get(intendedFromDna) ||
                  intended.get(intendedToDna) || {
                    expect: 'present',
                    lastSha: commitShas[commitShas.length - 1],
                  },
              });
            }
          }
        }
      }

      const zombieEdgesSet = new Set<string>();
      for (const workingEdge of working.edges) {
        // Extract DNA hashes from working edge IDs (intended map uses DNA hash as key)
        const workingFromDna = extractDnaHash(workingEdge.from_symbol_id);
        const workingToDna = extractDnaHash(workingEdge.to_symbol_id);

        const fromIntended = intended.has(workingFromDna);
        const toIntended = intended.has(workingToDna);

        if (!fromIntended && !toIntended) {
          continue;
        }

        const fromState = intended.get(workingFromDna);
        const toState = intended.get(workingToDna);

        const edgeInIntended = intendedEdges.some(intendedEdge => {
          // Extract DNA hashes for comparison
          const intendedFromDna = extractDnaHash(intendedEdge.from_symbol_id);
          const intendedToDna = extractDnaHash(intendedEdge.to_symbol_id);

          return (
            intendedFromDna === workingFromDna &&
            intendedToDna === workingToDna &&
            intendedEdge.edge_type === workingEdge.edge_type
          );
        });

        if (
          !edgeInIntended ||
          (fromState && fromState.expect === 'absent') ||
          (toState && toState.expect === 'absent')
        ) {
          const fromReadable = getReadableId(workingEdge.from_symbol_id);
          const toReadable = getReadableId(workingEdge.to_symbol_id);
          const edgeKey = `${fromReadable}->${toReadable}:${workingEdge.edge_type}`;

          if (!zombieEdgesSet.has(edgeKey)) {
            zombieEdgesSet.add(edgeKey);
            findings.zombie_edges.push({
              from: fromReadable,
              to: toReadable,
              type: workingEdge.edge_type,
              found: workingEdge,
            });
          }
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logWarn(`Failed to detect edge drift for commits [${commitShas?.join(', ')}]: ${errorMsg}`);
      logWarn('Continuing without edge drift detection. This may miss some zombie/missing edges.');
    }
  }

  const fileDrift = new Map<string, number>();
  for (const finding of [
    ...findings.missing_symbols,
    ...findings.zombie_symbols,
    ...findings.divergent_symbols,
  ]) {
    // symbol_id is now DNA hash, need to find file path from working snapshot
    const symbol = working.symbolsById.get(finding.symbol_id);
    const path = symbol ? extractPathFromSymbol(symbol, working) : 'unknown';
    fileDrift.set(path, (fileDrift.get(path) || 0) + 1);
  }

  findings.hotspots = Array.from(fileDrift.entries())
    .map(([path, count]) => ({ path, drift_count: count }))
    .sort((a, b) => b.drift_count - a.drift_count)
    .slice(0, 10);

  const conventionDrift = detectConventionDrift(working);
  if (conventionDrift) {
    findings.conventionDrift = conventionDrift.conventionDrift;
    findings.mixedConventionFiles = conventionDrift.mixedConventionFiles;
  }

  findings.unresolved_callers = detectUnresolvedCallers(working, intended);

  const enhancedDivergent = detectDivergentClusters(working, intended);
  if (enhancedDivergent.divergentClusters.length > 0) {
    findings.divergentClusters = enhancedDivergent.divergentClusters;
  }
  if (enhancedDivergent.suggestedConsolidations.length > 0) {
    findings.suggestedConsolidations = enhancedDivergent.suggestedConsolidations;
  }

  return findings;
}

function detectUnresolvedCallers(
  working: WorkingSnapshot,
  intended?: Map<string, IntendedState>
): UnresolvedCallerFact[] {
  let nameIndex: Map<string, string[]> | undefined;
  if (intended && Array.from(intended.values()).some(state => state.lastName)) {
    nameIndex = new Map<string, string[]>();
    for (const [symbolId, symbol] of working.symbolsById) {
      const key = symbol.name.toLowerCase();
      if (!nameIndex.has(key)) {
        nameIndex.set(key, []);
      }
      nameIndex.get(key)!.push(symbolId);
    }
  }

  const facts = new Map<string, UnresolvedCallerFact & { count: number }>();

  for (const edge of working.edges) {
    if (edge.edge_type !== 'calls') continue;

    // Extract DNA hash from edge.to_symbol_id for lookup
    const toDnaHash = extractDnaHash(edge.to_symbol_id);

    if (toDnaHash && working.symbolsById.has(toDnaHash)) continue;

    // Extract DNA hash from edge.from_symbol_id for lookup
    const fromDnaHash = extractDnaHash(edge.from_symbol_id);

    const caller = fromDnaHash ? working.symbolsById.get(fromDnaHash) : undefined;
    const calleeRaw = edge.to_symbol_id || '';
    const calleeName = extractCalleeName(calleeRaw);

    const guessed = guessTarget(calleeName, nameIndex, intended);

    const key = `${edge.from_symbol_id || 'unknown'}::${calleeName || calleeRaw}`;
    const current = facts.get(key) || {
      caller_symbol_id: edge.from_symbol_id,
      caller_name: caller?.name,
      caller_path: caller ? extractPathFromSymbol(caller, working) : undefined,
      callee_name: calleeName || calleeRaw,
      guessed_target_dna_id: guessed,
      caller_line: caller ? extractLineFromSymbol(caller) : undefined,
      occurrence_count: 0,
      severity: 0,
      count: 0,
    };

    current.count += 1;
    facts.set(key, current);
  }

  // Known built-in methods to filter out (organized by category)
  // TODO: Consider adding UI ignore feature for user-defined exclusions
  const builtInMethods = new Set([
    // Console/Logger
    'log',
    'warn',
    'error',
    'info',
    'debug',
    'trace',
    'logdebug',
    'loginfo',
    'logwarn',
    'logerror',
    'logtrace',

    // Array
    'join',
    'filter',
    'map',
    'reduce',
    'reduceright',
    'foreach',
    'slice',
    'push',
    'pop',
    'shift',
    'unshift',
    'splice',
    'sort',
    'reverse',
    'find',
    'findindex',
    'findlast',
    'findlastindex',
    'some',
    'every',
    'includes',
    'indexof',
    'lastindexof',
    'flat',
    'flatmap',
    'fill',
    'copywithin',
    'at',
    'from',
    'of',
    'isarray',

    // String
    'split',
    'substring',
    'substr',
    'replace',
    'replaceall',
    'match',
    'matchall',
    'search',
    'tolowercase',
    'touppercase',
    'trim',
    'trimstart',
    'trimend',
    'padstart',
    'padend',
    'repeat',
    'startswith',
    'endswith',
    'charat',
    'charcodeat',
    'codepointat',
    'normalize',
    'localecompare',

    // Object methods
    'concat',
    'keys',
    'values',
    'entries',
    'assign',
    'create',
    'freeze',
    'seal',
    'isfrozen',
    'issealed',
    'isextensible',
    'preventextensions',
    'getownpropertynames',
    'getownpropertysymbols',
    'getownpropertydescriptor',
    'getownpropertydescriptors',
    'getprototypeof',
    'setprototypeof',
    'defineproperty',
    'defineproperties',
    'fromentries',
    'hasown',
    'is',

    // Map/Set/WeakMap/WeakSet methods
    'get',
    'has',
    'set',
    'delete',
    'clear',
    'add',
    'size',

    // Date methods
    'now',
    'parse',
    'utc',
    'gettime',
    'getfullyear',
    'getmonth',
    'getdate',
    'getday',
    'gethours',
    'getminutes',
    'getseconds',
    'getmilliseconds',
    'gettimezoneoffset',
    'settime',
    'setfullyear',
    'setmonth',
    'setdate',
    'sethours',
    'setminutes',
    'setseconds',
    'setmilliseconds',
    'toisostring',
    'tojson',
    'todatestring',
    'totimestring',
    'tolocalestring',
    'tolocaledatestring',
    'tolocaletimestring',

    // Math methods
    'min',
    'max',
    'abs',
    'floor',
    'ceil',
    'round',
    'random',
    'sqrt',
    'pow',
    'exp',
    'log',
    'log10',
    'log2',
    'sin',
    'cos',
    'tan',
    'asin',
    'acos',
    'atan',
    'atan2',
    'sign',
    'trunc',
    'cbrt',
    'hypot',

    // Promise methods
    'then',
    'catch',
    'finally',
    'resolve',
    'reject',
    'all',
    'allsettled',
    'any',
    'race',

    // JSON methods
    'stringify',

    // Node.js fs methods
    'existssync',
    'readfile',
    'readfilesync',
    'writefile',
    'writefilesync',
    'stat',
    'statsync',
    'mkdir',
    'mkdirsync',
    'readdir',
    'readdirsync',
    'unlink',
    'unlinksync',
    'rmdir',
    'rmdirsync',
    'rename',
    'renamesync',
    'copyfile',
    'copyfilesync',
    'access',
    'accesssync',

    // Class-related
    'constructor',
    'tostring',
    'valueof',
    'hasownproperty',
    'isprototypeof',
    'propertyisenumerable',

    // RegExp methods
    'test',
    'exec',

    // TypedArray / ArrayBuffer methods
    'buffer',
    'bytelength',
    'byteoffset',
    'subarray',

    // Reflect methods
    'apply',
    'construct',
    'ownkeys',

    // Symbol methods
    'for',
    'keyfor',

    // Iterator methods
    'next',
    'return',
    'throw',

    // WeakRef / FinalizationRegistry
    'deref',
    'register',
    'unregister',

    // Common utility patterns
    'call',
    'bind',
    'length',
    'name',
    'prototype',
  ]);

  const results: UnresolvedCallerFact[] = [];
  for (const fact of facts.values()) {
    // Filter out known built-in methods
    const calleeNameLower = fact.callee_name.toLowerCase();
    if (builtInMethods.has(calleeNameLower)) {
      continue;
    }

    const OCCURRENCE_SCALE_FACTOR = 5;
    const baseSeverity = Math.min(1, Math.log1p(fact.count) / Math.log1p(OCCURRENCE_SCALE_FACTOR));

    const UNKNOWN_TARGET_BUMP = 0.1;
    const unknownBump = fact.guessed_target_dna_id ? 0 : UNKNOWN_TARGET_BUMP;

    fact.severity = Math.min(1, baseSeverity + unknownBump);
    fact.occurrence_count = fact.count;
    delete (fact as any).count;
    results.push(fact);
  }

  return results.sort((a, b) => b.severity - a.severity);
}

function extractCalleeName(raw: string): string {
  if (!raw) return '';

  // Strip function_ and method_ prefixes
  let cleaned = raw.replace(/^(function_|method_)/, '');

  // Remove trailing spaces and split by common delimiters
  cleaned = cleaned.trim();
  const tokens = cleaned.split(/[:.\s]/).filter(Boolean);
  const last = tokens[tokens.length - 1] || cleaned;

  // Return clean name without special characters
  return last.replace(/[^A-Za-z0-9_]/g, '');
}

function guessTarget(
  calleeName: string,
  nameIndex?: Map<string, string[]>,
  intended?: Map<string, IntendedState>
): string | null | undefined {
  if (!calleeName) return null;

  if (intended) {
    const intendedMatch = Array.from(intended.entries()).find(
      ([, st]) => st.lastName && st.lastName.toLowerCase() === calleeName.toLowerCase()
    );
    if (intendedMatch) {
      return intendedMatch[0];
    }
  }

  if (nameIndex) {
    const matches = nameIndex.get(calleeName.toLowerCase()) || [];
    if (matches.length === 1) {
      return matches[0];
    }
  }

  return null;
}

function detectConventionDrift(working: WorkingSnapshot): {
  conventionDrift?: {
    dominantConvention: NamingConvention;
    driftPercent: number;
    driftSymbols: Array<{
      symbolId: string;
      name: string;
      convention: NamingConvention;
      suggestedName: string;
      path: string;
    }>;
    importDrift?: {
      dominantStyle: string;
      driftPercent: number;
      driftImports: Array<{
        file: string;
        line: number;
        importPath: string;
        style: string;
      }>;
    };
    fileNamingDrift?: {
      dominantStyle: FileNamingConvention['style'];
      driftPercent: number;
      driftFiles: Array<{
        path: string;
        style: FileNamingConvention['style'];
        filename: string;
      }>;
    };
  };
  mixedConventionFiles?: Array<{
    path: string;
    conventions: NamingConvention[];
    symbolCount: number;
    driftPercent: number;
  }>;
} | null {
  try {
    const symbols = Array.from(working.symbolsById.values()).map(s => ({
      name: s.name,
      kind: s.kind,
      path: extractPathFromSymbol(s, working),
    }));

    if (symbols.length === 0) {
      return null;
    }

    const driftResult = analyzeConventionDrift(symbols);

    const driftSymbols = driftResult.driftSymbols
      .map(ds => {
        const symbolId =
          Array.from(working.symbolsById.entries()).find(
            ([, s]) => s.name === ds.name && extractPathFromSymbol(s, working) === ds.path
          )?.[0] || '';

        return {
          symbolId,
          name: ds.name,
          convention: ds.convention,
          suggestedName: ds.suggestedName,
          path: ds.path,
        };
      })
      .filter(ds => ds.symbolId !== '');

    const symbolsByFile = new Map<string, Array<{ name: string; kind: string; path: string }>>();
    for (const symbol of symbols) {
      if (!symbolsByFile.has(symbol.path)) {
        symbolsByFile.set(symbol.path, []);
      }
      symbolsByFile.get(symbol.path)!.push(symbol);
    }

    const mixedConventionFiles: Array<{
      path: string;
      conventions: NamingConvention[];
      symbolCount: number;
      driftPercent: number;
    }> = [];

    for (const [filePath, fileSymbols] of symbolsByFile.entries()) {
      if (fileSymbols.length < 2) continue;

      const fileDrift = analyzeConventionDrift(fileSymbols);
      const uniqueConventions = new Set(
        fileSymbols.map(s => detectNamingConvention(s.name).convention)
      );

      if (uniqueConventions.size > 1 && fileDrift.driftPercent > 0) {
        mixedConventionFiles.push({
          path: filePath,
          conventions: Array.from(uniqueConventions) as NamingConvention[],
          symbolCount: fileSymbols.length,
          driftPercent: fileDrift.driftPercent,
        });
      }
    }

    const importDrift = detectImportPathConventionDrift(working);

    const fileNamingDrift = detectFileNamingConventionDrift(working);

    return {
      conventionDrift: {
        dominantConvention: driftResult.dominantConvention,
        driftPercent: driftResult.driftPercent,
        driftSymbols,
        importDrift,
        fileNamingDrift,
      },
      mixedConventionFiles: mixedConventionFiles.length > 0 ? mixedConventionFiles : undefined,
    };
  } catch (error) {
    logWarn(`Failed to detect convention drift: ${error}`);
    return null;
  }
}

function detectImportPathConventionDrift(working: WorkingSnapshot):
  | {
      dominantStyle: string;
      driftPercent: number;
      driftImports: Array<{
        file: string;
        line: number;
        importPath: string;
        style: string;
      }>;
    }
  | undefined {
  const gitRoot = getGitRoot();
  if (!gitRoot) return undefined;

  const imports: Array<ImportPathConvention & { file: string }> = [];

  for (const filePath of working.analyzedPaths) {
    const language = detectLanguage(filePath);
    if (!language) continue;

    const absolutePath = path.join(gitRoot, filePath);
    if (!fs.existsSync(absolutePath)) continue;

    try {
      const content = fs.readFileSync(absolutePath, 'utf8');
      const fileImports = extractImportPaths(content, language).map(imp => ({
        ...imp,
        file: filePath,
      }));
      imports.push(...fileImports);
    } catch (error) {
      logWarn(`[ConventionDrift] Failed to analyze imports for ${filePath}: ${error}`);
    }
  }

  if (imports.length === 0) {
    return undefined;
  }

  const drift = analyzeImportPathDrift(imports);
  const driftImports = drift.driftImports
    .map(imp => ({
      file: (imp as any).file || '',
      line: imp.line,
      importPath: imp.path,
      style: imp.style,
    }))
    .filter(imp => imp.file);

  return {
    dominantStyle: drift.dominantStyle,
    driftPercent: drift.driftPercent,
    driftImports,
  };
}

function detectFileNamingConventionDrift(working: WorkingSnapshot):
  | {
      dominantStyle: FileNamingConvention['style'];
      driftPercent: number;
      driftFiles: Array<{
        path: string;
        style: FileNamingConvention['style'];
        filename: string;
      }>;
    }
  | undefined {
  if (working.analyzedPaths.size === 0) return undefined;

  const fileConventions: Array<FileNamingConvention & { path: string }> = [];
  for (const filePath of working.analyzedPaths) {
    const convention = detectFileNamingConvention(filePath);
    fileConventions.push({ ...convention, path: filePath });
  }

  if (fileConventions.length === 0) {
    return undefined;
  }

  const counts = new Map<FileNamingConvention['style'], number>();
  for (const fc of fileConventions) {
    counts.set(fc.style, (counts.get(fc.style) || 0) + 1);
  }

  const dominant = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'mixed';
  const driftFiles = fileConventions
    .filter(fc => fc.style !== dominant)
    .map(fc => ({
      path: fc.path,
      style: fc.style,
      filename: fc.filename,
    }));

  const driftPercent =
    fileConventions.length > 0 ? (driftFiles.length / fileConventions.length) * 100 : 0;

  return {
    dominantStyle: dominant,
    driftPercent,
    driftFiles,
  };
}

export interface DriftDetectorInput {
  intended: Map<string, IntendedState>;
  working: WorkingSnapshot;
  commitShas?: string[];
}

export class DriftDetector extends BaseDetector<DriftDetectorInput, DriftFindings> {
  constructor(config: Partial<DetectorConfig> = {}) {
    super({
      enableCaching: false,
      ...config,
    });
  }

  async detect(input: DriftDetectorInput): Promise<DriftFindings> {
    return detectDrift(input.intended, input.working, input.commitShas);
  }
}
