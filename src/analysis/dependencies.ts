import { SymbolInfo, EdgeInfo, FileChange } from '../types';
import { detectLanguage, isJSLanguage, isPHPLanguage } from '../utils/config';
import { GitOperations } from './git';
import { getDefaultThreshold } from '../utils/edgeThresholds';

export class DependencyExtractor {
  private readonly MAX_DEPTH = 3; // Prevent infinite recursion
  private resolvedSymbols = new Map<string, boolean>(); // Cache resolved symbols

  /**
   * Extract dependency edges from file content with confidence scoring
   */
  extractDependencies(content: string, filePath: string, symbols: SymbolInfo[], depth: number = 0): EdgeInfo[] {
    // Prevent stack overflow from deep recursion
    if (depth > this.MAX_DEPTH) {
      console.warn(`Max recursion depth reached for ${filePath}`);
      return [];
    }

    const language = detectLanguage(filePath);
    if (!language) {
      return [];
    }

    const edges: EdgeInfo[] = [];

    // Extract imports/requires with high confidence
    const importEdges = this.extractImports(content, filePath, language, symbols);
    edges.push(...importEdges);

    // Extract function calls within symbols
    for (const symbol of symbols) {
      const callEdges = this.extractCallsFromSymbol(content, filePath, symbol, language, symbols);
      edges.push(...callEdges);
    }

    // Mark resolved edges
    for (const edge of edges) {
      edge.confidence = edge.confidence ?? this.calculateEdgeConfidence(edge, symbols);
      edge.isResolved = this.isEdgeResolved(edge);
    }

    return edges;
  }

  /**
   * Extract import/require edges from file content with confidence
   */
  private extractImports(content: string, filePath: string, language: string, knownSymbols: SymbolInfo[]): EdgeInfo[] {
    const edges: EdgeInfo[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (isPHPLanguage(language)) {
        // PHP imports: use, require, include
        const useMatch = line.match(/^use\s+([^;]+);/);
        if (useMatch) {
          const imported = useMatch[1].split('\\').pop() || useMatch[1];
          edges.push({
            from: `${filePath}: file`,
            to: `class_${imported} `,
            type: 'imports',
            confidence: this.isSymbolKnown(`class_${imported} `, knownSymbols) ? 0.9 : 0.6,
            isResolved: this.isSymbolKnown(`class_${imported} `, knownSymbols)
          });
        }

        const requireMatch = line.match(/(require|include)(_once)?\s*\(\s*['"]([^'"]+)['"]\s*\)/);
        if (requireMatch) {
          const requiredFile = requireMatch[3];
          edges.push({
            from: `${filePath}: file`,
            to: `${requiredFile}: file`,
            type: 'imports',
            confidence: 0.8, // File imports are usually reliable
            isResolved: true
          });
        }
      }

      if (isJSLanguage(language)) {
        // JS/TS imports
        const importMatch = line.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/);
        if (importMatch) {
          const importedModule = importMatch[1];
          edges.push({
            from: `${filePath}: file`,
            to: `${importedModule}: module`,
            type: 'imports',
            confidence: 0.9, // ES6 imports are usually reliable
            isResolved: true
          });
        }

        // CommonJS requires
        const requireMatch = line.match(/const\s+\w+\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
        if (requireMatch) {
          const requiredModule = requireMatch[1];
          edges.push({
            from: `${filePath}: file`,
            to: `${requiredModule}: module`,
            type: 'imports',
            confidence: 0.8, // CommonJS requires are reliable
            isResolved: true
          });
        }
      }
    }

    return edges;
  }

