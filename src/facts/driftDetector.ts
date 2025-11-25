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

  return findings;
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
