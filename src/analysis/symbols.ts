import { SymbolInfo, SymbolDelta, SymbolChangeType, FileChange } from '../types';
import { getTreeSitterParser, detectLanguage } from './tree-sitter';
import { GitOperations } from './git';
import { SemanticChangeDetector } from './semanticChanges';

export class SymbolExtractor {
  private git: GitOperations;
  private parser = getTreeSitterParser();
  private semanticDetector = new SemanticChangeDetector();

  constructor(git: GitOperations) {
    this.git = git;
  }

  /**
   * Extract symbols from all changed files in a commit with semantic enrichment
   */
  async extractCommitSymbols(sha: string, files: FileChange[]): Promise<{
    added: SymbolInfo[];
    removed: SymbolInfo[];
    modified: SymbolDelta[];
    renames: Array<{ oldSymbol: SymbolInfo; newSymbol: SymbolInfo; confidence: number }>;
    moves: Array<{ symbol: SymbolInfo; oldPath: string; newPath: string; confidence: number }>;
  }> {
    const added: SymbolInfo[] = [];
    const removed: SymbolInfo[] = [];
    const modified: SymbolDelta[] = [];

    // Collect symbols from all files
    for (const file of files) {
      if (this.shouldAnalyzeFile(file.path)) {
        const fileSymbols = await this.extractFileSymbols(sha, file);
        added.push(...fileSymbols.added);
        removed.push(...fileSymbols.removed);
        modified.push(...fileSymbols.modified);
      }
    }

    // Get parent commit for comparison
    let parentSha: string | undefined;
    try {
      const commitInfo = this.git.getCommitInfo(sha);
      parentSha = commitInfo.parent;
    } catch (error) {
      // No parent commit available
    }

    // Perform semantic analysis for renames and moves
    const renames = parentSha ?
      this.semanticDetector.detectRenames(removed, added) : [];

    // For moves, we need symbols from previous commit
    let previousSymbols: SymbolInfo[] = [];
    if (parentSha) {
      try {
        const previousCommitSymbols = await this.extractCommitSymbols(parentSha, files);
        previousSymbols = [
          ...previousCommitSymbols.added,
          ...previousCommitSymbols.removed,
          ...previousCommitSymbols.modified.map(m => m.symbol)
        ];
      } catch (error) {
        // Can't get previous symbols
      }
    }

    const currentSymbols = [...added, ...modified.map(m => m.symbol)];
    const moves = this.semanticDetector.detectMoves(previousSymbols, currentSymbols);

    return { added, removed, modified, renames, moves };
  }

  /**
   * Extract symbols from a single file in a commit
   */
  private async extractFileSymbols(sha: string, file: FileChange): Promise<{
    added: SymbolInfo[];
    removed: SymbolInfo[];
    modified: SymbolDelta[];
  }> {
    const added: SymbolInfo[] = [];
    const removed: SymbolInfo[] = [];
    const modified: SymbolDelta[] = [];

    try {
      // Skip deleted files - they don't exist in the commit
      if (file.status === 'D') {
        return { added, removed, modified };
      }

      // Get current file content (use safe method to handle path mismatches)
      console.log(`[SYMBOLS] Extracting ${file.path} at ${sha.substring(0, 8)} (status: ${file.status})`);
      const currentContent = this.git.safeGetFileContent(sha, file.path);

      // Skip if file doesn't exist at this SHA (path mismatch, rename, or file added later)
      if (!currentContent) {
        console.log(`[SYMBOLS] Skipping ${file.path} at ${sha.substring(0, 8)} - not found in commit`);
        return { added, removed, modified };
      }

      // Get previous file content (if it exists)
      let previousContent: string | null = null;
      if (file.status !== 'A' && file.oldPath) {
        try {
          const parentSha = this.git.getCommitInfo(sha).parent;
          if (parentSha) {
            previousContent = this.git.safeGetFileContent(parentSha, file.oldPath);
          }
        } catch {
          // File didn't exist in parent, treat as new
        }
      } else if (file.status !== 'A') {
        try {
          const parentSha = this.git.getCommitInfo(sha).parent;
          if (parentSha) {
            previousContent = this.git.safeGetFileContent(parentSha, file.path);
          }
        } catch {
          // File didn't exist in parent, treat as new
        }
      }

      // Extract symbols from both versions
      const currentSymbols = await this.extractSymbolsFromContent(currentContent, file.path);
      const previousSymbols = previousContent
        ? await this.extractSymbolsFromContent(previousContent, file.oldPath || file.path)
        : [];

      // Compare and categorize changes
      const changes = this.compareSymbolSets(previousSymbols, currentSymbols, file.path);

      // Enhance modified symbols with semantic information
      for (const delta of changes.modified) {
        // Classify modification reason
        delta.modReason = this.semanticDetector.classifyModificationReason(delta);

        // Capture diff snippets if content available
        if (previousContent && currentContent) {
          const snippets = this.semanticDetector.extractDiffSnippets(
            previousContent,
            currentContent,
            delta.symbol
          );
          delta.diffSnippetPre = snippets.pre;
          delta.diffSnippetPost = snippets.post;
        }
      }

      added.push(...changes.added);
      removed.push(...changes.removed);
      modified.push(...changes.modified);

    } catch (error) {
      console.warn(`Failed to extract symbols from ${file.path}:`, error);
    }

    return { added, removed, modified };
  }

