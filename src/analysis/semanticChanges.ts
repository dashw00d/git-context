import { ModReason, SymbolDelta, SymbolInfo } from '../types';
import { detectLanguage } from '../utils/config';

export class SemanticChangeDetector {
  detectRenames(
    removed: SymbolInfo[],
    added: SymbolInfo[],
    threshold: number = 0.8
  ): Array<{
    oldSymbol: SymbolInfo;
    newSymbol: SymbolInfo;
    confidence: number;
  }> {
    const renames: Array<{
      oldSymbol: SymbolInfo;
      newSymbol: SymbolInfo;
      confidence: number;
    }> = [];

    for (const removedSymbol of removed) {
      let bestMatch: SymbolInfo | null = null;
      let bestConfidence = 0;

      for (const addedSymbol of added) {
        const confidence = this.calculateRenameConfidence(removedSymbol, addedSymbol);
        if (confidence > bestConfidence && confidence >= threshold) {
          bestMatch = addedSymbol;
          bestConfidence = confidence;
        }
      }

      if (bestMatch) {
        renames.push({
          oldSymbol: removedSymbol,
          newSymbol: bestMatch,
          confidence: bestConfidence,
        });
      }
    }

    return renames;
  }

  private calculateRenameConfidence(oldSymbol: SymbolInfo, newSymbol: SymbolInfo): number {
    let confidence = 0;

    if (oldSymbol.kind === newSymbol.kind) {
      confidence += 0.3;
    } else {
      return 0;
    }

    if (
      this.signaturesSimilar(
        oldSymbol.signature,
        newSymbol.signature,
        oldSymbol.name,
        newSymbol.name
      )
    ) {
      confidence += 0.4;
    }

    if (oldSymbol.name !== newSymbol.name) {
      const nameSimilarity = this.nameSimilarity(oldSymbol.name, newSymbol.name);
      confidence += nameSimilarity * 0.3;
    }

    return Math.min(confidence, 1.0);
  }

  private signaturesSimilar(sig1: string, sig2: string, name1: string, name2: string): boolean {
    const normalized1 = sig1.replace(name1, 'SYMBOL').replace(/\s+/g, ' ').trim();
    const normalized2 = sig2.replace(name2, 'SYMBOL').replace(/\s+/g, ' ').trim();

    return normalized1 === normalized2;
  }

  private nameSimilarity(name1: string, name2: string): number {
    if (name1 === name2) return 1.0;

    const prefixes = ['get', 'set', 'is', 'has', 'can', 'should', 'validate'];
    const suffixes = ['Handler', 'Service', 'Controller', 'Manager', 'Util', 'Helper'];

    for (const prefix of prefixes) {
      if (name1.startsWith(prefix) && name2.startsWith(prefix)) {
        const rest1 = name1.slice(prefix.length);
        const rest2 = name2.slice(prefix.length);
        if (rest1 === rest2) return 0.9;
      }
    }

    for (const suffix of suffixes) {
      if (name1.endsWith(suffix) && name2.endsWith(suffix)) {
        const rest1 = name1.slice(0, -suffix.length);
        const rest2 = name2.slice(0, -suffix.length);
        if (rest1 === rest2) return 0.9;
      }
    }

    return this.levenshteinSimilarity(name1, name2);
  }

  private levenshteinSimilarity(s1: string, s2: string): number {
    const len1 = s1.length;
    const len2 = s2.length;
    const maxLen = Math.max(len1, len2);

    if (maxLen === 0) return 1.0;

    const distance = this.levenshteinDistance(s1, s2);
    return 1.0 - distance / maxLen;
  }

