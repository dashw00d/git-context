import { SymbolInfo, EdgeInfo, EdgeDelta } from '../types';
import { detectLanguage } from './tree-sitter';

export class DependencyExtractor {
  private readonly MAX_DEPTH = 3; // Prevent infinite recursion

  /**
   * Extract dependency edges from file content
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

    // Extract imports/requires
    const importEdges = this.extractImports(content, filePath, language);
    edges.push(...importEdges);

    // Extract function calls within symbols
    for (const symbol of symbols) {
      const callEdges = this.extractCallsFromSymbol(content, filePath, symbol, language);
      edges.push(...callEdges);
    }

    return edges;
  }

  /**
   * Extract import/require edges from file content
   */
  private extractImports(content: string, filePath: string, language: string): EdgeInfo[] {
    const edges: EdgeInfo[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (language === 'php') {
        // PHP imports: use, require, include
        const useMatch = line.match(/^use\s+([^;]+);/);
        if (useMatch) {
          const imported = useMatch[1].split('\\').pop() || useMatch[1];
          edges.push({
            from: `${filePath}:file`,
            to: `class_${imported}`,
            type: 'imports'
          });
        }

        const requireMatch = line.match(/(require|include)(_once)?\s*\(\s*['"]([^'"]+)['"]\s*\)/);
        if (requireMatch) {
          const requiredFile = requireMatch[3];
          edges.push({
            from: `${filePath}:file`,
            to: `${requiredFile}:file`,
            type: 'imports'
          });
        }
      }

      if (language === 'javascript' || language === 'typescript') {
        // JS/TS imports
        const importMatch = line.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/);
        if (importMatch) {
          const importedModule = importMatch[1];
          edges.push({
            from: `${filePath}:file`,
            to: `${importedModule}:module`,
            type: 'imports'
          });
        }

        // CommonJS requires
        const requireMatch = line.match(/const\s+\w+\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
        if (requireMatch) {
          const requiredModule = requireMatch[1];
          edges.push({
            from: `${filePath}:file`,
            to: `${requiredModule}:module`,
            type: 'imports'
          });
        }
      }
    }

    return edges;
  }

  /**
   * Extract function calls from a symbol's content
   */
  private extractCallsFromSymbol(
    content: string,
    filePath: string,
    symbol: SymbolInfo,
    language: string
  ): EdgeInfo[] {
    const edges: EdgeInfo[] = [];

    // Extract the symbol's code block
    const lines = content.split('\n');
    const startLine = symbol.location.start.line - 1; // Convert to 0-based
    const endLine = symbol.location.end.line - 1;

    const symbolContent = lines.slice(startLine, endLine + 1).join('\n');

    // Extract calls based on language
    if (language === 'php') {
      const callMatches = symbolContent.matchAll(/(\w+)\s*\(/g);
      for (const match of callMatches) {
        const calledFunction = match[1];
        // Skip common PHP constructs
        if (!['if', 'while', 'for', 'foreach', 'echo', 'print', 'isset', 'empty'].includes(calledFunction)) {
          edges.push({
            from: symbol.id,
            to: `function_${calledFunction}`,
            type: 'calls'
          });
        }
      }

      // Extract method calls ($obj->method())
      const methodMatches = symbolContent.matchAll(/\$(\w+)\s*->\s*(\w+)\s*\(/g);
      for (const match of methodMatches) {
        const variable = match[1];
        const method = match[2];
        edges.push({
          from: symbol.id,
          to: `method_${method}`,
          type: 'calls'
        });
      }
    }

    if (language === 'javascript' || language === 'typescript') {
      // Extract function calls
      const callMatches = symbolContent.matchAll(/(\w+)\s*\(/g);
      for (const match of callMatches) {
        const calledFunction = match[1];
        // Skip common JS constructs and keywords
        if (!['if', 'while', 'for', 'console', 'setTimeout', 'setInterval', 'Promise', 'Array', 'Object', 'String'].includes(calledFunction)) {
          edges.push({
            from: symbol.id,
            to: `function_${calledFunction}`,
            type: 'calls'
          });
        }
      }

      // Extract method calls (obj.method())
      const methodMatches = symbolContent.matchAll(/(\w+)\.(\w+)\s*\(/g);
      for (const match of methodMatches) {
        const object = match[1];
        const method = match[2];
        edges.push({
          from: symbol.id,
          to: `method_${method}`,
          type: 'calls'
        });
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
    const previousMap = new Map(previous.map(e => [`${e.from}:${e.to}:${e.type}`, e]));
    const currentMap = new Map(current.map(e => [`${e.from}:${e.to}:${e.type}`, e]));

    // Find added edges
    for (const edge of current) {
      const key = `${edge.from}:${edge.to}:${edge.type}`;
      if (!previousMap.has(key)) {
        added.push(edge);
      }
    }

    // Find removed edges
    for (const edge of previous) {
      const key = `${edge.from}:${edge.to}:${edge.type}`;
      if (!currentMap.has(key)) {
        removed.push(edge);
      }
    }

    return { added, removed };
  }

  /**
   * Extract edges for an entire commit
   */
  extractCommitEdges(
    sha: string,
    symbols: { added: SymbolInfo[]; removed: SymbolInfo[]; modified: any[] },
    fileContents: Map<string, string>
  ): {
    added: EdgeInfo[];
    removed: EdgeInfo[];
  } {
    const currentEdges: EdgeInfo[] = [];
    const previousEdges: EdgeInfo[] = [];

    // Process current symbols
    for (const [filePath, content] of fileContents) {
      const fileSymbols = symbols.added.filter(s => s.id.startsWith(`${filePath}:`));
      const edges = this.extractDependencies(content, filePath, fileSymbols);
      currentEdges.push(...edges);
    }

    // For modified symbols, we'd need to compare with previous versions
    // This is a simplified version - in practice, we'd need to get previous content

    return {
      added: currentEdges, // Simplified - in real implementation, compare with previous
      removed: []
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
}
