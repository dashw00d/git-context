import { logError } from '../utils/logger';
import { getDatabaseManager } from './database';

export class BranchManager {
  private _db: any;

  constructor(db?: any) {
    this._db = db;
  }

  private get db() {
    if (!this._db) {
      this._db = getDatabaseManager().getDatabase();
    }
    return this._db;
  }

  recordCommit(sha: string, branch: string | null | undefined): void {
    if (!sha || !branch) {
      return;
    }
    try {
      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO commit_branches (sha, branch, first_seen_at)
        VALUES (?, ?, ?)
      `);
      stmt.run(sha, branch, new Date().toISOString());
    } catch (error) {
      logError('[BranchManager] Failed to record commit', error);
    }
  }

  updateBranchHead(branch: string | null | undefined, headSha: string): void {
    if (!branch) {
      return;
    }
    try {
      const writeQueue = DatabaseWriteQueue.getInstance();
      // Queue branch head updates
      writeQueue.queue({ type: 'commit_branch', data: { branch, isHead: false } });
      writeQueue.queue({ type: 'commit_branch', data: { branch, sha: headSha, isHead: true } });
      this.db
        .prepare(
          `
        INSERT OR REPLACE INTO branches (name, head_sha, created_at, last_analyzed_at)
        VALUES (?, ?, COALESCE(
          (SELECT created_at FROM branches WHERE name = ?),
          ?
        ), ?)
      `
        )
        .run(branch, headSha, branch, new Date().toISOString(), new Date().toISOString());
    } catch (error) {
      logError('[BranchManager] Failed to update branch head', error);
    }
  }

  getCommitsOnBranch(branch: string | null | undefined, limit = 50): string[] {
    if (!branch) {
      return [];
    }
    try {
      const stmt = this.db.prepare(`
        SELECT sha FROM commit_branches
        WHERE branch = ?
        ORDER BY first_seen_at DESC
        LIMIT ?
      `);
      const rows = stmt.all(branch, limit) as Array<{ sha: string }>;
      return rows.map(r => r.sha);
    } catch (error) {
      logError('[BranchManager] Failed to load branch commits', error);
      return [];
    }
  }

  getCommitsNotOnBranch(sourceBranch: string, targetBranch: string, limit = 50): string[] {
    if (!sourceBranch || !targetBranch) {
      return [];
    }
    try {
      const stmt = this.db.prepare(`
        SELECT cb1.sha FROM commit_branches cb1
        WHERE cb1.branch = ?
        AND NOT EXISTS (
          SELECT 1 FROM commit_branches cb2
          WHERE cb2.sha = cb1.sha
          AND cb2.branch = ?
        )
        ORDER BY cb1.first_seen_at DESC
        LIMIT ?
      `);
      const rows = stmt.all(sourceBranch, targetBranch, limit) as Array<{
        sha: string;
      }>;
      return rows.map(r => r.sha);
    } catch (error) {
      logError('[BranchManager] Failed to compare branches', error);
      return [];
    }
  }

  getTrackedBranches(): string[] {
    try {
      const rows = this.db.prepare(`SELECT name FROM branches ORDER BY name ASC`).all() as Array<{
        name: string;
      }>;
      return rows.map(r => r.name);
    } catch (error) {
      logError('[BranchManager] Failed to list branches', error);
      return [];
    }
  }
}
