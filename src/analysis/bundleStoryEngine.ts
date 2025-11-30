import { CommitFacts } from './commitIndexer';
import { LlmAnalyst } from './llmAnalyst/runner';
import { getQdrantClient } from '../storage/qdrantClient';
import { generateEmbedding } from '../storage/embeddings';
import { RefactorBundleFacts } from '../facts/types';
import { logInfo, logWarn } from '../utils/logger';
import { getProjectId } from '../utils/config';
import type { HistoryMetrics } from './runner/pipelineMetrics';

export interface RetrievedHistory {
  similarCommits: Array<{
    sha: string;
    date: string;
    message: string;
    similarity: number;
    risks: string[];
    blastRadius: number;
  }>;
  similarSymbols: Array<{
    symbolDnaId: string;
    name: string;
    kind: string;
    changeType: string;
    impactScore: number;
    filePath: string;
    similarity: number;
    commitDate: string;
  }>;
  relatedRefactors: Array<{
    sha: string;
    message: string;
    structuralChangeScore: number;
    similarity: number;
  }>;
  symbolEvolution: Map<string, Array<{
    sha: string;
    changeType: string;
    date: string;
    impactScore: number;
  }>>;
}

export class BundleStoryEngine {
  constructor(private llmAnalyst: LlmAnalyst) { }

  /**
   * Generate narrative story from bundle facts + historical context
   */
  async generateStory(
    bundleFacts: RefactorBundleFacts,
    commitFacts: CommitFacts[],
    precomputedHistory?: RetrievedHistory
  ): Promise<any> {
    logInfo('[BundleStory] Retrieving historical context...');

    let history: RetrievedHistory;
    if (precomputedHistory) {
      history = precomputedHistory;
    } else {
      // Build bundle query shard
      const bundleShard = this.buildBundleShard(bundleFacts, commitFacts);
      const bundleEmbedding = await generateEmbedding(bundleShard);

      // Cross-time retrieval with multiple query strategies
      const { history: generatedHistory } = await this.retrieveHistory(
        bundleEmbedding,
        bundleFacts,
        commitFacts
      );
      history = generatedHistory;
    }

    logInfo('[BundleStory] Running LLM analysis...');

    // Pass to LLM analyst with rich historical context
    const llmAnalysis = await this.llmAnalyst.analyze(bundleFacts, history);

    return {
      llmAnalysis,
      history  // Include history for UI display
    };
  }

  private buildBundleShard(
    facts: RefactorBundleFacts,
    commitFacts: CommitFacts[]
  ): string {
    const totalSymbols = facts.working?.symbols || 0;
    const issues = facts.findings?.incompleteness?.missing || 0;
    const blastRadius = facts.scope?.blastRadius || 0;

    const totalAdded = commitFacts.reduce((sum, f) => sum + f.symbolsAdded, 0);
    const totalModified = commitFacts.reduce((sum, f) => sum + f.symbolsModified, 0);
    const totalRemoved = commitFacts.reduce((sum, f) => sum + f.symbolsRemoved, 0);

    const allRisks = [...new Set(commitFacts.flatMap(f => f.risks))];

    return `Refactor bundle analysis: ${facts.bundle.shas.length} commits, ` +
      `${totalSymbols} total symbols affected. ` +
      `Changes: ${totalAdded} added, ${totalModified} modified, ${totalRemoved} removed. ` +
      `Issues found: ${issues}. ` +
      `Blast radius: ${blastRadius}. ` +
      `Risks: ${allRisks.join(', ')}. ` +
      `Scope: ${facts.scope?.files || 0} files`;
  }

