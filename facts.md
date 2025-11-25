
/* ---- File: src/facts/deltaConverter.ts ---- */

import { SymbolInfo, SymbolDelta } from '../types';
import { SymbolContext, EdgeContext } from '../contracts/llmContext';
import { WorkingSnapshot } from './workingSnapshot';

/**
 * Convert symbol deltas from extractWorkingTreeSymbols to WorkingSnapshot format
 * This bridges the gap between change-based analysis and the snapshot-based report system
 */
export function convertDeltasToSnapshot(
    deltas: {
        added: SymbolInfo[];
        removed: SymbolInfo[];
        modified: SymbolDelta[];
    },
    scopePaths: Set<string>
): WorkingSnapshot {
    const symbolsById = new Map<string, SymbolContext>();
    const symbolsByFile = new Map<string, SymbolContext[]>();
    const analyzedPaths = new Set<string>();

    // Helper to add symbol to maps
    const addSymbol = (symbol: SymbolInfo) => {
        const ctx: SymbolContext = {
            id: 0, // Placeholder for working snapshot (not from database)
            symbol_id: symbol.id,
            name: symbol.name,
            kind: symbol.kind,
            signature: symbol.signature,
            loc_pre: symbol.location
                ? {
                    start: {
                        line: symbol.location.start.line,
                        column: symbol.location.start.column,
                    },
                    end: {
                        line: symbol.location.end.line,
                        column: symbol.location.end.column,
                    },
                }
                : undefined,
        };

        symbolsById.set(symbol.id, ctx);

        // Extract file path from symbol ID (format: "path:semanticId")
        const filePath = symbol.id.split(':')[0];
        if (!symbolsByFile.has(filePath)) {
            symbolsByFile.set(filePath, []);
        }
        symbolsByFile.get(filePath)!.push(ctx);
        analyzedPaths.add(filePath);
    };

    // Process added symbols
    for (const symbol of deltas.added) {
        addSymbol(symbol);
    }

    // Process modified symbols (use current state, not pre-state)
    for (const delta of deltas.modified) {
        addSymbol(delta.symbol);
    }

    // Note: Removed symbols are intentionally NOT included in working snapshot
    // They existed in HEAD but not in working tree, so they shouldn't appear
    // in the "working" state used for drift detection

    // For now, return empty edges - these can be added later via DependencyExtractor
    // if needed for more complete analysis
    const edges: EdgeContext[] = [];

    console.log(
        `[DELTA-SNAPSHOT] Converted ${deltas.added.length} added, ${deltas.modified.length} modified symbols to snapshot`
    );
    console.log(
        `[DELTA-SNAPSHOT] Removed ${deltas.removed.length} symbols (excluded from working snapshot)`
    );
    console.log(`[DELTA-SNAPSHOT] Total symbols in snapshot: ${symbolsById.size}`);
    console.log(`[DELTA-SNAPSHOT] Files analyzed: ${analyzedPaths.size}`);

    return {
        symbolsById,
        symbolsByFile,
        edges,
        analyzedPaths,
    };
}



/* ---- File: src/facts/driftDetector.ts ---- */

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



/* ---- File: src/facts/factsAssembler.ts ---- */

import * as fs from 'fs';
import * as path from 'path';
import { getGitRoot } from '../utils/config';
import { ScopeSet } from './scope';
import { IntendedState } from './intendedMap';
import { WorkingSnapshot } from './workingSnapshot';
import { DriftFindings } from './driftDetector';
import { LegacyAuditResult } from './legacyAudit';
import { RefactorBundleFacts } from './types';

// Re-export for backward compatibility
export type { RefactorBundleFacts } from './types';

/**
 * Assemble all facts into v2 JSON schema
 */
