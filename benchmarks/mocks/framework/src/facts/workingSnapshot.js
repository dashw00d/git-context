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
exports.getWorkingSnapshot = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const symbols_1 = require("../analysis/symbols");
const dependencies_1 = require("../analysis/dependencies");
const git_1 = require("../analysis/git");
const config_1 = require("../utils/config");
/**
 * Get scoped working tree snapshot using real SymbolExtractor + DependencyExtractor
 */
async function getWorkingSnapshot(scopePaths, liveOverrides) {
    const gitRoot = (0, config_1.getGitRoot)();
    if (!gitRoot) {
        throw new Error('Not in a git repository');
    }
    const symbolsById = new Map();
    const symbolsByFile = new Map();
    const edges = [];
    const analyzedPaths = new Set();
    // Initialize analyzers
    const git = new git_1.GitOperations();
    const symbolExtractor = new symbols_1.SymbolExtractor(git);
    const dependencyExtractor = new dependencies_1.DependencyExtractor();
    // Only analyze files in scope
    for (const filePath of scopePaths) {
        try {
            const fullPath = path.join(gitRoot, filePath);
            // Check if file exists
            if (!fs.existsSync(fullPath)) {
                console.log(`[WORKING-SNAPSHOT] Skipping non-existent path: ${filePath}`);
                continue;
            }
            // Check if it's a file (not a directory)
            const stat = fs.statSync(fullPath);
            if (!stat.isFile()) {
                console.log(`[WORKING-SNAPSHOT] Skipping non-file (directory or link): ${filePath}`);
                continue;
            }
            analyzedPaths.add(filePath);
            let content;
            if (liveOverrides && liveOverrides.has(fullPath)) {
                content = liveOverrides.get(fullPath);
                console.log(`[WORKING-SNAPSHOT] Using live content for: ${filePath}`);
            }
            else {
                content = fs.readFileSync(fullPath, 'utf8');
            }
            // Extract symbols from current file using the same SymbolExtractor as commit analysis
            // CRITICAL: This MUST use the exact same extractor and ID format as commit analysis
            // to ensure semantic ID consistency (symbol.id format: `${filePath}:${semanticId}`)
            const symbols = await symbolExtractor.extractSymbolsFromContent(content, filePath);
            for (const symbol of symbols) {
                // Verify symbol ID format matches commit analysis format
                if (!symbol.id || !symbol.id.includes(':')) {
                    console.warn(`Invalid symbol ID format in ${filePath}: ${symbol.id}. Expected format: path:semanticId`);
                    continue;
                }
                const symbolContext = {
                    id: 0,
                    symbol_id: symbol.id,
                    name: symbol.name,
                    kind: symbol.kind,
                    signature: symbol.signature,
                    loc_pre: symbol.location ? {
                        start: { line: symbol.location.start.line, column: symbol.location.start.column },
                        end: { line: symbol.location.end.line, column: symbol.location.end.column }
                    } : undefined
                };
                symbolsById.set(symbol.id, symbolContext);
                if (!symbolsByFile.has(filePath)) {
                    symbolsByFile.set(filePath, []);
                }
                symbolsByFile.get(filePath).push(symbolContext);
            }
            // Extract edges from current file
            const fileEdges = dependencyExtractor.extractDependencies(content, filePath, symbols);
            edges.push(...fileEdges.map(edge => ({
                from_symbol_id: edge.from,
                to_symbol_id: edge.to,
                edge_type: edge.type,
                change_type: 'added',
                confidence: edge.confidence || 1.0,
                is_resolved: edge.isResolved || true
            })));
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.warn(`[WORKING-SNAPSHOT] Skipped ${filePath}: ${errorMsg}`);
        }
    }
    return { symbolsById, symbolsByFile, edges, analyzedPaths };
}
exports.getWorkingSnapshot = getWorkingSnapshot;