  /**
   * Extract function calls from a symbol's content with confidence
   */
  private extractCallsFromSymbol(
    content: string,
    filePath: string,
    symbol: SymbolInfo,
    language: string,
    knownSymbols: SymbolInfo[]
  ): EdgeInfo[] {
    const edges: EdgeInfo[] = [];

    // Extract the symbol's code block
    const lines = content.split('\n');
    const startLine = symbol.location.start.line - 1; // Convert to 0-based
    const endLine = symbol.location.end.line - 1;

    const symbolContent = lines.slice(startLine, endLine + 1).join('\n');

    // Extract calls based on language
    if (isPHPLanguage(language)) {
      const callMatches = symbolContent.matchAll(/(\w+)\s*\(/g);
      for (const match of callMatches) {
        const calledFunction = match[1];
        // Skip common PHP constructs
        if (!['if', 'while', 'for', 'foreach', 'echo', 'print', 'isset', 'empty'].includes(calledFunction)) {
          const targetId = `function_${calledFunction} `;
          edges.push({
            from: symbol.id,
            to: targetId,
            type: 'calls',
            confidence: this.isSymbolKnown(targetId, knownSymbols) ? 0.8 : 0.4,
            isResolved: this.isSymbolKnown(targetId, knownSymbols)
          });
        }
      }

      // Extract method calls ($obj->method())
      const methodMatches = symbolContent.matchAll(/\$(\w+)\s*->\s*(\w+)\s*\(/g);
      for (const match of methodMatches) {
        const variable = match[1];
        const method = match[2];
        // Add edge for method call
        edges.push({
          from: symbol.id,
          to: `method_${method} `,
          type: 'calls'
        });
        // Also track variable-to-object relationship if variable represents an object
        // This helps track object dependencies
        if (variable && variable.length > 0) {
          edges.push({
            from: symbol.id,
            to: `variable_${variable}`,
            type: 'uses'
          });
        }
      }
    }

    if (isJSLanguage(language)) {
      // Extract function calls
      const callMatches = symbolContent.matchAll(/(\w+)\s*\(/g);
      for (const match of callMatches) {
        const calledFunction = match[1];
        // Skip common JS constructs and keywords
        if (!['if', 'while', 'for', 'console', 'setTimeout', 'setInterval', 'Promise', 'Array', 'Object', 'String'].includes(calledFunction)) {
          edges.push({
            from: symbol.id,
            to: `function_${calledFunction} `,
            type: 'calls'
          });
        }
      }

      // Extract method calls (obj.method())
      const methodMatches = symbolContent.matchAll(/(\w+)\.(\w+)\s*\(/g);
      for (const match of methodMatches) {
        const object = match[1];
        const method = match[2];
        // Add edge for method call
        edges.push({
          from: symbol.id,
          to: `method_${method} `,
          type: 'calls'
        });
        // Also track object dependency
        // This helps build a more complete dependency graph
        if (object && object.length > 0 && !['this', 'self', 'super'].includes(object.toLowerCase())) {
          edges.push({
            from: symbol.id,
            to: `object_${object}`,
            type: 'uses'
          });
        }
      }
    }

    return edges;
  }

  /**
   * Compare two sets of edges and determine changes
   */
  compareEdges(previous: EdgeInfo[], current: EdgeInfo[]): {
    added: EdgeInfo[];
    removed: EdgeInfo[];
  } {
    const added: EdgeInfo[] = [];
    const removed: EdgeInfo[] = [];

    // Create maps for efficient lookup
    const previousMap = new Map(previous.map(e => [`${e.from}:${e.to}:${e.type} `, e]));
    const currentMap = new Map(current.map(e => [`${e.from}:${e.to}:${e.type} `, e]));

    // Find added edges
    for (const edge of current) {
      const key = `${edge.from}:${edge.to}:${edge.type} `;
      if (!previousMap.has(key)) {
        added.push(edge);
      }
    }

    // Find removed edges
    for (const edge of previous) {
      const key = `${edge.from}:${edge.to}:${edge.type} `;
      if (!currentMap.has(key)) {
        removed.push(edge);
      }
    }

    return { added, removed };
  }

  /**
   * Extract edges from working tree files
   */
  async extractWorkingTreeEdges(files: FileChange[], symbols: { added: SymbolInfo[]; removed: SymbolInfo[]; modified: any[] }, git: any): Promise<{
    added: EdgeInfo[];
    removed: EdgeInfo[];
  }> {
    const currentEdges: EdgeInfo[] = [];

    // Group symbols by file path
    const symbolsByFile = new Map<string, SymbolInfo[]>();
    for (const symbol of [...symbols.added, ...symbols.modified.map(m => m.symbol)]) {
      const filePath = symbol.id.split(':')[0];
      if (!symbolsByFile.has(filePath)) {
        symbolsByFile.set(filePath, []);
      }
      symbolsByFile.get(filePath)!.push(symbol);
    }

    // Extract edges from each file
    for (const [filePath, fileSymbols] of symbolsByFile) {
      try {
        // Get current working content
        const isStaged = files.some(f => f.path === filePath && f.status !== 'U');
        const content = isStaged
          ? git.safeGetStagedContent(filePath)
          : git.safeGetWorkingContent(filePath);

        if (content) {
          const edges = this.extractDependencies(content, filePath, fileSymbols);
          currentEdges.push(...edges);
        }
      } catch (error) {
        console.warn(`Failed to extract edges from working tree file ${filePath}:`, error);
      }
    }

    // For working tree, we consider all edges as "added" since we're comparing against HEAD
    return {
      added: currentEdges,
      removed: []
    };
  }

  /**
   * Extract edges for an entire commit
   */
  async extractCommitEdges(
    sha: string,
    symbols: { added: SymbolInfo[]; removed: SymbolInfo[]; modified: any[] },
    fileContents: Map<string, string>,
    files: FileChange[],
    git: GitOperations
  ): Promise<{
    added: EdgeInfo[];
    removed: EdgeInfo[];
  }> {
    const currentEdges: EdgeInfo[] = [];
    const previousEdges: EdgeInfo[] = [];

    // Process current symbols
    for (const [filePath, content] of fileContents) {
      const fileSymbols = symbols.added.filter(s => s.id.startsWith(`${filePath}: `));
      // Also include modified symbols in current analysis
      const modifiedSymbols = symbols.modified.map(m => m.symbol).filter(s => s.id.startsWith(`${filePath}: `));
      const allFileSymbols = [...fileSymbols, ...modifiedSymbols];

      const edges = this.extractDependencies(content, filePath, allFileSymbols);
      currentEdges.push(...edges);
    }

    // For modified files, we need to compare with previous versions
    const modifiedFiles = new Set(symbols.modified.map(m => m.symbol.id.split(':')[0]));

    // Also check for files that might have edges removed but no symbol changes
    // Ideally we should check all modified files in the commit, but we only have symbol info here
    // We'll rely on the passed fileContents which should contain all modified files

    for (const filePath of modifiedFiles) {
      try {
        const commitInfo = await git.getCommitInfo(sha);
        if (commitInfo.parent) {
          // Determine correct path for parent commit (handle renames)
          const fileChange = files.find(f => f.path === filePath);
          const parentPath = (fileChange?.status === 'R' && fileChange.oldPath)
            ? fileChange.oldPath
            : filePath;

          // Get previous content safely
          const previousContent = await git.safeGetFileContent(commitInfo.parent, parentPath);

          // Get previous symbols (we need to reconstruct or fetch them)
          // For now, we'll use the previousSymbol from modified deltas
          const previousFileSymbols = symbols.modified
            .filter(m => m.symbol.id.startsWith(`${filePath}: `) && m.previousSymbol)
            .map(m => m.previousSymbol!);

          // Extract previous edges
          const edges = this.extractDependencies(previousContent, filePath, previousFileSymbols);
          previousEdges.push(...edges);
        }
      } catch (error) {
        console.warn(`Failed to extract previous edges for ${filePath}: `, error);
      }
    }

    // Compare edges
    const changes = this.compareEdges(previousEdges, currentEdges);

    return {
      added: changes.added,
      removed: changes.removed
    };
  }

  /**
   * Calculate graph metrics
   */
  calculateMetrics(edges: EdgeInfo[]): {
    fanIn: Map<string, number>;
    fanOut: Map<string, number>;
  } {
    const fanIn = new Map<string, number>();
    const fanOut = new Map<string, number>();

    for (const edge of edges) {
      // Increment fan-in for the target
      fanIn.set(edge.to, (fanIn.get(edge.to) || 0) + 1);

      // Increment fan-out for the source
      fanOut.set(edge.from, (fanOut.get(edge.from) || 0) + 1);
    }

    return { fanIn, fanOut };
  }

  /**
   * Calculate blast radius for changed symbols
   */
  calculateBlastRadius(changedSymbols: SymbolInfo[], allEdges: EdgeInfo[]): {
    downstreamCallers: Map<string, SymbolInfo[]>;
    upstreamDependencies: Map<string, SymbolInfo[]>;
    impactScore: Map<string, number>;
  } {
    const downstreamCallers = new Map<string, SymbolInfo[]>();
    const upstreamDependencies = new Map<string, SymbolInfo[]>();
    const impactScore = new Map<string, number>();

    // Get symbol IDs that changed
    const changedIds = new Set(changedSymbols.map(s => s.id));

    // Find downstream callers (who calls the changed symbols)
    for (const edge of allEdges) {
      if (changedIds.has(edge.to)) {
        // edge.from calls edge.to (which changed)
        const callers = downstreamCallers.get(edge.to) || [];
        // Store the caller's ID even if we can't resolve the full symbol info
        // We create a placeholder SymbolInfo with just the ID
        if (!callers.some(c => c.id === edge.from)) {
          callers.push({ id: edge.from, name: edge.from.split(':').pop() || edge.from, kind: 'variable', location: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } }, signature: '' } as SymbolInfo);
          downstreamCallers.set(edge.to, callers);
        }
      }
    }

    // Find upstream dependencies (what the changed symbols call)
    for (const edge of allEdges) {
      if (changedIds.has(edge.from)) {
        // edge.from (which changed) calls edge.to
        const dependencies = upstreamDependencies.get(edge.from) || [];
        if (!dependencies.some(d => d.id === edge.to)) {
          dependencies.push({ id: edge.to, name: edge.to.split(':').pop() || edge.to, kind: 'variable', location: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } }, signature: '' } as SymbolInfo);
          upstreamDependencies.set(edge.from, dependencies);
        }
      }
    }

    // Calculate impact scores (simple metric)
    for (const symbolId of changedIds) {
      const downstreamCount = downstreamCallers.get(symbolId)?.length || 0;
      const upstreamCount = upstreamDependencies.get(symbolId)?.length || 0;
      impactScore.set(symbolId, downstreamCount + upstreamCount);
    }

    return { downstreamCallers, upstreamDependencies, impactScore };
  }

  /**
   * Check if a symbol ID is known/resolvable
   */
  private isSymbolKnown(symbolId: string, knownSymbols: SymbolInfo[]): boolean {
    return knownSymbols.some(s => s.id === symbolId || s.semanticId === symbolId);
  }

  /**
   * Check if an edge target is resolved
   */
  private isEdgeResolved(edge: EdgeInfo): boolean {
    // For now, assume edges are resolved if confidence > default threshold
    // In a full implementation, this would check against a symbol registry
    return (edge.confidence ?? 0) > getDefaultThreshold();
  }

  /**
   * Calculate confidence for an edge
   */
  private calculateEdgeConfidence(edge: EdgeInfo, knownSymbols: SymbolInfo[]): number {
    if (edge.type === 'imports') {
      return 0.9; // Import statements are usually reliable
    }

    if (edge.type === 'calls') {
      // Lower confidence for dynamic calls or unknown targets
      return this.isSymbolKnown(edge.to, knownSymbols) ? 0.7 : 0.3;
    }

    return 0.5; // Default confidence
  }
}
