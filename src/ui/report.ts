import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { SymbolExtractor } from '../analysis/symbols';
import { DependencyExtractor } from '../analysis/dependencies';
import { RiskDetector } from '../analysis/heuristics';
import { GitOperations } from '../analysis/git';
import { getGitRoot } from '../utils/config';
import { SymbolContext, EdgeContext } from '../contracts/llmContext';

// Types for refactor bundle analysis
interface IntendedState {
  expect: 'present' | 'absent';
  lastName?: string;
  lastPath?: string;
  lastSig?: string;
  lastSha: string;
}

interface DriftFindings {
  missing_symbols: Array<{symbol_id: string, expected: IntendedState}>;
  zombie_symbols: Array<{symbol_id: string, expected: IntendedState, found: SymbolContext}>;
  divergent_symbols: Array<{symbol_id: string, expected: IntendedState, found: SymbolContext}>;
  missing_edges: Array<{from: string, to: string, type: string, expected: IntendedState}>;
  zombie_edges: Array<{from: string, to: string, type: string, found: EdgeContext}>;
  hotspots: Array<{path: string, drift_count: number}>;
}

interface WorkingSnapshot {
  symbolsById: Map<string, SymbolContext>;
  symbolsByFile: Map<string, SymbolContext[]>;
  edges: EdgeContext[];
  analyzedPaths: Set<string>; // Track which paths were analyzed
}

interface ScopeSet {
  commitFiles: Set<string>;        // Files touched by selected commits
  workingChanged: Set<string>;     // Files changed in working tree
  blastRadius: Set<string>;        // Neighbor files from dependency analysis
  allPaths: Set<string>;           // Union of all paths to analyze
}

/**
 * Compute scoped analysis set for refactor bundle
 */
async function computeScope(commitShas: string[]): Promise<ScopeSet> {
  const { getDatabaseManager, ensureDatabaseInitialized } = await import('../storage/database');
  const { GitOperations } = await import('../analysis/git');

  await ensureDatabaseInitialized();
  const db = getDatabaseManager().getDatabase();
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

  // 2. Files changed in working tree
  const workingChanges = git.getWorkingDirectoryChanges();
  workingChanges.forEach(f => scope.workingChanged.add(f.path));

  // 3. Blast-radius neighbors (top N by confidence)
  const blastRadiusFiles = await computeBlastRadiusNeighbors(commitShas, scope.commitFiles, 20); // Max 20 extra files
  blastRadiusFiles.forEach(f => scope.blastRadius.add(f));

  // Union all paths
  scope.allPaths = new Set([
    ...scope.commitFiles,
    ...scope.workingChanged,
    ...scope.blastRadius
  ]);

  return scope;
}

/**
 * Compute blast-radius neighbor files from commit metadata
 */
