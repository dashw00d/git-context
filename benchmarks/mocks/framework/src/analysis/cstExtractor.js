"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CstExtractor = void 0;
const crypto = __importStar(require("crypto"));
const config_1 = require("../utils/config");
/**
 * Extract CST facts from a tree-sitter tree
 * Supports both CST-only languages and hybrid augmentation
 */
class CstExtractor {
    /**
     * Extract CST facts from tree (CST-only or hybrid augmentation)
     */
    extractCstFacts(tree, filePath, language, existingSymbols = []) {
        const config = (0, config_1.getExtensionConfig)();
        const isCstOnly = (0, config_1.isCstOnlyLanguage)(language);
        const enableAugment = config.enableCstAugmentation ?? false;
        // Only extract if CST-only or augmentation enabled
        if (!isCstOnly && !enableAugment) {
            return [];
        }
        const facts = [];
        const depthLimit = 3; // Limit traversal depth for performance
        const traverse = (node, depth) => {
            if (depth > depthLimit)
                return;
            // Extract based on language and mode
            if (isCstOnly) {
                const fact = this.extractCstOnlyFact(node, filePath, language);
                if (fact) {
                    facts.push(fact);
                }
            }
            else if (enableAugment) {
                // Hybrid augmentation: extract auxiliary nodes
                const fact = this.extractHybridAuxiliaryFact(node, filePath, language, existingSymbols);
                if (fact) {
                    facts.push(fact);
                }
            }
            // Recurse into children
            if (node.childCount > 0 && depth < depthLimit) {
                for (const child of node.children) {
                    if (child.isNamed) {
                        traverse(child, depth + 1);
                    }
                }
            }
        };
        // Start traversal from root node
        traverse(tree.rootNode, 0);
        return facts;
    }
    /**
     * Extract CST fact for CST-only languages (Markdown, JSON, YAML, CSS)
     */
    extractCstOnlyFact(node, filePath, language) {
        switch (language) {
            case config_1.LANGUAGES.MARKDOWN:
                return this.extractMarkdownFact(node, filePath);
            case config_1.LANGUAGES.JSON:
                return this.extractJsonFact(node, filePath);
            case config_1.LANGUAGES.YAML:
                return this.extractYamlFact(node, filePath);
            case config_1.LANGUAGES.CSS:
                return this.extractCssFact(node, filePath);
            default:
                return null;
        }
    }
    /**
     * Extract Markdown heading fact
     */
    extractMarkdownFact(node, filePath) {
        // Check for heading nodes (atx_heading or setext_heading)
        if (node.type === 'atx_heading') {
            // Extract level from number of # characters
            const headingMarker = node.namedChildren.find((c) => c.type === 'atx_h1_marker' || c.type === 'atx_h2_marker' || c.type === 'atx_h3_marker' || c.type === 'atx_h4_marker' || c.type === 'atx_h5_marker' || c.type === 'atx_h6_marker');
            let level = 1;
            if (headingMarker) {
                const markerText = headingMarker.text;
                level = markerText.length; // Number of # characters
            }
            // Extract heading content
            const contentNode = node.namedChildren.find((c) => c.type === 'heading_content');
            const name = contentNode?.text?.trim() || '';
            if (!name)
                return null;
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
                    end: { line: node.endPosition.row + 1, column: node.endPosition.column }
                },
                nodeType: 'atx_heading',
                level,
                bodyShape,
                timeline: [] // Will be populated by timeline manager
            };
        }
        return null;
    }
    /**
     * Extract JSON property fact
     */
    extractJsonFact(node, filePath) {
        if (node.type === 'pair') {
            // Extract key from string child
            const keyNode = node.namedChildren.find((c) => c.type === 'string');
            if (!keyNode)
                return null;
            // Remove quotes from key
            const key = keyNode.text?.replace(/^"|"$/g, '') || '';
            if (!key)
                return null;
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
                    end: { line: node.endPosition.row + 1, column: node.endPosition.column }
                },
                nodeType: 'pair',
                bodyShape,
                timeline: []
            };
        }
        return null;
    }
    /**
     * Extract YAML property fact
     */
    extractYamlFact(node, filePath) {
        if (node.type === 'block_mapping_pair') {
            // Extract key from block_mapping_key
            const keyNode = node.namedChildren.find((c) => c.type === 'block_mapping_key');
            if (!keyNode)
                return null;
            const key = keyNode.text?.trim() || '';
            if (!key)
                return null;
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
                    end: { line: node.endPosition.row + 1, column: node.endPosition.column }
                },
                nodeType: 'block_mapping_pair',
                bodyShape,
                timeline: []
            };
        }
        return null;
    }
    /**
     * Extract CSS rule fact
     */
    extractCssFact(node, filePath) {
        if (node.type === 'rule_set') {
            // Extract selector
            const selectorNode = node.namedChildren.find((c) => c.type === 'selectors');
            if (!selectorNode)
                return null;
            const selector = selectorNode.text?.trim() || '';
            if (!selector)
                return null;
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
                    end: { line: node.endPosition.row + 1, column: node.endPosition.column }
                },
                nodeType: 'rule_set',
                bodyShape,
                timeline: []
            };
        }
        return null;
    }
    /**
     * Extract hybrid auxiliary fact (comments, docstrings) for supported languages
     */
    extractHybridAuxiliaryFact(node, filePath, language, existingSymbols) {
        // Extract comments for JS/TS/PHP
        if (node.type === 'comment') {
            const text = node.text || '';
            // Filter overlaps: don't extract if symbol with same location exists
            const overlaps = existingSymbols.some(s => this.locationsOverlap(s.location, {
                start: { line: node.startPosition.row + 1, column: node.startPosition.column },
                end: { line: node.endPosition.row + 1, column: node.endPosition.column }
            }));
            if (overlaps)
                return null;
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
                    end: { line: node.endPosition.row + 1, column: node.endPosition.column }
                },
                nodeType: 'comment',
                bodyShape,
                timeline: []
            };
        }
        return null;
    }
    /**
     * Hash CST subset (structural shape)
     */
    hashCstSubset(node, includeChildren = true) {
        // Serialize node structure (simplified - exclude trivia)
        const serialized = this.serializeNodeForHash(node, includeChildren);
        return crypto.createHash('sha256')
            .update(serialized)
            .digest('hex')
            .substring(0, 16);
    }
    /**
     * Serialize node for hashing (exclude trivia)
     */
    serializeNodeForHash(node, includeChildren) {
        const parts = [node.type];
        if (includeChildren && node.childCount > 0) {
            for (const child of node.children) {
                if (child.isNamed) {
                    parts.push(this.serializeNodeForHash(child, true));
                }
            }
        }
        return parts.join('::');
    }
    /**
     * Compute DNA for CST fact
     */
    computeCstDna(kind, name, level, bodyShape) {
        const parts = [
            kind,
            name,
            level !== undefined ? String(level) : '',
            bodyShape
        ];
        return crypto.createHash('sha256')
            .update(parts.join('::'))
            .digest('hex')
            .substring(0, 16);
    }
    /**
     * Check if two locations overlap
     */
    locationsOverlap(loc1, loc2) {
        // Check if locations overlap (simplified check)
        return !(loc1.end.line < loc2.start.line ||
            loc1.start.line > loc2.end.line ||
            (loc1.end.line === loc2.start.line && loc1.end.column < loc2.start.column) ||
            (loc1.start.line === loc2.end.line && loc1.start.column > loc2.end.column));
    }
}
exports.CstExtractor = CstExtractor;
