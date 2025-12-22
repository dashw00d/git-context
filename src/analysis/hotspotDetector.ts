import * as crypto from 'crypto';
import { DatabaseService, getDatabaseService } from '../services/databaseService';
import { getDatabaseManager } from '../storage/database';
import { DatabaseWriteQueue } from '../storage/databaseWriteQueue';
import { prepare } from '../storage/statement-wrapper';
import { SymbolInfo } from '../types';
import { logDebug, logInfo } from '../utils/logger';
import { BaseDetector, DetectorConfig } from './detectors/BaseDetector';
import type { CommitFacts } from '../analysis/commitIndexer';

export interface HotspotMetrics {
  commitFrequency: number;
  recency: number;
  authorDiversity: number;
  changeIntensity: number;
  temporalClustering: number;
}

export interface FileHotspot {
  filePath: string;
  totalCommits: number;
  totalChanges: number;
  uniqueAuthors: number;
  lastChangedSha: string;
  lastChangedDate: string;
  hotspotScore: number;
  firstSeenSha: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  touchedInVersions?: string[];
  touchedInVersionsDescription?: string;
}

export interface SymbolHotspot {
  symbolId: string;
  filePath: string;
  symbolType: string;
  symbolName: string;
  totalModifications: number;
  totalCommits: number;
  lastChangeType: string;
  lastChangedSha: string;
  lastChangedDate: string;
  hotspotScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface HotspotSnapshot {
  snapshotSha: string;
  snapshotDate: string;
  entityType: 'file' | 'symbol';
  entityId: string;
  hotspotScore: number;
  totalChanges: number;
}

export class HotspotDetector {
  constructor(
    private dbManager = getDatabaseManager(),
    private commitService: DatabaseService = getDatabaseService()
  ) {
    //empty
  }

  /**
   * Calculate hotspot score from metrics (0-100)
   *
   * Note: When analyzing a small number of commits (e.g., 2-3), files that changed
   * in all commits will have identical metrics, leading to identical scores. This is
   * expected behavior and scores will differentiate as more commit history is analyzed.
   */
  calculateHotspotScore(metrics: HotspotMetrics): number {
    const weights = {
      commitFrequency: 0.35,
      recency: 0.2,
      authorDiversity: 0.15,
      changeIntensity: 0.2,
      temporalClustering: 0.1,
    };

    const rawScore =
      metrics.commitFrequency * weights.commitFrequency +
      metrics.recency * weights.recency +
      metrics.authorDiversity * weights.authorDiversity +
      metrics.changeIntensity * weights.changeIntensity +
      metrics.temporalClustering * weights.temporalClustering;

    return Math.min(100, Math.log10(1 + rawScore * 9) * 100);
  }

  /**
   * Classify risk level based on hotspot score
   */
  classifyRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  /**
   * Update hotspot metrics for a file
   */
  async updateFileHotspot(
    filePath: string,
    sha: string,
    symbolChanges: SymbolInfo[],
    author?: string
  ): Promise<void> {
    const existing = this.getFileHotspot(filePath);

    // Calculate metrics first (async operation)
    const metrics = await this.calculateFileMetrics(filePath, sha, symbolChanges, author);

    const totalCommits = (existing?.totalCommits || 0) + 1;
    const totalChanges = (existing?.totalChanges || 0) + symbolChanges.length;
    const uniqueAuthors = await this.updateAuthorCount(filePath, author || 'unknown');

    // Queue for batch write
    const writeQueue = DatabaseWriteQueue.getInstance();
    writeQueue.queue({
      type: 'file_hotspot',
      data: {
        filePath,
        sha,
        symbolChanges,
        author,
        metrics: {
          hotspotScore: metrics.hotspotScore,
          riskLevel: metrics.riskLevel,
          totalCommits,
          totalChanges,
          uniqueAuthors,
          firstSeenSha: existing?.firstSeenSha || sha,
        },
      },
    });

    logDebug(
      `[HotspotDetector] Queued file hotspot update: ${filePath} (score: ${metrics.hotspotScore.toFixed(
        1
      )})`
    );
  }

