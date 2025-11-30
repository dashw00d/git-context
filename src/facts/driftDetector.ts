import * as fs from 'fs';
import * as path from 'path';
import { SymbolContext, EdgeContext } from '../contracts/llmContext';
import { IntendedState } from './intendedMap';
import { WorkingSnapshot } from './workingSnapshot';
import { getDatabaseManager } from '../storage/database';
import { NamingConvention, analyzeConventionDrift, detectNamingConvention } from '../analysis/namingConventions';
import type { HybridFact } from '../types/cstFacts';
import { BaseDetector, DetectorConfig } from '../analysis/detectors/BaseDetector';
import {
  analyzeImportPathDrift,
  extractImportPaths,
  detectFileNamingConvention,
  FileNamingConvention,
  ImportPathConvention
} from '../analysis/conventionEnhancements';
import { detectLanguage, getGitRoot } from '../utils/config';

/**
 * Safely extract line number from symbol location
 */
function extractLineFromSymbol(symbol: SymbolContext): number | undefined {
  // Try post location first (more recent), then pre location
  const loc = symbol.loc_post || symbol.loc_pre;
  return loc?.start?.line;
}

/**
 * Safely extract file path from symbol ID
 * Symbol IDs are expected to be in format "path/to/file:kind:name" or similar
 */
function extractPathFromSymbolId(symbolId: string): string {
  if (!symbolId || typeof symbolId !== 'string') {
    return 'unknown';
  }

  const colonIndex = symbolId.indexOf(':');
  if (colonIndex === -1) {
    console.warn(`Invalid symbol ID format (no colon found): ${symbolId}`);
    return 'unknown';
  }

  const path = symbolId.substring(0, colonIndex);
  if (!path) {
    console.warn(`Invalid symbol ID format (empty path): ${symbolId}`);
    return 'unknown';
  }

  return path;
}

export interface DriftFindings {
  missing_symbols: Array<{symbol_id: string, expected: IntendedState, introducedAtVersion?: string, resolvedAtVersion?: string, versionDescription?: string}>;
  zombie_symbols: Array<{symbol_id: string, expected: IntendedState, found: SymbolContext, introducedAtVersion?: string, resolvedAtVersion?: string, versionDescription?: string}>;
  divergent_symbols: Array<{symbol_id: string, expected: IntendedState, found: SymbolContext, introducedAtVersion?: string, resolvedAtVersion?: string, versionDescription?: string}>;
  missing_edges: Array<{from: string, to: string, type: string, expected: IntendedState, introducedAtVersion?: string, resolvedAtVersion?: string, versionDescription?: string}>;
  zombie_edges: Array<{from: string, to: string, type: string, found: EdgeContext, introducedAtVersion?: string, resolvedAtVersion?: string, versionDescription?: string}>;
  hotspots: Array<{path: string, drift_count: number}>;
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
  suggestedConsolidations?: Array<{symbols: string[], similarity: number}>;
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
  severity: number; // 0-1
}

/**
 * Detect divergent symbol clusters using AST shape similarity and reachability analysis
 */
