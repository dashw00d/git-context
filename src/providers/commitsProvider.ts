import * as vscode from 'vscode';
import { GitOperations } from '../analysis/git';
import { getStore } from '../state/store';
import { BranchManager } from '../storage/branchManager';
import { logError, logInfo, logWarn } from '../utils/logger';
import { isWorkspaceSha, makeWorkspaceSha } from '../utils/workspace';
import { ActiveBundleProvider } from './activeBundleProvider';

export class CommitsProvider {
  private git: GitOperations | null = null;
  private branchManager: BranchManager;
  private currentBranch: string | null = null;

  public workspaceScope: 'workspace' | 'staged' | 'unstaged' = 'workspace';
  public loadMoreOffset = 0;
  public manualCommits: Set<string>;
  public runningTask: {
    cancel: () => void;
    token: vscode.CancellationToken;
  } | null = null;
  public PAGE_SIZE = 50;

  constructor(
    private context: vscode.ExtensionContext,
    private activeBundleProvider: ActiveBundleProvider
  ) {
    this.branchManager = new BranchManager();

    this.git = null;
    this.currentBranch = null;
    this.manualCommits = new Set(
      context.workspaceState.get<string[]>('commit-tracker.manualCommits', [])
    );

    this.workspaceScope = context.workspaceState.get('workspaceScope', 'workspace');
    this.loadMoreOffset = context.workspaceState.get('loadMoreOffset', 0);
  }

  async refresh(): Promise<void> {
    await this.updateBranchCursor();
  }

  private async updateBranchCursor() {
    if (this.git) {
      try {
        this.currentBranch = await this.git.getCurrentBranch();
      } catch {
        this.currentBranch = null;
      }
    }
  }

  async initializeDatabase(): Promise<void> {
    const { ensureDatabaseInitialized } = await import('../storage/database');
    await ensureDatabaseInitialized();
  }

  getWorkspaceScope(): 'workspace' | 'staged' | 'unstaged' {
    return this.workspaceScope;
  }

  async toggleCommitSelection(sha: string): Promise<void> {
    const store = getStore();
    const state = store.getState();
    const selected = new Set(state.selectedCommitShas);

    if (selected.has(sha)) {
      selected.delete(sha);
    } else {
      selected.add(sha);
    }

    store.dispatch({
      type: 'SELECTION_SET',
      payload: { shas: Array.from(selected) },
    });
    this.refresh();
  }

  async clearSelection(): Promise<void> {
    const store = getStore();
    store.dispatch({ type: 'SELECTION_CLEARED' });
    this.refresh();
  }

  async toggleFileSelection(file: any): Promise<void> {
    const filePath = typeof file === 'string' ? file : file.path || file.id;
    const store = getStore();
    const state = store.getState();
    const selectedStaged = new Set(state.selectedStagedPaths);
    const selectedUnstaged = new Set(state.selectedUnstagedPaths);

    let updatedStaged: string[] | undefined;
    let updatedUnstaged: string[] | undefined;

    try {
      const { GitOperations } = require('../analysis/git');
      const git = new GitOperations();
      const stagedFilesList = await git.getStagedFiles();
      const stagedFiles = stagedFilesList.map((f: { path: string }) => f.path);
      if (stagedFiles.includes(filePath)) {
        if (selectedStaged.has(filePath)) {
          selectedStaged.delete(filePath);
        } else {
          selectedStaged.add(filePath);
        }
        updatedStaged = Array.from(selectedStaged);
      } else {
        if (selectedUnstaged.has(filePath)) {
          selectedUnstaged.delete(filePath);
        } else {
          selectedUnstaged.add(filePath);
        }
        updatedUnstaged = Array.from(selectedUnstaged);
      }
    } catch (error) {
      logError('Failed to determine file status for toggle:', error);

      if (selectedStaged.has(filePath)) {
        selectedStaged.delete(filePath);
      } else {
        selectedStaged.add(filePath);
      }
      if (selectedUnstaged.has(filePath)) {
        selectedUnstaged.delete(filePath);
      } else {
        selectedUnstaged.add(filePath);
      }
      updatedStaged = Array.from(selectedStaged);
      updatedUnstaged = Array.from(selectedUnstaged);
    }

    if (updatedStaged) {
      store.dispatch({
        type: 'STAGED_SELECTION_UPDATED',
        payload: { paths: updatedStaged },
      });
    }
    if (updatedUnstaged) {
      store.dispatch({
        type: 'UNSTAGED_SELECTION_UPDATED',
        payload: { paths: updatedUnstaged },
      });
    }
    this.refresh();
  }

  async selectAllStaged(): Promise<void> {
    try {
      const { GitOperations } = require('../analysis/git');
      const git = new GitOperations();
      const staged = await git.getStagedFiles();
      const stagedPaths = staged.map((file: { path: string; status: any }) => file.path);

      const store = getStore();
      store.dispatch({
        type: 'STAGED_SELECTION_UPDATED',
        payload: { paths: stagedPaths },
      });
      this.refresh();
    } catch (error) {
      logError('Failed to select all staged files:', error);
    }
  }

  async selectAllUnstaged(): Promise<void> {
    try {
      const { GitOperations } = require('../analysis/git');
      const git = new GitOperations();
      const unstaged = await git.getUnstagedFiles();
      const unstagedPaths = unstaged.map((file: { path: string; status: any }) => file.path);

      const store = getStore();
      store.dispatch({
        type: 'UNSTAGED_SELECTION_UPDATED',
        payload: { paths: unstagedPaths },
      });
      this.refresh();
    } catch (error) {
      logError('Failed to select all unstaged files:', error);
    }
  }

