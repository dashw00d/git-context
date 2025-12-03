import { getDatabase } from '../storage/database';
import { prepare } from '../storage/statement-wrapper';
import { DeltaChange, HybridFact, isCstFact } from '../types/cstFacts';
import { logDebug, logError } from '../utils/logger';
import { computeHybridDna } from './symbolDna';
import type { ScopeSet } from '../facts/scope';

/**
 * Manager for CST timeline tracking (hybrid facts evolution)
 */
export class CstTimelineManager {
  /**
   * Save hybrid facts for a file at a specific version
   */
  async saveFacts(
    filePath: string,
    commitSha: string,
    facts: HybridFact[],
    prevHash?: string
  ): Promise<void> {
    const db = getDatabase();
    if (!db) {
      logDebug('[CstTimeline] Database not initialized, skipping save');
      return;
    }

    this.ensureTableExists();

    const fileHash = this.computeFileHash(facts);

    const priorFacts = prevHash ? await this.getFactsByHash(filePath, prevHash) : null;

    const factsWithDeltas = await Promise.all(
      facts.map(async fact => {
        const delta = await this.computeDelta(fact, priorFacts);
        return { fact, delta };
      })
    );

    for (const { fact, delta } of factsWithDeltas) {
      await this.appendToTimeline(filePath, commitSha, fact, delta, fileHash);
    }

    logDebug(
      `[CstTimeline] Saved ${
        facts.length
      } hybrid facts for ${filePath}@${commitSha.substring(0, 8)}`
    );
  }

  /**
   * Get prior facts for a file at a specific version
   */
  async getPriorFacts(filePath: string, commitSha: string): Promise<HybridFact[] | null> {
    const db = getDatabase();
    if (!db) return null;

    this.ensureTableExists();

    try {
      const stmt = prepare(`
        SELECT serialized_fact FROM hybrid_facts
        WHERE file_path = ? AND version = ?
        ORDER BY created_at DESC
      `);

      const rows = stmt.all([filePath, commitSha]) as any[];
      if (!rows || rows.length === 0) return null;

      return rows.map(row => JSON.parse(row.serialized_fact)) as HybridFact[];
    } catch (error) {
      logDebug(`[CstTimeline] Error getting prior facts: ${error}`);
      return null;
    }
  }

  /**
   * Batch retrieve prior facts for multiple files at a specific version
   * More efficient than calling getPriorFacts() multiple times
   */
  async getPriorFactsBatch(
    filePaths: string[],
    version: string
  ): Promise<Map<string, HybridFact[]>> {
    const db = getDatabase();
    if (!db || filePaths.length === 0) return new Map();

    this.ensureTableExists();

    try {
      const placeholders = filePaths.map(() => '?').join(',');
      const stmt = prepare(`
        SELECT file_path, serialized_fact
        FROM hybrid_facts
        WHERE file_path IN (${placeholders}) AND version = ?
        ORDER BY file_path, created_at DESC
      `);

      const rows = stmt.all([...filePaths, version]) as any[];
      if (!rows || rows.length === 0) return new Map();

      const factsByFile = new Map<string, HybridFact[]>();
      for (const row of rows) {
        if (!factsByFile.has(row.file_path)) {
          factsByFile.set(row.file_path, []);
        }
        factsByFile.get(row.file_path)!.push(JSON.parse(row.serialized_fact) as HybridFact);
      }

      return factsByFile;
    } catch (error) {
      logDebug(`[CstTimeline] Error getting prior facts batch: ${error}`);
      return new Map();
    }
  }

  /**
   * Batch retrieve prior facts with per-file version selection
   * Accepts a map of filePath → version for efficient batch queries
   */
  async getPriorFactsBatchWithVersions(
    versionMap: Map<string, string>
  ): Promise<Map<string, HybridFact[]>> {
    if (!versionMap || versionMap.size === 0) {
      return new Map();
    }

    const byVersion = new Map<string, string[]>();
    for (const [path, version] of versionMap) {
      if (!byVersion.has(version)) {
        byVersion.set(version, []);
      }
      byVersion.get(version)!.push(path);
    }

    const allFacts = new Map<string, HybridFact[]>();
    for (const [version, paths] of byVersion) {
      const facts = await this.getPriorFactsBatch(paths, version);
      for (const [path, factsList] of facts) {
        allFacts.set(path, factsList);
      }
    }
    return allFacts;
  }

  /**
   * Get facts by file hash
   */
  private async getFactsByHash(filePath: string, hash: string): Promise<HybridFact[] | null> {
    const db = getDatabase();
    if (!db) return null;

    try {
      const stmt = prepare(`
        SELECT serialized_fact FROM hybrid_facts
        WHERE file_path = ? AND hash = ?
        ORDER BY created_at DESC
      `);

      const rows = stmt.all([filePath, hash]) as any[];
      if (!rows || rows.length === 0) return null;

      return rows.map(row => JSON.parse(row.serialized_fact)) as HybridFact[];
    } catch (error) {
      logDebug(`[CstTimeline] Error getting facts by hash: ${error}`);
      return null;
    }
  }