function detectDivergentClusters(
  working: WorkingSnapshot,
  intended: Map<string, IntendedState>
): {
  divergentClusters: Array<Set<SymbolContext>>;
  suggestedConsolidations: Array<{symbols: string[], similarity: number}>;
} {
  const divergentClusters: Array<Set<SymbolContext>> = [];
  const suggestedConsolidations: Array<{symbols: string[], similarity: number}> = [];

  // Get symbols that exist in working tree and are intended present
  const workingIntendedSymbols = Array.from(working.symbolsById.entries())
    .filter(([symbolId]) => {
      const intendedState = intended.get(symbolId);
      return intendedState && intendedState.expect === 'present';
    })
    .map(([, symbol]) => symbol);

  if (workingIntendedSymbols.length < 2) {
    return { divergentClusters, suggestedConsolidations };
  }

  // Cluster by AST shape similarity
  const clusters = clusterByShape(workingIntendedSymbols);

  // Find divergent clusters (clusters with high internal similarity but behavioral differences)
  for (const cluster of clusters) {
    if (cluster.size >= 2) {
      const symbols = Array.from(cluster);
      const names = symbols.map(s => s.name);

      // Check if symbols have different names OR same names but different signatures
      const uniqueNames = new Set(names);
      const hasDifferentNames = uniqueNames.size > 1;

      // For same-named symbols, check if they have different signatures
      const hasDifferentSignatures = uniqueNames.size === 1 &&
        new Set(symbols.map(s => s.signature)).size > 1;

      if (hasDifferentNames || hasDifferentSignatures) {
        // Calculate average similarity within cluster
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

        // Only consider clusters with high similarity (>0.7) as potentially divergent
        if (avgSimilarity > 0.7) {
          divergentClusters.push(new Set(symbols));

          // Suggest consolidation if similarity is very high (>0.9)
          if (avgSimilarity > 0.9) {
            suggestedConsolidations.push({
              symbols: symbols.map(s => s.symbol_id),
              similarity: avgSimilarity
            });
          }
        }
      }
    }
  }

  // Reachability analysis for intended symbols
  const reachableSymbols = findReachableSymbols(working, intended);
  for (const [symbolId, intendedState] of intended) {
    if (intendedState.expect === 'present' && !reachableSymbols.has(symbolId)) {
      // Symbol is intended present but not reachable from entry points
      const symbol = working.symbolsById.get(symbolId);
      if (symbol) {
        // Add to divergent clusters as potentially unreachable/dead code
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

  // Group symbols by their DNA hash (if available)
  const dnaClusters = new Map<string, Set<SymbolContext>>();
  const symbolsWithoutDna: SymbolContext[] = [];

  for (const symbol of symbols) {
    const dnaHash = symbol.dnaId;

    if (dnaHash) {
      // Has DNA hash - cluster by DNA
      if (!dnaClusters.has(dnaHash)) {
        dnaClusters.set(dnaHash, new Set());
      }
      dnaClusters.get(dnaHash)!.add(symbol);
    } else {
      // No DNA hash - will use signature clustering
      symbolsWithoutDna.push(symbol);
    }
  }

  // Convert DNA clusters to array
  for (const cluster of dnaClusters.values()) {
    if (cluster.size > 0) {
      clusters.push(cluster);
    }
  }

  // For symbols without DNA, use signature-based similarity
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

    // Try to find existing cluster with similar signature
    for (const cluster of clusters) {
      const clusterSymbol = Array.from(cluster)[0];
      if (calculateSignatureSimilarity(symbol.signature || '', clusterSymbol.signature || '') > 0.8) {
        cluster.add(symbol);
        foundCluster = true;
        break;
      }
    }

    // Create new cluster if no similar signature found
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
  // Use DNA hash similarity if available
  const aDna = a.dnaId;
  const bDna = b.dnaId;

  if (aDna && bDna) {
    return aDna === bDna ? 1.0 : 0.0; // Exact DNA match = perfect similarity
  }

  // Fallback to signature similarity
  return calculateSignatureSimilarity(a.signature || '', b.signature || '');
}

/**
 * Calculate signature similarity using Jaccard index on tokens
 */
function calculateSignatureSimilarity(sigA: string, sigB: string): number {
  if (!sigA || !sigB) return 0;

  // Tokenize signatures (simple split on non-word chars)
  const tokensA = new Set(sigA.split(/\W+/).filter(t => t.length > 0));
  const tokensB = new Set(sigB.split(/\W+/).filter(t => t.length > 0));

  // Calculate Jaccard similarity: |intersection| / |union|
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

  // Start with entry points: symbols marked as entry points or with entry-point names
  for (const [symbolId, symbol] of working.symbolsById) {
    const intendedState = intended.get(symbolId);

    // Include symbols that are explicitly intended present or have entry-point names
    if ((intendedState && intendedState.expect === 'present') ||
        symbol.name.startsWith('main') ||
        symbol.name.startsWith('index')) {
      reachable.add(symbolId);
      queue.push(symbolId);
    }
  }

  // BFS traversal following edges
  while (queue.length > 0) {
    const currentSymbolId = queue.shift()!;

    // Find all edges where current symbol is the source
    const outgoingEdges = working.edges.filter(edge =>
      edge.from_symbol_id === currentSymbolId
    );

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
    hotspots: []
  };

  // Check symbol completeness
  // CRITICAL: Only check symbols in intended map. Do NOT add fake zombies for symbols
  // that exist in working tree but not in intended map - those are out of scope.
  for (const [symbolKey, expected] of intended) {
    const found = working.symbolsById.get(symbolKey);

    if (expected.expect === 'present') {
      if (!found) {
        findings.missing_symbols.push({ symbol_id: symbolKey, expected });
      } else {
        // Check for divergence (simplified - could check signature/content hash)
        if (expected.lastName && found.name !== expected.lastName) {
          findings.divergent_symbols.push({ symbol_id: symbolKey, expected, found });
        }
      }
    } else if (expected.expect === 'absent') {
      // Only add zombies for symbols explicitly marked as absent in intended map
      if (found) {
        findings.zombie_symbols.push({ symbol_id: symbolKey, expected, found });
      }
    }
  }

  // NOTE: We intentionally do NOT iterate over working.symbolsById to find "fake zombies"
  // (symbols in working tree but not in intended map). Those are out of scope and not
  // part of the refactor bundle analysis.

  // Check edge drift if commit SHAs are provided
  if (commitShas && commitShas.length > 0) {
    try {
      const db = getDatabaseManager().getDatabase();
      const placeholders = commitShas.map(() => '?').join(',');
      
      // Query intended edges from database (edges added/modified in commits)
      const intendedEdgesStmt = db.prepare(`
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

      // Check for missing edges (intended present but not in working)
      for (const intendedEdge of intendedEdges) {
        const found = working.edges.find(
          e => e.from_symbol_id === intendedEdge.from_symbol_id &&
               e.to_symbol_id === intendedEdge.to_symbol_id &&
               e.edge_type === intendedEdge.edge_type
        );
        
        if (!found) {
          // Only report as missing if both symbols are in intended map
          const fromIntended = intended.has(intendedEdge.from_symbol_id);
          const toIntended = intended.has(intendedEdge.to_symbol_id);
          
          if (fromIntended || toIntended) {
            findings.missing_edges.push({
              from: intendedEdge.from_symbol_id,
              to: intendedEdge.to_symbol_id,
              type: intendedEdge.edge_type,
              expected: intended.get(intendedEdge.from_symbol_id) || intended.get(intendedEdge.to_symbol_id) || {
                expect: 'present',
                lastSha: commitShas[commitShas.length - 1]
              }
            });
          }
        }
      }

      // Check for zombie edges (in working but not intended)
      for (const workingEdge of working.edges) {
        const fromIntended = intended.has(workingEdge.from_symbol_id);
        const toIntended = intended.has(workingEdge.to_symbol_id);

        // Skip edges where both symbols are out of scope (not in intended map)
        if (!fromIntended && !toIntended) {
          continue;
        }

        const fromState = intended.get(workingEdge.from_symbol_id);
        const toState = intended.get(workingEdge.to_symbol_id);

        // Check if this edge exists in intended edges from database
        const edgeInIntended = intendedEdges.some(
          intendedEdge => intendedEdge.from_symbol_id === workingEdge.from_symbol_id &&
                           intendedEdge.to_symbol_id === workingEdge.to_symbol_id &&
                           intendedEdge.edge_type === workingEdge.edge_type
        );

        // Flag as zombie if:
        // 1. Edge doesn't exist in intended edges from database, OR
        // 2. Edge connects to a symbol that should be absent
        if (!edgeInIntended ||
            (fromState && fromState.expect === 'absent') ||
            (toState && toState.expect === 'absent')) {
          findings.zombie_edges.push({
            from: workingEdge.from_symbol_id,
            to: workingEdge.to_symbol_id,
            type: workingEdge.edge_type,
            found: workingEdge
          });
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`Failed to detect edge drift for commits [${commitShas?.join(', ')}]: ${errorMsg}`);
      console.warn('Continuing without edge drift detection. This may miss some zombie/missing edges.');
      // Continue without edge drift detection
    }
  }

  // Build file hotspots
  const fileDrift = new Map<string, number>();
  for (const finding of [...findings.missing_symbols, ...findings.zombie_symbols, ...findings.divergent_symbols]) {
    // Extract path from symbol key safely
    const path = extractPathFromSymbolId(finding.symbol_id);
    fileDrift.set(path, (fileDrift.get(path) || 0) + 1);
  }

  findings.hotspots = Array.from(fileDrift.entries())
    .map(([path, count]) => ({ path, drift_count: count }))
    .sort((a, b) => b.drift_count - a.drift_count)
    .slice(0, 10);

  // Detect convention drift
  const conventionDrift = detectConventionDrift(working);
  if (conventionDrift) {
    findings.conventionDrift = conventionDrift.conventionDrift;
    findings.mixedConventionFiles = conventionDrift.mixedConventionFiles;
  }

  // Detect unresolved callers (call sites that don't resolve to a current symbol)
  findings.unresolved_callers = detectUnresolvedCallers(working, intended);

  // Enhanced divergent detection with AST shape clustering
  const enhancedDivergent = detectDivergentClusters(working, intended);
  if (enhancedDivergent.divergentClusters.length > 0) {
    findings.divergentClusters = enhancedDivergent.divergentClusters;
  }
  if (enhancedDivergent.suggestedConsolidations.length > 0) {
    findings.suggestedConsolidations = enhancedDivergent.suggestedConsolidations;
  }

  return findings;
}

/**
 * Detect unresolved callers (call sites that don't resolve to a current symbol)
 */
function detectUnresolvedCallers(
  working: WorkingSnapshot,
  intended?: Map<string, IntendedState>
): UnresolvedCallerFact[] {
  // Only build name index if we have intended states that might need name matching
  let nameIndex: Map<string, string[]> | undefined;
  if (intended && Array.from(intended.values()).some(state => state.lastName)) {
    nameIndex = new Map<string, string[]>(); // lowerName -> symbol_ids
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

    // Skip if target is a known symbol
    if (edge.to_symbol_id && working.symbolsById.has(edge.to_symbol_id)) continue;

    const caller = edge.from_symbol_id ? working.symbolsById.get(edge.from_symbol_id) : undefined;
    const calleeRaw = edge.to_symbol_id || '';
    const calleeName = extractCalleeName(calleeRaw);

    // Try to guess a target by name match
    const guessed = guessTarget(calleeName, nameIndex, intended);

    const key = `${edge.from_symbol_id || 'unknown'}::${calleeName || calleeRaw}`;
    const current = facts.get(key) || {
      caller_symbol_id: edge.from_symbol_id,
      caller_name: caller?.name,
      caller_path: caller?.symbol_id ? extractPathFromSymbolId(caller.symbol_id) : undefined,
      callee_name: calleeName || calleeRaw,
      guessed_target_dna_id: guessed,
      caller_line: caller ? extractLineFromSymbol(caller) : undefined,
      occurrence_count: 0,
      severity: 0,
      count: 0
    };

    current.count += 1;
    facts.set(key, current);
  }

  const results: UnresolvedCallerFact[] = [];
  for (const fact of facts.values()) {
    // Base severity from occurrence count using logarithmic scaling
    // log1p(count) / log1p(5) gives severity that grows slowly with count
    // At count=1: ~0.43, count=5: ~0.70, count=25: ~0.89, count=100: ~0.96
    const OCCURRENCE_SCALE_FACTOR = 5;
    const baseSeverity = Math.min(1, Math.log1p(fact.count) / Math.log1p(OCCURRENCE_SCALE_FACTOR));

    // Additional severity bump for calls that can't be guessed (no target found)
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
  // Try to take the last identifier-like token
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

  // First try intended map names (more reliable)
  if (intended) {
    const intendedMatch = Array.from(intended.entries()).find(([, st]) =>
      st.lastName && st.lastName.toLowerCase() === calleeName.toLowerCase()
    );
    if (intendedMatch) {
      return intendedMatch[0];
    }
  }

  // Then try working symbol name index if available
  if (nameIndex) {
    const matches = nameIndex.get(calleeName.toLowerCase()) || [];
    if (matches.length === 1) {
      return matches[0];
    }
  }

  return null;
}

/**
 * Detect naming convention drift across working symbols
 */
function detectConventionDrift(
  working: WorkingSnapshot
): {
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
    // Get symbols from working snapshot
    const symbols = Array.from(working.symbolsById.values()).map(s => ({
      name: s.name,
      kind: s.kind,
      path: extractPathFromSymbolId(s.symbol_id)
    }));

    if (symbols.length === 0) {
      return null;
    }

    // Analyze overall convention drift
    const driftResult = analyzeConventionDrift(symbols);

    // Build drift symbols with suggestions
    const driftSymbols = driftResult.driftSymbols.map(ds => {
      const symbolId = Array.from(working.symbolsById.entries())
        .find(([, s]) => s.name === ds.name && extractPathFromSymbolId(s.symbol_id) === ds.path)?.[0] || '';

      return {
        symbolId,
        name: ds.name,
        convention: ds.convention,
        suggestedName: ds.suggestedName,
        path: ds.path
      };
    }).filter(ds => ds.symbolId !== ''); // Only include symbols we found

    // Analyze file-level convention mixing
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
      if (fileSymbols.length < 2) continue; // Need at least 2 symbols to have mixing

      const fileDrift = analyzeConventionDrift(fileSymbols);
      const uniqueConventions = new Set(
        fileSymbols.map(s => detectNamingConvention(s.name).convention)
      );

      // Only include files with multiple conventions
      if (uniqueConventions.size > 1 && fileDrift.driftPercent > 0) {
        mixedConventionFiles.push({
          path: filePath,
          conventions: Array.from(uniqueConventions) as NamingConvention[],
          symbolCount: fileSymbols.length,
          driftPercent: fileDrift.driftPercent
        });
      }
    }

    // Analyze import path conventions (JS/TS/PHP)
    const importDrift = detectImportPathConventionDrift(working);

    // Analyze file naming conventions
    const fileNamingDrift = detectFileNamingConventionDrift(working);

    return {
      conventionDrift: {
        dominantConvention: driftResult.dominantConvention,
        driftPercent: driftResult.driftPercent,
        driftSymbols,
        importDrift,
        fileNamingDrift
      },
      mixedConventionFiles: mixedConventionFiles.length > 0 ? mixedConventionFiles : undefined
    };
  } catch (error) {
    console.warn('Failed to detect convention drift:', error);
    return null;
  }
}

function detectImportPathConventionDrift(
  working: WorkingSnapshot
): {
  dominantStyle: string;
  driftPercent: number;
  driftImports: Array<{ file: string; line: number; importPath: string; style: string }>;
} | undefined {
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
        file: filePath
      }));
      imports.push(...fileImports);
    } catch (error) {
      console.warn(`[ConventionDrift] Failed to analyze imports for ${filePath}:`, error);
    }
  }

  if (imports.length === 0) {
    return undefined;
  }

  const drift = analyzeImportPathDrift(imports);
  const driftImports = drift.driftImports.map(imp => ({
    file: (imp as any).file || '', // file is attached above; fallback to blank if missing
    line: imp.line,
    importPath: imp.path,
    style: imp.style
  })).filter(imp => imp.file);

  return {
    dominantStyle: drift.dominantStyle,
    driftPercent: drift.driftPercent,
    driftImports
  };
}

function detectFileNamingConventionDrift(
  working: WorkingSnapshot
): {
  dominantStyle: FileNamingConvention['style'];
  driftPercent: number;
  driftFiles: Array<{ path: string; style: FileNamingConvention['style']; filename: string }>;
} | undefined {
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
  const driftFiles = fileConventions.filter(fc => fc.style !== dominant).map(fc => ({
    path: fc.path,
    style: fc.style,
    filename: fc.filename
  }));

  const driftPercent = fileConventions.length > 0
    ? (driftFiles.length / fileConventions.length) * 100
    : 0;

  return {
    dominantStyle: dominant,
    driftPercent,
    driftFiles
  };
}

/**
 * Input type for drift detection
 */
export interface DriftDetectorInput {
  intended: Map<string, IntendedState>;
  working: WorkingSnapshot;
  commitShas?: string[];
}

/**
 * Drift detector that extends BaseDetector for unified analysis patterns
 */
export class DriftDetector extends BaseDetector<DriftDetectorInput, DriftFindings> {
  constructor(config: Partial<DetectorConfig> = {}) {
    super({
      enableCaching: false, // Drift detection should always be fresh
      ...config
    });
  }

  async detect(input: DriftDetectorInput): Promise<DriftFindings> {
    // Drift detection should always be fresh - no caching
    return detectDrift(input.intended, input.working, input.commitShas);
  }
}