export async function assembleFacts(
  commitShas: string[],
  scope: ScopeSet,
  intended: Map<string, IntendedState>,
  working: WorkingSnapshot,
  drift: DriftFindings,
  legacy: LegacyAuditResult
): Promise<RefactorBundleFacts> {

  // Calculate counts and lists
  const intendedCounts = calculateIntendedCounts(intended);
  const intendedLists = getIntendedLists(intended);
  const workingLists = getWorkingLists(working);
  const oldestSha = commitShas.length > 0 ? commitShas[0] : 'unknown';

  const newestSha = commitShas.length > 0 ? commitShas[commitShas.length - 1] : 'unknown';

  const facts: RefactorBundleFacts = {
    version: "2.0",
    generated_at: new Date().toISOString(),
    bundle: {
      oldestSha,
      newestSha,
      shas: commitShas
    },
    scope: {
      files: scope.commitFiles.size,
      blastRadius: scope.blastRadius.size
    },
    intended: intendedCounts,
    working: {
      symbols: working.symbolsById.size,
      edges: working.edges.length
    },
    findings: {
      incompleteness: {
        missing: drift.missing_symbols.length,
        zombies: drift.zombie_symbols.length,
        divergent: drift.divergent_symbols.length
      },
      patternDrift: {
        mixedTargets: detectMixedTargets(drift, working),
        oldNamespaces: detectOldNamespaces(working, intended),
        conventionDrift: drift.conventionDrift ? {
          dominantConvention: drift.conventionDrift.dominantConvention,
          driftPercent: drift.conventionDrift.driftPercent,
          driftSymbolCount: drift.conventionDrift.driftSymbols.length
        } : undefined,
        mixedConventionFiles: drift.mixedConventionFiles?.length || undefined
      },
      legacyAudit: {
        dead: legacy.dead.length,
        legacyUsed: legacy.legacyUsed.length,
        replacedLeftovers: legacy.replacedLeftovers.map(item => ({
          old: item.old.symbol_id,
          new: item.new.symbol_id,
          confidence: item.confidence
        }))
      }
    },
    evidence: {
      // Scope evidence
      "bundle.shas": commitShas,
      "scope.files": Array.from(scope.commitFiles),
      "scope.blastRadius": Array.from(scope.blastRadius),

      // Intended state evidence
      "intended.present": intendedLists.present,
      "intended.absent": intendedLists.absent,
      "intended.renamed": intendedLists.renamed,

      // Working state evidence
      "working.symbols": workingLists.symbols,
      "working.edges": workingLists.edges,

      // Findings evidence
      "findings.incompleteness": {
        missing: drift.missing_symbols.map(m => ({ symbol_id: m.symbol_id, expected: m.expected })),
        zombies: drift.zombie_symbols.map(z => ({ symbol_id: z.symbol_id, found: { name: z.found.name, kind: z.found.kind } })),
        divergent: drift.divergent_symbols
      },
      "findings.incompleteness.missing": drift.missing_symbols.map(m => ({ symbol_id: m.symbol_id, expected: m.expected })),
      "findings.incompleteness.zombies": drift.zombie_symbols.map(z => ({ symbol_id: z.symbol_id, found: { name: z.found.name, kind: z.found.kind } })),

      "findings.legacyAudit": {
        dead: legacy.dead.map(d => ({ symbol_id: d.symbol_id, name: d.name, kind: d.kind })),
        legacyUsed: legacy.legacyUsed.map(l => ({ symbol_id: l.symbol_id, name: l.name, kind: l.kind })),
        replacedLeftovers: legacy.replacedLeftovers.map(r => ({
          old: r.old.symbol_id,
          new: r.new.symbol_id,
          confidence: r.confidence
        }))
      },

      "findings.patternDrift.conventionDrift": drift.conventionDrift ? {
        dominantConvention: drift.conventionDrift.dominantConvention,
        driftPercent: drift.conventionDrift.driftPercent,
        driftSymbols: drift.conventionDrift.driftSymbols.map(ds => ({
          symbolId: ds.symbolId,
          name: ds.name,
          convention: ds.convention,
          suggestedName: ds.suggestedName,
          path: ds.path
        }))
      } : undefined,

      "findings.patternDrift.mixedConventionFiles": drift.mixedConventionFiles || undefined,

      // Legacy fields for backward compatibility
      missing: drift.missing_symbols.map(m => ({ symbol_id: m.symbol_id, expected: m.expected })),
      zombies: drift.zombie_symbols.map(z => ({ symbol_id: z.symbol_id, found: { name: z.found.name, kind: z.found.kind } })),
      dead: legacy.dead.map(d => ({ symbol_id: d.symbol_id, name: d.name, kind: d.kind })),
      legacyUsed: legacy.legacyUsed.map(l => ({ symbol_id: l.symbol_id, name: l.name, kind: l.kind })),
      replacedLeftovers: legacy.replacedLeftovers.map(r => ({
        old: r.old.symbol_id,
        new: r.new.symbol_id,
        confidence: r.confidence
      }))
    }
  };

  return facts;
}

