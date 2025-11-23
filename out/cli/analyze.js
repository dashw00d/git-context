"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeCommit = exports.analyzeStagedChanges = exports.analyzeLastCommits = void 0;
const config_1 = require("../utils/config");
const git_1 = require("../analysis/git");
const symbols_1 = require("../analysis/symbols");
const dependencies_1 = require("../analysis/dependencies");
const heuristics_1 = require("../analysis/heuristics");
const summarizer_1 = require("../llm/summarizer");
const difftastic_1 = require("../analysis/difftastic");
const database_1 = require("../storage/database");
async function analyzeLastCommits(count) {
    await (0, database_1.ensureDatabaseInitialized)();
    const db = (0, database_1.getDatabaseManager)().getDatabase();
    const gitRoot = (0, config_1.getGitRoot)();
    if (!gitRoot) {
        throw new Error('Not in a git repository');
    }
    const git = new git_1.GitOperations();
    const commits = git.getRecentCommits(count);
    console.log(`Analyzing ${commits.length} commits...`);
    for (const commit of commits) {
        try {
            console.log(`Processing commit ${commit.sha}...`);
            await analyzeCommit(commit.sha);
            console.log(`✓ Completed ${commit.sha}`);
        }
        catch (error) {
            console.error(`✗ Failed to analyze ${commit.sha}:`, error);
        }
    }
    console.log('Analysis complete!');
}
exports.analyzeLastCommits = analyzeLastCommits;
async function analyzeStagedChanges() {
    await (0, database_1.ensureDatabaseInitialized)();
    const db = (0, database_1.getDatabaseManager)().getDatabase();
    const gitRoot = (0, config_1.getGitRoot)();
    if (!gitRoot) {
        throw new Error('Not in a git repository');
    }
    // For staged changes, we create a temporary analysis
    // This is more complex and would require comparing staged vs HEAD
    console.log('Staged changes analysis not yet implemented');
    console.log('Use "ct analyze" to analyze committed changes');
}
exports.analyzeStagedChanges = analyzeStagedChanges;
async function analyzeCommit(sha) {
    const git = new git_1.GitOperations();
    // Get commit information
    const commitInfo = git.getCommitInfo(sha);
    const files = git.getFileChanges(sha);
    console.log(`Analyzing commit ${sha}: ${commitInfo.message.substring(0, 50)}...`);
    // Initialize analyzers
    const symbolExtractor = new symbols_1.SymbolExtractor(git);
    const dependencyExtractor = new dependencies_1.DependencyExtractor();
    const riskDetector = new heuristics_1.RiskDetector();
    const llmSummarizer = new summarizer_1.LLMSummarizer();
    const difftastic = (0, difftastic_1.getDifftasticIntegration)();
    // Extract symbols with semantic enrichment
    console.log(`Extracting symbols from ${files.length} files...`);
    const symbols = await symbolExtractor.extractCommitSymbols(sha, files);
    console.log(`Found ${symbols.added.length} added, ${symbols.removed.length} removed, ${symbols.modified.length} modified symbols`);
    if (symbols.renames.length > 0) {
        console.log(`Detected ${symbols.renames.length} renames`);
    }
    if (symbols.moves.length > 0) {
        console.log(`Detected ${symbols.moves.length} moves`);
    }
    console.log(`Extracted symbols: +${symbols.added.length} -${symbols.removed.length} ~${symbols.modified.length}`);
    // Extract dependencies and compare
    const fileContents = new Map();
    for (const file of files) {
        // Skip deleted files
        if (file.status === 'D') {
            continue;
        }
        try {
            fileContents.set(file.path, git.safeGetFileContent(sha, file.path));
        }
        catch {
            // Skip files that can't be read
        }
    }
    const edges = await dependencyExtractor.extractCommitEdges(sha, symbols, fileContents, files, git);
    console.log(`Extracted edges: +${edges.added.length} -${edges.removed.length}`);
    // Calculate blast radius for changed symbols
    const changedSymbols = [...symbols.added, ...symbols.modified.map(m => m.symbol)];
    const blastRadius = dependencyExtractor.calculateBlastRadius(changedSymbols, edges.added);
    const totalImpact = Array.from(blastRadius.impactScore.values()).reduce((a, b) => a + b, 0);
    console.log(`Blast radius calculated: ${totalImpact} total impacts across ${changedSymbols.length} changed symbols`);
    // Get difftastic highlights
    const difftasticHighlights = [];
    for (const file of files) {
        if (file.status === 'M') {
            try {
                const highlights = await difftastic.getCommitStructuralHighlights(sha, file.path, file.oldPath);
                difftasticHighlights.push(...highlights.highlights);
            }
            catch {
                // Skip difftastic failures
            }
        }
    }
    // Detect risks
    const risks = riskDetector.detectRisks(files, symbols, edges);
    // Create analysis result
    const analysis = {
        commit: commitInfo,
        files,
        symbols,
        edges,
        risks,
        difftasticHighlights,
        llmSummary: undefined
    };
    // Generate LLM summary
    try {
        analysis.llmSummary = await llmSummarizer.summarizeCommit(analysis);
    }
    catch (error) {
        console.warn(`LLM summarization failed for ${sha}:`, error);
    }
    // Store in database
    await storeAnalysisResult(analysis, symbols);
    console.log(`Stored analysis for ${sha}`);
}
exports.analyzeCommit = analyzeCommit;
async function storeAnalysisResult(analysis, symbols) {
    const db = (0, database_1.getDatabaseManager)().getDatabase();
    // Insert commit
    const commitStmt = db.prepare(`
    INSERT OR REPLACE INTO commits
    (sha, author, date, message, summary_md, raw_llm_json, files_changed, symbols_added, symbols_removed, symbols_modified, edges_added, edges_removed, risks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    const llmJson = analysis.llmSummary ? JSON.stringify(analysis.llmSummary) : null;
    const risksJson = JSON.stringify(analysis.risks);
    commitStmt.run(analysis.commit.sha, analysis.commit.author, analysis.commit.date, analysis.commit.message, analysis.llmSummary?.summary_md || '', llmJson, analysis.files.length, analysis.symbols.added.length, analysis.symbols.removed.length, analysis.symbols.modified.length, analysis.edges.added.length, analysis.edges.removed.length, risksJson);
    // Insert files
    const fileStmt = db.prepare(`
    INSERT OR REPLACE INTO files (sha, path, status, lang)
    VALUES (?, ?, ?, ?)
  `);
    for (const file of analysis.files) {
        fileStmt.run(analysis.commit.sha, file.path, file.status, null); // TODO: detect language
    }
    // Insert symbols with enhanced semantic information
    const symbolStmt = db.prepare(`
    INSERT OR REPLACE INTO symbols
    (sha, path, symbol_id, name, kind, signature_pre, signature_post, loc_pre, loc_post, change_type, mod_reason, diff_snippet_pre, diff_snippet_post, confidence)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    // Added symbols
    for (const symbol of symbols.added) {
        symbolStmt.run(analysis.commit.sha, symbol.id.split(':')[0], // Extract path from ID
        symbol.id, symbol.name, symbol.kind, null, symbol.signature, null, JSON.stringify(symbol.location), 'added', null, null, null, 1.0);
    }
    // Removed symbols
    for (const symbol of symbols.removed) {
        symbolStmt.run(analysis.commit.sha, symbol.id.split(':')[0], symbol.id, symbol.name, symbol.kind, symbol.signature, null, JSON.stringify(symbol.location), null, 'removed', null, null, null, 1.0);
    }
    // Modified symbols with semantic enhancement
    for (const delta of symbols.modified) {
        symbolStmt.run(analysis.commit.sha, delta.symbol.id.split(':')[0], delta.symbol.id, delta.symbol.name, delta.symbol.kind, delta.previousSymbol?.signature || null, delta.symbol.signature, delta.previousSymbol ? JSON.stringify(delta.previousSymbol.location) : null, JSON.stringify(delta.symbol.location), delta.changeType, delta.modReason || null, delta.diffSnippetPre || null, delta.diffSnippetPost || null, 1.0);
    }
    // Store renames as special symbol entries
    for (const rename of symbols.renames) {
        // Store the new symbol with rename metadata
        symbolStmt.run(analysis.commit.sha, rename.newSymbol.id.split(':')[0], rename.newSymbol.id, rename.newSymbol.name, rename.newSymbol.kind, rename.oldSymbol.signature, rename.newSymbol.signature, JSON.stringify(rename.oldSymbol.location), JSON.stringify(rename.newSymbol.location), 'renamed', null, null, null, rename.confidence);
    }
    // Insert into renames table
    const renamesStmt = db.prepare(`
    INSERT OR REPLACE INTO renames
    (sha, path, old_symbol_id, new_symbol_id, old_name, new_name, confidence)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
    for (const rename of symbols.renames) {
        renamesStmt.run(analysis.commit.sha, rename.newSymbol.id.split(':')[0], rename.oldSymbol.id, rename.newSymbol.id, rename.oldSymbol.name, rename.newSymbol.name, rename.confidence);
    }
    // Store moves as special symbol entries
    for (const move of symbols.moves) {
        symbolStmt.run(analysis.commit.sha, move.newPath, move.symbol.id, move.symbol.name, move.symbol.kind, null, move.symbol.signature, null, JSON.stringify(move.symbol.location), 'moved', null, null, null, move.confidence);
    }
    // Insert edges
    const edgeStmt = db.prepare(`
    INSERT OR REPLACE INTO edges (sha, from_symbol_id, to_symbol_id, edge_type, change_type)
    VALUES (?, ?, ?, ?, ?)
  `);
    for (const edge of [...analysis.edges.added, ...analysis.edges.removed]) {
        const changeType = analysis.edges.added.includes(edge) ? 'added' : 'removed';
        edgeStmt.run(analysis.commit.sha, edge.from, edge.to, edge.type, changeType);
    }
}
//# sourceMappingURL=analyze.js.map