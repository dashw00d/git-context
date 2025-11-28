import { HybridFact, CstFact, DeltaChange, isCstFact } from '../types/cstFacts';
import { SymbolInfo } from '../types';
import { getDatabase } from '../storage/database';
import { computeHybridDna } from './symbolDna';
import { logDebug } from '../utils/logger';

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

    // Ensure hybrid_facts table exists
    this.ensureTableExists(db);

    // Compute file hash for this version
    const fileHash = this.computeFileHash(facts);

    // Get prior facts if prevHash provided
    const priorFacts = prevHash ? await this.getFactsByHash(filePath, prevHash) : null;

    // Compute deltas for each fact
    const factsWithDeltas = facts.map(fact => {
      const delta = this.computeDelta(fact, priorFacts);
      return { fact, delta };
    });

    // Update timelines
    for (const { fact, delta } of factsWithDeltas) {
      await this.appendToTimeline(filePath, commitSha, fact, delta, fileHash);
    }

    logDebug(`[CstTimeline] Saved ${facts.length} hybrid facts for ${filePath}@${commitSha.substring(0, 8)}`);
  }

  /**
   * Get prior facts for a file at a specific version
   */
  async getPriorFacts(
    filePath: string,
    commitSha: string
  ): Promise<HybridFact[] | null> {
    const db = getDatabase();
    if (!db) return null;

    this.ensureTableExists(db);

    try {
      // Get all facts for this file/version
      const stmt = db.prepare(`
        SELECT serialized_fact FROM hybrid_facts
        WHERE file_path = ? AND version = ?
        ORDER BY created_at DESC
      `);

      const rows = stmt.all([filePath, commitSha]) as any[];
      if (!rows || rows.length === 0) return null;

      // Deserialize all facts
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

    this.ensureTableExists(db);

    try {
      // Use IN clause for batch retrieval
      const placeholders = filePaths.map(() => '?').join(',');
      const stmt = db.prepare(`
        SELECT file_path, serialized_fact 
        FROM hybrid_facts
        WHERE file_path IN (${placeholders}) AND version = ?
        ORDER BY file_path, created_at DESC
      `);

      const rows = stmt.all([...filePaths, version]) as any[];
      if (!rows || rows.length === 0) return new Map();

      // Group by file path
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
   * Get prior facts for a file with workspace fallback
   * Tries the specified version first, then falls back to 'workspace' and 'workspace-staged'
   * This handles cases where workspace files are stored with version='workspace' 
   * but we're querying with a commit SHA
   */
  async getPriorFactsWithFallback(
    filePath: string,
    version: string
  ): Promise<HybridFact[]> {
    // Try the requested version first
    let facts = await this.getPriorFacts(filePath, version) || [];
    
    // If no facts found and version is not already 'workspace', try workspace fallback
    if (facts.length === 0 && version !== 'workspace' && version !== 'workspace-staged') {
      // Try workspace version
      const workspaceFacts = await this.getPriorFacts(filePath, 'workspace') || [];
      if (workspaceFacts.length > 0) {
        facts = workspaceFacts;
        logDebug(`[CstTimeline] Found ${facts.length} facts for ${filePath} in workspace (fallback from ${version.substring(0, 8)})`);
      } else {
        // Try workspace-staged as last resort
        const stagedFacts = await this.getPriorFacts(filePath, 'workspace-staged') || [];
        if (stagedFacts.length > 0) {
          facts = stagedFacts;
          logDebug(`[CstTimeline] Found ${facts.length} facts for ${filePath} in workspace-staged (fallback from ${version.substring(0, 8)})`);
        }
      }
    }
    
    return facts;
  }

  /**
   * Batch retrieve prior facts with workspace fallback
   * For files with no facts at the requested version, automatically tries 'workspace' and 'workspace-staged'
   */
  async getPriorFactsBatchWithFallback(
    filePaths: string[],
    version: string
  ): Promise<Map<string, HybridFact[]>> {
    const db = getDatabase();
    if (!db || filePaths.length === 0) return new Map();

    this.ensureTableExists(db);

    try {
      // First, try the requested version
      let factsByFile = await this.getPriorFactsBatch(filePaths, version);
      
      // If version is not already workspace, check for missing files and try fallback
      if (version !== 'workspace' && version !== 'workspace-staged') {
        const missingFiles = filePaths.filter(path => !factsByFile.has(path) || factsByFile.get(path)!.length === 0);
        
        if (missingFiles.length > 0) {
          // Try workspace version for missing files
          const workspaceFacts = await this.getPriorFactsBatch(missingFiles, 'workspace');
          for (const [filePath, facts] of workspaceFacts) {
            if (facts.length > 0) {
              factsByFile.set(filePath, facts);
              logDebug(`[CstTimeline] Found ${facts.length} facts for ${filePath} in workspace (batch fallback from ${version.substring(0, 8)})`);
            }
          }
          
          // Try workspace-staged for any still missing
          const stillMissing = missingFiles.filter(path => !factsByFile.has(path) || factsByFile.get(path)!.length === 0);
          if (stillMissing.length > 0) {
            const stagedFacts = await this.getPriorFactsBatch(stillMissing, 'workspace-staged');
            for (const [filePath, facts] of stagedFacts) {
              if (facts.length > 0) {
                factsByFile.set(filePath, facts);
                logDebug(`[CstTimeline] Found ${facts.length} facts for ${filePath} in workspace-staged (batch fallback from ${version.substring(0, 8)})`);
              }
            }
          }
        }
      }
      
      return factsByFile;
    } catch (error) {
      logDebug(`[CstTimeline] Error getting prior facts batch with fallback: ${error}`);
      return new Map();
    }
  }

  /**
   * Get facts by file hash
   */
  private async getFactsByHash(
    filePath: string,
    hash: string
  ): Promise<HybridFact[] | null> {
    const db = getDatabase();
    if (!db) return null;

    try {
      // Get all facts for this file/hash
      const stmt = db.prepare(`
        SELECT serialized_fact FROM hybrid_facts
        WHERE file_path = ? AND hash = ?
        ORDER BY created_at DESC
      `);

      const rows = stmt.all([filePath, hash]) as any[];
      if (!rows || rows.length === 0) return null;

      // Deserialize all facts
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

    const dnaId = computeHybridDna(fact);
    const timelineEntry = {
      version,
      dna: dnaId,
      delta
    };

    // Get existing timeline or create new
    let timeline: Array<{ version: string; dna: string; delta: DeltaChange }> = [];

    if (isCstFact(fact)) {
      // For CST facts, use existing timeline
      timeline = [...fact.timeline, timelineEntry];
    } else {
      // For symbols, create new timeline entry
      timeline = [timelineEntry];
    }

    // Update or insert fact
    const stmt = db.prepare(`
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
      new Date().toISOString()
    ]);
  }

  /**
   * Compute delta between current fact and prior facts
   */
  private computeDelta(
    fact: HybridFact,
    priorFacts: HybridFact[] | null
  ): DeltaChange {
    if (!priorFacts || priorFacts.length === 0) {
      return {
        type: 'added',
        newDna: computeHybridDna(fact)
      };
    }

    // Find matching fact in prior version (by DNA or name)
    const priorFact = priorFacts.find(p => 
      p.dnaId === fact.dnaId || 
      (p.name === fact.name && this.sameKind(p, fact))
    );

    if (!priorFact) {
      return {
        type: 'added',
        newDna: computeHybridDna(fact)
      };
    }

    // Check if removed (fact exists in prior but not in current)
    // This is handled at file level, so here we assume it's modified if it exists

    // Check if modified (DNA changed or location changed)
    const dnaChanged = priorFact.dnaId !== fact.dnaId;
    const locationChanged = 
      priorFact.location.start.line !== fact.location.start.line ||
      priorFact.location.start.column !== fact.location.start.column;

    if (dnaChanged || locationChanged) {
      return {
        type: 'modified',
        oldDna: priorFact.dnaId,
        newDna: fact.dnaId,
        locationDelta: locationChanged ? {
          oldLine: priorFact.location.start.line,
          newLine: fact.location.start.line
        } : undefined
      };
    }

    // No change
    return {
      type: 'modified', // Still mark as modified for timeline tracking
      oldDna: priorFact.dnaId,
      newDna: fact.dnaId
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
    const serialized = JSON.stringify(facts.map(f => ({
      id: f.id,
      dnaId: f.dnaId,
      name: f.name,
      kind: f.kind
    })));
    return crypto.createHash('sha256')
      .update(serialized)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Ensure hybrid_facts table exists
   */
  private ensureTableExists(db: any): void {
    try {
      // Check if table exists
      const checkStmt = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='hybrid_facts'
      `);
      const exists = checkStmt.get();

      if (!exists) {
        // Create table
        const createStmt = db.prepare(`
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

        // Create indexes
        const idx1 = db.prepare(`
          CREATE INDEX IF NOT EXISTS idx_hybrid_facts_file_version 
          ON hybrid_facts(file_path, version)
        `);
        idx1.run();

        const idx2 = db.prepare(`
          CREATE INDEX IF NOT EXISTS idx_hybrid_facts_dna 
          ON hybrid_facts(dna_id)
        `);
        idx2.run();

        const idx3 = db.prepare(`
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

// Singleton instance
let timelineManagerInstance: CstTimelineManager | null = null;

export function getCstTimelineManager(): CstTimelineManager {
  if (!timelineManagerInstance) {
    timelineManagerInstance = new CstTimelineManager();
  }
  return timelineManagerInstance;
}