/**
 * Save facts to .git/commit-tracker/last-bundle-facts.json
 */
export async function saveFacts(facts: RefactorBundleFacts): Promise<string> {
  const gitRoot = getGitRoot();
  if (!gitRoot) {
    throw new Error('Not in a git repository');
  }

  const factsDir = path.join(gitRoot, '.git', 'commit-tracker');
  const factsPath = path.join(factsDir, 'last-bundle-facts.json');

  // Ensure directory exists
  if (!fs.existsSync(factsDir)) {
    fs.mkdirSync(factsDir, { recursive: true });
  }

  // Write facts JSON
  fs.writeFileSync(factsPath, JSON.stringify(facts, null, 2), 'utf8');

  return factsPath;
}

/**
 * Calculate counts for intended state summary
 */
function calculateIntendedCounts(intended: Map<string, IntendedState>): { present: number; absent: number; renamed: number } {
  let present = 0;
  let absent = 0;
  let renamed = 0;

  for (const [symbolId, state] of intended) {
    if (state.expect === 'present') {
      present++;
      if (state.isRenamed) {
        renamed++;
      }
    } else if (state.expect === 'absent') {
      absent++;
    }
  }

  return { present, absent, renamed };
}

/**
 * Get detailed lists for intended state
 */
function getIntendedLists(intended: Map<string, IntendedState>): { present: string[]; absent: string[]; renamed: string[] } {
  const present: string[] = [];
  const absent: string[] = [];
  const renamed: string[] = [];

  for (const [symbolId, state] of intended) {
    if (state.expect === 'present') {
      present.push(symbolId);
      if (state.isRenamed) {
        renamed.push(symbolId);
      }
    } else if (state.expect === 'absent') {
      absent.push(symbolId);
    }
  }

  return { present, absent, renamed };
}

/**
 * Get detailed lists for working state
 */
function getWorkingLists(working: WorkingSnapshot): { symbols: string[]; edges: string[] } {
  return {
    symbols: Array.from(working.symbolsById.keys()),
    edges: working.edges.map(e => `${e.from_symbol_id} -> ${e.to_symbol_id} (${e.edge_type})`)
  };
}

/**
 * Detect files with mixed naming convention targets
 * Counts files that have multiple naming conventions in use
 */
function detectMixedTargets(drift: DriftFindings, working: WorkingSnapshot): number {
  // Use mixedConventionFiles from drift detector if available
  if (drift.mixedConventionFiles && drift.mixedConventionFiles.length > 0) {
    return drift.mixedConventionFiles.length;
  }

  // Fallback: detect by analyzing files with multiple conventions
  const fileConventions = new Map<string, Set<string>>();
  
  for (const [symbolId, symbol] of working.symbolsById) {
    const filePath = symbolId.split(':')[0];
    if (!fileConventions.has(filePath)) {
      fileConventions.set(filePath, new Set());
    }
    
    // Simple convention detection based on naming patterns
    const name = symbol.name;
    if (/^[a-z]/.test(name)) {
      fileConventions.get(filePath)!.add('camelCase');
    } else if (/^[A-Z]/.test(name) && /[A-Z]/.test(name.slice(1))) {
      fileConventions.get(filePath)!.add('PascalCase');
    } else if (/_/.test(name)) {
      fileConventions.get(filePath)!.add('snake_case');
    }
  }

  // Count files with multiple conventions
  let mixedCount = 0;
  for (const conventions of fileConventions.values()) {
    if (conventions.size > 1) {
      mixedCount++;
    }
  }

  return mixedCount;
}

/**
 * Detect old namespace usage patterns
 * Looks for symbols using deprecated/old namespace patterns
 */