  /**
   * Extract symbols from working tree files (staged or unstaged) compared to HEAD
   */
  async extractWorkingTreeSymbols(files: FileChange[], options: { staged?: boolean } = {}): Promise<{
    added: SymbolInfo[];
    removed: SymbolInfo[];
    modified: SymbolDelta[];
  }> {
    const added: SymbolInfo[] = [];
    const removed: SymbolInfo[] = [];
    const modified: SymbolDelta[] = [];

    for (const file of files) {
      if (this.shouldAnalyzeFile(file.path)) {
        const fileSymbols = await this.extractWorkingTreeFileSymbols(file, options);
        added.push(...fileSymbols.added);
        removed.push(...fileSymbols.removed);
        modified.push(...fileSymbols.modified);
      }
    }

    return { added, removed, modified };
  }

  /**
   * Extract symbols from a single working tree file
   */
  private async extractWorkingTreeFileSymbols(file: FileChange, options: { staged?: boolean }): Promise<{
    added: SymbolInfo[];
    removed: SymbolInfo[];
    modified: SymbolDelta[];
  }> {
    const added: SymbolInfo[] = [];
    const removed: SymbolInfo[] = [];
    const modified: SymbolDelta[] = [];

    try {
      // Get current working tree content (staged or unstaged)
      const currentContent = options.staged
        ? this.git.safeGetStagedContent(file.path)
        : this.git.safeGetWorkingContent(file.path);

      if (!currentContent) {
        console.log(`[SYMBOLS] Skipping ${file.path} - no content available`);
        return { added, removed, modified };
      }

      // Get HEAD content for comparison
      const headContent = this.git.safeGetFileContent('HEAD', file.path);

      // Extract symbols from both versions
      const currentSymbols = await this.extractSymbolsFromContent(currentContent, file.path);
      const headSymbols = headContent
        ? await this.extractSymbolsFromContent(headContent, file.path)
        : [];

      // Compare and categorize changes
      const changes = this.compareSymbolSets(headSymbols, currentSymbols, file.path);

      // Enhance modified symbols with semantic information
      for (const delta of changes.modified) {
        delta.modReason = this.semanticDetector.classifyModificationReason(delta);

        // Capture diff snippets if content available
        if (headContent && currentContent) {
          const snippets = this.semanticDetector.extractDiffSnippets(
            headContent,
            currentContent,
            delta.symbol
          );
          delta.diffSnippetPre = snippets.pre;
          delta.diffSnippetPost = snippets.post;
        }
      }

      added.push(...changes.added);
      removed.push(...changes.removed);
      modified.push(...changes.modified);

    } catch (error) {
      console.warn(`Failed to extract working tree symbols from ${file.path}:`, error);
    }

    return { added, removed, modified };
  }

  /**
   * Extract symbols from file content
   */
  public async extractSymbolsFromContent(content: string, filePath: string): Promise<SymbolInfo[]> {
    const language = detectLanguage(filePath);
    if (!language) {
      return [];
    }

    const tree = await this.parser.parseFile(content, language);
    if (!tree) {
      return [];
    }

    const symbols = this.parser.extractSymbols(tree, filePath, language);

    // Add unique IDs and ensure they include file path for uniqueness
    return symbols.map(symbol => ({
      ...symbol,
      semanticId: symbol.id,
      id: `${filePath}:${symbol.id}`
    }));
  }

