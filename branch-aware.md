Branch-Aware Architecture: Implementation Breakdown
Core Principle
Commits are global, branch membership is tracked separately. Workspace analysis is branch-qualified.

Schema Changes (v11)
New Tables
sql
-- Track which branches contain which commits
CREATE TABLE commit_branches (
  sha TEXT NOT NULL,
  branch TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  is_head INTEGER DEFAULT 0,
  PRIMARY KEY (sha, branch),
  FOREIGN KEY (sha) REFERENCES commits_metadata(sha)
);

-- Branch metadata
CREATE TABLE branches (
  name TEXT PRIMARY KEY,
  head_sha TEXT,
  parent_branch TEXT,
  created_at TEXT NOT NULL,
  last_analyzed_at TEXT
);

-- Link squashed commits to source commits
CREATE TABLE squash_mappings (
  squash_sha TEXT NOT NULL,
  source_branch TEXT NOT NULL,
  source_shas TEXT NOT NULL, -- JSON array
  created_at TEXT NOT NULL,
  PRIMARY KEY (squash_sha, source_branch)
);

-- Indexes
CREATE INDEX idx_commit_branches_branch ON commit_branches(branch);
CREATE INDEX idx_commit_branches_sha ON commit_branches(sha);
CREATE INDEX idx_branches_parent ON branches(parent_branch);
Workspace SHA Format
typescript
// Old: 'workspace-staged', 'workspace-unstaged'
// New: 'workspace-staged@branch-name', 'workspace-unstaged@branch-name'

export function makeWorkspaceSha(mode: 'staged' | 'unstaged', branch: string): string {
  return `workspace-${mode}@${branch}`;
}

export function parseWorkspaceSha(sha: string): { mode: string; branch: string } | null {
  const match = sha.match(/^workspace-(staged|unstaged)@(.+)$/);
  return match ? { mode: match[1], branch: match[2] } : null;
}

export function isWorkspaceSha(sha: string): boolean {
  return sha.startsWith('workspace-');
}
Core Functions
Branch Detection
typescript
// src/analysis/git.ts
export class GitOperations {
  getCurrentBranch(): string | null {
    try {
      const result = this.execGit(['branch', '--show-current']);
      return result.trim() || null;
    } catch {
      return null;
    }
  }
  
  getBranchCommits(branch: string, limit: number = 100): string[] {
    const result = this.execGit(['log', branch, `--max-count=${limit}`, '--format=%H']);
    return result.trim().split('\n').filter(Boolean);
  }
}
Branch Tracking
typescript
// src/storage/branchManager.ts (NEW)
export class BranchManager {
  private db: any;
  
  async recordCommit(sha: string, branch: string) {
    this.db.prepare(`
      INSERT OR IGNORE INTO commit_branches (sha, branch, first_seen_at)
      VALUES (?, ?, ?)
    `).run(sha, branch, new Date().toISOString());
  }
  
  async updateBranchHead(branch: string, headSha: string) {
    // Clear old HEAD markers
    this.db.prepare('UPDATE commit_branches SET is_head = 0 WHERE branch = ?').run(branch);
    
    // Set new HEAD
    this.db.prepare('UPDATE commit_branches SET is_head = 1 WHERE sha = ? AND branch = ?')
      .run(headSha, branch);
    
    // Update branch metadata
    this.db.prepare(`
      INSERT OR REPLACE INTO branches (name, head_sha, last_analyzed_at)
      VALUES (?, ?, ?)
    `).run(branch, headSha, new Date().toISOString());
  }
  
  getCommitsOnBranch(branch: string): string[] {
    return this.db.prepare('SELECT sha FROM commit_branches WHERE branch = ? ORDER BY first_seen_at DESC')
      .all(branch)
      .map((r: any) => r.sha);
  }
  
