import { ensureDatabaseInitialized } from '../storage/database';
import { prepare } from '../storage/statement-wrapper';
import { logError } from '../utils/logger';

/**
 * Centralized service for all commit-related database operations.
 * Replaces scattered queries across providers and consolidates state.
 */
export class CommitService {
  /**
   * Get commit metadata from database
   */
  async getCommitMetadata(sha: string): Promise<CommitMetadata | null> {
    try {
      await ensureDatabaseInitialized();
      const stmt = prepare('SELECT * FROM commits_metadata WHERE sha = ?');
      const result = stmt.get(sha) as any;
      stmt.free?.();

      if (!result) {
        return null;
      }

      return {
        sha: result.sha,
        author: result.author,
        date: new Date(result.date),
        message: result.message,
        parent: result.parent,
        filesChanged: result.files_changed,
      };
    } catch (error) {
      logError(`Failed to get commit metadata for ${sha}`, error);
      return null;
    }
  }

  /**
   * Get recent commits from database
   */
  async getRecentCommits(limit = 20, offset = 0): Promise<CommitListItem[]> {
    try {
      await ensureDatabaseInitialized();

      const stmt = prepare(`
        SELECT m.sha, m.author, m.date, m.message,
               COALESCE(a.symbols_added, 0) + COALESCE(a.symbols_modified, 0) + COALESCE(a.symbols_removed, 0) as changes
        FROM commits_metadata m
        LEFT JOIN commits_analysis a ON m.sha = a.sha
        ORDER BY m.date DESC
        LIMIT ? OFFSET ?
      `);

      const commits = stmt.all(limit, offset) as any[];
      stmt.free?.();

      return commits.map(c => ({
        sha: c.sha,
        message: c.message,
        author: c.author,
        date: new Date(c.date),
        changes: c.changes || 0,
      }));
    } catch (error) {
      logError('Failed to get recent commits', error);
      return [];
    }
  }

  /**
   * Count total commits in database
   */
  async countCommits(): Promise<number> {
    try {
      await ensureDatabaseInitialized();
      const result = prepare('SELECT COUNT(*) as count FROM commits_metadata').get() as {
        count: number;
      };
      return result.count;
    } catch (error) {
      logError('Failed to count commits', error);
      return 0;
    }
  }

  /**
   * Check if commit has been analyzed
   */
  async isAnalyzed(sha: string): Promise<boolean> {
    try {
      await ensureDatabaseInitialized();
      const result = prepare('SELECT 1 FROM commits_analysis WHERE sha = ? LIMIT 1').get(sha);
      return !!result;
    } catch (error) {
      logError(`Failed to check if commit ${sha} is analyzed`, error);
      return false;
    }
  }

  /**
   * Get commits with filtering and search
   */
  async searchCommits(options: CommitSearchOptions = {}): Promise<CommitListItem[]> {
    try {
      await ensureDatabaseInitialized();

      const { limit = 20, offset = 0, filterText, shas } = options;

      let query = `
        SELECT m.sha, m.author, m.date, m.message, m.files_changed
        FROM commits_metadata m
      `;

      const conditions: string[] = [];
      const params: any[] = [];

      if (filterText && filterText.trim()) {
        conditions.push('(m.message LIKE ? OR m.sha LIKE ?)');
        const searchTerm = `%${filterText.trim()}%`;
        params.push(searchTerm, searchTerm);
      }

      if (shas && shas.length > 0) {
        const placeholders = shas.map(() => '?').join(',');
        conditions.push(`m.sha IN (${placeholders})`);
        params.push(...shas);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ` ORDER BY m.date DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const stmt = prepare(query);
      const commits = stmt.all(...params) as any[];
      stmt.free?.();

      return commits.map(c => ({
        sha: c.sha,
        message: c.message,
        author: c.author,
        date: new Date(c.date),
        changes: c.files_changed || 0,
      }));
    } catch (error) {
      logError('Failed to search commits', error);
      return [];
    }
  }
}

// Singleton instance
let commitServiceInstance: CommitService | null = null;

export function getCommitService(): CommitService {
  if (!commitServiceInstance) {
    commitServiceInstance = new CommitService();
  }
  return commitServiceInstance;
}

// Types
export interface CommitMetadata {
  sha: string;
  author: string;
  date: Date;
  message: string;
  parent: string | null;
  filesChanged: number;
}

export interface CommitListItem {
  sha: string;
  message: string;
  author: string;
  date: Date;
  changes: number;
}

export interface CommitSearchOptions {
  limit?: number;
  offset?: number;
  filterText?: string;
  shas?: string[];
}