async function computeBlastRadiusNeighbors(
  commitShas: string[],
  commitFiles: Set<string>,
  maxNeighbors: number
): Promise<string[]> {
  const { getDatabaseManager } = await import('../storage/database');
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
 * Get scoped working tree snapshot
 */
async function getScopedWorkingTreeSnapshot(scopePaths: Set<string>): Promise<WorkingSnapshot> {
  const gitRoot = getGitRoot();
  if (!gitRoot) {
    throw new Error('Not in a git repository');
  }

  const symbolsById = new Map<string, SymbolContext>();
  const symbolsByFile = new Map<string, SymbolContext[]>();
  const edges: EdgeContext[] = [];
  const analyzedPaths = new Set<string>();

  // Initialize analyzers
  const dependencyExtractor = new DependencyExtractor();

  // Only analyze files in scope
  for (const filePath of scopePaths) {
    try {
      const fullPath = path.join(gitRoot, filePath);
      if (!fs.existsSync(fullPath)) continue;

      analyzedPaths.add(filePath);
      const content = fs.readFileSync(fullPath, 'utf8');

      // Extract symbols from current file
      const symbols = await extractSymbolsFromContent(content, filePath);

      for (const symbol of symbols) {
        const symbolContext: SymbolContext = {
          id: symbol.id,
          symbol_id: symbol.id,
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
      console.warn(`Failed to analyze scoped file ${filePath}:`, error);
    }
  }

  return { symbolsById, symbolsByFile, edges, analyzedPaths };
}

/**
 * Detect if widening is needed and compute additional paths
 */
function detectWideningNeeds(
  intended: Map<string, IntendedState>,
  working: WorkingSnapshot,
  commitShas: string[]
): { needsWidening: boolean; additionalPaths: Set<string> } {
  const additionalPaths = new Set<string>();

  // Check for missing symbols with known external callers
  for (const [symbolKey, expected] of intended) {
    if (expected.expect === 'present') {
      const found = working.symbolsById.get(symbolKey);
      if (!found) {
        // Check if this symbol has callers in commit metadata that aren't in our snapshot
        const hasExternalCallers = checkForExternalCallers(symbolKey, commitShas, working.analyzedPaths);
        if (hasExternalCallers) {
          // Add caller files to scope
          const callerFiles = getCallerFiles(symbolKey, commitShas);
          callerFiles.forEach(f => additionalPaths.add(f));
        }
      }
    }
  }

  // Check for zombie symbols with unknown destinations
  for (const [symbolKey, found] of working.symbolsById) {
    const expected = intended.get(symbolKey);
    if (!expected || expected.expect === 'absent') {
      // Check if this zombie has outbound edges to unknown symbols
      const hasUnknownDestinations = checkForUnknownDestinations(found.symbol_id, working, commitShas);
      if (hasUnknownDestinations) {
        const destFiles = getDestinationFiles(found.symbol_id, commitShas);
        destFiles.forEach(f => additionalPaths.add(f));
      }
    }
  }

  return {
    needsWidening: additionalPaths.size > 0,
    additionalPaths
  };
}

/**
 * Check if a symbol has callers outside the current scope
 */
function checkForExternalCallers(symbolId: string, commitShas: string[], analyzedPaths: Set<string>): boolean {
  // This would query the database for callers and check if their files are outside analyzedPaths
  // Simplified for now - would need database access
  return false;
}

/**
 * Get files containing callers of a symbol
 */
function getCallerFiles(symbolId: string, commitShas: string[]): string[] {
  // This would query database for caller files
  // Simplified for now
  return [];
}

/**
 * Check if a symbol has outbound edges to unknown destinations
 */
function checkForUnknownDestinations(symbolId: string, working: WorkingSnapshot, commitShas: string[]): boolean {
  // Check working edges for destinations not in analyzed paths
  for (const edge of working.edges) {
    if (edge.from_symbol_id === symbolId) {
      const destFile = extractFileFromSymbolId(edge.to_symbol_id);
      if (destFile && !working.analyzedPaths.has(destFile)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Get files containing destinations of a symbol's edges
 */
function getDestinationFiles(symbolId: string, commitShas: string[]): string[] {
  // This would query database for destination files
  // Simplified for now
  return [];
}


/**
 * Build intended refactor map by folding selected commits oldest → newest
 */
async function buildIntendedRefactorMap(commitShas: string[]): Promise<Map<string, IntendedState>> {
  const { getDatabaseManager } = await import('../storage/database');
  const db = getDatabaseManager().getDatabase();

  // Sort SHAs oldest → newest (reverse chronological order)
  const placeholders = commitShas.map(() => '?').join(',');
  const shaOrderStmt = db.prepare(`
    SELECT sha FROM commits
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

    // Load renames
    const renamesStmt = db.prepare(`
      SELECT symbol_id, name, change_type FROM symbols
      WHERE sha = ? AND change_type = 'renamed'
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

    // Process renames
    for (const rename of renames) {
      const key = rename.symbol_id;
      const prev = intended.get(key);
      intended.set(key, {
        ...(prev || { expect: 'present' as const }),
        expect: 'present',
        lastName: rename.name,
        lastSha: sha
      });
    }

    // Process removals
    for (const symbol of symbols) {
      if (symbol.change_type === 'removed') {
        const key = symbol.symbol_id || `${symbol.path}:${symbol.kind}:${symbol.name}`;
        intended.set(key, {
          expect: 'absent',
          lastSha: sha
        });
      }
    }
  }

  return intended;
}

/**
 * Compare intended refactor map against working tree snapshot
 */
function detectRefactorDrift(
  intended: Map<string, IntendedState>,
  working: WorkingSnapshot
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
      if (found) {
        findings.zombie_symbols.push({ symbol_id: symbolKey, expected, found });
      }
    }
  }

  // Check for symbols in working tree that weren't in intended (zombies)
  for (const [symbolKey, found] of working.symbolsById) {
    if (!intended.has(symbolKey)) {
      findings.zombie_symbols.push({
        symbol_id: symbolKey,
        expected: { expect: 'absent', lastSha: 'unknown' },
        found
      });
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

  return findings;
}

/**
 * Generate refactor bundle analysis report with scoped working tree analysis
 */
export async function generateRefactorBundleReport(commitShas: string[]): Promise<void> {
  try {
    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Analyzing refactor bundle...',
      cancellable: false
    }, async (progress) => {
      progress.report({ increment: 0, message: 'Computing analysis scope...' });

      // Phase 1: Compute scoped analysis set
      const scope = await computeScope(commitShas);

      progress.report({ increment: 10, message: `Analyzing ${scope.allPaths.size} scoped files...` });

      // Phase 2A: Get scoped working tree snapshot
      let working = await getScopedWorkingTreeSnapshot(scope.allPaths);

      progress.report({ increment: 30, message: 'Building intended refactor map...' });

      // Build intended refactor map
      const intended = await buildIntendedRefactorMap(commitShas);

      progress.report({ increment: 50, message: 'Detecting drift...' });

      // Detect drift
      let drift = detectRefactorDrift(intended, working);

      // Phase 2B: Lazy widening if needed
      let widening = { needsWidening: false, additionalPaths: new Set<string>() };
      widening = detectWideningNeeds(intended, working, commitShas);
      if (widening.needsWidening && scope.allPaths.size < 100) { // Hard limit to prevent explosion
        progress.report({ increment: 70, message: `Widening scope to ${widening.additionalPaths.size} additional files...` });

        // Add new paths to scope
        widening.additionalPaths.forEach(p => scope.allPaths.add(p));

        // Re-analyze with widened scope
        working = await getScopedWorkingTreeSnapshot(scope.allPaths);
        drift = detectRefactorDrift(intended, working);
      }

      progress.report({ increment: 90, message: 'Generating report...' });

      // Generate markdown report
      let markdown = `# Refactor Bundle Analysis Report\n\n`;
      markdown += `Generated: ${new Date().toLocaleString()}\n\n`;
      markdown += `Analyzing ${commitShas.length} commits as refactor bundle vs scoped working tree.\n\n`;

      // Analysis Scope
      markdown += `## 🎯 Analysis Scope\n\n`;
      markdown += `- **Commit Files:** ${scope.commitFiles.size} files touched by selected commits\n`;
      markdown += `- **Working Changes:** ${scope.workingChanged.size} files changed in working tree\n`;
      markdown += `- **Blast Radius:** ${scope.blastRadius.size} additional neighbor files\n`;
      markdown += `- **Total Analyzed:** ${scope.allPaths.size} files (widened: ${widening?.needsWidening ? 'yes' : 'no'})\n\n`;

      // Bundle Summary
      markdown += `## 🔄 Refactor Bundle Summary\n\n`;
      markdown += `- **Selected Commits:** ${commitShas.length}\n`;
      markdown += `- **Intended Changes:** ${intended.size} symbols\n`;
      markdown += `- **Scoped Working Tree:** ${working.symbolsById.size} symbols, ${working.edges.length} edges\n\n`;

      // Incompleteness
      markdown += `## ❌ Incompleteness\n\n`;

      if (drift.missing_symbols.length > 0) {
        markdown += `### Missing Additions (${drift.missing_symbols.length})\n\n`;
        for (const missing of drift.missing_symbols.slice(0, 10)) {
          markdown += `- \`${missing.symbol_id}\` (expected in ${missing.expected.lastSha?.substring(0, 8)})\n`;
        }
        if (drift.missing_symbols.length > 10) markdown += `- ... and ${drift.missing_symbols.length - 10} more\n`;
        markdown += `\n`;
      }

      if (drift.zombie_symbols.length > 0) {
        markdown += `### Zombie Removals (${drift.zombie_symbols.length})\n\n`;
        for (const zombie of drift.zombie_symbols.slice(0, 10)) {
          markdown += `- \`${zombie.symbol_id}\` still exists but was removed in ${zombie.expected.lastSha?.substring(0, 8)}\n`;
        }
        if (drift.zombie_symbols.length > 10) markdown += `- ... and ${drift.zombie_symbols.length - 10} more\n`;
        markdown += `\n`;
      }

      if (drift.divergent_symbols.length > 0) {
        markdown += `### Divergent Modifications (${drift.divergent_symbols.length})\n\n`;
        for (const divergent of drift.divergent_symbols.slice(0, 10)) {
          markdown += `- \`${divergent.symbol_id}\` modified but current name differs from expected "${divergent.expected.lastName}"\n`;
        }
        if (drift.divergent_symbols.length > 10) markdown += `- ... and ${drift.divergent_symbols.length - 10} more\n`;
        markdown += `\n`;
      }

      // Pattern Drift
      markdown += `## 🔀 Pattern Drift\n\n`;
      markdown += `Analysis of incomplete migrations and mixed patterns...\n\n`;

      // Hotspots
      if (drift.hotspots.length > 0) {
        markdown += `### Drift Hotspots\n\n`;
        for (const hotspot of drift.hotspots.slice(0, 5)) {
          markdown += `- **${hotspot.path}:** ${hotspot.drift_count} inconsistencies\n`;
        }
        markdown += `\n`;
      }

      // Recommendations
      markdown += `## 🎯 Recommendations\n\n`;
      if (drift.missing_symbols.length > 0) {
        markdown += `- **Complete additions:** ${drift.missing_symbols.length} symbols still need to be added\n`;
      }
      if (drift.zombie_symbols.length > 0) {
        markdown += `- **Remove zombies:** ${drift.zombie_symbols.length} symbols should be deleted\n`;
      }
      if (drift.divergent_symbols.length > 0) {
        markdown += `- **Fix divergences:** ${drift.divergent_symbols.length} symbols have inconsistent implementations\n`;
      }
      markdown += `- **Test thoroughly:** This refactor appears incomplete and may have runtime issues\n\n`;

      // Create document
      const doc = await vscode.workspace.openTextDocument({
        content: markdown,
        language: 'markdown'
      });
      await vscode.window.showTextDocument(doc, { preview: false });

      vscode.window.showInformationMessage(`Refactor bundle analysis complete`);
    });

  } catch (error) {
    vscode.window.showErrorMessage(`Failed to generate refactor bundle report: ${error}`);
    console.error('Refactor bundle analysis error:', error);
  }
}

/**
 * Extract symbols from file content (simplified version for working tree analysis)
 */
async function extractSymbolsFromContent(content: string, filePath: string): Promise<any[]> {
  const { getTreeSitterParser, detectLanguage } = await import('../analysis/tree-sitter');
  const parser = getTreeSitterParser();
  const language = detectLanguage(filePath);

  if (!language) return [];

  try {
    const tree = await parser.parse(content, language);
    const symbols: any[] = [];

    // Simple symbol extraction (functions, classes, etc.)
    function walkTree(node: any, depth = 0) {
      if (depth > 10) return; // Prevent infinite recursion

      // Extract function definitions
      if (node.type === 'function_declaration' || node.type === 'method_definition' ||
          node.type === 'function_expression' || node.type === 'arrow_function') {
        const nameNode = node.childForFieldName?.('name') || node.childForFieldName?.('identifier');
        if (nameNode) {
          const name = content.substring(nameNode.startIndex, nameNode.endIndex);
          const id = `${filePath}:${name}`;
          symbols.push({
            id,
            name,
            kind: 'function',
            signature: name,
            location: {
              start: { line: nameNode.startPosition.row + 1, column: nameNode.startPosition.column },
              end: { line: nameNode.endPosition.row + 1, column: nameNode.endPosition.column }
            }
          });
        }
      }

      // Extract class definitions
      if (node.type === 'class_declaration') {
        const nameNode = node.childForFieldName?.('name');
        if (nameNode) {
          const name = content.substring(nameNode.startIndex, nameNode.endIndex);
          const id = `${filePath}:${name}`;
          symbols.push({
            id,
            name,
            kind: 'class',
            signature: `class ${name}`,
            location: {
              start: { line: nameNode.startPosition.row + 1, column: nameNode.startPosition.column },
              end: { line: nameNode.endPosition.row + 1, column: nameNode.endPosition.column }
            }
          });
        }
      }

      // Recurse on children
      for (let i = 0; i < node.childCount; i++) {
        walkTree(node.child(i), depth + 1);
      }
    }

    if (tree?.rootNode) {
      walkTree(tree.rootNode);
    }

    return symbols;
  } catch (error) {
    console.warn(`Failed to parse ${filePath}:`, error);
    return [];
  }
}

function shouldAnalyzeFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ['.ts', '.js', '.tsx', '.jsx', '.php', '.py', '.java', '.go', '.rs', '.cpp', '.c', '.cs'].includes(ext);
}

export async function generateCommitReport(commitShas?: string[]): Promise<void> {
    try {
        const { getDatabaseManager, ensureDatabaseInitialized } = await import('../storage/database');
        await ensureDatabaseInitialized();
        const db = getDatabaseManager().getDatabase();

        // Fetch commits
        let commits: any[];

        if (commitShas && commitShas.length > 0) {
            // Generate report for specific commits
            const placeholders = commitShas.map(() => '?').join(',');
            const commitsStmt = db.prepare(`
            SELECT sha, author, date, message, summary_md, files_changed,
    symbols_added, symbols_modified, symbols_removed, risks
            FROM commits
            WHERE sha IN(${placeholders})
            ORDER BY date DESC
    `);
            commits = commitsStmt.all(...commitShas) as any[];
        } else {
            // Fetch all commits
            const commitsStmt = db.prepare(`
            SELECT sha, author, date, message, summary_md, files_changed,
    symbols_added, symbols_modified, symbols_removed, risks
            FROM commits
            ORDER BY date DESC
            LIMIT 20
          `);
            commits = commitsStmt.all() as any[];
        }

        if (commits.length === 0) {
            vscode.window.showInformationMessage('No commits analyzed yet. Run "Analyze Last N Commits" first.');
            return;
        }

        // Build markdown report
        let markdown = `# Git Commit Analysis Report\n\n`;
        markdown += `Generated: ${new Date().toLocaleString()} \n\n`;
        if (commitShas && commitShas.length > 0) {
            markdown += `Report for ${commits.length} selected commit${commits.length > 1 ? 's' : ''} \n\n`;
        } else {
            markdown += `Total commits analyzed: ${commits.length} \n\n`;
        }
        markdown += `-- -\n\n`;

        for (const commit of commits) {
            const shortSha = commit.sha.substring(0, 8);
            const risks = JSON.parse(commit.risks || '[]');

            markdown += `## 📝 ${shortSha} - ${commit.message.split('\n')[0]} \n\n`;
            markdown += `** Author:** ${commit.author} \n`;
            markdown += `** Date:** ${commit.date} \n`;
            markdown += `** Files Changed:** ${commit.files_changed} \n`;
            markdown += `** Symbols:** +${commit.symbols_added} ~${commit.symbols_modified} -${commit.symbols_removed} \n\n`;

            // Add risks if any
            if (risks.length > 0) {
                markdown += `### ⚠️ Risks\n\n`;
                for (const risk of risks) {
                    markdown += `- ${risk} \n`;
                }
                markdown += `\n`;
            }

            // Add AI summary if available
            if (commit.summary_md) {
                markdown += `### Summary\n\n${commit.summary_md} \n\n`;
            }

            // Fetch and display symbols
            if (commit.symbols_added > 0) {
                const symbolsStmt = db.prepare(`
          SELECT name, kind, path, symbol_id FROM symbols
          WHERE sha = ? AND change_type = 'added'
          ORDER BY kind, name
    `);
                const symbols = symbolsStmt.all(commit.sha) as any[];

                if (symbols.length > 0) {
                    markdown += `### ➕ Added Symbols(${symbols.length}) \n\n`;
                    const grouped = groupByKind(symbols);
                    for (const [kind, items] of Object.entries(grouped)) {
                        markdown += `** ${kind}:**\n`;
                        for (const item of items) {
                            markdown += `- \`${item.name}\` (${item.path})\n`;

                            // Show what this new symbol calls
                            const callsStmt = db.prepare(`
                SELECT to_symbol_id, edge_type FROM edges
                WHERE sha = ? AND from_symbol_id = ? AND change_type = 'added'
                LIMIT 5
              `);
                            const calls = callsStmt.all(commit.sha, item.symbol_id) as any[];
                            if (calls.length > 0) {
                                markdown += `  - Calls: ${calls.map(c => `\`${extractSymbolName(c.to_symbol_id)}\``).join(', ')}${calls.length === 5 ? '...' : ''}\n`;
                            }
                        }
                        markdown += `\n`;
                    }
                }
            }

            if (commit.symbols_modified > 0) {
                const symbolsStmt = db.prepare(`
          SELECT name, kind, path, symbol_id FROM symbols
          WHERE sha = ? AND change_type IN ('modified', 'signature_changed')
          ORDER BY kind, name
        `);
                const symbols = symbolsStmt.all(commit.sha) as any[];

                if (symbols.length > 0) {
                    markdown += `### ✏️ Modified Symbols (${symbols.length})\n\n`;
                    const grouped = groupByKind(symbols);
                    for (const [kind, items] of Object.entries(grouped)) {
                        markdown += `**${kind}:**\n`;
                        for (const item of items) {
                            markdown += `- \`${item.name}\` (${item.path})\n`;
                        }
                        markdown += `\n`;
                    }
                }
            }

            if (commit.symbols_removed > 0) {
                const symbolsStmt = db.prepare(`
          SELECT name, kind, path, symbol_id FROM symbols
          WHERE sha = ? AND change_type = 'removed'
          ORDER BY kind, name
        `);
                const symbols = symbolsStmt.all(commit.sha) as any[];

                if (symbols.length > 0) {
                    markdown += `### ➖ Removed Symbols (${symbols.length})\n\n`;
                    const grouped = groupByKind(symbols);
                    for (const [kind, items] of Object.entries(grouped)) {
                        markdown += `**${kind}:**\n`;
                        for (const item of items) {
                            markdown += `- \`${item.name}\` (${item.path})\n`;

                            // Show what used to call this removed symbol
                            const calledByStmt = db.prepare(`
                SELECT from_symbol_id, edge_type FROM edges
                WHERE sha = ? AND to_symbol_id = ? AND change_type = 'removed'
                LIMIT 5
              `);
                            const calledBy = calledByStmt.all(commit.sha, item.symbol_id) as any[];
                            if (calledBy.length > 0) {
                                markdown += `  - Was called by: ${calledBy.map(c => `\`${extractSymbolName(c.from_symbol_id)}\``).join(', ')}${calledBy.length === 5 ? '...' : ''}\n`;
                            }
                        }
                        markdown += `\n`;
                    }
                }
            }

            // Add dependency graph section
            const edgesStmt = db.prepare(`
        SELECT COUNT(*) as count FROM edges WHERE sha = ?
      `);
            const edgeCount = edgesStmt.get(commit.sha) as any;

            if (edgeCount && edgeCount.count > 0) {
                markdown += `### 🔗 Function Call Graph (${edgeCount.count} connections)\n\n`;
                markdown += `This commit creates ${edgeCount.count} new function call relationships.\n\n`;

                // Show top call patterns
                const topCallersStmt = db.prepare(`
          SELECT from_symbol_id, COUNT(*) as call_count
          FROM edges
          WHERE sha = ? AND change_type = 'added'
          GROUP BY from_symbol_id
          ORDER BY call_count DESC
          LIMIT 5
        `);
                const topCallers = topCallersStmt.all(commit.sha) as any[];

                if (topCallers.length > 0) {
                    markdown += `**Most Connected New Functions:**\n`;
                    for (const caller of topCallers) {
                        const symbolName = extractSymbolName(caller.from_symbol_id);
                        markdown += `- \`${symbolName}\` makes ${caller.call_count} calls\n`;

                        // Show what it calls
                        const callsStmt = db.prepare(`
              SELECT to_symbol_id FROM edges
              WHERE sha = ? AND from_symbol_id = ? AND change_type = 'added'
              LIMIT 3
            `);
                        const calls = callsStmt.all(commit.sha, caller.from_symbol_id) as any[];
                        if (calls.length > 0) {
                            markdown += `  → ${calls.map(c => `\`${extractSymbolName(c.to_symbol_id)}\``).join(', ')}${calls.length === 3 ? '...' : ''}\n`;
                        }
                    }
                    markdown += `\n`;
                }
            }

            markdown += `---\n\n`;
        }

        // Create and show document
        const { getGitRoot } = await import('../utils/config');
        const gitRoot = getGitRoot();

        if (gitRoot) {
            // Save to .git/commit-tracker/report.md
            const fs = require('fs');
            const path = require('path');
            const reportDir = path.join(gitRoot, '.git', 'commit-tracker');
            const reportPath = path.join(reportDir, 'commit-report.md');

            // Ensure directory exists
            if (!fs.existsSync(reportDir)) {
                fs.mkdirSync(reportDir, { recursive: true });
            }

            // Write file
            fs.writeFileSync(reportPath, markdown, 'utf8');

            // Open the file
            const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(reportPath));
            await vscode.window.showTextDocument(doc, { preview: false });

            vscode.window.showInformationMessage(`Report saved to ${reportPath}`);
        } else {
            // Fallback to untitled document if not in git repo
            const doc = await vscode.workspace.openTextDocument({
                content: markdown,
                language: 'markdown'
            });
            await vscode.window.showTextDocument(doc, { preview: false });
        }

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to generate report: ${error}`);
        console.error('Report generation error:', error);
    }
}

function groupByKind(symbols: any[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};
    for (const symbol of symbols) {
        if (!grouped[symbol.kind]) {
            grouped[symbol.kind] = [];
        }
        grouped[symbol.kind].push(symbol);
    }
    return grouped;
}

function extractSymbolName(symbolId: string): string {
    // symbol_id format is typically "path:class_name" or "path:function_name"
    const parts = symbolId.split(':');
    if (parts.length > 1) {
        return parts[parts.length - 1].replace(/^(class_|function_)/, '');
    }
    return symbolId;
}
