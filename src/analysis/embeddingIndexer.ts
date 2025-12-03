import { DatabaseService, getDatabaseService } from '../services/databaseService';
import { getDatabaseManager } from '../storage/database';
import { generateEmbedding, stringToPointId } from '../storage/embeddings';
import { getQdrantClient } from '../storage/qdrantClient';
import { prepare } from '../storage/statement-wrapper';
import { getProjectId } from '../utils/config';
import { logDebug, logInfo } from '../utils/logger';
import { CommitFacts } from './commitIndexer';
import { runWithConcurrency } from './runner/concurrency';
import type { EmbeddingMetrics } from './runner/pipelineMetrics';

export class EmbeddingIndexer {
  constructor(
    private dbManager = getDatabaseManager(),
    private commitService: DatabaseService = getDatabaseService()
  ) {}

  /**
   * Index both commit and symbol shards into Qdrant
   */
  async indexCommits(commitFacts: CommitFacts[]): Promise<EmbeddingMetrics> {
    const metrics: EmbeddingMetrics = {
      commitCount: commitFacts.length,
      commitShardCount: 0,
      symbolShardCount: 0,
      themeShardCount: 0,
      durationMs: 0,
    };
    const startTime = Date.now();

    const qdrant = getQdrantClient();
    if (!(await qdrant.isEnabled())) {
      logDebug('[EmbeddingIndexer] Qdrant not enabled, skipping');
      return { ...metrics, skipped: true, reason: 'qdrant_disabled' };
    }

    await qdrant.ensureCollections();
    const client = await qdrant.getClient();
    if (!client) {
      return { ...metrics, skipped: true, reason: 'client_unavailable' };
    }

    logInfo(`[EmbeddingIndexer] Indexing ${commitFacts.length} commits...`);

    metrics.commitShardCount = await this.indexCommitShards(commitFacts, client);

    metrics.symbolShardCount = await this.indexSymbolShards(commitFacts, client);

    metrics.themeShardCount = await this.indexThemeShards(commitFacts, client);

    logInfo(`[EmbeddingIndexer] Indexing complete`);
    metrics.durationMs = Date.now() - startTime;
    return metrics;
  }

  /**
   * Index commit-level shards
   */
  private async indexCommitShards(commitFacts: CommitFacts[], client: any): Promise<number> {
    const qdrant = getQdrantClient();
    const projectId = (await getProjectId()) || 'unknown';
    const collectionName = qdrant.getCollectionName('commits', projectId);

    await qdrant.ensureCollection('commits', projectId);

    let processed = 0;
    await runWithConcurrency(commitFacts, 10, async facts => {
      const shard = await this.buildCommitShard(facts, projectId);
      const embedding = await generateEmbedding(shard.text);

      await client.upsert(collectionName, {
        wait: true,
        points: [
          {
            id: stringToPointId(facts.sha),
            vector: embedding,
            payload: shard.metadata,
          },
        ],
      });

      logDebug(
        `[EmbeddingIndexer] Indexed commit ${facts.sha.substring(0, 8)} to ${collectionName}`
      );
      processed += 1;
    });

    const info = await client.getCollection(collectionName);
    const pointsCount = (info as any).points_count ?? (info as any).pointsCount ?? 0;

    if (pointsCount === 0 && processed > 0) {
      logInfo(`[EmbeddingIndexer] WARNING: Indexed ${processed} commits but collection count is 0`);
    } else {
      logDebug(
        `[EmbeddingIndexer] Verified collection ${collectionName} has ${pointsCount} points`
      );
    }

    return processed;
  }