function detectOldNamespaces(working: WorkingSnapshot, intended: Map<string, IntendedState>): number {
  const oldNamespacePatterns = [
    /^(old|legacy|deprecated|v1|v2|old_|legacy_|deprecated_)/i,
    /(Old|Legacy|Deprecated)([A-Z]|$)/,
    /\\Old\\/,
    /\\Legacy\\/,
    /\\Deprecated\\/,
    /\/old\//,
    /\/legacy\//,
    /\/deprecated\//
  ];

  let oldNamespaceCount = 0;

  // Check working symbols for old namespace patterns
  for (const [symbolId, symbol] of working.symbolsById) {
    const filePath = symbolId.split(':')[0];
    const symbolName = symbol.name;

    // Check if path or name matches old namespace patterns
    const matchesOldPattern = oldNamespacePatterns.some(pattern => 
      pattern.test(filePath) || pattern.test(symbolName)
    );

    if (matchesOldPattern) {
      // Only count if it's in scope (intended map) or if it's a zombie (should be removed)
      const intendedState = intended.get(symbolId);
      if (intendedState || !intended.has(symbolId)) {
        // Check if this is a zombie (should be removed but still exists)
        if (intendedState?.expect === 'absent') {
          oldNamespaceCount++;
        } else if (!intended.has(symbolId)) {
          // Symbol not in intended map but matches old pattern - potential old namespace
          oldNamespaceCount++;
        }
      }
    }
  }

  return oldNamespaceCount;
}



/* ---- File: src/facts/intendedMap.ts ---- */

import { getDatabaseManager } from '../storage/database';

export interface IntendedState {
  expect: 'present' | 'absent';
  lastName?: string;
  lastPath?: string;
  lastSig?: string;
  lastSha: string;
  isRenamed?: boolean; // Indicates if this symbol was renamed
}

/**
 * Build intended refactor map by folding selected commits oldest→newest, respecting renames
 */
export async function buildIntendedMap(commitShas: string[]): Promise<Map<string, IntendedState>> {
  const db = getDatabaseManager().getDatabase();

  // Sort SHAs oldest → newest (reverse chronological order)
  const placeholders = commitShas.map(() => '?').join(',');
  const shaOrderStmt = db.prepare(`
    SELECT sha FROM commits_metadata
    WHERE sha IN (${placeholders})
    ORDER BY date ASC
  `);
  const orderedShas = shaOrderStmt.all(...commitShas).map((row: any) => row.sha);

  const intended = new Map<string, IntendedState>();

  for (const sha of orderedShas) {
    // Load symbol deltas for this commit
    const symbolsStmt = db.prepare(`
      SELECT symbol_id, name, path, signature_post, signature_pre, change_type, mod_reason
      FROM symbols WHERE sha = ?
    `);
    const symbols = symbolsStmt.all(sha) as any[];

    // Load renames from renames table
    const renamesStmt = db.prepare(`
      SELECT old_symbol_id, new_symbol_id, old_name, new_name, confidence
      FROM renames WHERE sha = ?
    `);
    const renames = renamesStmt.all(sha) as any[];

    // Process additions/modifications
    for (const symbol of symbols) {
      const key = symbol.symbol_id || `${symbol.path}:${symbol.kind}:${symbol.name}`;

      if (symbol.change_type === 'added') {
        intended.set(key, {
          expect: 'present',
          lastName: symbol.name,
          lastPath: symbol.path,
          lastSig: symbol.signature_post || symbol.signature_pre,
          lastSha: sha
        });
      } else if (symbol.change_type === 'modified') {
        const prev = intended.get(key);
        intended.set(key, {
          expect: 'present',
          lastName: symbol.name,
          lastPath: symbol.path,
          lastSig: symbol.signature_post || symbol.signature_pre,
          lastSha: sha
        });
      }
    }

    // Process renames - treat as continuity (not delete+add)
    // Create a set of renamed old symbol IDs to skip them in removals
    const renamedOldIds = new Set<string>();
    for (const rename of renames) {
      const oldKey = rename.old_symbol_id;
      const newKey = rename.new_symbol_id;
      renamedOldIds.add(oldKey);

      // If the old symbol was intended to be present, map it to the new symbol
      const oldState = intended.get(oldKey);
      if (oldState && oldState.expect === 'present') {
        // Remove the old symbol entry
        intended.delete(oldKey);
        
        // Set new symbol as present, marking it as renamed
        intended.set(newKey, {
          expect: 'present',
          lastName: rename.new_name,
          lastPath: rename.new_symbol_id.split(':')[0], // Extract path from symbol ID
          lastSig: oldState.lastSig, // Preserve signature from old state
          lastSha: sha,
          isRenamed: true // Mark as renamed
        });
      } else {
        // Old symbol wasn't in intended map yet, just add the new one
        intended.set(newKey, {
          expect: 'present',
          lastName: rename.new_name,
          lastPath: rename.new_symbol_id.split(':')[0],
          lastSha: sha,
          isRenamed: true
        });
      }
    }

    // Process removals (but skip symbols that were renamed)
    for (const symbol of symbols) {
      if (symbol.change_type === 'removed') {
        const key = symbol.symbol_id || `${symbol.path}:${symbol.kind}:${symbol.name}`;
        
        // Skip if this symbol was renamed (continuity, not removal)
        if (renamedOldIds.has(key)) {
          continue;
        }
        
        intended.set(key, {
          expect: 'absent',
          lastSha: sha
        });
      }
    }
  }

  // Log rename continuity summary
  const renamedCount = Array.from(intended.values()).filter(s => s.isRenamed).length;
  console.log(`Intended map: ${intended.size} symbols, ${renamedCount} renamed`);

  return intended;
}



