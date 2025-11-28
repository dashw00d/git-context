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
exports.computeHybridDna = exports.assignDNAIds = exports.computeBodyHash = exports.computeSymbolDNA = void 0;
const crypto = __importStar(require("crypto"));
const cstFacts_1 = require("../types/cstFacts");
/**
 * Generate stable DNA hash for symbol (survives renames, moves)
 */
function computeSymbolDNA(symbol, bodyText) {
    // DNA based on: kind + signature + body shape (not name, not location)
    const parts = [
        symbol.kind,
        normalizeSignature(symbol.signature),
        bodyText ? computeBodyShape(bodyText) : ''
    ];
    return crypto.createHash('sha256')
        .update(parts.join('::'))
        .digest('hex')
        .substring(0, 16);
}
exports.computeSymbolDNA = computeSymbolDNA;
/**
 * Compute body hash (for modification detection)
 */
function computeBodyHash(bodyText) {
    // Normalize whitespace, remove comments
    const normalized = bodyText
        .replace(/\/\*[\s\S]*?\*\//g, '') // Block comments
        .replace(/\/\/.*/g, '') // Line comments
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
    return crypto.createHash('sha256')
        .update(normalized)
        .digest('hex')
        .substring(0, 16);
}
exports.computeBodyHash = computeBodyHash;
/**
 * Compute structural shape of body (ignores identifiers)
 */
function computeBodyShape(bodyText) {
    // Extract AST node types only (no identifiers)
    // This is a simplified version - real implementation would use Tree-sitter
    const tokens = bodyText
        .replace(/[a-zA-Z_][a-zA-Z0-9_]*/g, 'ID') // Replace identifiers
        .replace(/\d+/g, 'NUM') // Replace numbers
        .replace(/["'].*?["']/g, 'STR') // Replace strings
        .replace(/\s+/g, ''); // Remove whitespace
    return crypto.createHash('sha256')
        .update(tokens)
        .digest('hex')
        .substring(0, 8);
}
function normalizeSignature(sig) {
    // Remove parameter names, keep types only
    return sig
        .replace(/\w+\s*:/g, ':') // Remove param names in TS
        .replace(/\s+/g, '') // Remove whitespace
        .toLowerCase();
}
/**
 * Assign DNA IDs to symbols
 */
function assignDNAIds(symbols, bodyTexts) {
    return symbols.map(symbol => {
        const bodyText = bodyTexts?.get(symbol.id);
        const dnaId = computeSymbolDNA(symbol, bodyText);
        const bodyHash = bodyText ? computeBodyHash(bodyText) : undefined;
        return {
            ...symbol,
            dnaId,
            bodyHash
        };
    });
}
exports.assignDNAIds = assignDNAIds;
/**
 * Compute DNA for hybrid fact (symbol or CST fact)
 */
function computeHybridDna(fact, bodyText) {
    if ((0, cstFacts_1.isCstFact)(fact)) {
        // For CST facts: kind + name + level + bodyShape + timeline.length
        const parts = [
            fact.kind,
            fact.name,
            fact.level !== undefined ? String(fact.level) : '',
            fact.bodyShape,
            String(fact.timeline.length)
        ];
        return crypto.createHash('sha256')
            .update(parts.join('::'))
            .digest('hex')
            .substring(0, 16);
    }
    else {
        // For semantic symbols: use existing computeSymbolDNA
        return computeSymbolDNA(fact, bodyText);
    }
}
exports.computeHybridDna = computeHybridDna;