  getCommitsNotOnBranch(branch: string, excludeBranch: string): string[] {
    // Commits on `branch` but not on `excludeBranch`
    return this.db.prepare(`
      SELECT cb1.sha FROM commit_branches cb1
      WHERE cb1.branch = ?
      AND NOT EXISTS (
        SELECT 1 FROM commit_branches cb2 
        WHERE cb2.sha = cb1.sha AND cb2.branch = ?
      )
      ORDER BY cb1.first_seen_at DESC
    `).all(branch, excludeBranch).map((r: any) => r.sha);
  }
}
Workspace Analysis Updates
Pipeline Changes
typescript
// src/analysis/pipeline.ts
async analyzeWorkspace(
  mode: 'staged' | 'unstaged',
  options: AnalysisOptions = {}
): Promise<CommitAnalysis> {
  const currentBranch = this.git.getCurrentBranch();
  if (!currentBranch) {
    throw new Error('Not on a branch');
  }
  
  const sha = makeWorkspaceSha(mode, currentBranch);
  
  // Check cache
  if (!options.forceReanalyze && await this.isCommitAnalyzed(sha)) {
    return await this.getAnalysisResults(sha);
  }
  
  // ... analyze (same as before) ...
  
  const analysis: CommitAnalysis = {
    sha, // e.g., 'workspace-staged@feature/auth'
    // ... rest of analysis
  };
  
  await this.storeCommitAnalysis(analysis);
  return analysis;
}
Migration on Commit
typescript
async migrateWorkspaceToCommit(newSha: string): Promise<void> {
  const currentBranch = this.git.getCurrentBranch();
  if (!currentBranch) return;
  
  const workspaceSha = makeWorkspaceSha('staged', currentBranch);
  
  // Check workspace analysis exists
  const exists = await this.isCommitAnalyzed(workspaceSha);
  if (!exists) return;
  
  // Migrate data
  this.db.exec('BEGIN TRANSACTION');
  try {
    this.db.prepare('UPDATE commits_analysis SET sha = ? WHERE sha = ?')
      .run(newSha, workspaceSha);
    this.db.prepare('UPDATE symbols SET sha = ? WHERE sha = ?')
      .run(newSha, workspaceSha);
    this.db.prepare('UPDATE edges SET sha = ? WHERE sha = ?')
      .run(newSha, workspaceSha);
    this.db.prepare('UPDATE files SET sha = ? WHERE sha = ?')
      .run(newSha, workspaceSha);
    
    // Record commit on branch
    const branchManager = new BranchManager(this.db);
    await branchManager.recordCommit(newSha, currentBranch);
    await branchManager.updateBranchHead(currentBranch, newSha);
    
    this.db.exec('COMMIT');
    logInfo(`Migrated ${workspaceSha} → ${newSha} on ${currentBranch}`);
  } catch (error) {
    this.db.exec('ROLLBACK');
    throw error;
  }
}
UI Updates
Branch Filter in Tree
typescript
// src/providers/commitsProvider.ts
export class CommitsProvider {
  private currentBranch: string | null = null;
  private showAllBranches: boolean = false; // User toggle
  
