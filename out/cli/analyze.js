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
    // Extract symbols
    const symbols = await symbolExtractor.extractCommitSymbols(sha, files);
    // Extract dependencies and compare
    const fileContents = new Map();
    for (const file of files) {
        // Skip deleted files
        if (file.status === 'D') {
            continue;
        }
        try {
            fileContents.set(file.path, git.getFileContent(sha, file.path));
        }
        catch {
            // Skip files that can't be read
        }
    }
    const edges = dependencyExtractor.extractCommitEdges(sha, symbols, fileContents);
    // Get difftastic highlights
    const difftasticHighlights = [];
    for (const file of files) {
        if (file.status === 'M') {
            try {
                const highlights = await difftastic.getCommitStructuralHighlights(sha, file.path);
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
    await storeAnalysisResult(analysis);
    console.log(`Stored analysis for ${sha}`);
}
exports.analyzeCommit = analyzeCommit;
async function storeAnalysisResult(analysis) {
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
    // Insert symbols
    const symbolStmt = db.prepare(`
    INSERT OR REPLACE INTO symbols
    (sha, path, symbol_id, name, kind, signature_pre, signature_post, loc_pre, loc_post, change_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    // Added symbols
    for (const symbol of analysis.symbols.added) {
        symbolStmt.run(analysis.commit.sha, symbol.id.split(':')[0], // Extract path from ID
        symbol.id, symbol.name, symbol.kind, null, symbol.signature, null, JSON.stringify(symbol.location), 'added');
    }
    // Removed symbols
    for (const symbol of analysis.symbols.removed) {
        symbolStmt.run(analysis.commit.sha, symbol.id.split(':')[0], symbol.id, symbol.name, symbol.kind, symbol.signature, null, JSON.stringify(symbol.location), null, 'removed');
    }
    // Modified symbols
    for (const delta of analysis.symbols.modified) {
        symbolStmt.run(analysis.commit.sha, delta.symbol.id.split(':')[0], delta.symbol.id, delta.symbol.name, delta.symbol.kind, delta.previousSymbol?.signature || null, delta.symbol.signature, delta.previousSymbol ? JSON.stringify(delta.previousSymbol.location) : null, JSON.stringify(delta.symbol.location), delta.changeType);
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