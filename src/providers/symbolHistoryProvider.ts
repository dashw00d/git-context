import * as vscode from 'vscode';
import { prepare } from '../storage/statement-wrapper';
import { logError } from '../utils/logger';

export class SymbolHistoryProvider {
  private searchQuery: string = '';

  constructor(private context: vscode.ExtensionContext) {}

  refresh(): void {}

  async exportRecentSymbols(
    limit = 20,
    filterText?: string,
    filterKind?: string | 'all',
    filterChange?: 'all' | 'added' | 'modified' | 'removed'
  ): Promise<
    Array<{
      path: string;
      name: string;
      kind: string;
      changeType: string;
      sha: string;
      date: string;
    }>
  > {
    try {
      const { ensureDatabaseInitialized } = await import('../storage/database');
      await ensureDatabaseInitialized();
      const safeLimit = Math.max(1, Number(limit) || 20);

      let query = `
        SELECT s.path, s.name, s.kind, s.change_type, c.date, s.sha
        FROM symbols s
        JOIN commits_metadata c ON s.sha = c.sha
      `;
      const conditions: string[] = [];
      const params: any[] = [];

      if (filterText && filterText.trim()) {
        conditions.push(`(s.name LIKE ? OR s.path LIKE ?)`);
        const searchTerm = `%${filterText.trim()}%`;
        params.push(searchTerm, searchTerm);
      }

      if (filterKind && filterKind !== 'all') {
        conditions.push(`s.kind = ?`);
        params.push(filterKind);
      }

      if (filterChange && filterChange !== 'all') {
        conditions.push(`s.change_type = ?`);
        params.push(filterChange);
      }

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      query += ` ORDER BY c.date DESC LIMIT ${safeLimit}`;

      const stmt = prepare(query);
      const rows = stmt.all(...params) as any[];
      stmt.free?.();

      return rows.map(row => ({
        path: row.path,
        name: row.name,
        kind: row.kind,
        changeType: row.change_type,
        sha: row.sha,
        date: row.date,
      }));
    } catch (error) {
      logError('Failed to export symbols for cockpit:', error);
      return [];
    }
  }

  setSearchQuery(query: string): void {
    this.searchQuery = query;
    this.refresh();
  }
}