  /**
   * Append entry to fact timeline
   */
  private async appendToTimeline(
    filePath: string,
    version: string,
    fact: HybridFact,
    delta: DeltaChange,
    fileHash: string
  ): Promise<void> {
    const db = getDatabase();
    if (!db) return;

    const dnaId = await computeHybridDna(fact);
    const timelineEntry = {
      version,
      dna: dnaId,
      delta,
    };

    let timeline: Array<{ version: string; dna: string; delta: DeltaChange }> = [];

    if (isCstFact(fact)) {
      timeline = [...fact.timeline, timelineEntry];
    } else {
      timeline = [timelineEntry];
    }

    const stmt = prepare(`
      INSERT OR REPLACE INTO hybrid_facts
      (file_path, version, fact_id, dna_id, serialized_fact, timeline_json, hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      filePath,
      version,
      fact.id,
      dnaId,
      JSON.stringify(fact),
      JSON.stringify(timeline),
      fileHash,
      new Date().toISOString(),
    ]);
  }

  /**
   * Compute delta between current fact and prior facts
   */
  private async computeDelta(
    fact: HybridFact,
    priorFacts: HybridFact[] | null
  ): Promise<DeltaChange> {
    if (!priorFacts || priorFacts.length === 0) {
      return {
        type: 'added',
        newDna: await computeHybridDna(fact),
      };
    }

    const priorFact = priorFacts.find(
      p => p.id === fact.id || (p.name === fact.name && this.sameKind(p, fact))
    );

    if (!priorFact) {
      return {
        type: 'added',
        newDna: await computeHybridDna(fact),
      };
    }

    const dnaChanged = priorFact.id !== fact.id;
    const locationChanged =
      priorFact.location.start.line !== fact.location.start.line ||
      priorFact.location.start.column !== fact.location.start.column;

    if (dnaChanged || locationChanged) {
      return {
        type: 'modified',
        oldDna: priorFact.id,
        newDna: fact.id,
        locationDelta: locationChanged
          ? {
              oldLine: priorFact.location.start.line,
              newLine: fact.location.start.line,
            }
          : undefined,
      };
    }

    return {
      type: 'modified',
      oldDna: priorFact.id,
      newDna: fact.id,
    };
  }

  /**
   * Check if two facts are the same kind
   */
  private sameKind(fact1: HybridFact, fact2: HybridFact): boolean {
    if (isCstFact(fact1) && isCstFact(fact2)) {
      return fact1.kind === fact2.kind;
    }
    if (!isCstFact(fact1) && !isCstFact(fact2)) {
      return fact1.kind === fact2.kind;
    }
    return false;
  }

  /**
   * Compute file hash from facts
   */
  private computeFileHash(facts: HybridFact[]): string {
    const crypto = require('crypto');
    const serialized = JSON.stringify(
      facts.map(f => ({
        id: f.id,
        dnaId: f.id,
        name: f.name,
        kind: f.kind,
      }))
    );
    return crypto.createHash('sha256').update(serialized).digest('hex').substring(0, 16);
  }

  /**
   * Ensure hybrid_facts table exists
   */
  private ensureTableExists(): void {
    const db = getDatabase();
    if (!db) return;

    try {
      const checkStmt = prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='hybrid_facts'
      `);
      const exists = checkStmt.get();

      if (!exists) {
        const createStmt = prepare(`
          CREATE TABLE IF NOT EXISTS hybrid_facts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_path TEXT NOT NULL,
            version TEXT NOT NULL,
            fact_id TEXT NOT NULL,
            dna_id TEXT NOT NULL,
            serialized_fact TEXT NOT NULL,
            timeline_json TEXT NOT NULL,
            hash TEXT NOT NULL,
            created_at TEXT NOT NULL,
            UNIQUE(file_path, version, fact_id)
          )
        `);
        createStmt.run();

        const idx1 = prepare(`
          CREATE INDEX IF NOT EXISTS idx_hybrid_facts_file_version
          ON hybrid_facts(file_path, version)
        `);
        idx1.run();

        const idx2 = prepare(`
          CREATE INDEX IF NOT EXISTS idx_hybrid_facts_dna
          ON hybrid_facts(dna_id)
        `);
        idx2.run();

        const idx3 = prepare(`
          CREATE INDEX IF NOT EXISTS idx_hybrid_facts_hash
          ON hybrid_facts(file_path, hash)
        `);
        idx3.run();

        logDebug('[CstTimeline] Created hybrid_facts table');
      }
    } catch (error) {
      logDebug(`[CstTimeline] Error ensuring table exists: ${error}`);
    }
  }
}

let timelineManagerInstance: CstTimelineManager | null = null;

export function getCstTimelineManager(): CstTimelineManager {
  if (!timelineManagerInstance) {
    timelineManagerInstance = new CstTimelineManager();
  }
  return timelineManagerInstance;
}

export function getPriorVersionInChain(
  currentVersion: string,
  scope: ScopeSet,
  filePath: string,
  commitShas: string[]
): string {
  if (currentVersion === 'workspace-unstaged') {
    if (scope.stagedFiles?.has(filePath)) return 'workspace-staged';
    return 'HEAD';
  }

  if (currentVersion === 'workspace-staged') {
    return 'HEAD';
  }

  if (currentVersion === 'HEAD') {
    if (commitShas.length === 0) {
      logError(
        `Cannot determine prior version for HEAD - no commits in timeline chain. ` +
          `File: ${filePath}`
      );
      return '';
    }
    return commitShas[0];
  }

  const index = commitShas.indexOf(currentVersion);
  if (index === -1) {
    logError(
      `Version ${currentVersion.substring(0, 8)} not found in timeline chain. ` +
        `File: ${filePath}, Expected chain: [${commitShas.map(s => s.substring(0, 8)).join(', ')}]`
    );
    return '';
  }
  if (index === commitShas.length - 1) {
    logError(
      `No prior version for ${currentVersion.substring(0, 8)} - already at oldest commit. ` +
        `File: ${filePath}`
    );
    return '';
  }
  return commitShas[index + 1];
}