  private levenshteinDistance(s1: string, s2: string): number {
    const matrix = Array(s2.length + 1)
      .fill(null)
      .map(() => Array(s1.length + 1).fill(null));

    for (let i = 0; i <= s1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= s2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= s2.length; j++) {
      for (let i = 1; i <= s1.length; i++) {
        const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[s2.length][s1.length];
  }

  detectMoves(
    previousSymbols: SymbolInfo[],
    currentSymbols: SymbolInfo[]
  ): Array<{
    symbol: SymbolInfo;
    oldPath: string;
    newPath: string;
    confidence: number;
  }> {
    const moves: Array<{
      symbol: SymbolInfo;
      oldPath: string;
      newPath: string;
      confidence: number;
    }> = [];

    const prevByName = new Map<string, SymbolInfo[]>();
    const currByName = new Map<string, SymbolInfo[]>();

    for (const symbol of previousSymbols) {
      const key = `${symbol.name}:${symbol.kind}`;
      if (!prevByName.has(key)) prevByName.set(key, []);
      prevByName.get(key)!.push(symbol);
    }

    for (const symbol of currentSymbols) {
      const key = `${symbol.name}:${symbol.kind}`;
      if (!currByName.has(key)) currByName.set(key, []);
      currByName.get(key)!.push(symbol);
    }

    for (const [key, prevGroup] of prevByName) {
      const currGroup = currByName.get(key);
      if (!currGroup) continue;

      for (const prevSymbol of prevGroup) {
        for (const currSymbol of currGroup) {
          if (prevSymbol.filePath !== currSymbol.filePath) {
            const confidence = this.calculateMoveConfidence(prevSymbol, currSymbol);
            if (confidence > 0.7) {
              moves.push({
                symbol: currSymbol,
                oldPath: prevSymbol.filePath,
                newPath: currSymbol.filePath,
                confidence,
              });
            }
          }
        }
      }
    }

    return moves;
  }

  private calculateMoveConfidence(oldSymbol: SymbolInfo, newSymbol: SymbolInfo): number {
    let confidence = 0;

    if (oldSymbol.name === newSymbol.name && oldSymbol.kind === newSymbol.kind) {
      confidence += 0.5;
    } else {
      return 0;
    }

    if (oldSymbol.signature === newSymbol.signature) {
      confidence += 0.4;
    } else if (
      this.signaturesSimilar(
        oldSymbol.signature,
        newSymbol.signature,
        oldSymbol.name,
        newSymbol.name
      )
    ) {
      confidence += 0.3;
    }

    const oldLang = detectLanguage(oldSymbol.filePath);
    const newLang = detectLanguage(newSymbol.filePath);
    if (oldLang === newLang) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  classifyModificationReason(delta: SymbolDelta): ModReason {
    if (!delta.previousSymbol) return 'body_changed';

    const prev = delta.previousSymbol;
    const curr = delta.symbol;

    if (prev.signature !== curr.signature) {
      const prevNormalized = this.normalizeSignature(prev.signature);
      const currNormalized = this.normalizeSignature(curr.signature);

      if (prevNormalized !== currNormalized) {
        return 'signature_changed';
      }
    }

    const visibilityRegex = /(public|private|protected|export)/g;
    const prevVisibility = (prev.signature.match(visibilityRegex) || []).join(' ');
    const currVisibility = (curr.signature.match(visibilityRegex) || []).join(' ');

    if (prevVisibility !== currVisibility) {
      return 'visibility_changed';
    }

    const annotationRegex = /@\w+/g;
    const prevAnnotations = (prev.signature.match(annotationRegex) || []).join(' ');
    const currAnnotations = (curr.signature.match(annotationRegex) || []).join(' ');

    if (prevAnnotations !== currAnnotations) {
      return 'annotation_changed';
    }

    const prevLines = prev.location.end.line - prev.location.start.line;
    const currLines = curr.location.end.line - curr.location.start.line;

    if (Math.abs(prevLines - currLines) > prevLines * 0.5) {
      return 'body_changed';
    }

    return 'body_changed';
  }

  private normalizeSignature(signature: string): string {
    return signature
      .replace(/\b\w+\s+(\w+)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  extractDiffSnippets(
    previousContent: string,
    currentContent: string,
    symbol: SymbolInfo,
    maxLines: number = 10
  ): { pre: string; post: string } {
    const extractSnippet = (content: string, location: typeof symbol.location): string => {
      const lines = content.split('\n');
      const startLine = Math.max(0, location.start.line - 3);

      const endLine = Math.min(lines.length, location.end.line + 3, startLine + maxLines);

      return lines.slice(startLine, endLine).join('\n');
    };

    return {
      pre: extractSnippet(previousContent, symbol.location),
      post: extractSnippet(currentContent, symbol.location),
    };
  }
}