/* ---- File: src/facts/legacyAudit.ts ---- */

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



/* ---- File: src/facts/scope.ts ---- */

import { GitOperations } from '../analysis/git';
import { getDatabaseManager } from '../storage/database';
import { getExtensionConfig } from '../utils/config';

export interface ScopeSet {
  commitFiles: Set<string>;        // Files touched by selected commits
  workingChanged: Set<string>;     // Files changed in working tree
  blastRadius: Set<string>;        // Neighbor files from dependency analysis
  allPaths: Set<string>;           // Union of all paths to analyze
}

/**
 * Extract file path from symbol ID (heuristic)
 */
function extractFileFromSymbolId(symbolId: string): string | null {
  // Symbol IDs are typically like "path/to/file.ts:ClassName" or "path/to/file:functionName"
  const parts = symbolId.split(':');
  if (parts.length >= 2) {
    return parts[0];
  }
  return null;
}

/**
 * Compute blast-radius neighbor files from commit metadata
 */
async function computeBlastRadiusNeighbors(
  commitShas: string[],
  commitFiles: Set<string>,
  maxNeighbors: number
): Promise<string[]> {
  const db = getDatabaseManager().getDatabase();

  const neighborFiles = new Map<string, number>(); // file -> confidence score

  // Get edges from selected commits
  const placeholders = commitShas.map(() => '?').join(',');
  const edgesStmt = db.prepare(`
    SELECT from_symbol_id, to_symbol_id, confidence, change_type
    FROM edges
    WHERE sha IN (${placeholders}) AND change_type IS NOT NULL
    ORDER BY confidence DESC
    LIMIT 200
  `);
  const edges = edgesStmt.all(...commitShas) as any[];

  // Extract symbol IDs that changed
  const changedSymbols = new Set<string>();
  for (const sha of commitShas) {
    const symbolsStmt = db.prepare(`
      SELECT symbol_id FROM symbols WHERE sha = ?
    `);
    const symbols = symbolsStmt.all(sha) as any[];
    symbols.forEach(s => changedSymbols.add(s.symbol_id));
  }

  // For each edge connected to changed symbols, find the file containing the other end
  for (const edge of edges) {
    const fromChanged = changedSymbols.has(edge.from_symbol_id);
    const toChanged = changedSymbols.has(edge.to_symbol_id);

    // Only consider edges where one end is changed (to find neighbors)
    if (fromChanged !== toChanged) {
      const neighborSymbolId = fromChanged ? edge.to_symbol_id : edge.from_symbol_id;
      const confidence = edge.confidence || 1.0;

      // Extract file path from symbol ID (simplified heuristic)
      const filePath = extractFileFromSymbolId(neighborSymbolId);
      if (filePath && !commitFiles.has(filePath)) {
        neighborFiles.set(filePath, (neighborFiles.get(filePath) || 0) + confidence);
      }
    }
  }

  // Return top N neighbors by confidence score
  return Array.from(neighborFiles.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxNeighbors)
    .map(([file]) => file);
}

/**
 * Compute scoped analysis set for refactor bundle
 */