  /**
   * Index symbol-level shards (for fine-grained retrieval)
   */
  private async indexSymbolShards(commitFacts: CommitFacts[], client: any): Promise<number> {
    const qdrant = getQdrantClient();
    const projectId = (await getProjectId()) || 'unknown';
    const collectionName = qdrant.getCollectionName('symbols', projectId);

    await qdrant.ensureCollection('symbols', projectId);

    const symbolShards = [];

    logInfo(`[EmbeddingIndexer] Gathering symbol history from ${commitFacts.length} commits...`);

    for (const facts of commitFacts) {
      const symbols = this.loadSymbolHistory(facts.sha);
      logDebug(
        `[EmbeddingIndexer] Found ${symbols.length} symbols for commit ${facts.sha.substring(0, 8)}`
      );

      for (const symbol of symbols) {
        const shard = await this.buildSymbolShard(symbol, facts, projectId);
        symbolShards.push({ shard, symbol });
      }
    }

    if (symbolShards.length === 0) {
      logInfo('[EmbeddingIndexer] No symbols to index, skipping symbol indexing');
      return 0;
    }

    logInfo(
      `[EmbeddingIndexer] Indexing ${symbolShards.length} symbol shards to ${collectionName}...`
    );

    let processed = 0;
    await runWithConcurrency(symbolShards, 10, async ({ shard, symbol }) => {
      try {
        const embedding = await generateEmbedding(shard.text);

        await client.upsert(collectionName, {
          wait: true,
          points: [
            {
              id: this.symbolToPointId(symbol.symbol_dna_id, symbol.sha),
              vector: embedding,
              payload: shard.metadata,
            },
          ],
        });

        processed++;
        if (processed % 10 === 0) {
          logDebug(`[EmbeddingIndexer] Processed ${processed}/${symbolShards.length} symbols`);
        }
      } catch (error) {
        logDebug(
          `[EmbeddingIndexer] Failed to index symbol ${symbol.name}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });

    logInfo(`[EmbeddingIndexer] Symbol indexing complete: ${processed}/${symbolShards.length}`);
    return symbolShards.length;
  }

  private async buildCommitShard(
    facts: CommitFacts,
    projectId: string
  ): Promise<{ text: string; metadata: any }> {
    const extended = await this.loadExtendedFacts(facts.sha);

    const tags = [
      ...facts.risks.map(r => `[risk:${r}]`),
      facts.structuralChangeScore > 0.7 ? '[high-structural-change]' : '',
      facts.symbolsRemoved > 10 ? '[major-deletion]' : '',
      facts.symbolsAdded > 20 ? '[major-addition]' : '',
      facts.blastRadius > 50 ? '[high-blast-radius]' : '',

      extended.hotspots.length > 0 ? '[has-hotspots]' : '',
      extended.structuralChangeScore > 0.8 ? '[critical-drift]' : '',
      extended.edgesAdded > 5 ? '[high-coupling]' : '',
    ].filter(Boolean);

    const commitInfo = await this.getCommitMetadata(facts.sha);

    const text =
      `${tags.join(' ')} Commit ${facts.sha.substring(0, 8)} (${commitInfo?.date || 'unknown'}): ` +
      `"${commitInfo?.message || 'No message'}". ` +
      `Changed ${facts.filesChanged} files. ` +
      `Added ${facts.symbolsAdded} symbols, modified ${facts.symbolsModified}, removed ${facts.symbolsRemoved}. ` +
      `Structural change score: ${facts.structuralChangeScore.toFixed(2)}. ` +
      `Blast radius: ${facts.blastRadius}. ` +
      `Risks: ${facts.risks.join(', ') || 'none'}. ` +
      `Hotspots involved: ${extended.hotspots.length}.`;

    return {
      text,
      metadata: {
        project_id: projectId,
        sha: facts.sha,
        date: commitInfo?.date,
        author: commitInfo?.author,
        message: commitInfo?.message,
        symbols_added: facts.symbolsAdded,
        symbols_modified: facts.symbolsModified,
        symbols_removed: facts.symbolsRemoved,
        edges_added: facts.edgesAdded,
        edges_removed: facts.edgesRemoved,
        risks: facts.risks,
        structural_change_score: facts.structuralChangeScore,
        blast_radius: facts.blastRadius,
        files_changed: facts.filesChanged,

        hotspots: extended.hotspots,
        tags: tags,
      },
    };
  }

  private async buildSymbolShard(
    symbolHistory: any,
    commitFacts: CommitFacts,
    projectId: string
  ): Promise<{ text: string; metadata: any }> {
    const tags = [
      `[${symbolHistory.change_type}]`,
      `[${symbolHistory.kind}]`,
      symbolHistory.impact_score > 10 ? '[high-impact]' : '',
      symbolHistory.impact_score > 50 ? '[critical-impact]' : '',

      commitFacts.risks.length > 0 ? `[risk:${commitFacts.risks[0]}]` : '',
      commitFacts.structuralChangeScore > 0.7 ? '[high-structural-change]' : '',
    ].filter(Boolean);

    const commitInfo = await this.getCommitMetadata(commitFacts.sha);

    const text =
      `${tags.join(' ')} Symbol ${symbolHistory.name} (${symbolHistory.kind}) ` +
      `in ${symbolHistory.file_path}. ` +
      `Change: ${symbolHistory.change_type} in commit ${commitFacts.sha.substring(0, 8)} (${
        commitInfo?.date || 'unknown'
      }). ` +
      `Signature: ${symbolHistory.signature || 'none'}. ` +
      `Impact score: ${symbolHistory.impact_score}. ` +
      `Part of commit with ${commitFacts.symbolsAdded} additions, ${commitFacts.symbolsModified} modifications. ` +
      `Commit risks: ${commitFacts.risks.join(', ') || 'none'}.`;

    return {
      text,
      metadata: {
        project_id: projectId,
        symbol_dna_id: symbolHistory.symbol_dna_id,
        name: symbolHistory.name,
        kind: symbolHistory.kind,
        file_path: symbolHistory.file_path,
        signature: symbolHistory.signature,
        change_type: symbolHistory.change_type,
        impact_score: symbolHistory.impact_score,
        sha: symbolHistory.sha,
        date: commitInfo?.date,
        commit_message: commitInfo?.message,
        tags: tags,
      },
    };
  }

  private loadSymbolHistory(sha: string): any[] {
    const stmt = this.dbManager.getDatabase().prepare(`
      SELECT * FROM symbol_history
      WHERE sha = ?
      ORDER BY impact_score DESC
    `);
    return stmt.all(sha);
  }

  private async getCommitMetadata(sha: string): Promise<any> {
    const metadata = await this.commitService.getCommitMetadata(sha);
    if (!metadata) return null;

    return {
      author: metadata.author,
      date: metadata.date.toISOString(),
      message: metadata.message,
    };
  }

  private async indexThemeShards(commitFacts: CommitFacts[], client: any): Promise<number> {
    const qdrant = getQdrantClient();
    const projectId = (await getProjectId()) || 'unknown';
    const collectionName = qdrant.getCollectionName('patterns', projectId);

    await qdrant.ensureCollection('patterns', projectId);

    const themeShards: { text: string; metadata: any }[] = [];

    const themeMap = new Map<
      string,
      {
        risks: string[];
        hotspots: number;
        commits: number;
        textParts: string[];
      }
    >();

    for (const facts of commitFacts) {
      const extended = await this.loadExtendedFacts(facts.sha);
      const hotspots = extended.hotspots || [];

      const themeId = this.inferThemeId(facts.risks, hotspots);
      const entry = themeMap.get(themeId) || {
        risks: [],
        hotspots: 0,
        commits: 0,
        textParts: [],
      };

      entry.risks.push(...facts.risks);
      entry.hotspots += hotspots.length;
      entry.commits++;
      entry.textParts.push(`${facts.sha.slice(0, 8)}: ${facts.risks.join(',') || 'low-risk'}`);

      themeMap.set(themeId, entry);
    }

    for (const [themeId, agg] of themeMap) {
      const uniqueRisks = [...new Set(agg.risks)];
      const tags = [
        `[theme:${themeId}]`,
        agg.hotspots > 5 ? '[hotspot-cluster]' : '',
        agg.commits > 3 ? '[recurring]' : '',
      ].filter(Boolean);

      const text =
        `${tags.join(' ')} Theme ${themeId}: Appears in ${agg.commits} commits. ` +
        `Hotspots involved: ${agg.hotspots}. ` +
        `Risks: ${uniqueRisks.join(', ')}. ` +
        `Episodes: ${agg.textParts.slice(0, 5).join('; ')}`;

      themeShards.push({
        text,
        metadata: {
          project_id: projectId,
          theme_id: themeId,
          commits: agg.commits,
          hotspots: agg.hotspots,
          risks: uniqueRisks,
          tags: tags,
        },
      });
    }

    if (themeShards.length > 0) {
      logInfo(
        `[EmbeddingIndexer] Indexing ${themeShards.length} theme shards to ${collectionName}`
      );

      await runWithConcurrency(themeShards, 5, async shard => {
        const embedding = await generateEmbedding(shard.text);
        await client.upsert(collectionName, {
          wait: true,
          points: [
            {
              id: stringToPointId(shard.metadata.theme_id),
              vector: embedding,
              payload: shard.metadata,
            },
          ],
        });
      });
    }

    return themeShards.length;
  }

  private inferThemeId(risks: string[], hotspots: string[]): string {
    const key = [...new Set([...risks, ...hotspots])].sort().join('|');
    if (!key) return 'theme_general';

    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash << 5) - hash + key.charCodeAt(i);
      hash = hash >>> 0;
    }
    return `theme_${hash.toString(16).slice(0, 12)}`;
  }

  private async loadExtendedFacts(sha: string): Promise<any> {
    const analysisStmt = prepare(`
      SELECT structural_change_score, files_changed, hotspots_json
      FROM commits_analysis
      WHERE sha = ?
    `);
    const analysis = analysisStmt.get(sha) as any;

    const edgesStmt = prepare(`
      SELECT COUNT(*) as count FROM edges WHERE sha = ? AND change_type = 'added'
    `);
    const edgesAdded = (edgesStmt.get(sha) as any)?.count || 0;

    let hotspots: string[] = [];
    if (analysis?.hotspots_json) {
      try {
        hotspots = JSON.parse(analysis.hotspots_json);
      } catch (e) {}
    }

    return {
      structuralChangeScore: analysis?.structural_change_score || 0,
      hotspots,
      edgesAdded,
    };
  }

  private symbolToPointId(dnaId: string, sha: string): number {
    const combined = dnaId + sha;
    return stringToPointId(combined);
  }
}
