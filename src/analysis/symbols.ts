import * as vscode from 'vscode';
import { FileChange, SymbolDelta, SymbolDeltaChangeType, SymbolInfo } from '../types';
import { detectLanguage, getTestFilePattern } from '../utils/config';
import { logDebug, logInfo, logWarn } from '../utils/logger';
import { filterPath } from '../utils/pathFilter';
import { GitOperations } from './git';
import { SemanticChangeDetector } from './semanticChanges';
import { assignDNAIds } from './symbolDna';
import { getTreeSitterParser } from './tree-sitter';

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
  async extractCommitSymbols(
    sha: string,
    files: FileChange[]
  ): Promise<{
    added: SymbolInfo[];
    removed: SymbolInfo[];
    modified: SymbolDelta[];
    renames: Array<{
      oldSymbol: SymbolInfo;
      newSymbol: SymbolInfo;
      confidence: number;
    }>;
    moves: Array<{
      symbol: SymbolInfo;
      oldPath: string;
      newPath: string;
      confidence: number;
    }>;
  }> {
    const added: SymbolInfo[] = [];
    const removed: SymbolInfo[] = [];
    const modified: SymbolDelta[] = [];

    for (const file of files) {
      if (await this.shouldAnalyzeFile(file.path)) {
        const fileSymbols = await this.extractFileSymbols(sha, file);
        added.push(...fileSymbols.added);
        removed.push(...fileSymbols.removed);
        modified.push(...fileSymbols.modified);
      }
    }

    let parentSha: string | undefined;
    try {
      const commitInfo = await this.git.getCommitInfo(sha);
      parentSha = commitInfo.parent;
    } catch (error) {
      //empty
    }

    const renames = parentSha ? this.semanticDetector.detectRenames(removed, added) : [];

    let previousSymbols: SymbolInfo[] = [];
    if (parentSha) {
      try {
        const previousCommitSymbols = await this.extractCommitSymbols(parentSha, files);
        previousSymbols = [
          ...previousCommitSymbols.added,
          ...previousCommitSymbols.removed,
          ...previousCommitSymbols.modified.map(m => m.symbol),
        ];
      } catch (error) {
        //empty
      }
    }

    const currentSymbols = [...added, ...modified.map(m => m.symbol)];
    const moves = this.semanticDetector.detectMoves(previousSymbols, currentSymbols);

    return { added, removed, modified, renames, moves };
  }

  /**
   * Extract symbols from a single file in a commit
   */
  private async extractFileSymbols(
    sha: string,
    file: FileChange
  ): Promise<{
    added: SymbolInfo[];
    removed: SymbolInfo[];
    modified: SymbolDelta[];
  }> {
    const added: SymbolInfo[] = [];
    const removed: SymbolInfo[] = [];
    const modified: SymbolDelta[] = [];

    try {
      if (file.status === 'D') {
        return { added, removed, modified };
      }

      logInfo(`Extracting ${file.path} at ${sha.substring(0, 8)} (status: ${file.status})`);
      const currentContent = await this.git.safeGetFileContent(sha, file.path);

      if (!currentContent) {
        logInfo(`Skipping ${file.path} at ${sha.substring(0, 8)} - not found in commit`);
        return { added, removed, modified };
      }

      let previousContent: string | null = null;
      if (file.status !== 'A' && file.oldPath) {
        try {
          const commitInfo = await this.git.getCommitInfo(sha);
          const parentSha = commitInfo.parent;
          if (parentSha) {
            previousContent = await this.git.safeGetFileContent(parentSha, file.oldPath);
          }
        } catch {
          //empty
        }
      } else if (file.status !== 'A') {
        try {
          const commitInfo = await this.git.getCommitInfo(sha);
          const parentSha = commitInfo.parent;
          if (parentSha) {
            previousContent = await this.git.safeGetFileContent(parentSha, file.path);
          }
        } catch {
          //empty
        }
      }

      const currentSymbols = await this.extractSymbolsFromContent(currentContent, file.path);
      const bodyTexts = new Map([[file.path, currentContent]]);
      const currentSymbolsWithDNA = await assignDNAIds(
        currentSymbols,
        bodyTexts,
        detectLanguage(file.path) || undefined
      );

      const previousSymbols = previousContent
        ? await this.extractSymbolsFromContent(previousContent, file.oldPath || file.path)
        : [];

      let previousSymbolsWithDNA = previousSymbols;
      if (previousContent) {
        const bodyTexts = new Map([[file.oldPath || file.path, previousContent]]);
        previousSymbolsWithDNA = await assignDNAIds(
          previousSymbols,
          bodyTexts,
          detectLanguage(file.oldPath || file.path) || undefined
        );
      }

      const changes = this.compareSymbolSets(
        previousSymbolsWithDNA,
        currentSymbolsWithDNA,
        file.path
      );

      for (const delta of changes.modified) {
        delta.modReason = this.semanticDetector.classifyModificationReason(delta);

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
      logWarn(`Failed to extract symbols from ${file.path}: ${error}`);
    }

    return { added, removed, modified };
  }

  /**
   * Extract symbols from working tree files (staged or unstaged) compared to HEAD
   */
  async extractWorkingTreeSymbols(
    files: FileChange[],
    options: { staged?: boolean } = {
      //empty
    }
  ): Promise<{
    added: SymbolInfo[];
    removed: SymbolInfo[];
    modified: SymbolDelta[];
  }> {
    const added: SymbolInfo[] = [];
    const removed: SymbolInfo[] = [];
    const modified: SymbolDelta[] = [];

    for (const file of files) {
      if (await this.shouldAnalyzeFile(file.path)) {
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
  private async extractWorkingTreeFileSymbols(
    file: FileChange,
    options: { staged?: boolean }
  ): Promise<{
    added: SymbolInfo[];
    removed: SymbolInfo[];
    modified: SymbolDelta[];
  }> {
    const added: SymbolInfo[] = [];
    const removed: SymbolInfo[] = [];
    const modified: SymbolDelta[] = [];

    try {
      const currentContent = options.staged
        ? await this.git.safeGetStagedContent(file.path)
        : this.git.safeGetWorkingContent(file.path);

      if (!currentContent) {
        logInfo(`Skipping ${file.path} - no content available`);
        return { added, removed, modified };
      }

      const headContent = await this.git.safeGetFileContent('HEAD', file.path);

      const currentSymbols = await this.extractSymbolsFromContent(currentContent, file.path);
      const bodyTexts = new Map([[file.path, currentContent]]);
      const currentSymbolsWithDNA = await assignDNAIds(
        currentSymbols,
        bodyTexts,
        detectLanguage(file.path) || undefined
      );

      const headSymbols = headContent
        ? await this.extractSymbolsFromContent(headContent, file.path)
        : [];
      let headSymbolsWithDNA = headSymbols;

      if (headContent) {
        const headBodyTexts = new Map([[file.path, headContent]]);
        headSymbolsWithDNA = await assignDNAIds(
          headSymbols,
          headBodyTexts,
          detectLanguage(file.path) || undefined
        );
      }

      const changes = this.compareSymbolSets(headSymbolsWithDNA, currentSymbolsWithDNA, file.path);

      for (const delta of changes.modified) {
        delta.modReason = this.semanticDetector.classifyModificationReason(delta);

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
      logWarn(`Failed to extract working tree symbols from ${file.path}: ${error}`);
    }

    return { added, removed, modified };
  }

  /**
   * Extract symbols from file content
   */
  /**
   * Extract symbols incrementally from live changes
   * Compares previous symbols with current content to determine changes
   */
  public async extractIncremental(
    prevSymbols: SymbolInfo[],
    changes: vscode.TextDocumentContentChangeEvent[],
    content: string,
    path: string
  ): Promise<{
    symbols: SymbolInfo[];
    delta: {
      added: SymbolInfo[];
      removed: SymbolInfo[];
      modified: SymbolDelta[];
    };
  }> {
    const newSymbols = await this.extractSymbolsFromContent(content, path);

    const delta = this.compareSymbolSets(prevSymbols, newSymbols, path);

    return {
      symbols: newSymbols,
      delta: {
        added: delta.added,
        removed: delta.removed,
        modified: delta.modified,
      },
    };
  }

  public async extractSymbolsFromContent(content: string, filePath: string): Promise<SymbolInfo[]> {
    const language = detectLanguage(filePath);
    if (!language) {
      return [];
    }

    const facts = await this.parser.extractHybridFacts(content, filePath, language);

    const symbolKinds = new Set([
      'function',
      'method',
      'class',
      'const',
      'variable',
      'interface',
      'enum',
      'module',
    ]);
    const symbols = facts.filter(f => symbolKinds.has(f.kind)) as SymbolInfo[];

    return symbols.map(symbol => ({
      ...symbol,
      semanticId: symbol.id,
      id: `${filePath}:${symbol.id}`,
    }));
  }

  /**
   * Extract symbols WITH body text for DNA hashing
   */
  async extractSymbolsWithBodies(
    content: string,
    filePath: string,
    _language: string
  ): Promise<{ symbols: SymbolInfo[]; bodyTexts: Map<string, string> }> {
    const symbols = await this.extractSymbolsFromContent(content, filePath);
    const bodyTexts = new Map<string, string>();

    for (const symbol of symbols) {
      const bodyText = this.extractBodyText(
        content,
        symbol.location.start.line,
        symbol.location.end.line
      );
      bodyTexts.set(symbol.id, bodyText);
    }

    return { symbols, bodyTexts };
  }

  private extractBodyText(content: string, startLine: number, endLine: number): string {
    const lines = content.split('\n');
    return lines.slice(startLine - 1, endLine).join('\n');
  }

  /**
   * Compare two sets of symbols and determine changes
   */
  private compareSymbolSets(
    previous: SymbolInfo[],
    current: SymbolInfo[],
    _filePath: string
  ): {
    added: SymbolInfo[];
    removed: SymbolInfo[];
    modified: SymbolDelta[];
  } {
    const added: SymbolInfo[] = [];
    const removed: SymbolInfo[] = [];
    const modified: SymbolDelta[] = [];

    const previousMap = new Map(previous.map(s => [s.id, s]));
    const currentMap = new Map(current.map(s => [s.id, s]));

    for (const symbol of current) {
      if (!previousMap.has(symbol.id)) {
        added.push(symbol);
      }
    }

    for (const symbol of previous) {
      if (!currentMap.has(symbol.id)) {
        removed.push(symbol);
      }
    }

    for (const currentSymbol of current) {
      const previousSymbol = previousMap.get(currentSymbol.id);
      if (previousSymbol) {
        const changeType = this.determineSymbolChange(previousSymbol, currentSymbol);
        if (changeType !== 'body_changed') {
          modified.push({
            symbol: currentSymbol,
            changeType,
            previousSymbol,
          });
        }
      }
    }

    return { added, removed, modified };
  }

  /**
   * Determine the type of change between two symbol versions
   */
  private determineSymbolChange(previous: SymbolInfo, current: SymbolInfo): SymbolDeltaChangeType {
    if (previous.signature !== current.signature) {
      if (this.isPublicSymbol(previous) && this.isPublicSymbol(current)) {
        return 'signature_changed';
      }
    }

    const prevLines = previous.location.end.line - previous.location.start.line;
    const currLines = current.location.end.line - current.location.start.line;

    if (Math.abs(prevLines - currLines) > 10) {
      return 'body_changed';
    }

    return 'body_changed';
  }

  /**
   * Check if a symbol is public (exported)
   */
  private isPublicSymbol(symbol: SymbolInfo): boolean {
    return !symbol.name.startsWith('_');
  }

  /**
   * Check if a file should be analyzed for symbols
   */
  private async shouldAnalyzeFile(filePath: string): Promise<boolean> {
    const language = detectLanguage(filePath);
    if (!language) return false;

    if (!(await filterPath(filePath, { git: this.git }))) {
      return false;
    }

    const skipPatterns = [/vendor/, /\.min\./, getTestFilePattern()];

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
    const stagedChanges = await this.git.getWorkingDirectoryChanges();
    const added: SymbolInfo[] = [];
    const removed: SymbolInfo[] = [];
    const modified: SymbolDelta[] = [];

    for (const file of stagedChanges) {
      if (file.status === 'M' && (await this.shouldAnalyzeFile(file.path))) {
        try {
          const stagedContent = await this.git.safeGetStagedContent(file.path);
          if (!stagedContent) {
            logDebug(`[SymbolExtractor] No staged content for ${file.path}`);
            continue;
          }

          const headContent = await this.git.safeGetFileContent('HEAD', file.path);

          const stagedSymbols = await this.extractSymbolsFromContent(stagedContent, file.path);
          const bodyTexts = new Map([[file.path, stagedContent]]);
          const stagedSymbolsWithDNA = await assignDNAIds(
            stagedSymbols,
            bodyTexts,
            detectLanguage(file.path) || undefined
          );

          const headSymbols = headContent
            ? await this.extractSymbolsFromContent(headContent, file.path)
            : [];
          let headSymbolsWithDNA = headSymbols;

          if (headContent) {
            const headBodyTexts = new Map([[file.path, headContent]]);
            headSymbolsWithDNA = await assignDNAIds(
              headSymbols,
              headBodyTexts,
              detectLanguage(file.path) || undefined
            );
          }

          const changes = this.compareSymbolSets(
            headSymbolsWithDNA,
            stagedSymbolsWithDNA,
            file.path
          );

          added.push(...changes.added);
          removed.push(...changes.removed);
          modified.push(...changes.modified);
        } catch (error) {
          logDebug(`[SymbolExtractor] Failed to process staged changes for ${file.path}: ${error}`);
        }
      }
    }

    return { added, removed, modified };
  }
}