export async function computeScope(
  commitShas: string[],
  workspaceParts?: Set<'staged' | 'unstaged'>
): Promise<ScopeSet> {
  const { ensureDatabaseInitialized } = await import('../storage/database');

  await ensureDatabaseInitialized();
  const git = new GitOperations();

  const scope: ScopeSet = {
    commitFiles: new Set(),
    workingChanged: new Set(),
    blastRadius: new Set(),
    allPaths: new Set()
  };

  // 1. Files touched by selected commits
  for (const sha of commitShas) {
    const commitFiles = git.getFileChanges(sha);
    commitFiles.forEach(f => scope.commitFiles.add(f.path));
  }

  // 2. Files changed in working tree (filtered by workspaceParts)
  const workingChanges = git.getWorkingDirectoryChanges();
  
  if (workspaceParts) {
    const includeStaged = workspaceParts.has('staged');
    const includeUnstaged = workspaceParts.has('unstaged');
    
    // Get staged and unstaged files separately
    const stagedFiles = git.getStagedFiles();
    const unstagedFiles = git.getUnstagedFiles();
    
    if (includeStaged) {
      stagedFiles.forEach(f => scope.workingChanged.add(f.path));
    }
    
    if (includeUnstaged) {
      unstagedFiles.forEach(f => scope.workingChanged.add(f.path));
    }
  } else {
    // Default: include all working changes
  workingChanges.forEach(f => scope.workingChanged.add(f.path));
  }

  // 3. Blast-radius neighbors (top N by confidence)
  const blastRadiusFiles = await computeBlastRadiusNeighbors(commitShas, scope.commitFiles, 20); // Max 20 extra files
  blastRadiusFiles.forEach(f => scope.blastRadius.add(f));

  // Union all paths
  const allPaths = new Set([
    ...scope.commitFiles,
    ...scope.workingChanged,
    ...scope.blastRadius
  ]);

  // Filter out build artifacts and ignored directories
  const filteredPaths = new Set<string>();
  for (const p of allPaths) {
    const normalized = p.replace(/\\/g, '/');
    if (normalized.startsWith('out/') ||
      normalized.startsWith('dist/') ||
      normalized.startsWith('node_modules/') ||
      normalized.includes('/node_modules/')) {
      continue;
    }

    if (git.isIgnored(p)) {
      continue;
    }

    // Check custom ignore paths
    const config = getExtensionConfig();
    if (config.customIgnorePaths && config.customIgnorePaths.length > 0) {
      let ignored = false;
      for (const pattern of config.customIgnorePaths) {
        // Simple glob matching support
        // Convert glob to regex: . -> \., * -> .*, ? -> .
        const regexStr = '^' + pattern
          .replace(/\./g, '\\.')
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.') + '$';
        const regex = new RegExp(regexStr);

        if (regex.test(p) || p.includes(pattern)) {
          ignored = true;
          break;
        }
      }
      if (ignored) continue;
    }

    filteredPaths.add(p);
  }

  scope.allPaths = filteredPaths;

  return scope;
}



/* ---- File: src/facts/types.ts ---- */

/**
 * Single source of truth for RefactorBundleFacts interface
 * This is the canonical schema for v2.0 facts JSON
 */

export interface RefactorBundleFacts {
  version: '2.0';
  generated_at: string;
  bundle: {
    oldestSha: string;
    newestSha?: string;
    shas: string[];
  };
  scope: {
    files: number;
    blastRadius: number;
  };
  intended: {
    present: number;
    absent: number;
    renamed: number;
  };
  working: {
    symbols: number;
    edges: number;
  };
  findings: {
    incompleteness: {
      missing: number;
      zombies: number;
      divergent: number;
    };
    patternDrift: {
      mixedTargets: number;
      oldNamespaces: number;
      conventionDrift?: {
        dominantConvention: string;
        driftPercent: number;
        driftSymbolCount: number;
      };
      mixedConventionFiles?: number;
    };
    legacyAudit: {
      dead: number;
      legacyUsed: number;
      replacedLeftovers: Array<{
        old: string;
        new: string;
        confidence: number;
      }>;
    };
  };
  evidence: Record<string, any>;
}