  /**
   * Batch update hotspot metrics for multiple symbols (optimized)
   */
  async batchUpdateSymbols(symbols: SymbolInfo[], sha: string): Promise<void> {
    if (symbols.length === 0) return;

    const now = new Date().toISOString();

    const cacheKey = this.generateCacheKey(symbols, sha);
    const cacheHash = crypto.createHash('sha256').update(cacheKey).digest('hex');

    const cached = this.getCachedResult(cacheHash);
    if (cached) {
      logDebug(`[HotspotDetector] Cache hit for batch update (${symbols.length} symbols)`);
      return;
    }

    const dnaIds = symbols.filter(s => s.id).map(s => s.id);
    if (dnaIds.length === 0) return;

    const placeholders = dnaIds.map(() => '?').join(',');
    const existingStmt = prepare(`
      SELECT symbol_id, hotspot_score FROM symbol_hotspots
      WHERE symbol_id IN (${placeholders})
    `);
    const existing = new Map<string, number>();
    const existingRows = existingStmt.all(...dnaIds) as any[];
    for (const row of existingRows) {
      existing.set(row.symbol_id, row.hotspot_score);
    }

    const insertStmt = prepare(`
      INSERT OR REPLACE INTO symbol_hotspots
      (symbol_id, file_path, symbol_type, symbol_name,
       total_modifications, total_commits, last_change_type,
       last_changed_sha, last_changed_date, hotspot_score, risk_level)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Batch fetch all symbol histories and total commit count once
    const symbolHistories = await this.batchGetSymbolHistories(dnaIds);
    const totalCommits = await this.getTotalCommitCount();

    const symbolMetrics = new Map<string, { hotspotScore: number; riskLevel: string }>();
    for (const symbol of symbols) {
      if (!symbol.id) continue;
      try {
        const history = symbolHistories.get(symbol.id) || [];
        const metrics = this.calculateSymbolMetricsFromHistory(history, totalCommits);
        symbolMetrics.set(symbol.id, metrics);
      } catch (error: any) {
        logDebug(
          `[HotspotDetector] Failed to calculate metrics for ${symbol.name}: ${error.message}`
        );
      }
    }

    const batch = this.dbManager.getDatabase().transaction((symbols: SymbolInfo[]) => {
      let skipped = 0;
      let updated = 0;

      for (const symbol of symbols) {
        if (!symbol.id) {
          skipped++;
          continue;
        }

        const filePath = symbol.filePath;
        if (!filePath || filePath.trim() === '') {
          skipped++;
          continue;
        }

        const metrics = symbolMetrics.get(symbol.id);
        if (!metrics) {
          skipped++;
          continue;
        }

        try {
          const existingHotspot = this.getSymbolHotspot(symbol.id);

          const existingScore = existing.get(symbol.id);
          if (existingScore !== undefined) {
            const scoreDelta = Math.abs(metrics.hotspotScore - existingScore);
            const scoreDeltaPercent = existingScore > 0 ? (scoreDelta / existingScore) * 100 : 0;
            if (scoreDeltaPercent < 5) {
              skipped++;
              continue;
            }
          }

          const totalModifications = (existingHotspot?.totalModifications || 0) + 1;
          const totalCommits = (existingHotspot?.totalCommits || 0) + 1;

          insertStmt.run([
            symbol.id, // id is now the DNA hash
            filePath,
            symbol.kind,
            symbol.name,
            totalModifications,
            totalCommits,
            'modified',
            sha,
            now,
            metrics.hotspotScore,
            metrics.riskLevel,
          ]);

          updated++;
        } catch (error: any) {
          logDebug(
            `[HotspotDetector] Failed to update symbol hotspot ${symbol.name}: ${error.message}`
          );
          skipped++;
        }
      }

      return { updated, skipped };
    });

    const result = batch(symbols);
    logDebug(
      `[HotspotDetector] Batch updated ${result.updated} symbols, skipped ${result.skipped} (dedup/cache)`
    );

    this.setCachedResult(cacheKey, cacheHash, now);
  }

  /**
   * Update hotspot metrics for a symbol
   */
  async updateSymbolHotspot(symbol: SymbolInfo, sha: string): Promise<void> {
    if (!symbol.id) {
      logDebug(`[HotspotDetector] Skipping invalid symbol ${symbol.name}: missing id`);
      return;
    }

    const filePath = symbol.filePath;

    if (!filePath || filePath.trim() === '') {
      logDebug(`[HotspotDetector] Skipping symbol ${symbol.name}: no valid file path`);
      return;
    }

    try {
      const now = new Date().toISOString();

      const existing = this.getSymbolHotspot(symbol.id);

      const metrics = await this.calculateSymbolMetrics(symbol.id, sha);

      const stmt = this.dbManager.getDatabase().prepare(`
        INSERT OR REPLACE INTO symbol_hotspots
        (symbol_id, file_path, symbol_type, symbol_name,
         total_modifications, total_commits, last_change_type,
         last_changed_sha, last_changed_date, hotspot_score, risk_level)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const totalModifications = (existing?.totalModifications || 0) + 1;
      const totalCommits = (existing?.totalCommits || 0) + 1;

      stmt.run([
        symbol.id, // id is now the DNA hash
        filePath,
        symbol.kind,
        symbol.name,
        totalModifications,
        totalCommits,
        'modified', // TODO: Determine actual change type
        sha,
        now,
        metrics.hotspotScore,
        metrics.riskLevel,
      ]);

      logDebug(
        `[HotspotDetector] Updated symbol hotspot: ${
          symbol.name
        } (score: ${metrics.hotspotScore.toFixed(1)}, file: ${filePath})`
      );
    } catch (error: any) {
      logDebug(
        `[HotspotDetector] Failed to update symbol hotspot ${symbol.name} (id: ${symbol.id}): ${error.message}`
      );
    }
  }

