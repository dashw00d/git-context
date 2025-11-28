import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getGitRoot } from '../utils/config';
import { ActiveBundleProvider } from './activeBundleProvider';
import { GitOperations } from '../analysis/git';
import { BranchManager } from '../storage/branchManager';
import { makeWorkspaceSha, isWorkspaceSha } from '../utils/workspace';


export class CommitsProvider {
  private git: GitOperations | null = null;
  private branchManager: BranchManager;
  private currentBranch: string | null = null;

  // DEPRECATED: State moved to CockpitOrchestrator
  // public selectedCommits = new Set<string>();
  // public selectedFiles = new Set<string>();

  public workspaceScope: 'workspace' | 'staged' | 'unstaged' = 'workspace';
  public loadMoreOffset = 0;
  public manualCommits: Set<string>;
  public runningTask: { cancel: () => void; token: vscode.CancellationToken } | null = null;
  public PAGE_SIZE = 50;

  constructor(private context: vscode.ExtensionContext, private activeBundleProvider: ActiveBundleProvider) {
    this.branchManager = new BranchManager();
    // Initialize git lazily in async methods
    this.git = null;
    this.currentBranch = null;
    this.manualCommits = new Set(context.workspaceState.get<string[]>('commit-tracker.manualCommits', []));

    // DEPRECATED: State moved to CockpitOrchestrator
    // Load initial state (no longer used - CockpitOrchestrator is single source of truth)
    // const selectedCommits = context.workspaceState.get<string[]>('selectedCommits', []);
    // this.selectedCommits = new Set(selectedCommits);
    // const selectedFiles = context.workspaceState.get<string[]>('selectedFiles', []);
    // this.selectedFiles = new Set(selectedFiles);

    this.workspaceScope = context.workspaceState.get('workspaceScope', 'workspace');
    this.loadMoreOffset = context.workspaceState.get('loadMoreOffset', 0);
  }

  async refresh(): Promise<void> {
    await this.updateBranchCursor();
    // TreeView removed - no event firing needed
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






  // Methods for compatibility with commands.ts
  async initializeDatabase(): Promise<void> {
    const { ensureDatabaseInitialized } = await import('../storage/database');
    await ensureDatabaseInitialized();
  }

  getWorkspaceScope(): 'workspace' | 'staged' | 'unstaged' {
    return this.workspaceScope;
  }

  async toggleCommitSelection(sha: string): Promise<void> {
    // DEPRECATED: Use CockpitOrchestrator.updateState() instead
    // This method kept for backwards compatibility with tree views
    const { getCockpitOrchestrator } = await import('../state/cockpitOrchestrator');
    const orchestrator = getCockpitOrchestrator();
    const state = orchestrator.getState();
    const selected = new Set(state.selectedCommitShas);

    if (selected.has(sha)) {
      selected.delete(sha);
    } else {
      selected.add(sha);
    }

    orchestrator.updateState({ selectedCommitShas: Array.from(selected) }, 'provider:toggleCommit');
    this.refresh();
  }

  async clearSelection(): Promise<void> {
    // DEPRECATED: Use CockpitOrchestrator.updateState() instead
    const { getCockpitOrchestrator } = await import('../state/cockpitOrchestrator');
    const orchestrator = getCockpitOrchestrator();
    orchestrator.updateState({
      selectedCommitShas: [],
      selectedStagedPaths: [],
      selectedUnstagedPaths: []
    }, 'provider:clearSelection');
    this.refresh();
  }

  async toggleFileSelection(file: any): Promise<void> {
    const filePath = typeof file === 'string' ? file : (file.path || file.id);
    const { getCockpitOrchestrator } = await import('../state/cockpitOrchestrator');
    const orchestrator = getCockpitOrchestrator();
    const state = orchestrator.getState();
    const selectedStaged = new Set(state.selectedStagedPaths);
    const selectedUnstaged = new Set(state.selectedUnstagedPaths);

    let updatedStaged: string[] | undefined;
    let updatedUnstaged: string[] | undefined;

    // Check if it's a staged file
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
        // Assume it's an unstaged file if not staged
        if (selectedUnstaged.has(filePath)) {
          selectedUnstaged.delete(filePath);
        } else {
          selectedUnstaged.add(filePath);
        }
        updatedUnstaged = Array.from(selectedUnstaged);
      }
    } catch (error) {
      console.error('Failed to determine file status for toggle:', error);
      // Fallback: if we can't determine, just toggle in both sets (less efficient but safe)
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

    orchestrator.updateState({
      selectedStagedPaths: updatedStaged,
      selectedUnstagedPaths: updatedUnstaged
    }, 'provider:toggleFile');
    this.refresh();
  }

