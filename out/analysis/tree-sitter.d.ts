import { SymbolInfo } from '../types';
export declare function detectLanguage(filePath: string): string | null;
export declare class TreeSitterParser {
    private parsers;
    private initialized;
    initializeParsers(): Promise<void>;
    getParser(languageId: string): any | undefined;
    parse(content: string, languageId: string): Promise<any | undefined>;
    parseFile(content: string, languageId: string): Promise<any | null>;
    extractSymbols(tree: any, filePath: string, language: string): SymbolInfo[];
    private extractSymbolFromNode;
    private extractPHPSymbol;
    private extractJSSymbol;
    private extractPHPSignature;
    private extractJSSignature;
    dispose(): void;
}
export declare function getTreeSitterParser(): TreeSitterParser;
//# sourceMappingURL=tree-sitter.d.ts.map