  /**
   * Get top N hotspot files
   */
  async getTopFileHotspots(limit: number = 20): Promise<FileHotspot[]> {
    const stmt = this.dbManager.getDatabase().prepare(`
      SELECT * FROM file_hotspots
      ORDER BY hotspot_score DESC
      LIMIT ?
    `);

    const rows = stmt.all(limit);
    return rows.map((row: any) => ({
      filePath: row.file_path,
      totalCommits: row.total_commits,
      totalChanges: row.total_changes,
      uniqueAuthors: row.unique_authors,
      lastChangedSha: row.last_changed_sha,
      lastChangedDate: row.last_changed_date,
      hotspotScore: row.hotspot_score,
      firstSeenSha: row.first_seen_sha,
      riskLevel: row.risk_level,
    }));
  }

  /**
   * Get top N hotspot symbols
   */
  async getTopSymbolHotspots(limit: number = 20, filterByFile?: string): Promise<SymbolHotspot[]> {
    let query = `
      SELECT * FROM symbol_hotspots
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filterByFile) {
      query += ` AND file_path = ?`;
      params.push(filterByFile);
    }

    query += ` ORDER BY hotspot_score DESC LIMIT ?`;
    params.push(limit);

    const stmt = this.dbManager.getDatabase().prepare(query);
    const rows = stmt.all(...params);

    return rows.map((row: any) => ({
      symbolId: row.symbol_id,
      filePath: row.file_path,
      symbolType: row.symbol_type,
      symbolName: row.symbol_name,
      totalModifications: row.total_modifications,
      totalCommits: row.total_commits,
      lastChangeType: row.last_change_type,
      lastChangedSha: row.last_changed_sha,
      lastChangedDate: row.last_changed_date,
      hotspotScore: row.hotspot_score,
      riskLevel: row.risk_level,
    }));
  }

  /**
   * Get hotspot trend over time
   */
  async getHotspotTrend(
    entityType: 'file' | 'symbol',
    entityId: string,
    since?: Date
  ): Promise<HotspotSnapshot[]> {
    let query = `
      SELECT * FROM hotspot_snapshots
      WHERE entity_type = ? AND entity_id = ?
    `;
    const params: any[] = [entityType, entityId];

    if (since) {
      query += ` AND snapshot_date >= ?`;
      params.push(since.toISOString());
    }

    query += ` ORDER BY snapshot_date ASC`;

    const stmt = this.dbManager.getDatabase().prepare(query);
    const rows = stmt.all(...params);

    return rows.map((row: any) => ({
      snapshotSha: row.snapshot_sha,
      snapshotDate: row.snapshot_date,
      entityType: row.entity_type,
      entityId: row.entity_id,
      hotspotScore: row.hotspot_score,
      totalChanges: row.total_changes,
    }));
  }

  /**
   * Create periodic snapshot for trend analysis
   */
  async createSnapshot(sha: string): Promise<void> {
    const writeQueue = DatabaseWriteQueue.getInstance();

    const fileHotspots = await this.getTopFileHotspots(1000);
    for (const hotspot of fileHotspots) {
      if (!hotspot.filePath) continue;

      writeQueue.queue({
        type: 'hotspot_snapshot',
        data: {
          sha,
          entityType: 'file',
          entityId: hotspot.filePath,
          score: hotspot.hotspotScore,
          changes: hotspot.totalChanges,
        },
      });
    }

    const symbolHotspots = await this.getTopSymbolHotspots(1000);
    for (const hotspot of symbolHotspots) {
      if (!hotspot.symbolId) continue;

      writeQueue.queue({
        type: 'hotspot_snapshot',
        data: {
          sha,
          entityType: 'symbol',
          entityId: hotspot.symbolId,
          score: hotspot.hotspotScore,
          changes: hotspot.totalModifications,
        },
      });
    }

    logInfo(
      `[HotspotDetector] Queued hotspot snapshot for ${fileHotspots.length} files and ${symbolHotspots.length} symbols`
    );
  }

  /**
   * Calculate metrics for a file
   */
  private async calculateFileMetrics(
    filePath: string,
    _sha: string,
    symbolChanges: SymbolInfo[],
    _author?: string
  ): Promise<{
    hotspotScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  }> {
    const history = await this.getFileHistory(filePath);

    const totalCommits = await this.getTotalCommitCount();
    const fileCommits = history.length;
    const commitFrequency =
      totalCommits > 0 ? Math.min(1, fileCommits / Math.sqrt(totalCommits)) : 0;

    const lastChange = history.length > 0 ? new Date(history[history.length - 1]) : new Date();
    const daysSinceLastChange = (Date.now() - lastChange.getTime()) / (1000 * 60 * 60 * 24);
    const recency = Math.exp(-daysSinceLastChange / 30);

    const uniqueAuthors = await this.getFileAuthorCount(filePath);
    const authorDiversity = Math.min(1, uniqueAuthors / 5);

    const avgChangesPerCommit = fileCommits > 0 ? symbolChanges.length / fileCommits : 0;
    const changeIntensity = Math.min(1, avgChangesPerCommit / 10);

    const temporalClustering = this.calculateTemporalClustering(history);

    const metrics: HotspotMetrics = {
      commitFrequency,
      recency,
      authorDiversity,
      changeIntensity,
      temporalClustering,
    };

    const hotspotScore = this.calculateHotspotScore(metrics);
    const riskLevel = this.classifyRiskLevel(hotspotScore);

    return { hotspotScore, riskLevel };
  }

  /**
   * Calculate metrics for a symbol
   */
  private async calculateSymbolMetrics(
    symbolId: string,
    _sha: string
  ): Promise<{
    hotspotScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  }> {
    const history = await this.getSymbolHistory(symbolId);

    const totalCommits = await this.getTotalCommitCount();
    const symbolCommits = history.length;
    const commitFrequency =
      totalCommits > 0 ? Math.min(1, symbolCommits / Math.sqrt(totalCommits)) : 0;

    const lastChange = history.length > 0 ? new Date(history[history.length - 1]) : new Date();
    const daysSinceLastChange = (Date.now() - lastChange.getTime()) / (1000 * 60 * 60 * 24);
    const recency = Math.exp(-daysSinceLastChange / 30);

    const authorDiversity = 0.5; // Placeholder
    const changeIntensity = Math.min(1, symbolCommits / 20);
    const temporalClustering = this.calculateTemporalClustering(history);

    const metrics: HotspotMetrics = {
      commitFrequency,
      recency,
      authorDiversity,
      changeIntensity,
      temporalClustering,
    };

    const hotspotScore = this.calculateHotspotScore(metrics);
    const riskLevel = this.classifyRiskLevel(hotspotScore);

    return { hotspotScore, riskLevel };
  }

  /**
   * Calculate temporal clustering (burstiness)
   */
  private calculateTemporalClustering(history: Date[]): number {
    if (history.length < 2) return 0;

    const gaps: number[] = [];
    for (let i = 1; i < history.length; i++) {
      const gap = history[i].getTime() - history[i - 1].getTime();
      gaps.push(gap / (1000 * 60 * 60 * 24));
    }

    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const variance = gaps.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / gaps.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean > 0 ? stdDev / mean : 0;

    return Math.min(1, cv / 2);
  }

  private getFileHotspot(filePath: string): FileHotspot | null {
    const stmt = this.dbManager.getDatabase().prepare(`
      SELECT * FROM file_hotspots WHERE file_path = ?
    `);
    const row = stmt.get(filePath) as any;
    if (!row) return null;

    return {
      filePath: row.file_path,
      totalCommits: row.total_commits,
      totalChanges: row.total_changes,
      uniqueAuthors: row.unique_authors,
      lastChangedSha: row.last_changed_sha,
      lastChangedDate: row.last_changed_date,
      hotspotScore: row.hotspot_score,
      firstSeenSha: row.first_seen_sha,
      riskLevel: row.risk_level,
    };
  }

  private getSymbolHotspot(symbolId: string): SymbolHotspot | null {
    const stmt = this.dbManager.getDatabase().prepare(`
      SELECT * FROM symbol_hotspots WHERE symbol_id = ?
    `);
    const row = stmt.get(symbolId) as any;
    if (!row) return null;

    return {
      symbolId: row.symbol_id,
      filePath: row.file_path,
      symbolType: row.symbol_type,
      symbolName: row.symbol_name,
      totalModifications: row.total_modifications,
      totalCommits: row.total_commits,
      lastChangeType: row.last_change_type,
      lastChangedSha: row.last_changed_sha,
      lastChangedDate: row.last_changed_date,
      hotspotScore: row.hotspot_score,
      riskLevel: row.risk_level,
    };
  }

  private async getFileHistory(filePath: string): Promise<Date[]> {
    const stmt = this.dbManager.getDatabase().prepare(`
      SELECT last_changed_date FROM file_hotspots
      WHERE file_path = ?
      UNION ALL
      SELECT snapshot_date FROM hotspot_snapshots
      WHERE entity_type = 'file' AND entity_id = ?
      ORDER BY last_changed_date ASC
    `);
    const rows = stmt.all(filePath, filePath);
    return rows.map((row: any) => new Date(row.last_changed_date || row.snapshot_date));
  }

  private async getSymbolHistory(symbolId: string): Promise<Date[]> {
    const stmt = this.dbManager.getDatabase().prepare(`
      SELECT last_changed_date FROM symbol_hotspots
      WHERE symbol_id = ?
      UNION ALL
      SELECT snapshot_date FROM hotspot_snapshots
      WHERE entity_type = 'symbol' AND entity_id = ?
      ORDER BY last_changed_date ASC
    `);
    const rows = stmt.all(symbolId, symbolId);
    return rows.map((row: any) => new Date(row.last_changed_date || row.snapshot_date));
  }

  /**
   * Batch fetch symbol histories for multiple symbols
   */
  private async batchGetSymbolHistories(symbolIds: string[]): Promise<Map<string, Date[]>> {
    if (symbolIds.length === 0) return new Map();

    const result = new Map<string, Date[]>();

    // Initialize empty arrays for all symbols
    for (const id of symbolIds) {
      result.set(id, []);
    }

    // Batch fetch in chunks to avoid parameter limits
    const chunkSize = 100;
    for (let i = 0; i < symbolIds.length; i += chunkSize) {
      const chunk = symbolIds.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => '?').join(',');

      const stmt = this.dbManager.getDatabase().prepare(`
        SELECT symbol_id as id, last_changed_date as date FROM symbol_hotspots
        WHERE symbol_id IN (${placeholders})
        UNION ALL
        SELECT entity_id as id, snapshot_date as date FROM hotspot_snapshots
        WHERE entity_type = 'symbol' AND entity_id IN (${placeholders})
        ORDER BY date ASC
      `);

      const rows = stmt.all(...chunk, ...chunk) as any[];
      for (const row of rows) {
        const dates = result.get(row.id) || [];
        dates.push(new Date(row.date));
        result.set(row.id, dates);
      }
    }

    return result;
  }

  /**
   * Calculate symbol metrics from pre-fetched history
   */
  private calculateSymbolMetricsFromHistory(
    history: Date[],
    totalCommits: number
  ): {
    hotspotScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  } {
    const symbolCommits = history.length;
    const commitFrequency =
      totalCommits > 0 ? Math.min(1, symbolCommits / Math.sqrt(totalCommits)) : 0;

    const lastChange = history.length > 0 ? new Date(history[history.length - 1]) : new Date();
    const daysSinceLastChange = (Date.now() - lastChange.getTime()) / (1000 * 60 * 60 * 24);
    const recency = Math.exp(-daysSinceLastChange / 30);

    const authorDiversity = 0.5; // Placeholder
    const changeIntensity = Math.min(1, symbolCommits / 20);
    const temporalClustering = this.calculateTemporalClustering(history);

    const metrics: HotspotMetrics = {
      commitFrequency,
      recency,
      authorDiversity,
      changeIntensity,
      temporalClustering,
    };

    const hotspotScore = this.calculateHotspotScore(metrics);
    const riskLevel = this.classifyRiskLevel(hotspotScore);

    return { hotspotScore, riskLevel };
  }

  private async getTotalCommitCount(): Promise<number> {
    return await this.commitService.countCommits();
  }

  private async getFileAuthorCount(filePath: string): Promise<number> {
    try {
      const stmt = prepare(`
        SELECT COUNT(DISTINCT m.author) as author_count
        FROM commits_metadata m
        JOIN files f ON f.sha = m.sha
        WHERE f.path = ?
      `);
      const result = stmt.get(filePath) as { author_count: number } | undefined;

      return result?.author_count || 1;
    } catch (error) {
      return 1;
    }
  }

  private async updateAuthorCount(filePath: string, author: string): Promise<number> {
    const current = this.getFileHotspot(filePath);
    return (current?.uniqueAuthors || 0) + (author !== 'unknown' ? 1 : 0);
  }

  /**
   * Generate cache key from symbols and SHA
   */
  private generateCacheKey(symbols: SymbolInfo[], sha: string): string {
    const symbolKeys = symbols
      .filter(s => s.id)
      .map(s => `${s.id}:${s.name}`)
      .sort()
      .join(',');
    return `${sha}:${symbolKeys}`;
  }

  /**
   * Get cached result if valid
   */
  private getCachedResult(cacheHash: string): boolean {
    const stmt = prepare(`
      SELECT expires_at FROM hotspot_cache
      WHERE cache_hash = ?
    `);

    const row = stmt.get([cacheHash]) as any;

    if (!row) return false;

    const expiresAt = new Date(row.expires_at);
    if (expiresAt < new Date()) {
      const deleteStmt = prepare(`DELETE FROM hotspot_cache WHERE cache_hash = ?`);
      deleteStmt.run([cacheHash]);
      return false;
    }

    return true;
  }

  /**
   * Set cached result with TTL
   */
  private setCachedResult(cacheKey: string, cacheHash: string, cachedAt: string): void {
    if (!cacheKey || !cacheHash || !cachedAt) {
      logDebug(`[HotspotDetector] Skipping cache: invalid params`);
      return;
    }

    const expiresAt = new Date(new Date(cachedAt).getTime() + 3600 * 1000);

    try {
      const stmt = prepare(`
        INSERT OR REPLACE INTO hotspot_cache
        (cache_key, cache_hash, cached_at, expires_at)
        VALUES (?, ?, ?, ?)
      `);

      stmt.run([cacheKey, cacheHash, cachedAt, expiresAt.toISOString()]);
    } catch (error: any) {
      logDebug(`[HotspotDetector] Cache insert failed: ${error.message}`);
    }
  }

  /**
   * Clean expired cache entries (call periodically)
   */
  async cleanExpiredCache(): Promise<void> {
    const now = new Date().toISOString();
    const stmt = prepare(`DELETE FROM hotspot_cache WHERE expires_at < ?`);
    const result = stmt.run(now);
    if (result.changes > 0) {
      logDebug(`[HotspotDetector] Cleaned ${result.changes} expired cache entries`);
    }
  }
}

export class HotspotDetectorV2 extends BaseDetector<
  CommitFacts[],
  Array<FileHotspot | SymbolHotspot>
> {
  private legacyDetector: HotspotDetector;

  constructor(config: Partial<DetectorConfig> = {}) {
    super({
      enableCaching: true,
      ...config,
    });
    this.legacyDetector = new HotspotDetector();
  }

  async detect(commitFacts: CommitFacts[]): Promise<Array<FileHotspot | SymbolHotspot>> {
    return this.getCachedResult(this.generateCacheKey(commitFacts), async () => {
      const fileHotspots = await this.legacyDetector.getTopFileHotspots(25);
      const symbolHotspots = await this.legacyDetector.getTopSymbolHotspots(25);

      return [...fileHotspots, ...symbolHotspots];
    });
  }

  async updateFileHotspot(
    filePath: string,
    sha: string,
    symbolChanges: SymbolInfo[],
    author?: string
  ): Promise<void> {
    return this.legacyDetector.updateFileHotspot(filePath, sha, symbolChanges, author);
  }

  async batchUpdateSymbols(symbols: SymbolInfo[], sha: string): Promise<void> {
    return this.legacyDetector.batchUpdateSymbols(symbols, sha);
  }

  async getTopFileHotspots(limit: number = 20): Promise<FileHotspot[]> {
    return this.legacyDetector.getTopFileHotspots(limit);
  }

  async getTopSymbolHotspots(limit: number = 20, filterByFile?: string): Promise<SymbolHotspot[]> {
    return this.legacyDetector.getTopSymbolHotspots(limit, filterByFile);
  }

  calculateHotspotScore(metrics: HotspotMetrics): number {
    return this.legacyDetector.calculateHotspotScore(metrics);
  }

  classifyRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    return this.legacyDetector.classifyRiskLevel(score);
  }

  async createSnapshot(sha: string): Promise<void> {
    return this.legacyDetector.createSnapshot(sha);
  }
}
