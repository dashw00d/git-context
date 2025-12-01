import * as fs from 'fs';
import * as path from 'path';
import { DependencyExtractor } from '../analysis/dependencies';
import { GitOperations } from '../analysis/git';
import { SymbolExtractor } from '../analysis/symbols';
import { EdgeContext, SymbolContext } from '../contracts/llmContext';
import { getGitRoot } from '../utils/config';
import { logError, logInfo, logWarn } from '../utils/logger';

export interface WorkingSnapshot {
  symbolsById: Map<string, SymbolContext>;
  symbolsByFile: Map<string, SymbolContext[]>;
  edges: EdgeContext[];
  analyzedPaths: Set<string>; // Track which paths were analyzed
}

/**
 * Get scoped working tree snapshot using real SymbolExtractor + DependencyExtractor
 */
export async function getWorkingSnapshot(
  scopePaths: Set<string>,
  liveOverrides?: Map<string, string>
): Promise<WorkingSnapshot> {
  const gitRoot = getGitRoot();
  if (!gitRoot) {
    logError('Not in a git repository');
    return {
      symbolsById: new Map(),
      symbolsByFile: new Map(),
      edges: [],
      analyzedPaths: new Set(),
    }; // Return empty snapshot instead of throwing
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
        logInfo(`Skipping non-existent path: ${filePath}`);
        continue;
      }

      // Check if it's a file (not a directory)
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

      // Extract symbols from current file using the same SymbolExtractor as commit analysis
      // CRITICAL: This MUST use the exact same extractor and ID format as commit analysis
      // to ensure semantic ID consistency (symbol.id format: `${filePath}:${semanticId}`)
      const symbols = await symbolExtractor.extractSymbolsFromContent(content, filePath);

      for (const symbol of symbols) {
        // Verify symbol ID format matches commit analysis format
        if (!symbol.id || !symbol.id.includes(':')) {
          logWarn(
            `Invalid symbol ID format in ${filePath}: ${symbol.id}. Expected format: path:semanticId`
          );
          continue;
        }

        const symbolContext: SymbolContext = {
          id: 0, // Placeholder for working snapshot (not from database)
          symbol_id: symbol.id, // This MUST match the symbol_id stored in database from commit analysis
          name: symbol.name,
          kind: symbol.kind,
          signature: symbol.signature,
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

      // Extract edges from current file
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
    }
  }

  return { symbolsById, symbolsByFile, edges, analyzedPaths };
}
