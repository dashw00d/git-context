"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSymbolInfo = exports.isCstFact = void 0;
/**
 * Type guard to check if a fact is a CST fact
 */
function isCstFact(fact) {
    return fact.kind === 'cst_node' || fact.kind === 'heading' || fact.kind === 'property' || fact.kind === 'doc_comment';
}
exports.isCstFact = isCstFact;
/**
 * Type guard to check if a fact is a semantic symbol
 */
function isSymbolInfo(fact) {
    return !isCstFact(fact);
}
exports.isSymbolInfo = isSymbolInfo;
