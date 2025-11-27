import { CommitFacts } from './commitIndexer';
import { getQdrantClient } from '../storage/qdrantClient';
import { generateEmbedding, stringToPointId } from '../storage/embeddings';
import { logDebug, logInfo } from '../utils/logger';
import { runWithConcurrency } from './runner/concurrency';
import { getDatabaseManager } from '../storage/database';
import { getProjectId } from '../utils/config';

export class EmbeddingIndexer {
  constructor(private dbManager = getDatabaseManager()) { }

  /**
   * Index both commit and symbol shards into Qdrant
   */
  async indexCommits(commitFacts: CommitFacts[]): Promise<void> {
    const qdrant = getQdrantClient();
    if (!(await qdrant.isEnabled())) {
      logDebug('[EmbeddingIndexer] Qdrant not enabled, skipping');
      return;
    }

    await qdrant.ensureCollections();
    const client = await qdrant.getClient();
    if (!client) return;

    logInfo(`[EmbeddingIndexer] Indexing ${commitFacts.length} commits...`);

    // Index commit shards
    await this.indexCommitShards(commitFacts, client);

    // Index symbol shards
    await this.indexSymbolShards(commitFacts, client);

    logInfo(`[EmbeddingIndexer] Indexing complete`);
  }

  /**
   * Index commit-level shards
   */
  private async indexCommitShards(commitFacts: CommitFacts[], client: any): Promise<void> {
    const qdrant = getQdrantClient();
    const projectId = getProjectId() || 'unknown'; // Get unique project identifier
    const collectionName = qdrant.getCollectionName('commits', projectId);

    await runWithConcurrency(commitFacts, 5, async (facts) => {
      const shard = this.buildCommitShard(facts, projectId);
      const embedding = await generateEmbedding(shard.text);

      await client.upsert(collectionName, {
        wait: true,
        points: [{
          id: stringToPointId(facts.sha),
          vector: embedding,
          payload: shard.metadata
        }]
      });

      logDebug(`[EmbeddingIndexer] Indexed commit ${facts.sha.substring(0, 8)} to ${collectionName}`);
    });
  }

  /**
   * Index symbol-level shards (for fine-grained retrieval)
   */
  private async indexSymbolShards(commitFacts: CommitFacts[], client: any): Promise<void> {
    const qdrant = getQdrantClient();
    const projectId = getProjectId() || 'unknown'; // Get unique project identifier
    const collectionName = qdrant.getCollectionName('symbols', projectId);
    const symbolShards = [];

    // Gather symbol history from DB
    for (const facts of commitFacts) {
      const symbols = this.loadSymbolHistory(facts.sha);

      for (const symbol of symbols) {
        const shard = this.buildSymbolShard(symbol, facts, projectId);
        symbolShards.push({ shard, symbol });
      }
    }

    logInfo(`[EmbeddingIndexer] Indexing ${symbolShards.length} symbol shards to ${collectionName}...`);

    await runWithConcurrency(symbolShards, 10, async ({ shard, symbol }) => {
      const embedding = await generateEmbedding(shard.text);

      await client.upsert(collectionName, {
        wait: true,
        points: [{
          id: this.symbolToPointId(symbol.symbol_dna_id, symbol.sha),
          vector: embedding,
          payload: shard.metadata
        }]
      });
    });
  }

  /**
   * Build commit story shard
   */
  private buildCommitShard(facts: CommitFacts, projectId: string): { text: string; metadata: any } {
    const tags = [
      ...facts.risks.map(r => `[${r}]`),
      facts.structuralChangeScore > 0.7 ? '[high-structural-change]' : '',
      facts.symbolsRemoved > 10 ? '[major-deletion]' : '',
      facts.symbolsAdded > 20 ? '[major-addition]' : '',
      facts.blastRadius > 50 ? '[high-blast-radius]' : ''
    ].filter(Boolean);

    // Get commit metadata from DB
    const commitInfo = this.getCommitMetadata(facts.sha);

    const text = `${tags.join(' ')} Commit ${facts.sha.substring(0, 8)} (${commitInfo?.date || 'unknown'}): ` +
      `"${commitInfo?.message || 'No message'}". ` +
      `Changed ${facts.filesChanged} files. ` +
      `Added ${facts.symbolsAdded} symbols, modified ${facts.symbolsModified}, removed ${facts.symbolsRemoved}. ` +
      `${facts.edgesAdded} new dependencies, ${facts.edgesRemoved} removed. ` +
      `Structural change score: ${facts.structuralChangeScore.toFixed(2)}. ` +
      `Blast radius: ${facts.blastRadius}. ` +
      `Risks: ${facts.risks.join(', ') || 'none'}.`;

    return {
      text,
      metadata: {
        project_id: projectId,  // PROJECT ISOLATION
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
        files_changed: facts.filesChanged
      }
    };
  }

  /**
   * Build symbol story shard
   */
  private buildSymbolShard(
    symbolHistory: any,
    commitFacts: CommitFacts,
    projectId: string
  ): { text: string; metadata: any } {
    const tags = [
      `[${symbolHistory.change_type}]`,
      `[${symbolHistory.kind}]`,
      symbolHistory.impact_score > 10 ? '[high-impact]' : '',
      symbolHistory.impact_score > 50 ? '[critical-impact]' : ''
    ].filter(Boolean);

    const commitInfo = this.getCommitMetadata(commitFacts.sha);

    const text = `${tags.join(' ')} Symbol ${symbolHistory.name} (${symbolHistory.kind}) ` +
      `in ${symbolHistory.file_path}. ` +
      `Change: ${symbolHistory.change_type} in commit ${commitFacts.sha.substring(0, 8)} (${commitInfo?.date || 'unknown'}). ` +
      `Signature: ${symbolHistory.signature || 'none'}. ` +
      `Impact score: ${symbolHistory.impact_score}. ` +
      `Part of commit with ${commitFacts.symbolsAdded} additions, ${commitFacts.symbolsModified} modifications.`;

    return {
      text,
      metadata: {
        project_id: projectId,  // PROJECT ISOLATION
        symbol_dna_id: symbolHistory.symbol_dna_id,
        name: symbolHistory.name,
        kind: symbolHistory.kind,
        file_path: symbolHistory.file_path,
        signature: symbolHistory.signature,
        change_type: symbolHistory.change_type,
        impact_score: symbolHistory.impact_score,
        sha: symbolHistory.sha,
        date: commitInfo?.date,
        commit_message: commitInfo?.message
      }
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

  private getCommitMetadata(sha: string): any {
    const stmt = this.dbManager.getDatabase().prepare(`
      SELECT author, date, message FROM commits_metadata
      WHERE sha = ?
    `);
    return stmt.get([sha]);
  }

  private symbolToPointId(dnaId: string, sha: string): number {
    // Combine DNA ID + SHA for unique symbol version ID
    const combined = dnaId + sha;
    return stringToPointId(combined);
  }
}
