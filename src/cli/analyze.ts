import { getGitRoot } from '../utils/config';
import { GitOperations } from '../analysis/git';
import { SymbolExtractor } from '../analysis/symbols';
import { DependencyExtractor } from '../analysis/dependencies';
import { RiskDetector } from '../analysis/heuristics';
import { LLMSummarizer } from '../llm/summarizer';
import { getDifftasticIntegration } from '../analysis/difftastic';
import { getDatabaseManager, ensureDatabaseInitialized } from '../storage/database';
import { AnalysisResult, SymbolInfo, SymbolDelta } from '../types';
import { detectNamingConvention, analyzeConventionDrift } from '../analysis/namingConventions';
import { extractImportPaths, analyzeImportPathDrift, detectFileNamingConvention } from '../analysis/conventionEnhancements';
import { detectLanguage } from '../analysis/tree-sitter';

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

  // Extract symbols with semantic enrichment
  console.log(`Extracting symbols from ${files.length} files...`);
  const symbols = await symbolExtractor.extractCommitSymbols(sha, files);

  console.log(`Found ${symbols.added.length} added, ${symbols.removed.length} removed, ${symbols.modified.length} modified symbols`);
  if (symbols.renames.length > 0) {
    console.log(`Detected ${symbols.renames.length} renames:`);
    for (const rename of symbols.renames) {
      console.log(`  ${rename.oldSymbol.name} → ${rename.newSymbol.name} (confidence: ${rename.confidence.toFixed(2)})`);
    }
  }
  if (symbols.moves.length > 0) {
    console.log(`Detected ${symbols.moves.length} moves`);
  }
  console.log(`Extracted symbols: +${symbols.added.length} -${symbols.removed.length} ~${symbols.modified.length}`);

  // Extract dependencies and compare
  const fileContents = new Map<string, string>();
  for (const file of files) {
    // Skip deleted files
    if (file.status === 'D') {
      continue;
    }
    try {
      fileContents.set(file.path, git.safeGetFileContent(sha, file.path));
    } catch {
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
  const difftasticHighlights: string[] = [];
  for (const file of files) {
    if (file.status === 'M') {
      try {
        const highlights = await difftastic.getCommitStructuralHighlights(sha, file.path, file.oldPath);
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
  await storeAnalysisResult(analysis, symbols);

  // Sync symbols to Qdrant if enabled
  await syncSymbolsToQdrant(symbols, sha);

  // Sync commit to Qdrant if enabled
  await syncCommitToQdrant(analysis);

  console.log(`Stored analysis for ${sha}`);
}

async function storeAnalysisResult(
  analysis: AnalysisResult,
  symbols: {
    added: SymbolInfo[];
    removed: SymbolInfo[];
    modified: SymbolDelta[];
    renames: Array<{ oldSymbol: SymbolInfo; newSymbol: SymbolInfo; confidence: number }>;
    moves: Array<{ symbol: SymbolInfo; oldPath: string; newPath: string; confidence: number }>;
  }
): Promise<void> {
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

  // Insert symbols with enhanced semantic information
  const symbolStmt = db.prepare(`
    INSERT OR REPLACE INTO symbols
    (sha, path, symbol_id, name, kind, signature_pre, signature_post, loc_pre, loc_post, change_type, mod_reason, diff_snippet_pre, diff_snippet_post, confidence, naming_convention, convention_confidence)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Added symbols
  for (const symbol of symbols.added) {
    const convention = detectNamingConvention(symbol.name);
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
      'added',
      null,
      null,
      null,
      1.0,
      convention.convention,
      convention.confidence
    );
  }

  // Removed symbols
  for (const symbol of symbols.removed) {
    const convention = detectNamingConvention(symbol.name);
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
      'removed',
      null,
      null,
      null,
      1.0,
      convention.convention,
      convention.confidence
    );
  }

  // Modified symbols with semantic enhancement
  for (const delta of symbols.modified) {
    const convention = detectNamingConvention(delta.symbol.name);
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
      delta.changeType,
      delta.modReason || null,
      delta.diffSnippetPre || null,
      delta.diffSnippetPost || null,
      1.0,
      convention.convention,
      convention.confidence
    );
  }

  // Store renames as special symbol entries
  for (const rename of symbols.renames) {
    const convention = detectNamingConvention(rename.newSymbol.name);
    // Store the new symbol with rename metadata
    symbolStmt.run(
      analysis.commit.sha,
      rename.newSymbol.id.split(':')[0],
      rename.newSymbol.id,
      rename.newSymbol.name,
      rename.newSymbol.kind,
      rename.oldSymbol.signature,
      rename.newSymbol.signature,
      JSON.stringify(rename.oldSymbol.location),
      JSON.stringify(rename.newSymbol.location),
      'renamed',
      null,
      null,
      null,
      rename.confidence,
      convention.convention,
      convention.confidence
    );
  }

  // Insert into renames table
  if (symbols.renames.length > 0) {
    console.log(`Storing ${symbols.renames.length} renames to database...`);
    const renamesStmt = db.prepare(`
      INSERT OR REPLACE INTO renames
      (sha, path, old_symbol_id, new_symbol_id, old_name, new_name, confidence)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      for (const rename of symbols.renames) {
        renamesStmt.run(
          analysis.commit.sha,
          rename.newSymbol.id.split(':')[0],
          rename.oldSymbol.id,
          rename.newSymbol.id,
          rename.oldSymbol.name,
          rename.newSymbol.name,
          rename.confidence
        );
      }
      console.log(`✓ Stored ${symbols.renames.length} renames`);
    } catch (error) {
      console.error(`✗ Failed to store renames:`, error);
      throw error;
    }
  }

  // Store moves as special symbol entries
  for (const move of symbols.moves) {
    const convention = detectNamingConvention(move.symbol.name);
    symbolStmt.run(
      analysis.commit.sha,
      move.newPath,
      move.symbol.id,
      move.symbol.name,
      move.symbol.kind,
      null,
      move.symbol.signature,
      null,
      JSON.stringify(move.symbol.location),
      'moved',
      null,
      null,
      null,
      move.confidence,
      convention.convention,
      convention.confidence
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

  // Analyze and store file-level convention drift
  await storeFileConventions(analysis.commit.sha, symbols, db);
}

/**
 * Analyze and store file-level naming convention data
 */
async function storeFileConventions(
  sha: string,
  symbols: {
    added: SymbolInfo[];
    removed: SymbolInfo[];
    modified: SymbolDelta[];
  },
  db: any
): Promise<void> {
  try {
    // Group symbols by file path
    const symbolsByFile = new Map<string, Array<{ name: string; kind: string; path: string }>>();

    // Collect all symbols (added, modified)
    for (const symbol of symbols.added) {
      const path = symbol.id.split(':')[0];
      if (!symbolsByFile.has(path)) {
        symbolsByFile.set(path, []);
      }
      symbolsByFile.get(path)!.push({
        name: symbol.name,
        kind: symbol.kind,
        path
      });
    }

    for (const delta of symbols.modified) {
      const path = delta.symbol.id.split(':')[0];
      if (!symbolsByFile.has(path)) {
        symbolsByFile.set(path, []);
      }
      symbolsByFile.get(path)!.push({
        name: delta.symbol.name,
        kind: delta.symbol.kind,
        path
      });
    }

    // Analyze convention drift per file
    const fileConventionStmt = db.prepare(`
      INSERT OR REPLACE INTO file_conventions
      (sha, path, dominant_convention, convention_counts, drift_percent, symbol_count)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const [filePath, fileSymbols] of symbolsByFile.entries()) {
      if (fileSymbols.length === 0) continue;

      const driftResult = analyzeConventionDrift(fileSymbols);
      
      fileConventionStmt.run(
        sha,
        filePath,
        driftResult.dominantConvention,
        JSON.stringify(driftResult.conventionCounts),
        driftResult.driftPercent,
        fileSymbols.length
      );
    }
  } catch (error) {
    console.warn('[Conventions] Failed to store file conventions:', error);
    // Don't throw - convention tracking is optional
  }

  // Store import path conventions
  await storeImportConventions(sha, symbols, db);
}

/**
 * Analyze and store import path conventions
 */
async function storeImportConventions(
  sha: string,
  symbols: {
    added: SymbolInfo[];
    removed: SymbolInfo[];
    modified: SymbolDelta[];
  },
  db: any
): Promise<void> {
  try {
    const { GitOperations } = await import('../analysis/git');
    const git = new GitOperations();

    // Get unique file paths from symbols
    const filePaths = new Set<string>();
    for (const symbol of symbols.added) {
      filePaths.add(symbol.id.split(':')[0]);
    }
    for (const delta of symbols.modified) {
      filePaths.add(delta.symbol.id.split(':')[0]);
    }

    const importStmt = db.prepare(`
      INSERT INTO import_conventions
      (sha, path, import_path, import_style, line_number)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const filePath of filePaths) {
      try {
        const content = git.safeGetFileContent(sha, filePath);
        const language = detectLanguage(filePath);
        if (!language) continue;

        const imports = extractImportPaths(content, language);
        for (const imp of imports) {
          importStmt.run(
            sha,
            filePath,
            imp.path,
            imp.style,
            imp.line
          );
        }
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }
  } catch (error) {
    console.warn('[Conventions] Failed to store import conventions:', error);
    // Don't throw - convention tracking is optional
  }
}

/**
 * Sync symbols to Qdrant for semantic search
 */
async function syncSymbolsToQdrant(
  symbols: {
    added: SymbolInfo[];
    removed: SymbolInfo[];
    modified: SymbolDelta[];
  },
  sha: string
): Promise<void> {
  try {
    const { getQdrantClient } = await import('../storage/qdrantClient');
    const { generateEmbedding, symbolToEmbeddingText } = await import('../storage/embeddings');
    
    const qdrant = getQdrantClient();
    if (!(await qdrant.isEnabled())) {
      return; // Skip if Qdrant not available
    }

    await qdrant.ensureCollections();
    const client = await qdrant.getClient();
    if (!client) {
      return;
    }

    const { stringToPointId } = await import('../storage/embeddings');
    const { detectNamingConvention } = await import('../analysis/namingConventions');
    const points: any[] = [];

    // Process added symbols
    for (const symbol of symbols.added) {
      const convention = detectNamingConvention(symbol.name);
      const embeddingText = symbolToEmbeddingText({
        name: symbol.name,
        kind: symbol.kind,
        signature: symbol.signature,
        path: symbol.id.split(':')[0],
        naming_convention: convention.convention
      });
      const embedding = await generateEmbedding(embeddingText);

      points.push({
        id: stringToPointId(symbol.id), // Hash to numeric ID
        vector: embedding,
        payload: {
          symbol_id: symbol.id,
          name: symbol.name,
          kind: symbol.kind,
          path: symbol.id.split(':')[0],
          sha,
          change_type: 'added',
          naming_convention: convention.convention
        }
      });
    }

    // Process modified symbols
    for (const delta of symbols.modified) {
      const convention = detectNamingConvention(delta.symbol.name);
      const embeddingText = symbolToEmbeddingText({
        name: delta.symbol.name,
        kind: delta.symbol.kind,
        signature: delta.symbol.signature,
        path: delta.symbol.id.split(':')[0],
        diff_snippet_post: delta.diffSnippetPost,
        naming_convention: convention.convention
      });
      const embedding = await generateEmbedding(embeddingText);

      points.push({
        id: stringToPointId(delta.symbol.id), // Hash to numeric ID
        vector: embedding,
        payload: {
          symbol_id: delta.symbol.id,
          name: delta.symbol.name,
          kind: delta.symbol.kind,
          path: delta.symbol.id.split(':')[0],
          sha,
          change_type: 'modified',
          naming_convention: convention.convention
        }
      });
    }

    // Batch upsert to Qdrant
    if (points.length > 0) {
      await client.upsert('symbols', {
        wait: true,
        points
      });
      console.log(`[Qdrant] Synced ${points.length} symbols to Qdrant`);
    }
  } catch (error) {
    console.warn('[Qdrant] Failed to sync symbols:', error);
    // Don't throw - Qdrant sync is optional
  }
}

/**
 * Sync commit to Qdrant for semantic search
 */
async function syncCommitToQdrant(analysis: AnalysisResult): Promise<void> {
  try {
    const { getQdrantClient } = await import('../storage/qdrantClient');
    const { generateEmbedding, commitToEmbeddingText, stringToPointId } = await import('../storage/embeddings');
    
    const qdrant = getQdrantClient();
    if (!(await qdrant.isEnabled())) {
      return; // Skip if Qdrant not available
    }

    await qdrant.ensureCollections();
    const client = await qdrant.getClient();
    if (!client) {
      return;
    }

    const embeddingText = commitToEmbeddingText({
      message: analysis.commit.message,
      summary_md: analysis.llmSummary?.summary_md,
      risks: analysis.risks
    });

    const embedding = await generateEmbedding(embeddingText);

    await client.upsert('commits', {
      wait: true,
      points: [{
        id: stringToPointId(analysis.commit.sha),
        vector: embedding,
        payload: {
          sha: analysis.commit.sha,
          author: analysis.commit.author,
          date: analysis.commit.date,
          message: analysis.commit.message,
          files_changed: analysis.files.length,
          symbols_added: analysis.symbols.added.length,
          symbols_modified: analysis.symbols.modified.length,
          symbols_removed: analysis.symbols.removed.length,
          risks: analysis.risks
        }
      }]
    });
    console.log(`[Qdrant] Synced commit ${analysis.commit.sha.substring(0, 8)} to Qdrant`);
  } catch (error) {
    console.warn('[Qdrant] Failed to sync commit:', error);
    // Don't throw - Qdrant sync is optional
  }
}
