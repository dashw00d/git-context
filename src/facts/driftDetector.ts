import * as fs from 'fs';
import * as path from 'path';
import {
  analyzeImportPathDrift,
  detectFileNamingConvention,
  extractImportPaths,
  FileNamingConvention,
  ImportPathConvention,
} from '../analysis/conventionEnhancements';
import { BaseDetector, DetectorConfig } from '../analysis/detectors/BaseDetector';
import {
  analyzeConventionDrift,
  detectNamingConvention,
  NamingConvention,
} from '../analysis/namingConventions';
import { EdgeContext, SymbolContext } from '../contracts/llmContext';
import { prepare } from '../storage/statement-wrapper';
import { detectLanguage, getGitRoot } from '../utils/config';
import { logWarn } from '../utils/logger';
import { IntendedState } from './intendedMap';
import { WorkingSnapshot } from './workingSnapshot';
import type { HybridFact } from '../types/cstFacts';

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

export interface DriftFindings {
  missing_symbols: Array<{
    symbol_id: string;
    expected: IntendedState;
    introducedAtVersion?: string;
    resolvedAtVersion?: string;
    versionDescription?: string;
  }>;
  zombie_symbols: Array<{
    symbol_id: string;
    expected: IntendedState;
    found: SymbolContext;
    introducedAtVersion?: string;
    resolvedAtVersion?: string;
    versionDescription?: string;
  }>;
  divergent_symbols: Array<{
    symbol_id: string;
    expected: IntendedState;
    found: SymbolContext;
    introducedAtVersion?: string;
    resolvedAtVersion?: string;
    versionDescription?: string;
  }>;
  missing_edges: Array<{
    from: string;
    to: string;
    type: string;
    expected: IntendedState;
    introducedAtVersion?: string;
    resolvedAtVersion?: string;
    versionDescription?: string;
  }>;
  zombie_edges: Array<{
    from: string;
    to: string;
    type: string;
    found: EdgeContext;
    introducedAtVersion?: string;
    resolvedAtVersion?: string;
    versionDescription?: string;
  }>;
  hotspots: Array<{ path: string; drift_count: number }>;
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
  divergentClusters?: Array<Set<SymbolContext>>;
  suggestedConsolidations?: Array<{ symbols: string[]; similarity: number }>;
  unresolved_callers?: Array<UnresolvedCallerFact>;
  /**
   * Hybrid drifts: CST facts that have changed or are missing
   * For CST-only languages and hybrid augmentation
   */
  hybridDrifts?: Array<{
    fact: HybridFact;
    type: 'missing' | 'zombie' | 'divergent' | 'modified';
    expected?: IntendedState;
    timelineDelta?: Array<{ version: string; delta: any }>;
    introducedAtVersion?: string;
    resolvedAtVersion?: string;
  }>;
}

export interface UnresolvedCallerFact {
  caller_symbol_id?: string;
  caller_name?: string;
  caller_path?: string;
  caller_line?: number;
  callee_name: string;
  guessed_target_dna_id?: string | null;
  occurrence_count: number;
  severity: number;
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

    const outgoingEdges = working.edges.filter(edge => edge.from_symbol_id === currentSymbolId);

    for (const edge of outgoingEdges) {
      const targetSymbolId = edge.to_symbol_id;

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
    const found = working.symbolsById.get(symbolKey);

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

      for (const intendedEdge of intendedEdges) {
        const found = working.edges.find(
          e =>
            e.from_symbol_id === intendedEdge.from_symbol_id &&
            e.to_symbol_id === intendedEdge.to_symbol_id &&
            e.edge_type === intendedEdge.edge_type
        );

        if (!found) {
          const fromIntended = intended.has(intendedEdge.from_symbol_id);
          const toIntended = intended.has(intendedEdge.to_symbol_id);

          if (fromIntended || toIntended) {
            findings.missing_edges.push({
              from: intendedEdge.from_symbol_id,
              to: intendedEdge.to_symbol_id,
              type: intendedEdge.edge_type,
              expected: intended.get(intendedEdge.from_symbol_id) ||
                intended.get(intendedEdge.to_symbol_id) || {
                  expect: 'present',
                  lastSha: commitShas[commitShas.length - 1],
                },
            });
          }
        }
      }

      for (const workingEdge of working.edges) {
        const fromIntended = intended.has(workingEdge.from_symbol_id);
        const toIntended = intended.has(workingEdge.to_symbol_id);

        if (!fromIntended && !toIntended) {
          continue;
        }

        const fromState = intended.get(workingEdge.from_symbol_id);
        const toState = intended.get(workingEdge.to_symbol_id);

        const edgeInIntended = intendedEdges.some(
          intendedEdge =>
            intendedEdge.from_symbol_id === workingEdge.from_symbol_id &&
            intendedEdge.to_symbol_id === workingEdge.to_symbol_id &&
            intendedEdge.edge_type === workingEdge.edge_type
        );

        if (
          !edgeInIntended ||
          (fromState && fromState.expect === 'absent') ||
          (toState && toState.expect === 'absent')
        ) {
          findings.zombie_edges.push({
            from: workingEdge.from_symbol_id,
            to: workingEdge.to_symbol_id,
            type: workingEdge.edge_type,
            found: workingEdge,
          });
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

    if (edge.to_symbol_id && working.symbolsById.has(edge.to_symbol_id)) continue;

    const caller = edge.from_symbol_id ? working.symbolsById.get(edge.from_symbol_id) : undefined;
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

  const results: UnresolvedCallerFact[] = [];
  for (const fact of facts.values()) {
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

  const tokens = raw.split(/[:.\s]/).filter(Boolean);
  const last = tokens[tokens.length - 1] || raw;
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