  private async retrieveHistory(
    queryEmbedding: number[] | null,
    bundleFacts: RefactorBundleFacts,
    commitFacts: CommitFacts[]
  ): Promise<{ history: RetrievedHistory; metrics: HistoryMetrics }> {
    const startTime = Date.now();
    const makeEmpty = (reason: string): { history: RetrievedHistory; metrics: HistoryMetrics } => ({
      history: this.emptyHistory(),
      metrics: {
        durationMs: Date.now() - startTime,
        similarCommits: 0,
        similarSymbols: 0,
        relatedRefactors: 0,
        skipped: true,
        reason
      }
    });

    const qdrant = getQdrantClient();
    if (!(await qdrant.isEnabled())) {
      return makeEmpty('qdrant_disabled');
    }

    const client = await qdrant.getClient();
    if (!client) {
      return makeEmpty('client_unavailable');
    }

    // Compute embedding if not provided (history step calls directly)
    const effectiveEmbedding = queryEmbedding && queryEmbedding.length > 0
      ? queryEmbedding
      : await generateEmbedding(this.buildBundleShard(bundleFacts, commitFacts));

    // PROJECT ISOLATION: Filter by project ID
    const projectId = await getProjectId();
    if (!projectId) {
      logInfo('[BundleStory] No project ID found, skipping retrieval');
      return makeEmpty('no_project_id');
    }

    const commitsCollection = qdrant.getCollectionName('commits', projectId);
    const symbolsCollection = qdrant.getCollectionName('symbols', projectId);

    // Ensure collections exist before searching (handles both base and project-specific collections)
    await qdrant.ensureCollection('commits', projectId);
    await qdrant.ensureCollection('symbols', projectId);

    // Check collection sizes before searching to avoid unnecessary queries
    const commitsInfo = await client.getCollection(commitsCollection);
    const symbolsInfo = await client.getCollection(symbolsCollection);

    // Safely access points_count (Qdrant API returns this property)
    const commitsCount = (commitsInfo as any).points_count ?? (commitsInfo as any).pointsCount ?? 0;
    const symbolsCount = (symbolsInfo as any).points_count ?? (symbolsInfo as any).pointsCount ?? 0;

    const commitsEmpty = commitsCount === 0;
    const symbolsEmpty = symbolsCount === 0;

    if (commitsEmpty && symbolsEmpty) {
      logInfo('[BundleStory] Skipping search: both collections are empty');
      return makeEmpty('empty_collections');
    }

    if (commitsEmpty) {
      logInfo(`[BundleStory] Commits collection is empty (${commitsCount} points), skipping commit search`);
    }

    if (symbolsEmpty) {
      logInfo(`[BundleStory] Symbols collection is empty (${symbolsCount} points), skipping symbol search`);
    }

    const projectFilter = {
      must: [
        {
          key: 'project_id',
          match: { value: projectId }
        }
      ]
    };

    // Query 1: Similar commits (episodic memory)
    let similarCommits: any[] = [];
    if (!commitsEmpty) {
      try {
        similarCommits = await client.search(commitsCollection, {
          vector: effectiveEmbedding,
          limit: 20,
          with_payload: true,
          score_threshold: 0.6,
          filter: projectFilter  // ONLY CURRENT PROJECT
        });
      } catch (error: any) {
        logWarn(`[BundleStory] Failed to search commits: ${error?.message || error}. Collection: ${commitsCollection}, Filter: ${JSON.stringify(projectFilter)}`);
      }
    }

    // Query 2: Similar symbols (fine-grained history)
    let similarSymbols: any[] = [];
    if (!symbolsEmpty) {
      try {
        similarSymbols = await client.search(symbolsCollection, {
          vector: effectiveEmbedding,
          limit: 30,
          with_payload: true,
          score_threshold: 0.65,
          filter: projectFilter  // ONLY CURRENT PROJECT
        });
      } catch (error: any) {
        logWarn(`[BundleStory] Failed to search symbols: ${error?.message || error}. Collection: ${symbolsCollection}, Filter: ${JSON.stringify(projectFilter)}`);
      }
    }

    // Query 3: Refactors with high structural change (similar complexity)
    const refactorFilter = {
      must: [
        {
          key: 'project_id',
          match: { value: projectId }  // PROJECT ISOLATION
        },
        {
          key: 'structural_change_score',
          range: {
            gte: 0.1  // Lowered from 0.5 to capture more refactors
          }
        }
      ]
    };

    let relatedRefactors: any[] = [];
    if (!commitsEmpty) {
      try {
        relatedRefactors = await client.search(commitsCollection, {
          vector: effectiveEmbedding,
          limit: 10,
          filter: refactorFilter,
          with_payload: true
        });
      } catch (error: any) {
        logWarn(`[BundleStory] Failed to search related refactors: ${error?.message || error}. Collection: ${commitsCollection}, Filter: ${JSON.stringify(refactorFilter)}`);
      }
    }

    // Build symbol evolution timelines
    const symbolEvolution = await this.buildSymbolEvolution(similarSymbols);

    // Validate filter isolation: check that all retrieved items match project_id
    const retrievedProjectIds = new Set<string>();
    similarCommits.forEach(c => {
      if (c.payload?.project_id && typeof c.payload.project_id === 'string') retrievedProjectIds.add(c.payload.project_id);
    });
    similarSymbols.forEach(s => {
      if (s.payload?.project_id && typeof s.payload.project_id === 'string') retrievedProjectIds.add(s.payload.project_id);
    });
    relatedRefactors.forEach(r => {
      if (r.payload?.project_id && typeof r.payload.project_id === 'string') retrievedProjectIds.add(r.payload.project_id);
    });

    if (retrievedProjectIds.size > 1 || (retrievedProjectIds.size === 1 && !retrievedProjectIds.has(projectId))) {
      logWarn(`[BundleStory] Filter leak detected: expected ${projectId}, got ${Array.from(retrievedProjectIds).join(', ')}`);
    }

    const history: RetrievedHistory = {
      similarCommits: similarCommits.map(r => ({
        sha: (r.payload?.sha as string) || '',
        date: (r.payload?.date as string) || '',
        message: (r.payload?.message as string) || '',
        similarity: r.score,
        risks: (r.payload?.risks as string[]) || [],
        blastRadius: (r.payload?.blast_radius as number) || 0
      })),
      similarSymbols: similarSymbols.map(r => ({
        symbolDnaId: (r.payload?.symbol_dna_id as string) || '',
        name: (r.payload?.name as string) || '',
        kind: (r.payload?.kind as string) || '',
        changeType: (r.payload?.change_type as string) || '',
        impactScore: (r.payload?.impact_score as number) || 0,
        filePath: (r.payload?.file_path as string) || '',
        similarity: r.score,
        commitDate: (r.payload?.date as string) || ''
      })),
      relatedRefactors: relatedRefactors.map(r => ({
        sha: (r.payload?.sha as string) || '',
        message: (r.payload?.message as string) || '',
        structuralChangeScore: (r.payload?.structural_change_score as number) || 0,
        similarity: r.score
      })),
      symbolEvolution
    };

    const metrics: HistoryMetrics = {
      durationMs: Date.now() - startTime,
      similarCommits: history.similarCommits.length,
      similarSymbols: history.similarSymbols.length,
      relatedRefactors: history.relatedRefactors.length
    };

    return { history, metrics };
  }

  /**
   * Build symbol evolution timelines from similar symbols
   */
  private async buildSymbolEvolution(
    similarSymbols: any[]
  ): Promise<Map<string, Array<any>>> {
    const evolutionMap = new Map<string, Array<any>>();

    for (const result of similarSymbols) {
      const dnaId = result.payload.symbol_dna_id;

      if (!evolutionMap.has(dnaId)) {
        evolutionMap.set(dnaId, []);
      }

      evolutionMap.get(dnaId)!.push({
        sha: result.payload.sha,
        changeType: result.payload.change_type,
        date: result.payload.date,
        impactScore: result.payload.impact_score || 0,
        similarity: result.score
      });
    }

    // Sort each timeline by date
    for (const [dnaId, timeline] of evolutionMap) {
      timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }

    return evolutionMap;
  }

  private emptyHistory(): RetrievedHistory {
    return {
      similarCommits: [],
      similarSymbols: [],
      relatedRefactors: [],
      symbolEvolution: new Map()
    };
  }
}