  markCommitAsManual(sha: string): void {
    this.manualCommits.add(sha);
  }

  async exportCommitsDto(
    limit = 20,
    filterText?: string,
    _filterScopes?: { staged?: boolean; unstaged?: boolean; history?: boolean }
  ): Promise<
    Array<{
      sha: string;
      message: string;
      author?: string;
      date?: string;
      changes?: number;
      files?: Array<{ path: string; status: any }>;
      structuralChangeScore?: number;
      risks?: string[];
    }>
  > {
    try {
      const { getDatabaseService } = await import('../services/databaseService');
      const commitService = getDatabaseService();
      const limitValue = Math.max(1, Number(limit) || 20);

      const { GitOperations } = require('../analysis/git');
      const git = new GitOperations();
      const branch = this.currentBranch || git.getCurrentBranch();

      const result: Array<{
        sha: string;
        message: string;
        author?: string;
        date?: string;
        changes?: number;
        files?: Array<{ path: string; status: any }>;
        structuralChangeScore?: number;
        risks?: string[];
      }> = [];

      if (
        !filterText ||
        'staged changes'.includes(filterText.toLowerCase()) ||
        'unstaged changes'.includes(filterText.toLowerCase())
      ) {
        try {
          const stagedFiles = await git.getStagedFiles();
          logInfo(`Staged files: ${stagedFiles.length}`);
          if (stagedFiles.length > 0) {
            result.push({
              sha: makeWorkspaceSha('staged', branch),
              message: 'Staged Changes',
              author: 'You',
              date: new Date().toISOString(),
              changes: stagedFiles.length,
              files: stagedFiles.map((f: any) => ({
                path: f.path,
                status: f.status,
              })),
            });
          }

          const unstagedFiles = await git.getUnstagedFiles();
          if (unstagedFiles.length > 0) {
            result.push({
              sha: makeWorkspaceSha('unstaged', branch),
              message: 'Unstaged Changes',
              author: 'You',
              date: new Date().toISOString(),
              changes: unstagedFiles.length,
              files: unstagedFiles.map((f: any) => ({
                path: f.path,
                status: f.status,
              })),
            });
          }
        } catch (e) {
          logError('Failed to load virtual commits:', e);
        }
      }

      let headSha: string | null = null;
      try {
        headSha = await git.getHeadSha();
      } catch {
        headSha = null;
      }

      if (!filterText && headSha) {
        try {
          const headInfo = await git.getCommitInfo(headSha);
          result.push({
            sha: headSha,
            message: headInfo.message,
            author: headInfo.author,
            date: headInfo.date,
            changes: 0,
            files: [],
          });
        } catch {}
      }

      const searchOptions = {
        limit: this.loadMoreOffset + limitValue,
        offset: 0,
        filterText: filterText?.trim(),
      };

      const commits = await commitService.searchCommits(searchOptions);

      const historyCommits = await Promise.all(
        commits
          .filter(commit => commit.sha && !isWorkspaceSha(commit.sha) && commit.sha !== headSha)
          .map(async commit => {
            let files: Array<{ path: string; status: any }> = [];
            try {
              if (commit.sha && !isWorkspaceSha(commit.sha)) {
                const changes = await git.getFileChanges(commit.sha);
                if (Array.isArray(changes)) {
                  files = changes.map((f: any) => ({
                    path: f.path,
                    status: f.status,
                  }));
                } else {
                  logWarn(`getFileChanges returned non-array for ${commit.sha}: ${changes}`);
                }
              }
            } catch (e) {
              logWarn(`Failed to fetch files for commit ${commit.sha}: ${e}`);
            }

            return {
              sha: commit.sha,
              message: commit.message,
              author: commit.author,
              date: commit.date.toISOString(),
              files,
              stats: {
                files: commit.changes || 0,
                insertions: 0,
                deletions: 0,
              },
              isHead: false,
              isStaged: false,
              isUnstaged: false,
              structuralChangeScore: (commit as any).structuralChangeScore,
              risks: (commit as any).risks,
            };
          })
      );

      return [...result, ...historyCommits];
    } catch (error) {
      logError('Failed to export commits for cockpit:', error);
      return [];
    }
  }

  exportSelectionDto(): {
    selectedCommitShas: string[];
    selectedFiles: string[];
    workspaceScope: 'workspace' | 'staged' | 'unstaged';
  } {
    const store = getStore();
    const state = store.getState();

    return {
      selectedCommitShas: state.selectedCommitShas,
      selectedFiles: [...state.selectedStagedPaths, ...state.selectedUnstagedPaths],
      workspaceScope: this.workspaceScope,
    };
  }

  async exportWorkspaceFilesDto(): Promise<{
    staged: Array<{ path: string; status: 'A' | 'M' | 'D' | 'R' | 'C' | 'U' }>;
    unstaged: Array<{
      path: string;
      status: 'A' | 'M' | 'D' | 'R' | 'C' | 'U';
    }>;
  }> {
    try {
      const { GitOperations } = require('../analysis/git');
      const git = new GitOperations();
      const stagedList = await git.getStagedFiles();
      const unstagedList = await git.getUnstagedFiles();
      const staged = stagedList.map((f: { path: string; status: any }) => ({
        path: f.path,
        status: f.status,
      }));
      const unstaged = unstagedList.map((f: { path: string; status: any }) => ({
        path: f.path,
        status: f.status,
      }));
      return { staged, unstaged };
    } catch (error) {
      logError('Failed to export workspace files for cockpit:', error);
      return { staged: [], unstaged: [] };
    }
  }
}
