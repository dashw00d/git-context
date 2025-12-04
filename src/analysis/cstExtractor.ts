import * as crypto from 'crypto';
import { SymbolInfo } from '../types';
import { CstFact } from '../types/cstFacts';
import { getExtensionConfig, isCstOnlyLanguage, LANGUAGES } from '../utils/config';

export class CstExtractor {
  extractCstFacts(
    tree: any,
    filePath: string,
    language: string,
    existingSymbols: SymbolInfo[] = []
  ): CstFact[] {
    const config = getExtensionConfig();
    const isCstOnly = isCstOnlyLanguage(language);
    const enableAugment = config.enableCstAugmentation ?? false;

    if (!isCstOnly && !enableAugment) {
      return [];
    }

    const facts: CstFact[] = [];
    const depthLimit = 3;

    const traverse = (node: any, depth: number): void => {
      if (depth > depthLimit) return;

      if (isCstOnly) {
        const fact = this.extractCstOnlyFact(node, filePath, language);
        if (fact) {
          facts.push(fact);
        }
      } else if (enableAugment) {
        const fact = this.extractHybridAuxiliaryFact(node, filePath, language, existingSymbols);
        if (fact) {
          facts.push(fact);
        }
      }

      if (node.childCount > 0 && depth < depthLimit) {
        for (const child of node.children) {
          if (child.isNamed) {
            traverse(child, depth + 1);
          }
        }
      }
    };

    traverse(tree.rootNode, 0);
    return facts;
  }

  private extractCstOnlyFact(node: any, filePath: string, language: string): CstFact | null {
    switch (language) {
      case LANGUAGES.MARKDOWN:
        return this.extractMarkdownFact(node, filePath);
      case LANGUAGES.JSON:
        return this.extractJsonFact(node, filePath);
      case LANGUAGES.YAML:
        return this.extractYamlFact(node, filePath);
      case LANGUAGES.CSS:
        return this.extractCssFact(node, filePath);
      default:
        return null;
    }
  }

  private extractMarkdownFact(node: any, filePath: string): CstFact | null {
    if (node.type === 'atx_heading') {
      const headingMarker = node.namedChildren.find(
        (c: any) =>
          c.type === 'atx_h1_marker' ||
          c.type === 'atx_h2_marker' ||
          c.type === 'atx_h3_marker' ||
          c.type === 'atx_h4_marker' ||
          c.type === 'atx_h5_marker' ||
          c.type === 'atx_h6_marker'
      );
      let level = 1;
      if (headingMarker) {
        const markerText = headingMarker.text;
        level = markerText.length;
      }

      const contentNode = node.namedChildren.find((c: any) => c.type === 'heading_content');
      const name = contentNode?.text?.trim() || '';

      if (!name) return null;

      const bodyShape = this.hashCstSubset(node, true);
      const id = `heading_${filePath}_${node.startPosition.row}_${name}`;
      const dnaId = this.computeCstDna('heading', name, level, bodyShape);

      return {
        id,
        dnaId,
        name,
        kind: 'heading',
        signature: `#${'#'.repeat(level - 1)} ${name}`,
        location: {
          start: { line: node.startPosition.row + 1, column: node.startPosition.column },
          end: { line: node.endPosition.row + 1, column: node.endPosition.column },
        },
        nodeType: 'atx_heading',
        level,
        bodyShape,
        timeline: [],
      };
    }

    return null;
  }

  private extractJsonFact(node: any, filePath: string): CstFact | null {
    if (node.type === 'pair') {
      const keyNode = node.namedChildren.find((c: any) => c.type === 'string');
      if (!keyNode) return null;

      const key = keyNode.text?.replace(/^"|"$/g, '') || '';
      if (!key) return null;

      const bodyShape = this.hashCstSubset(node, true);
      const id = `property_${filePath}_${node.startPosition.row}_${key}`;
      const dnaId = this.computeCstDna('property', key, undefined, bodyShape);

      return {
        id,
        dnaId,
        name: key,
        kind: 'property',
        signature: `"${key}": ...`,
        location: {
          start: { line: node.startPosition.row + 1, column: node.startPosition.column },
          end: { line: node.endPosition.row + 1, column: node.endPosition.column },
        },
        nodeType: 'pair',
        bodyShape,
        timeline: [],
      };
    }

    return null;
  }