  async selectAllStaged(): Promise<void> {
    try {
      const { GitOperations } = require('../analysis/git');
      const git = new GitOperations();
      const staged = await git.getStagedFiles();
      const stagedPaths = staged.map((file: { path: string; status: any }) => file.path);

      const { getCockpitOrchestrator } = await import('../state/cockpitOrchestrator');
      const orchestrator = getCockpitOrchestrator();
      orchestrator.updateState({ selectedStagedPaths: stagedPaths }, 'provider:selectAllStaged');
      this.refresh();
    } catch (error) {
      console.error('Failed to select all staged files:', error);
    }
  }

  async selectAllUnstaged(): Promise<void> {
    try {
      const { GitOperations } = require('../analysis/git');
      const git = new GitOperations();
      const unstaged = await git.getUnstagedFiles();
      const unstagedPaths = unstaged.map((file: { path: string; status: any }) => file.path);

      const { getCockpitOrchestrator } = await import('../state/cockpitOrchestrator');
      const orchestrator = getCockpitOrchestrator();
      orchestrator.updateState({ selectedUnstagedPaths: unstagedPaths }, 'provider:selectAllUnstaged');
      this.refresh();
    } catch (error) {
      console.error('Failed to select all unstaged files:', error);
    }
  }

  markCommitAsManual(sha: string): void {
    this.manualCommits.add(sha);
  }

  get workspaceParts(): Set<string> {
    const { getCockpitOrchestrator } = require('../state/cockpitOrchestrator');
    const orchestrator = getCockpitOrchestrator();
    const state = orchestrator.getState();
    return new Set([...state.selectedStagedPaths, ...state.selectedUnstagedPaths]);
  }

  set workspaceParts(parts: Set<string>) {
    // This setter is deprecated as files are now split into staged/unstaged
    // For compatibility, we'll just set staged paths.
    const { getCockpitOrchestrator } = require('../state/cockpitOrchestrator');
    const orchestrator = getCockpitOrchestrator();
    orchestrator.updateState({ selectedStagedPaths: Array.from(parts) }, 'provider:setWorkspaceParts');
  }