  /**
   * Compare two sets of symbols and determine changes
   */
  private compareSymbolSets(
    previous: SymbolInfo[],
    current: SymbolInfo[],
    filePath: string
  ): {
    added: SymbolInfo[];
    removed: SymbolInfo[];
    modified: SymbolDelta[];
  } {
    const added: SymbolInfo[] = [];
    const removed: SymbolInfo[] = [];
    const modified: SymbolDelta[] = [];

    // Create maps for efficient lookup
    const previousMap = new Map(previous.map(s => [s.id, s]));
    const currentMap = new Map(current.map(s => [s.id, s]));

    // Find added symbols
    for (const symbol of current) {
      if (!previousMap.has(symbol.id)) {
        added.push(symbol);
      }
    }

    // Find removed symbols
    for (const symbol of previous) {
      if (!currentMap.has(symbol.id)) {
        removed.push(symbol);
      }
    }

    // Find modified symbols
    for (const currentSymbol of current) {
      const previousSymbol = previousMap.get(currentSymbol.id);
      if (previousSymbol) {
        const changeType = this.determineSymbolChange(previousSymbol, currentSymbol);
        if (changeType !== 'body_changed') { // Only report significant changes
          modified.push({
            symbol: currentSymbol,
            changeType,
            previousSymbol
          });
        }
      }
    }

    return { added, removed, modified };
  }

  /**
   * Determine the type of change between two symbol versions
   */
  private determineSymbolChange(previous: SymbolInfo, current: SymbolInfo): SymbolChangeType {
    // Check if signature changed
    if (previous.signature !== current.signature) {
      // Check if it's a breaking change (public API change)
      if (this.isPublicSymbol(previous) && this.isPublicSymbol(current)) {
        return 'signature_changed';
      }
    }

    // Check if location changed significantly (might indicate move/refactor)
    const prevLines = previous.location.end.line - previous.location.start.line;
    const currLines = current.location.end.line - current.location.start.line;

    if (Math.abs(prevLines - currLines) > 10) { // Arbitrary threshold
      return 'body_changed';
    }

    // Default to body change
    return 'body_changed';
  }

  /**
   * Check if a symbol is public (exported)
   */
  private isPublicSymbol(symbol: SymbolInfo): boolean {
    // Simple heuristic: symbols starting with underscore are private
    return !symbol.name.startsWith('_');
  }

  /**
   * Check if a file should be analyzed for symbols
   */
  private shouldAnalyzeFile(filePath: string): boolean {
    const language = detectLanguage(filePath);
    if (!language) return false;

    // Skip certain directories and files
    const skipPatterns = [
      /node_modules/,
      /\.git/,
      /dist/,
      /build/,
      /vendor/,
      /\.min\./,
      /test.*\.(js|ts|php)$/,
      /spec.*\.(js|ts|php)$/,
      /\.(test|spec)\.(js|ts|php)$/
    ];

    return !skipPatterns.some(pattern => pattern.test(filePath));
  }

  /**
   * Extract symbols from staged changes
   */
  async extractStagedSymbols(): Promise<{
    added: SymbolInfo[];
    removed: SymbolInfo[];
    modified: SymbolDelta[];
  }> {
    const stagedChanges = this.git.getWorkingDirectoryChanges();
    const added: SymbolInfo[] = [];
    const removed: SymbolInfo[] = [];
    const modified: SymbolDelta[] = [];

    for (const file of stagedChanges) {
      if (file.status === 'M' && this.shouldAnalyzeFile(file.path)) {
        try {
          // Get staged content
          const stagedContent = this.git.getStagedDiff();
          // This is complex - we'd need to parse the diff to extract staged content
          // For now, just mark as modified
          console.log(`Staged changes in ${file.path} - would extract symbols`);
        } catch (error) {
          console.warn(`Failed to extract staged symbols from ${file.path}:`, error);
        }
      }
    }

    return { added, removed, modified };
  }
}
