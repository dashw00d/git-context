import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { getDatabase } from './database';
import { RefactorBundleFacts } from '../facts/types';
import { GitOperations } from '../analysis/git';
import { getGitRoot } from '../utils/config';

export interface SavedReport {
  id: string;
  title: string;
  commitShas: string[];
  selectedFiles: string[];
  workspaceScope: 'full' | 'staged' | 'unstaged' | 'partial';
  createdAt: Date;
  workspaceHash: string;
  facts: RefactorBundleFacts | null;
  analysis: any;
  summary: string;
  criticalCount: number;
  warningCount: number;
  isPinned: boolean;
  // Layer 3 caching fields
  fingerprint?: string;
  pipelineVersion?: string;
  promptVersion?: string;
  mode?: string;
}

export class ReportManager {
  /**
   * Save a report to the database
   */
  save(report: SavedReport): void {
    const db = getDatabase();
    if (!db) {
      throw new Error('Database not initialized');
    }

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO reports (
        id, title, commit_shas, selected_files, workspace_scope,
        created_at, workspace_hash, facts_json, analysis_json,
        summary, critical_count, warning_count, is_pinned,
        fingerprint, pipeline_version, prompt_version, mode
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      report.id,
      report.title,
      JSON.stringify(report.commitShas),
      JSON.stringify(report.selectedFiles),
      report.workspaceScope,
      report.createdAt.toISOString(),
      report.workspaceHash,
      report.facts ? JSON.stringify(report.facts) : null,
      report.analysis ? JSON.stringify(report.analysis) : null,
      report.summary,
      report.criticalCount,
      report.warningCount,
      report.isPinned ? 1 : 0,
      report.fingerprint || null,
      report.pipelineVersion || null,
      report.promptVersion || null,
      report.mode || 'selection'
    );
  }

  /**
   * Load a report by ID
   */
  load(id: string): SavedReport | null {
    const db = getDatabase();
    if (!db) {
      return null;
    }

    const stmt = db.prepare('SELECT * FROM reports WHERE id = ?');
    const row = stmt.get(id);

    if (!row) {
      return null;
    }

    return this.deserializeReport(row);
  }

  /**
   * Load a report by fingerprint (Layer 3 caching)
   */
  loadByFingerprint(fingerprint: string): SavedReport | null {
    const db = getDatabase();
    if (!db) {
      return null;
    }

    const stmt = db.prepare('SELECT * FROM reports WHERE fingerprint = ?');
    const row = stmt.get(fingerprint);

    if (!row) {
      return null;
    }

    return this.deserializeReport(row);
  }

  /**
   * List all reports, sorted by pinned first, then by date DESC
   */
  list(): SavedReport[] {
    const db = getDatabase();
    if (!db) {
      return [];
    }

    const stmt = db.prepare(`
      SELECT * FROM reports 
      ORDER BY is_pinned DESC, created_at DESC
    `);
    const rows = stmt.all();

    return rows.map((row: any) => this.deserializeReport(row));
  }

  /**
   * Delete a report
   */
  delete(id: string): void {
    const db = getDatabase();
    if (!db) {
      throw new Error('Database not initialized');
    }

    const stmt = db.prepare('DELETE FROM reports WHERE id = ?');
    stmt.run(id);
  }

  /**
   * Toggle pin status of a report
   */
  togglePin(id: string): void {
    const db = getDatabase();
    if (!db) {
      throw new Error('Database not initialized');
    }

    const report = this.load(id);
    if (!report) {
      throw new Error(`Report ${id} not found`);
    }

    const stmt = db.prepare('UPDATE reports SET is_pinned = ? WHERE id = ?');
    stmt.run(report.isPinned ? 0 : 1, id);
  }

  /**
   * Compute workspace hash for staleness detection
   * Hash of: git status output + file modification times
   */
  /**
   * Compute workspace hash for staleness detection
   * Hash of: git status output + file modification times
   */
  async computeWorkspaceHash(): Promise<string> {
    const git = new GitOperations();
    const gitRoot = getGitRoot();
    if (!gitRoot) {
      throw new Error('Not in a git repository');
    }

    // Get git status output by using getWorkingDirectoryChanges
    // We'll reconstruct the status string from the changes
    const changes = await git.getWorkingDirectoryChanges();
    const statusLines: string[] = [];
    const fileTimes: string[] = [];

    for (const change of changes) {
      // Reconstruct status line format: "XY path"
      const statusCode = change.status === 'A' ? 'A ' :
        change.status === 'M' ? ' M' :
          change.status === 'D' ? 'D ' : '??';
      statusLines.push(`${statusCode} ${change.path}`);

      const fullPath = path.join(gitRoot, change.path);
      try {
        if (fs.existsSync(fullPath)) {
          const stat = fs.statSync(fullPath);
          fileTimes.push(`${change.path}:${stat.mtime.getTime()}`);
        }
      } catch (error) {
        // Skip files that can't be accessed
        console.warn(`Failed to stat ${change.path}:`, error);
      }
    }

    const combined = statusLines.join('\n') + '\n' + fileTimes.join('\n');
    return crypto.createHash('md5').update(combined).digest('hex');
  }

  /**
   * Get count of files that changed since report was created
   */
  async getChangedFileCount(report: SavedReport): Promise<number> {
    const git = new GitOperations();
    const gitRoot = getGitRoot();
    if (!gitRoot) {
      return 0;
    }

    const changes = await git.getWorkingDirectoryChanges();
    const currentFiles = new Set(
      changes.map(f => f.path)
    );
    const reportFiles = new Set(report.selectedFiles);

    // Count files that changed since report creation
    let changed = 0;
    for (const filePath of reportFiles) {
      if (currentFiles.has(filePath)) {
        // Check if file was modified after report creation
        const fullPath = path.join(gitRoot, filePath);
        try {
          if (fs.existsSync(fullPath)) {
            const stat = fs.statSync(fullPath);
            const fileMtime = stat.mtime.getTime();
            const reportTime = report.createdAt.getTime();
            if (fileMtime > reportTime) {
              changed++;
            }
          }
        } catch (error) {
          // Skip files that can't be accessed
          console.warn(`Failed to check ${filePath}:`, error);
        }
      }
    }

    return changed;
  }

  /**
   * Deserialize a database row to SavedReport
   */
  private deserializeReport(row: any): SavedReport {
    return {
      id: row.id,
      title: row.title,
      commitShas: JSON.parse(row.commit_shas || '[]'),
      selectedFiles: JSON.parse(row.selected_files || '[]'),
      workspaceScope: row.workspace_scope || 'full',
      createdAt: new Date(row.created_at),
      workspaceHash: row.workspace_hash,
      facts: row.facts_json ? JSON.parse(row.facts_json) : null,
      analysis: row.analysis_json ? JSON.parse(row.analysis_json) : null,
      summary: row.summary || '',
      criticalCount: row.critical_count || 0,
      warningCount: row.warning_count || 0,
      isPinned: row.is_pinned === 1,
      // Layer 3 caching fields
      fingerprint: row.fingerprint || undefined,
      pipelineVersion: row.pipeline_version || undefined,
      promptVersion: row.prompt_version || undefined,
      mode: row.mode || undefined
    };
  }
}

// Singleton instance
let reportManager: ReportManager | null = null;

export function getReportManager(): ReportManager {
  if (!reportManager) {
    reportManager = new ReportManager();
  }
  return reportManager;
}