  async refresh() {
    this.currentBranch = this.git.getCurrentBranch();
    this._onDidChangeTreeData.fire();
  }
  
  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (!element) {
      const items: TreeItem[] = [];
      
      // Branch selector
      items.push({
        id: 'branch-selector',
        label: `Branch: ${this.currentBranch || 'unknown'}`,
        description: this.showAllBranches ? 'All branches' : 'Current only',
        command: { command: 'commit-tracker.toggleBranchFilter' }
      });
      
      // Workspace (current branch only)
      const workspaceNodes = await this.getWorkspaceNodes(this.currentBranch);
      if (workspaceNodes.length > 0) {
        items.push(...workspaceNodes);
      }
      
      // Commits (filtered by branch)
      const commits = this.showAllBranches
        ? await this.getAllCommits()
        : await this.getBranchCommits(this.currentBranch);
      
      items.push(...commits);
      return items;
    }
  }
  
  private async getWorkspaceNodes(branch: string | null): Promise<TreeItem[]> {
    if (!branch) return [];
    
    const items: TreeItem[] = [];
    const stagedSha = makeWorkspaceSha('staged', branch);
    const unstagedSha = makeWorkspaceSha('unstaged', branch);
    
    const staged = await pipeline.getAnalysisResults(stagedSha);
    if (staged) {
      items.push({
        id: stagedSha,
        label: 'Staged Changes',
        description: `${staged.symbols.added.length} symbols`,
        contextValue: 'workspace-staged'
      });
    }
    
    const unstaged = await pipeline.getAnalysisResults(unstagedSha);
    if (unstaged) {
      items.push({
        id: unstagedSha,
        label: 'Unstaged Changes',
        description: `${unstaged.symbols.added.length} symbols`,
        contextValue: 'workspace-unstaged'
      });
    }
    
    return items;
  }
  
  private async getBranchCommits(branch: string | null): Promise<TreeItem[]> {
    if (!branch) return [];
    
    const branchManager = new BranchManager(this.db);
    const shas = branchManager.getCommitsOnBranch(branch);
    
    return shas.map(sha => this.createCommitNode(sha));
  }
}
Compare Mode
typescript
// New command
async function compareToMainCmd() {
  const currentBranch = git.getCurrentBranch();
  if (!currentBranch || currentBranch === 'main') {
    vscode.window.showInformationMessage('Already on main');
    return;
  }
  
  const branchManager = new BranchManager(db);
  const newCommits = branchManager.getCommitsNotOnBranch(currentBranch, 'main');
  
  vscode.window.showInformationMessage(
    `${newCommits.length} commits on ${currentBranch} not on main`
  );
  
  // Auto-select these commits for analysis
  commitsProvider.setSelection(new Set(newCommits));
}
Squash Merge Handling
Detect Squash Merge
typescript
// src/analysis/gitWatcher.ts
async handleSquashMerge(squashSha: string, sourceBranch: string) {
  // Get all commits from source branch not on target
  const branchManager = new BranchManager(this.db);
  const sourceCommits = branchManager.getCommitsOnBranch(sourceBranch);
  
  // Record mapping
  this.db.prepare(`
    INSERT INTO squash_mappings (squash_sha, source_branch, source_shas, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    squashSha,
    sourceBranch,
    JSON.stringify(sourceCommits),
    new Date().toISOString()
  );
  
  logInfo(`Recorded squash: ${sourceBranch} → ${squashSha}`);
}
Query Squash History
typescript
async getSquashSources(squashSha: string): Promise<string[]> {
  const row = this.db.prepare(`
    SELECT source_shas FROM squash_mappings WHERE squash_sha = ?
  `).get(squashSha);
  
  return row ? JSON.parse(row.source_shas) : [];
}
Key Behaviors
On Branch Switch
Refresh UI to show current branch
Load workspace for new branch (if exists)
Filter commits to current branch (unless "show all" enabled)
On Commit
Migrate workspace-staged@current-branch → new SHA
Record commit on current branch in commit_branches
Update branch HEAD
Clear workspace cache
On Merge
Detect merge type (regular vs squash)
If squash: record mapping in squash_mappings
Add merged commits to target branch in commit_branches
Compare Mode
Query commits on feature branch not on main
Show diff count in UI
Auto-select for bundle analysis
Migration Path
v10 → v11
sql
-- Add new tables (no data migration needed)
CREATE TABLE commit_branches (...);
CREATE TABLE branches (...);
CREATE TABLE squash_mappings (...);

-- Backfill current branch
INSERT INTO branches (name, head_sha, created_at)
SELECT 'main', sha, loaded_at FROM commits_metadata ORDER BY date DESC LIMIT 1;

-- Backfill commit_branches for existing commits (assume all on main)
INSERT INTO commit_branches (sha, branch, first_seen_at)
SELECT sha, 'main', loaded_at FROM commits_metadata;
Summary
What Changes:

Workspace SHAs include branch: workspace-staged@feature/auth
New tables track branch membership, not duplicate commits
UI filters by current branch (toggle for all branches)
Compare mode shows commits unique to feature branch
Squash merges preserve source analysis
What Stays Same:

Commits stored once (by SHA)
Analysis pipeline unchanged
Migration logic similar (just branch-aware)
Estimated Effort: +2 days for branch tracking on top of workspace caching plan.