export interface RefactorPattern {
  id: string; // Hash of name + examples
  name: string;
  description: string;
  examples: string[];
  count: number;
  pct: number;
  bundleShas: string[]; // Which commit bundles discovered this pattern
  refactorType?: string; // auth, api, migration, etc. (extracted from context)
}




/* ---- File: src/facts/workingSnapshot.ts ---- */

import * as fs from 'fs';
import * as path from 'path';
import { SymbolExtractor } from '../analysis/symbols';
import { DependencyExtractor } from '../analysis/dependencies';
import { GitOperations } from '../analysis/git';
import { getGitRoot } from '../utils/config';
import { SymbolContext, EdgeContext } from '../contracts/llmContext';

export interface WorkingSnapshot {
  symbolsById: Map<string, SymbolContext>;
  symbolsByFile: Map<string, SymbolContext[]>;
  edges: EdgeContext[];
  analyzedPaths: Set<string>; // Track which paths were analyzed
}

/**
 * Get scoped working tree snapshot using real SymbolExtractor + DependencyExtractor
 */
export async function getWorkingSnapshot(scopePaths: Set<string>): Promise<WorkingSnapshot> {
  const gitRoot = getGitRoot();
  if (!gitRoot) {
    throw new Error('Not in a git repository');
  }

  const symbolsById = new Map<string, SymbolContext>();
  const symbolsByFile = new Map<string, SymbolContext[]>();
  const edges: EdgeContext[] = [];
  const analyzedPaths = new Set<string>();

  // Initialize analyzers
  const git = new GitOperations();
  const symbolExtractor = new SymbolExtractor(git);
  const dependencyExtractor = new DependencyExtractor();

  // Only analyze files in scope
  for (const filePath of scopePaths) {
    try {
      const fullPath = path.join(gitRoot, filePath);

      // Check if file exists
      if (!fs.existsSync(fullPath)) {
        console.log(`[WORKING-SNAPSHOT] Skipping non-existent path: ${filePath}`);
        continue;
      }

      // Check if it's a file (not a directory)
      const stat = fs.statSync(fullPath);
      if (!stat.isFile()) {
        console.log(`[WORKING-SNAPSHOT] Skipping non-file (directory or link): ${filePath}`);
        continue;
      }

      analyzedPaths.add(filePath);
      const content = fs.readFileSync(fullPath, 'utf8');

      // Extract symbols from current file using the same SymbolExtractor as commit analysis
      // CRITICAL: This MUST use the exact same extractor and ID format as commit analysis
      // to ensure semantic ID consistency (symbol.id format: `${filePath}:${semanticId}`)
      const symbols = await symbolExtractor.extractSymbolsFromContent(content, filePath);

      for (const symbol of symbols) {
        // Verify symbol ID format matches commit analysis format
        if (!symbol.id || !symbol.id.includes(':')) {
          console.warn(`Invalid symbol ID format in ${filePath}: ${symbol.id}. Expected format: path:semanticId`);
          continue;
        }

        const symbolContext: SymbolContext = {
          id: 0, // Placeholder for working snapshot (not from database)
          symbol_id: symbol.id, // This MUST match the symbol_id stored in database from commit analysis
          name: symbol.name,
          kind: symbol.kind,
          signature: symbol.signature,
          loc_pre: symbol.location ? {
            start: { line: symbol.location.start.line, column: symbol.location.start.column },
            end: { line: symbol.location.end.line, column: symbol.location.end.column }
          } : undefined
        };

        symbolsById.set(symbol.id, symbolContext);

        if (!symbolsByFile.has(filePath)) {
          symbolsByFile.set(filePath, []);
        }
        symbolsByFile.get(filePath)!.push(symbolContext);
      }

      // Extract edges from current file
      const fileEdges = dependencyExtractor.extractDependencies(content, filePath, symbols);
      edges.push(...fileEdges.map(edge => ({
        from_symbol_id: edge.from,
        to_symbol_id: edge.to,
        edge_type: edge.type,
        change_type: 'added' as any,
        confidence: edge.confidence || 1.0,
        is_resolved: edge.isResolved || true
      })));

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`[WORKING-SNAPSHOT] Skipped ${filePath}: ${errorMsg}`);
    }
  }

  return { symbolsById, symbolsByFile, edges, analyzedPaths };
}


