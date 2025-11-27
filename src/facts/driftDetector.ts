import { SymbolContext, EdgeContext } from '../contracts/llmContext';
import { IntendedState } from './intendedMap';
import { WorkingSnapshot } from './workingSnapshot';
import { getDatabaseManager } from '../storage/database';
import { NamingConvention, analyzeConventionDrift, suggestConventionName } from '../analysis/namingConventions';

export interface DriftFindings {
  missing_symbols: Array<{symbol_id: string, expected: IntendedState}>;
  zombie_symbols: Array<{symbol_id: string, expected: IntendedState, found: SymbolContext}>;
  divergent_symbols: Array<{symbol_id: string, expected: IntendedState, found: SymbolContext}>;
  missing_edges: Array<{from: string, to: string, type: string, expected: IntendedState}>;
  zombie_edges: Array<{from: string, to: string, type: string, found: EdgeContext}>;
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

  // Find divergent clusters (clusters with high internal similarity but different names)
  for (const cluster of clusters) {
    if (cluster.size >= 2) {
      const symbols = Array.from(cluster);
      const names = symbols.map(s => s.name);

      // Check if symbols have different names but similar AST shapes
      const uniqueNames = new Set(names);
      if (uniqueNames.size > 1) {
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
    const dnaHash = (symbol as any).dnaId;

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
  const aDna = (a as any).dnaId;
  const bDna = (b as any).dnaId;

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

  // Start with entry points: exported symbols and symbols marked as entry points
  for (const [symbolId, symbol] of working.symbolsById) {
    const intendedState = intended.get(symbolId);

    // Include symbols that are exported or explicitly intended present
    if (symbol.kind === 'export' ||
        (intendedState && intendedState.expect === 'present') ||
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
        SELECT DISTINCT from_symbol_id, to_symbol_id, edge_type
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
        
        // If at least one symbol is not in intended map, it's a potential zombie edge
        // But only flag if one symbol is intended absent (zombie) or both are out of scope
        if (!fromIntended && !toIntended) {
          // Both symbols out of scope - skip
          continue;
        }
        
        const fromState = intended.get(workingEdge.from_symbol_id);
        const toState = intended.get(workingEdge.to_symbol_id);
        
        // Flag as zombie if:
        // 1. One symbol is intended absent (zombie symbol)
        // 2. Or edge connects to a symbol that should be absent
        if ((fromState && fromState.expect === 'absent') || 
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
      console.warn('Failed to detect edge drift:', error);
      // Continue without edge drift detection
    }
  }

  // Build file hotspots
  const fileDrift = new Map<string, number>();
  for (const finding of [...findings.missing_symbols, ...findings.zombie_symbols, ...findings.divergent_symbols]) {
    // Extract path from symbol key (simplified)
    const path = finding.symbol_id.split(':')[0] || 'unknown';
    fileDrift.set(path, (fileDrift.get(path) || 0) + 1);
  }

  findings.hotspots = Array.from(fileDrift.entries())
    .map(([path, count]) => ({ path, drift_count: count }))
    .sort((a, b) => b.drift_count - a.drift_count)
    .slice(0, 10);

  // Detect convention drift
  const conventionDrift = detectConventionDrift(working, commitShas);
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
  const nameIndex = new Map<string, string[]>(); // lowerName -> symbol_ids
  for (const [symbolId, symbol] of working.symbolsById) {
    const key = symbol.name.toLowerCase();
    if (!nameIndex.has(key)) {
      nameIndex.set(key, []);
    }
    nameIndex.get(key)!.push(symbolId);
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
      caller_path: caller?.symbol_id?.split(':')[0],
      callee_name: calleeName || calleeRaw,
      guessed_target_dna_id: guessed,
      caller_line: caller?.loc_post?.start?.line || caller?.loc_pre?.start?.line,
      occurrence_count: 0,
      severity: 0,
      count: 0
    };

    current.count += 1;
    facts.set(key, current);
  }

  const results: UnresolvedCallerFact[] = [];
  for (const fact of facts.values()) {
    const base = Math.min(1, Math.log1p(fact.count) / Math.log1p(5));
    const unknownBump = fact.guessed_target_dna_id ? 0 : 0.1;
    fact.severity = Math.min(1, base + unknownBump);
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
  nameIndex: Map<string, string[]>,
  intended?: Map<string, IntendedState>
): string | null | undefined {
  if (!calleeName) return null;
  const matches = nameIndex.get(calleeName.toLowerCase()) || [];
  if (matches.length === 1) {
    return matches[0];
  }

  // Try intended map names
  if (intended) {
    const intendedMatch = Array.from(intended.entries()).find(([, st]) =>
      st.lastName && st.lastName.toLowerCase() === calleeName.toLowerCase()
    );
    if (intendedMatch) {
      return intendedMatch[0];
    }
  }

  return null;
}

/**
 * Detect naming convention drift across working symbols
 */
function detectConventionDrift(
  working: WorkingSnapshot,
  commitShas?: string[]
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
      path: s.symbol_id.split(':')[0]
    }));

    if (symbols.length === 0) {
      return null;
    }

    // Analyze overall convention drift
    const driftResult = analyzeConventionDrift(symbols);

    // Build drift symbols with suggestions
    const driftSymbols = driftResult.driftSymbols.map(ds => {
      const symbolId = Array.from(working.symbolsById.entries())
        .find(([, s]) => s.name === ds.name && s.symbol_id.split(':')[0] === ds.path)?.[0] || '';
      
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
        fileSymbols.map(s => {
          const { detectNamingConvention } = require('../analysis/namingConventions');
          return detectNamingConvention(s.name).convention;
        })
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

    return {
      conventionDrift: {
        dominantConvention: driftResult.dominantConvention,
        driftPercent: driftResult.driftPercent,
        driftSymbols
      },
      mixedConventionFiles: mixedConventionFiles.length > 0 ? mixedConventionFiles : undefined
    };
  } catch (error) {
    console.warn('Failed to detect convention drift:', error);
    return null;
  }
}
