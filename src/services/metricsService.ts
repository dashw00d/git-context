import { ensureDatabaseInitialized } from '../storage/database';
import { prepare } from '../storage/statement-wrapper';
import { NodeMetrics } from '../types/cockpit';
import { logError } from '../utils/logger';

export class MetricsService {
  private static instance: MetricsService;

  private constructor() {
    //empty
  }

  public static getInstance(): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService();
    }
    return MetricsService.instance;
  }

  /**
   * aggregated metrics for a list of file paths
   */
  public async getNodeMetrics(
    filePaths: string[],
    since?: number
  ): Promise<Record<string, NodeMetrics>> {
    const metrics: Record<string, NodeMetrics> = {};

    if (filePaths.length === 0) return metrics;

    try {
      await ensureDatabaseInitialized();

      const CHUNK_SIZE = 500;
      for (let i = 0; i < filePaths.length; i += CHUNK_SIZE) {
        const chunk = filePaths.slice(i, i + CHUNK_SIZE);
        const chunkMetrics = await this.computeMetricsBatch(chunk, since);
        Object.assign(metrics, chunkMetrics);
      }
    } catch (error) {
      logError('Failed to get node metrics', error);
    }

    return metrics;
  }

  private async computeMetricsBatch(
    paths: string[],
    since?: number
  ): Promise<Record<string, NodeMetrics>> {
    const results: Record<string, NodeMetrics> = {};

    for (const path of paths) {
      results[path] = {
        riskScore: 0,
        churnScore: 0,
        lastModified: 0,
        driftCount: 0,
        incomingRefs: 0,
        outgoingRefs: 0,
        authors: [],
        ageDays: 0,
      };
    }

    const placeholders = paths.map(() => '?').join(',');

    let commitQuery = `
      SELECT f.path, m.author, m.date
      FROM commits_metadata m
      JOIN files f ON m.sha = f.sha
      WHERE f.path IN (${placeholders})
    `;
    const commitParams: any[] = [...paths];

    if (since) {
      commitQuery += ` AND m.date >= ?`;
      commitParams.push(new Date(since).toISOString());
    }
    commitQuery += ` ORDER BY m.date DESC`;

    const commitStmt = prepare(commitQuery);
    const allCommits = commitStmt.all(...commitParams) as {
      path: string;
      author: string;
      date: string;
    }[];
    commitStmt.free?.();

    const commitsByPath: Record<string, any[]> = {};
    for (const c of allCommits) {
      if (!commitsByPath[c.path]) commitsByPath[c.path] = [];
      commitsByPath[c.path].push(c);
    }

    for (const path of paths) {
      const commits = commitsByPath[path] || [];
      if (commits.length > 0) {
        const result = results[path];
        const lastDate = new Date(commits[0].date);
        const firstDate = new Date(commits[commits.length - 1].date);

        result.lastModified = lastDate.getTime();
        result.ageDays = Math.floor((Date.now() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
        result.churnScore = Math.min(100, (commits.length / 50) * 100);

        const authorCounts: Record<string, number> = {};
        for (const c of commits) {
          authorCounts[c.author] = (authorCounts[c.author] || 0) + 1;
        }
        result.authors = Object.entries(authorCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([name]) => name);
      }
    }

    const driftStmt = prepare(`
      SELECT path, drift_percent FROM file_conventions
      WHERE path IN (${placeholders})
      ORDER BY id ASC
    `);
    const allDrift = driftStmt.all(...paths) as { path: string; drift_percent: number }[];
    driftStmt.free?.();

    const driftByPath: Record<string, number> = {};
    for (const d of allDrift) {
      driftByPath[d.path] = d.drift_percent;
    }

    for (const path of paths) {
      if (driftByPath[path] !== undefined) {
        results[path].driftCount = Math.ceil((driftByPath[path] || 0) / 10);
      }
    }

    const symbolsStmt = prepare(`
      SELECT path, symbol_id FROM symbols
      WHERE path IN (${placeholders})
    `);
    const allSymbols = symbolsStmt.all(...paths) as { path: string; symbol_id: string }[];
    symbolsStmt.free?.();

    const symbolsByPath: Record<string, string[]> = {};
    const allSymbolIds: string[] = [];

    for (const s of allSymbols) {
      if (!symbolsByPath[s.path]) symbolsByPath[s.path] = [];
      symbolsByPath[s.path].push(s.symbol_id);
      allSymbolIds.push(s.symbol_id);
    }

    if (allSymbolIds.length > 0) {
      // Reduce chunk size to 200 to stay well within SQLite variable limits (usually 999 or 32766)
      const SYMBOL_CHUNK_SIZE = 200;
      const incomingCounts: Record<string, number> = {};
      const outgoingCounts: Record<string, number> = {};

      for (let i = 0; i < allSymbolIds.length; i += SYMBOL_CHUNK_SIZE) {
        const symbolChunk = allSymbolIds.slice(i, i + SYMBOL_CHUNK_SIZE);
        const symPlaceholders = symbolChunk.map(() => '?').join(',');

        const incomingStmt = prepare(`
          SELECT to_symbol_id, COUNT(*) as count
          FROM edges
          WHERE to_symbol_id IN (${symPlaceholders})
          AND from_symbol_id NOT IN (${symPlaceholders}) -- Approximation: exclude refs from within the same chunk (not perfect but close enough for batch)
          GROUP BY to_symbol_id
        `);

        const incomingRows = incomingStmt.all(...symbolChunk) as {
          to_symbol_id: string;
          count: number;
        }[];
        incomingStmt.free?.();
        for (const row of incomingRows) {
          incomingCounts[row.to_symbol_id] = (incomingCounts[row.to_symbol_id] || 0) + row.count;
        }

        const outgoingStmt = prepare(`
          SELECT from_symbol_id, COUNT(*) as count
          FROM edges
          WHERE from_symbol_id IN (${symPlaceholders})
          GROUP BY from_symbol_id
        `);
        const outgoingRows = outgoingStmt.all(...symbolChunk) as {
          from_symbol_id: string;
          count: number;
        }[];
        outgoingStmt.free?.();
        for (const row of outgoingRows) {
          outgoingCounts[row.from_symbol_id] =
            (outgoingCounts[row.from_symbol_id] || 0) + row.count;
        }
      }

      for (const path of paths) {
        const fileSymbolIds = symbolsByPath[path] || [];
        let incoming = 0;
        let outgoing = 0;
        for (const sid of fileSymbolIds) {
          incoming += incomingCounts[sid] || 0;
          outgoing += outgoingCounts[sid] || 0;
        }
        results[path].incomingRefs = incoming;
        results[path].outgoingRefs = outgoing;
      }
    }

    for (const path of paths) {
      const r = results[path];
      const risk = r.churnScore * 0.4 + r.driftCount * 10 + r.incomingRefs * 0.5;
      r.riskScore = Math.min(100, Math.round(risk));
    }

    return results;
  }
}
