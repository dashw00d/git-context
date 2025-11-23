import { getGitRoot } from '../utils/config';
import { GitOperations } from '../analysis/git';
import { SymbolExtractor } from '../analysis/symbols';
import { DependencyExtractor } from '../analysis/dependencies';
import { RiskDetector } from '../analysis/heuristics';
import { LLMSummarizer } from '../llm/summarizer';
import { getDifftasticIntegration } from '../analysis/difftastic';
import { getDatabaseManager, ensureDatabaseInitialized } from '../storage/database';
import { AnalysisResult } from '../types';

export async function analyzeLastCommits(count: number): Promise<void> {
  await ensureDatabaseInitialized();
  const db = getDatabaseManager().getDatabase();
  const gitRoot = getGitRoot();
  if (!gitRoot) {
    throw new Error('Not in a git repository');
  }

  const git = new GitOperations();
  const commits = git.getRecentCommits(count);

  console.log(`Analyzing ${commits.length} commits...`);

  for (const commit of commits) {
    try {
      console.log(`Processing commit ${commit.sha}...`);
      await analyzeCommit(commit.sha);
      console.log(`✓ Completed ${commit.sha}`);
    } catch (error) {
      console.error(`✗ Failed to analyze ${commit.sha}:`, error);
    }
  }

  console.log('Analysis complete!');
}

export async function analyzeStagedChanges(): Promise<void> {
  await ensureDatabaseInitialized();
  const db = getDatabaseManager().getDatabase();
  const gitRoot = getGitRoot();
  if (!gitRoot) {
    throw new Error('Not in a git repository');
  }

  // For staged changes, we create a temporary analysis
  // This is more complex and would require comparing staged vs HEAD
  console.log('Staged changes analysis not yet implemented');
  console.log('Use "ct analyze" to analyze committed changes');
}

export async function analyzeCommit(sha: string): Promise<void> {
  const git = new GitOperations();

  // Get commit information
  const commitInfo = git.getCommitInfo(sha);
  const files = git.getFileChanges(sha);

  console.log(`Analyzing commit ${sha}: ${commitInfo.message.substring(0, 50)}...`);

  // Initialize analyzers
  const symbolExtractor = new SymbolExtractor(git);
  const dependencyExtractor = new DependencyExtractor();
  const riskDetector = new RiskDetector();
  const llmSummarizer = new LLMSummarizer();
  const difftastic = getDifftasticIntegration();

  // Extract symbols
  const symbols = await symbolExtractor.extractCommitSymbols(sha, files);

  // Extract dependencies and compare
  const fileContents = new Map<string, string>();
  for (const file of files) {
    // Skip deleted files
    if (file.status === 'D') {
      continue;
    }
    try {
      fileContents.set(file.path, git.getFileContent(sha, file.path));
    } catch {
      // Skip files that can't be read
    }
  }

  const edges = dependencyExtractor.extractCommitEdges(sha, symbols, fileContents);

  // Get difftastic highlights
  const difftasticHighlights: string[] = [];
  for (const file of files) {
    if (file.status === 'M') {
      try {
        const highlights = await difftastic.getCommitStructuralHighlights(sha, file.path);
        difftasticHighlights.push(...highlights.highlights);
      } catch {
        // Skip difftastic failures
      }
    }
  }

  // Detect risks
  const risks = riskDetector.detectRisks(files, symbols, edges);

  // Create analysis result
  const analysis: AnalysisResult = {
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
  } catch (error) {
    console.warn(`LLM summarization failed for ${sha}:`, error);
  }

  // Store in database
  await storeAnalysisResult(analysis);

  console.log(`Stored analysis for ${sha}`);
}

async function storeAnalysisResult(analysis: AnalysisResult): Promise<void> {
  const db = getDatabaseManager().getDatabase();

  // Insert commit
  const commitStmt = db.prepare(`
    INSERT OR REPLACE INTO commits
    (sha, author, date, message, summary_md, raw_llm_json, files_changed, symbols_added, symbols_removed, symbols_modified, edges_added, edges_removed, risks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const llmJson = analysis.llmSummary ? JSON.stringify(analysis.llmSummary) : null;
  const risksJson = JSON.stringify(analysis.risks);

  commitStmt.run(
    analysis.commit.sha,
    analysis.commit.author,
    analysis.commit.date,
    analysis.commit.message,
    analysis.llmSummary?.summary_md || '',
    llmJson,
    analysis.files.length,
    analysis.symbols.added.length,
    analysis.symbols.removed.length,
    analysis.symbols.modified.length,
    analysis.edges.added.length,
    analysis.edges.removed.length,
    risksJson
  );

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
    symbolStmt.run(
      analysis.commit.sha,
      symbol.id.split(':')[0], // Extract path from ID
      symbol.id,
      symbol.name,
      symbol.kind,
      null,
      symbol.signature,
      null,
      JSON.stringify(symbol.location),
      'added'
    );
  }

  // Removed symbols
  for (const symbol of analysis.symbols.removed) {
    symbolStmt.run(
      analysis.commit.sha,
      symbol.id.split(':')[0],
      symbol.id,
      symbol.name,
      symbol.kind,
      symbol.signature,
      null,
      JSON.stringify(symbol.location),
      null,
      'removed'
    );
  }

  // Modified symbols
  for (const delta of analysis.symbols.modified) {
    symbolStmt.run(
      analysis.commit.sha,
      delta.symbol.id.split(':')[0],
      delta.symbol.id,
      delta.symbol.name,
      delta.symbol.kind,
      delta.previousSymbol?.signature || null,
      delta.symbol.signature,
      delta.previousSymbol ? JSON.stringify(delta.previousSymbol.location) : null,
      JSON.stringify(delta.symbol.location),
      delta.changeType
    );
  }

  // Insert edges
  const edgeStmt = db.prepare(`
    INSERT OR REPLACE INTO edges (sha, from_symbol_id, to_symbol_id, edge_type, change_type)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const edge of [...analysis.edges.added, ...analysis.edges.removed]) {
    const changeType = analysis.edges.added.includes(edge) ? 'added' : 'removed';
    edgeStmt.run(
      analysis.commit.sha,
      edge.from,
      edge.to,
      edge.type,
      changeType
    );
  }
}