  async exportCommitsDto(
    limit = 20,
    filterText?: string,
    filterScopes?: { staged?: boolean; unstaged?: boolean; history?: boolean }
  ): Promise<Array<{ sha: string; message: string; author?: string; date?: string; changes?: number; files?: Array<{ path: string; status: any }> }>> {
    try {
      const { getDatabaseService } = await import('../services/databaseService');
      const commitService = getDatabaseService();
      const limitValue = Math.max(1, Number(limit) || 20);

      const { GitOperations } = require('../analysis/git');
      const git = new GitOperations();
      const branch = this.currentBranch || git.getCurrentBranch();

      const result: Array<{ sha: string; message: string; author?: string; date?: string; changes?: number; files?: Array<{ path: string; status: any }> }> = [];

      // 1. Inject Virtual Commits (Staged/Unstaged)
      // Only if not filtering text (or if text matches "staged"/"unstaged")
      if (!filterText || 'staged changes'.includes(filterText.toLowerCase()) || 'unstaged changes'.includes(filterText.toLowerCase())) {
        try {
          const stagedFiles = await git.getStagedFiles();
          if (stagedFiles.length > 0) {
            result.push({
              sha: makeWorkspaceSha('staged', branch),
              message: 'Staged Changes',
              author: 'You',
              date: new Date().toISOString(),
              changes: stagedFiles.length,
              files: stagedFiles.map((f: any) => ({ path: f.path, status: f.status }))
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
              files: unstagedFiles.map((f: any) => ({ path: f.path, status: f.status }))
            });
          }
        } catch (e) {
          console.error('Failed to load virtual commits:', e);
        }
      }

      // 2. Get HEAD SHA for explicit HEAD node
      let headSha: string | null = null;
      try {
        headSha = git.getHeadSha();
      } catch {
        headSha = null;
      }

      // 3. Add explicit HEAD node (baseline commit before workspace changes)
      if (!filterText && headSha) {
        try {
          const headInfo = git.getCommitInfo(headSha);
          result.push({
            sha: headSha,
            message: headInfo.message,
            author: headInfo.author,
            date: headInfo.date,
            changes: 0, // Virtual - will be populated if analyzed
            files: [] // Will be populated from git.getFileChanges if needed
          });
        } catch {
          // HEAD not accessible, skip
        }
      }

      // 4. Fetch History Commits using CommitService
      const searchOptions = {
        limit: this.loadMoreOffset + limitValue,
        offset: 0,
        filterText: filterText?.trim()
      };

      const commits = await commitService.searchCommits(searchOptions);

      // 5. Map History Commits (exclude HEAD since we added it explicitly)
      const historyCommits = commits
        .filter((commit) => commit.sha && !isWorkspaceSha(commit.sha) && commit.sha !== headSha)
        .map((commit) => {
        let files: Array<{ path: string; status: any }> = [];
        try {
          // Only fetch files if we have a valid non-workspace SHA
          if (commit.sha && !isWorkspaceSha(commit.sha)) {
            files = git.getFileChanges(commit.sha).map((f: any) => ({
              path: f.path,
              status: f.status
            }));
          }
        } catch (e) {
          console.warn(`Failed to fetch files for commit ${commit.sha}:`, e);
          // If we failed to load files, but DB says there are changes,
          // we shouldn't return empty array if possible.
          // However, we can't invent files. The UI will show 0 files but maybe 'changes' count from DB.
        }

        return {
          sha: commit.sha,
          message: commit.message,
          author: commit.author,
          date: commit.date.toISOString(),
          changes: commit.changes,
          files: files
        };
      });

      return [...result, ...historyCommits];
    } catch (error) {
      console.error('Failed to export commits for cockpit:', error);
      return [];
    }
  }

  exportSelectionDto(): { selectedCommitShas: string[]; selectedFiles: string[]; workspaceScope: 'workspace' | 'staged' | 'unstaged' } {
    const { getCockpitOrchestrator } = require('../state/cockpitOrchestrator');
    const orchestrator = getCockpitOrchestrator();
    const state = orchestrator.getState();

    return {
      selectedCommitShas: state.selectedCommitShas,
      selectedFiles: [...state.selectedStagedPaths, ...state.selectedUnstagedPaths],
      workspaceScope: this.workspaceScope
    };
  }

  async exportWorkspaceFilesDto(): Promise<{
    staged: Array<{ path: string; status: 'A' | 'M' | 'D' | 'R' | 'C' | 'U' }>;
    unstaged: Array<{ path: string; status: 'A' | 'M' | 'D' | 'R' | 'C' | 'U' }>;
  }> {
    try {
      const { GitOperations } = require('../analysis/git');
      const git = new GitOperations();
      const stagedList = await git.getStagedFiles();
      const unstagedList = await git.getUnstagedFiles();
      const staged = stagedList.map((f: { path: string; status: any }) => ({ path: f.path, status: f.status }));
      const unstaged = unstagedList.map((f: { path: string; status: any }) => ({ path: f.path, status: f.status }));
      return { staged, unstaged };
    } catch (error) {
      console.error('Failed to export workspace files for cockpit:', error);
      return { staged: [], unstaged: [] };
    }
  }
}
