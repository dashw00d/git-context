import { EdgeInfo, FileChange, SymbolInfo } from '../types';
import { detectLanguage, isJSLanguage, isPHPLanguage } from '../utils/config';
import { getDefaultThreshold } from '../utils/edgeThresholds';
import { logError, logWarn } from '../utils/logger';
import { GitOperations } from './git';

export class DependencyExtractor {
  private readonly MAX_DEPTH = 3;
  private resolvedSymbols = new Map<string, boolean>();

  /**
   * Get content from plan data or fallback to git
   */
  private async getContent(
    sha: string,
    path: string,
    git: GitOperations,
    plan?: import('./runner/pipelineTypes').PlanData
  ): Promise<string> {
    // Try plan data first (synchronous, no lookup overhead)
    if (plan?.content.has(`${sha}:${path}`)) {
      return plan.content.get(`${sha}:${path}`)!;
    }
    // Fallback to git
    return git.safeGetFileContent(sha, path);
  }

  /**
   * Extract dependency edges from file content with confidence scoring
   */
  extractDependencies(
    content: string,
    filePath: string,
    symbols: SymbolInfo[],
    depth: number = 0,
    contentLines?: string[]
  ): EdgeInfo[] {
    if (depth > this.MAX_DEPTH) {
      logWarn(`Max recursion depth reached for ${filePath}`);
      return [];
    }

    const language = detectLanguage(filePath);
    if (!language) {
      return [];
    }

    const edges: EdgeInfo[] = [];

    const importEdges = this.extractImports(content, filePath, language, symbols, contentLines);
    edges.push(...importEdges);

    for (const symbol of symbols) {
      const callEdges = this.extractCallsFromSymbol(
        content,
        filePath,
        symbol,
        language,
        symbols,
        contentLines
      );
      edges.push(...callEdges);
    }

    for (const edge of edges) {
      edge.confidence = edge.confidence ?? this.calculateEdgeConfidence(edge, symbols);
      edge.isResolved = this.isEdgeResolved(edge);
    }

    return edges;
  }