  private extractYamlFact(node: any, filePath: string): CstFact | null {
    if (node.type === 'block_mapping_pair') {
      const keyNode = node.namedChildren.find((c: any) => c.type === 'block_mapping_key');
      if (!keyNode) return null;

      const key = keyNode.text?.trim() || '';
      if (!key) return null;

      const bodyShape = this.hashCstSubset(node, true);
      const id = `property_${filePath}_${node.startPosition.row}_${key}`;
      const dnaId = this.computeCstDna('property', key, undefined, bodyShape);

      return {
        id,
        dnaId,
        name: key,
        kind: 'property',
        signature: `${key}: ...`,
        location: {
          start: { line: node.startPosition.row + 1, column: node.startPosition.column },
          end: { line: node.endPosition.row + 1, column: node.endPosition.column },
        },
        nodeType: 'block_mapping_pair',
        bodyShape,
        timeline: [],
      };
    }

    return null;
  }

  private extractCssFact(node: any, filePath: string): CstFact | null {
    if (node.type === 'rule_set') {
      const selectorNode = node.namedChildren.find((c: any) => c.type === 'selectors');
      if (!selectorNode) return null;

      const selector = selectorNode.text?.trim() || '';
      if (!selector) return null;

      const bodyShape = this.hashCstSubset(node, true);
      const id = `rule_${filePath}_${node.startPosition.row}_${selector}`;
      const dnaId = this.computeCstDna('cst_node', selector, undefined, bodyShape);

      return {
        id,
        dnaId,
        name: selector,
        kind: 'cst_node',
        signature: `${selector} { ... }`,
        location: {
          start: { line: node.startPosition.row + 1, column: node.startPosition.column },
          end: { line: node.endPosition.row + 1, column: node.endPosition.column },
        },
        nodeType: 'rule_set',
        bodyShape,
        timeline: [],
      };
    }

    return null;
  }

  private extractHybridAuxiliaryFact(
    node: any,
    filePath: string,
    language: string,
    existingSymbols: SymbolInfo[]
  ): CstFact | null {
    if (node.type === 'comment') {
      const text = node.text || '';

      const overlaps = existingSymbols.some(s =>
        this.locationsOverlap(s.location, {
          start: { line: node.startPosition.row + 1, column: node.startPosition.column },
          end: { line: node.endPosition.row + 1, column: node.endPosition.column },
        })
      );

      if (overlaps) return null;

      const bodyShape = this.hashCstSubset(node, true);
      const id = `comment_${filePath}_${node.startPosition.row}_${node.startPosition.column}`;
      const dnaId = this.computeCstDna('doc_comment', 'comment', undefined, bodyShape);

      return {
        id,
        dnaId,
        name: 'comment',
        kind: 'doc_comment',
        signature: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
        location: {
          start: { line: node.startPosition.row + 1, column: node.startPosition.column },
          end: { line: node.endPosition.row + 1, column: node.endPosition.column },
        },
        nodeType: 'comment',
        bodyShape,
        timeline: [],
      };
    }

    return null;
  }

  private hashCstSubset(node: any, includeChildren: boolean = true): string {
    const serialized = this.serializeNodeForHash(node, includeChildren);
    return crypto.createHash('sha256').update(serialized).digest('hex').substring(0, 16);
  }

  private serializeNodeForHash(node: any, includeChildren: boolean): string {
    const parts: string[] = [node.type];

    if (includeChildren && node.childCount > 0) {
      for (const child of node.children) {
        if (child.isNamed) {
          parts.push(this.serializeNodeForHash(child, true));
        }
      }
    }

    return parts.join('::');
  }

  private computeCstDna(
    kind: string,
    name: string,
    level: number | undefined,
    bodyShape: string
  ): string {
    const parts = [kind, name, level !== undefined ? String(level) : '', bodyShape];

    return crypto.createHash('sha256').update(parts.join('::')).digest('hex').substring(0, 16);
  }

  private locationsOverlap(
    loc1: { start: { line: number; column: number }; end: { line: number; column: number } },
    loc2: { start: { line: number; column: number }; end: { line: number; column: number } }
  ): boolean {
    return !(
      loc1.end.line < loc2.start.line ||
      loc1.start.line > loc2.end.line ||
      (loc1.end.line === loc2.start.line && loc1.end.column < loc2.start.column) ||
      (loc1.start.line === loc2.end.line && loc1.start.column > loc2.end.column)
    );
  }
}
