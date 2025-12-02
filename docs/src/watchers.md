# Watchers Module (`watchers/`)

## Purpose

The `watchers/` module implements file system and Git event watchers that trigger automatic analysis and UI updates. It monitors repository changes and provides real-time feedback to users.

## Key Components

### Git Commit Watcher (`gitCommitWatcher.ts`)

Watches for Git commit events and triggers analysis.

```typescript
export class GitCommitWatcher {
  private watcher: vscode.FileSystemWatcher | null = null;
  private postCommitHookPath: string | null = null;

  constructor(private orchestrator: CockpitOrchestrator) {}

  async startWatching(): Promise<void> {
    const gitRoot = getGitRoot();
    if (!gitRoot) return;

    // Watch .git/logs/HEAD for commit changes
    const logPath = path.join(gitRoot, '.git', 'logs', 'HEAD');
    this.watcher = vscode.workspace.createFileSystemWatcher(logPath);

    this.watcher.onDidChange(async () => {
      logInfo('[GitWatcher] Commit detected, triggering analysis');
      await this.handleNewCommits();
    });

    this.watcher.onDidCreate(async () => {
      logInfo('[GitWatcher] New branch/commit created');
      await this.handleNewCommits();
    });

    // Install post-commit hook if enabled
    if (getExtensionConfig().autoInstallHooks) {
      await this.installPostCommitHook();
    }
  }

  private async handleNewCommits(): Promise<void> {
    try {
      // Get recent commits
      const git = new GitOperations();
      const recentCommits = await git.getRecentCommits(5);

      // Trigger analysis if enabled
      const config = getExtensionConfig();
      if (config.autoAnalyzeCommits) {
        this.orchestrator.dispatch({
          type: 'ANALYSIS_REQUESTED',
          payload: {
            selection: recentCommits.map(c => c.sha),
            force: false,
          },
        });
      }

      // Refresh UI
      await refreshCockpitState(this.orchestrator);
    } catch (error) {
      logError('[GitWatcher] Failed to handle new commits', error);
    }
  }

  private async installPostCommitHook(): Promise<void> {
    const gitRoot = getGitRoot();
    if (!gitRoot) return;

    const hooksDir = path.join(gitRoot, '.git', 'hooks');
    const hookPath = path.join(hooksDir, 'post-commit');

    if (fs.existsSync(hookPath)) {
      logInfo('[GitWatcher] Post-commit hook already exists');
      return;
    }

    const hookContent = `#!/bin/sh
# Git Context post-commit hook
exec ct analyze --count 1 --quiet || true
`;

    fs.writeFileSync(hookPath, hookContent, { mode: 0o755 });
    this.postCommitHookPath = hookPath;
    logInfo('[GitWatcher] Post-commit hook installed');
  }

  dispose(): void {
    this.watcher?.dispose();
    this.watcher = null;
  }
}
```

## Architecture

### Watcher Types

Different watcher patterns for different event sources:

- **File System Watchers**: VS Code API for file changes
- **Git Event Watchers**: Monitor Git internal files
- **Post-commit Hooks**: Git hook integration
- **Timer-based Watchers**: Periodic checks

### Event Flow

```
Git Event → Watcher Detection → State Update → UI Refresh → User Notification
```

## Key Concepts

### Debounced Watching

Watchers use debouncing to prevent excessive updates:

```typescript
private debounceTimer: NodeJS.Timeout | null = null;

private debouncedUpdate = (action: () => void) => {
  if (this.debounceTimer) {
    clearTimeout(this.debounceTimer);
  }

  this.debounceTimer = setTimeout(action, 500); // 500ms debounce
};
```

### Resource Management

Watchers properly manage VS Code resources:

```typescript
dispose(): void {
  this.watcher?.dispose();
  this.watcher = null;

  if (this.debounceTimer) {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = null;
  }
}
```

### Error Resilience

Watchers handle errors gracefully without crashing:

```typescript
private async handleEvent(): Promise<void> {
  try {
    await this.processEvent();
  } catch (error) {
    logError('[Watcher] Event processing failed', error);
    // Continue watching - don't throw
  }
}
```

## Dependencies

- **core/** - Orchestrator integration
- **utils/** - Configuration and logging
- **analysis/** - Git operations

## Usage Examples

### Basic Watcher Setup

```typescript
import { GitCommitWatcher } from './watchers/gitCommitWatcher';

const watcher = new GitCommitWatcher(orchestrator);
await watcher.startWatching();

// Watcher automatically handles Git events
```

### Custom Watcher Implementation

```typescript
class CustomFileWatcher {
  private watcher: vscode.FileSystemWatcher;

  constructor(
    private pattern: string,
    private callback: (uri: vscode.Uri) => void
  ) {
    this.watcher = vscode.workspace.createFileSystemWatcher(pattern);
    this.watcher.onDidChange(uri => this.debouncedCallback(uri));
    this.watcher.onDidCreate(uri => this.debouncedCallback(uri));
    this.watcher.onDidDelete(uri => this.debouncedCallback(uri));
  }

  private debouncedCallback = debounce((uri: vscode.Uri) => {
    this.callback(uri);
  }, 300);

  dispose(): void {
    this.watcher.dispose();
  }
}
```