  private extractImports(
    content: string,
    filePath: string,
    language: string,
    knownSymbols: SymbolInfo[],
    contentLines?: string[]
  ): EdgeInfo[] {
    const edges: EdgeInfo[] = [];
    const lines = contentLines || content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (isPHPLanguage(language)) {
        const useMatch = line.match(/^use\s+([^;]+);/);
        if (useMatch) {
          const imported = useMatch[1].split('\\').pop() || useMatch[1];
          const targetId = `class_${imported}`;
          const localSymbol = this.findKnownSymbol(targetId, knownSymbols);

          edges.push({
            from: `${filePath}:file`,
            to: localSymbol ? `${filePath}:${localSymbol.id}` : targetId,
            type: 'imports',
            confidence: localSymbol ? 0.9 : 0.6,
            isResolved: !!localSymbol,
          });
        }

        const requireMatch = line.match(/(require|include)(_once)?\s*\(\s*['"]([^'"]+)['"]\s*\)/);
        if (requireMatch) {
          const requiredFile = requireMatch[3];
          edges.push({
            from: `${filePath}:file`,
            to: `${requiredFile}:file`,
            type: 'imports',
            confidence: 0.8,
            isResolved: true,
          });
        }
      }

      if (isJSLanguage(language)) {
        const importMatch = line.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/);
        if (importMatch) {
          const importedModule = importMatch[1];
          edges.push({
            from: `${filePath}:file`,
            to: `${importedModule}:module`,
            type: 'imports',
            confidence: 0.9,
            isResolved: true,
          });
        }

        const requireMatch = line.match(/const\s+\w+\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
        if (requireMatch) {
          const requiredModule = requireMatch[1];
          edges.push({
            from: `${filePath}:file`,
            to: `${requiredModule}:module`,
            type: 'imports',
            confidence: 0.8,
            isResolved: true,
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
    knownSymbols: SymbolInfo[],
    contentLines?: string[]
  ): EdgeInfo[] {
    const edges: EdgeInfo[] = [];

    const lines = contentLines || content.split('\n');
    const startLine = symbol.location.start.line - 1;
    const endLine = symbol.location.end.line - 1;

    const symbolContent = lines.slice(startLine, endLine + 1).join('\n');

    if (symbolContent.length > 100000) {
      logWarn(
        `[DependencyExtractor] Symbol content too large for dependency extraction (${symbolContent.length} chars) in ${filePath}`
      );
      return [];
    }

    if (isPHPLanguage(language)) {
      const callMatches = symbolContent.matchAll(/(\w+)\s*\(/g);
      for (const match of callMatches) {
        const calledFunction = match[1];

        if (
          !['if', 'while', 'for', 'foreach', 'echo', 'print', 'isset', 'empty'].includes(
            calledFunction
          )
        ) {
          const targetId = `function_${calledFunction}`;
          const localSymbol = this.findKnownSymbol(targetId, knownSymbols);
          edges.push({
            from: `${filePath}:${symbol.id}`,
            to: localSymbol ? `${filePath}:${localSymbol.id}` : targetId,
            type: 'calls',
            confidence: localSymbol ? 0.8 : 0.4,
            isResolved: !!localSymbol,
          });
        }
      }

      const methodMatches = symbolContent.matchAll(/\$(\w+)\s*->\s*(\w+)\s*\(/g);
      for (const match of methodMatches) {
        const variable = match[1];
        const method = match[2];

        const targetId = `method_${method}`;
        const localSymbol = this.findKnownSymbol(targetId, knownSymbols);
        edges.push({
          from: `${filePath}:${symbol.id}`,
          to: localSymbol ? `${filePath}:${localSymbol.id}` : targetId,
          type: 'calls',
        });

        if (variable && variable.length > 0) {
          const varId = `variable_${variable}`;
          const localSymbol = this.findKnownSymbol(varId, knownSymbols);
          edges.push({
            from: `${filePath}:${symbol.id}`,
            to: localSymbol ? `${filePath}:${localSymbol.id}` : varId,
            type: 'uses',
          });
        }
      }
    }

    if (isJSLanguage(language)) {
      // Comprehensive list of built-in JavaScript/TypeScript methods to exclude
      const builtInFunctions = new Set([
        'if',
        'while',
        'for',
        'console',
        'setTimeout',
        'setInterval',
        'Promise',
        'Array',
        'Object',
        'String',
        'Number',
        'Boolean',
        'Date',
        'Math',
        'JSON',
        'parseInt',
        'parseFloat',
        'isNaN',
        'isFinite',
        'encodeURI',
        'decodeURI',
        'encodeURIComponent',
        'decodeURIComponent',
        'eval',
        'typeof',
        'instanceof',
      ]);

      const builtInArrayMethods = new Set([
        'join',
        'filter',
        'map',
        'reduce',
        'forEach',
        'slice',
        'push',
        'pop',
        'shift',
        'unshift',
        'splice',
        'sort',
        'reverse',
        'find',
        'findIndex',
        'some',
        'every',
        'includes',
        'indexOf',
        'lastIndexOf',
        'concat',
        'flat',
        'flatMap',
        'keys',
        'values',
        'entries',
      ]);

      const builtInStringMethods = new Set([
        'split',
        'substring',
        'substr',
        'replace',
        'match',
        'search',
        'toLowerCase',
        'toUpperCase',
        'trim',
        'concat',
        'charAt',
        'charCodeAt',
        'indexOf',
        'lastIndexOf',
        'startsWith',
        'endsWith',
        'includes',
      ]);

      const builtInObjectMethods = new Set([
        'keys',
        'values',
        'entries',
        'assign',
        'create',
        'freeze',
        'seal',
        'isFrozen',
        'isSealed',
        'hasOwnProperty',
        'toString',
        'valueOf',
      ]);

      const builtInConsoleMethods = new Set([
        'log',
        'warn',
        'error',
        'info',
        'debug',
        'trace',
        'assert',
      ]);

      const builtInFileSystemMethods = new Set([
        'existsSync',
        'readFile',
        'writeFile',
        'readFileSync',
        'writeFileSync',
        'stat',
        'statSync',
        'mkdir',
        'mkdirSync',
        'readdir',
        'readdirSync',
      ]);

      const builtInMathMethods = new Set([
        'min',
        'max',
        'abs',
        'floor',
        'ceil',
        'round',
        'random',
        'sqrt',
        'pow',
        'exp',
        'log',
        'log10',
        'sin',
        'cos',
        'tan',
        'PI',
        'E',
      ]);

      const allBuiltIns = new Set([
        ...builtInFunctions,
        ...builtInArrayMethods,
        ...builtInStringMethods,
        ...builtInObjectMethods,
        ...builtInConsoleMethods,
        ...builtInFileSystemMethods,
        ...builtInMathMethods,
      ]);

      const callMatches = symbolContent.matchAll(/(\w+)\s*\(/g);
      for (const match of callMatches) {
        const calledFunction = match[1];

        if (!allBuiltIns.has(calledFunction)) {
          const targetId = `function_${calledFunction}`;
          const localSymbol = this.findKnownSymbol(targetId, knownSymbols);
          edges.push({
            from: `${filePath}:${symbol.id}`,
            to: localSymbol ? `${filePath}:${localSymbol.id}` : targetId,
            type: 'calls',
          });
        }
      }

      const methodMatches = symbolContent.matchAll(/(\w+)\.(\w+)\s*\(/g);
      for (const match of methodMatches) {
        const object = match[1];
        const method = match[2];

        // Check if this is a built-in method call
        const isBuiltInMethod =
          (object === 'Array' && builtInArrayMethods.has(method)) ||
          (object === 'String' && builtInStringMethods.has(method)) ||
          (object === 'Object' && builtInObjectMethods.has(method)) ||
          (object === 'console' && builtInConsoleMethods.has(method)) ||
          (object === 'Math' && builtInMathMethods.has(method)) ||
          (object === 'fs' && builtInFileSystemMethods.has(method)) ||
          builtInArrayMethods.has(method) ||
          builtInStringMethods.has(method) ||
          builtInObjectMethods.has(method);

        if (!isBuiltInMethod) {
          const targetId = `method_${method}`;
          const localSymbol = this.findKnownSymbol(targetId, knownSymbols);
          edges.push({
            from: `${filePath}:${symbol.id}`,
            to: localSymbol ? `${filePath}:${localSymbol.id}` : targetId,
            type: 'calls',
          });
        }

        if (
          object &&
          object.length > 0 &&
          !['this', 'self', 'super'].includes(object.toLowerCase())
        ) {
          const targetId = `object_${object}`;
          const localSymbol = this.findKnownSymbol(targetId, knownSymbols);
          edges.push({
            from: `${filePath}:${symbol.id}`,
            to: localSymbol ? `${filePath}:${localSymbol.id}` : targetId,
            type: 'uses',
          });
        }
      }
    }

    return edges;
  }

  /**
   * Compare two sets of edges and determine changes
   */
  compareEdges(
    previous: EdgeInfo[],
    current: EdgeInfo[]
  ): {
    added: EdgeInfo[];
    removed: EdgeInfo[];
  } {
    const added: EdgeInfo[] = [];
    const removed: EdgeInfo[] = [];

    const previousMap = new Map(previous.map(e => [`${e.from}:${e.to}:${e.type} `, e]));
    const currentMap = new Map(current.map(e => [`${e.from}:${e.to}:${e.type} `, e]));

    for (const edge of current) {
      const key = `${edge.from}:${edge.to}:${edge.type} `;
      if (!previousMap.has(key)) {
        added.push(edge);
      }
    }

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
  async extractWorkingTreeEdges(
    files: FileChange[],
    symbols: { added: SymbolInfo[]; removed: SymbolInfo[]; modified: any[] },
    git: any
  ): Promise<{
    added: EdgeInfo[];
    removed: EdgeInfo[];
  }> {
    const currentEdges: EdgeInfo[] = [];

    const symbolsByFile = new Map<string, SymbolInfo[]>();
    for (const symbol of [...symbols.added, ...symbols.modified.map(m => m.symbol)]) {
      const filePath = symbol.filePath;
      if (!symbolsByFile.has(filePath)) {
        symbolsByFile.set(filePath, []);
      }
      symbolsByFile.get(filePath)!.push(symbol);
    }

    for (const [filePath, fileSymbols] of symbolsByFile) {
      try {
        const isStaged = files.some(f => f.path === filePath && f.status !== 'U');
        const content = isStaged
          ? git.safeGetStagedContent(filePath)
          : git.safeGetWorkingContent(filePath);

        if (content) {
          const edges = this.extractDependencies(content, filePath, fileSymbols);
          currentEdges.push(...edges);
        }
      } catch (error) {
        logError(`Failed to extract edges from working tree file ${filePath}`, error);
      }
    }

    return {
      added: currentEdges,
      removed: [],
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
    git: GitOperations,
    plan?: import('./runner/pipelineTypes').PlanData
  ): Promise<{
    added: EdgeInfo[];
    removed: EdgeInfo[];
  }> {
    const currentEdges: EdgeInfo[] = [];
    const previousEdges: EdgeInfo[] = [];

    for (const [filePath, content] of fileContents) {
      const fileSymbols = symbols.added.filter(s => s.filePath === filePath);

      const modifiedSymbols = symbols.modified
        .map(m => m.symbol)
        .filter(s => s.filePath === filePath);
      const allFileSymbols = [...fileSymbols, ...modifiedSymbols];

      const edges = this.extractDependencies(content, filePath, allFileSymbols);
      currentEdges.push(...edges);
    }

    const modifiedFiles = new Set(symbols.modified.map(m => m.symbol.filePath));

    for (const filePath of modifiedFiles) {
      try {
        const commitInfo = await git.getCommitInfo(sha);
        if (commitInfo.parent) {
          const fileChange = files.find(f => f.path === filePath);
          const parentPath =
            fileChange?.status === 'R' && fileChange.oldPath ? fileChange.oldPath : filePath;

          const previousContent = await this.getContent(commitInfo.parent, parentPath, git, plan);

          const previousFileSymbols = symbols.modified
            .filter(m => m.symbol.filePath === filePath && m.previousSymbol)
            .map(m => m.previousSymbol!);

          const edges = this.extractDependencies(previousContent, filePath, previousFileSymbols);
          previousEdges.push(...edges);
        }
      } catch (error) {
        logError(`Failed to extract previous edges for ${filePath}`, error);
      }
    }

    const changes = this.compareEdges(previousEdges, currentEdges);

    return {
      added: changes.added,
      removed: changes.removed,
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
      fanIn.set(edge.to, (fanIn.get(edge.to) || 0) + 1);

      fanOut.set(edge.from, (fanOut.get(edge.from) || 0) + 1);
    }

    return { fanIn, fanOut };
  }

  /**
   * Calculate blast radius for changed symbols
   */
  calculateBlastRadius(
    changedSymbols: SymbolInfo[],
    allEdges: EdgeInfo[]
  ): {
    downstreamCallers: Map<string, SymbolInfo[]>;
    upstreamDependencies: Map<string, SymbolInfo[]>;
    impactScore: Map<string, number>;
  } {
    const downstreamCallers = new Map<string, SymbolInfo[]>();
    const upstreamDependencies = new Map<string, SymbolInfo[]>();
    const impactScore = new Map<string, number>();

    const changedIds = new Set(changedSymbols.map(s => s.id));

    for (const edge of allEdges) {
      if (changedIds.has(edge.to)) {
        const callers = downstreamCallers.get(edge.to) || [];

        if (!callers.some(c => c.id === edge.from)) {
          callers.push({
            id: edge.from,
            name: edge.from.split(':').pop() || edge.from,
            kind: 'variable',
            location: {
              start: { line: 0, column: 0 },
              end: { line: 0, column: 0 },
            },
            signature: '',
          } as SymbolInfo);
          downstreamCallers.set(edge.to, callers);
        }
      }
    }

    for (const edge of allEdges) {
      if (changedIds.has(edge.from)) {
        const dependencies = upstreamDependencies.get(edge.from) || [];
        if (!dependencies.some(d => d.id === edge.to)) {
          dependencies.push({
            id: edge.to,
            name: edge.to.split(':').pop() || edge.to,
            kind: 'variable',
            location: {
              start: { line: 0, column: 0 },
              end: { line: 0, column: 0 },
            },
            signature: '',
          } as SymbolInfo);
          upstreamDependencies.set(edge.from, dependencies);
        }
      }
    }

    for (const symbolId of changedIds) {
      const downstreamCount = downstreamCallers.get(symbolId)?.length || 0;
      const upstreamCount = upstreamDependencies.get(symbolId)?.length || 0;
      impactScore.set(symbolId, downstreamCount + upstreamCount);
    }

    return { downstreamCallers, upstreamDependencies, impactScore };
  }

  private findKnownSymbol(symbolId: string, knownSymbols: SymbolInfo[]): SymbolInfo | undefined {
    return knownSymbols.find(s => s.id === symbolId || s.semanticId === symbolId);
  }

  private isSymbolKnown(symbolId: string, knownSymbols: SymbolInfo[]): boolean {
    return !!this.findKnownSymbol(symbolId, knownSymbols);
  }

  private isEdgeResolved(edge: EdgeInfo): boolean {
    return (edge.confidence ?? 0) > getDefaultThreshold();
  }

  private calculateEdgeConfidence(edge: EdgeInfo, knownSymbols: SymbolInfo[]): number {
    if (edge.type === 'imports') {
      return 0.9;
    }

    if (edge.type === 'calls') {
      return this.isSymbolKnown(edge.to, knownSymbols) ? 0.7 : 0.3;
    }

    return 0.5;
  }
}
