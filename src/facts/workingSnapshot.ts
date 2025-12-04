import * as fs from 'fs';
import * as path from 'path';
import { DependencyExtractor } from '../analysis/dependencies';
import { GitOperations } from '../analysis/git';
import { SymbolExtractor } from '../analysis/symbols';
import { EdgeContext, SymbolContext } from '../contracts/llmContext';
import { getGitRoot } from '../utils/config';
import { logError, logInfo, logWarn, logDebug } from '../utils/logger';

export interface WorkingSnapshot {
  symbolsById: Map<string, SymbolContext>;
  symbolsByFile: Map<string, SymbolContext[]>;
  edges: EdgeContext[];
  analyzedPaths: Set<string>;
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

  for (const filePath of scopePaths) {
    try {
      const fullPath = path.join(gitRoot, filePath);

      if (!fs.existsSync(fullPath)) {
        logInfo(`Skipping non-existent path: ${filePath} (full: ${fullPath})`);
        continue;
      }

      const stat = fs.statSync(fullPath);
      if (!stat.isFile()) {
        logInfo(`Skipping non-file (directory or link): ${filePath}`);
        continue;
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
      // Assign DNA IDs to symbols
      const bodyTexts = new Map([[filePath, content]]);
      const { assignDNAIds } = await import('../analysis/symbolDna');
      const { detectLanguage } = await import('../utils/config');
      const language = detectLanguage(filePath);
      const symbolsWithDNA = await assignDNAIds(symbols, bodyTexts, language || undefined);

      for (const symbol of symbolsWithDNA) {
        if (!symbol.id) {
          logWarn(`Invalid symbol: missing DNA ID in ${filePath}: ${symbol.name}`);
          continue;
        }

        const symbolContext: SymbolContext = {
          id: 0, // Placeholder for working snapshot (not from database)
          symbol_id: symbol.id, // id is now the DNA hash
          name: symbol.name,
          kind: symbol.kind,
          signature: symbol.signature,
          dnaId: symbol.id, // Keep for compatibility
          filePath: symbol.filePath, // Store file path
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

      const fileEdges = dependencyExtractor.extractDependencies(content, filePath, symbols);
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
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logWarn(`Skipped ${filePath}: ${errorMsg}`);
      logError(`[WorkingSnapshot] Error processing ${filePath}`, error);
    }
  }

  return { symbolsById, symbolsByFile, edges, analyzedPaths };
}
