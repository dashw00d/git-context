# Live Tracker Module (`liveTracker.ts`)

## Purpose

The `liveTracker.ts` module provides real-time tracking of workspace changes during development. It monitors file modifications and triggers incremental analysis to provide immediate feedback on code evolution.

## Key Components

### LiveDiffTracker Class

Main tracker implementation that monitors workspace changes.

```typescript
export class LiveDiffTracker extends EventEmitter {
  private isTracking = false;
  private pendingChanges: {
    files: number;
    totalEdits: number;
  } = { files: 0, totalEdits: 0 };

  private thresholds = {
    linesChanged: 50,
    symbolsChanged: 5,
  };

  private debounceTimer: NodeJS.Timeout | null = null;
  private readonly debounceMs = 1000;

  constructor() {
    super();
    this.setupFileWatchers();
  }

  private setupFileWatchers(): void {
    // Watch all supported files
    const pattern = `**/*{${SUPPORTED_EXTENSIONS.join(',')}}`;
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);

    watcher.onDidChange(async uri => {
      await this.handleFileChange(uri, 'change');
    });

    watcher.onDidCreate(async uri => {
      await this.handleFileChange(uri, 'create');
    });

    watcher.onDidDelete(async uri => {
      await this.handleFileChange(uri, 'delete');
    });

    // Store watcher for disposal
    this.watchers.push(watcher);
  }

  private async handleFileChange(uri: vscode.Uri, changeType: string): Promise<void> {
    if (!this.isTracking) return;

    try {
      // Calculate change metrics
      const changeMetrics = await this.calculateChangeMetrics(uri, changeType);

      // Update pending changes
      this.pendingChanges.files += 1;
      this.pendingChanges.totalEdits += changeMetrics.edits;

      // Check thresholds
      const thresholdReached = this.checkThresholds(changeMetrics);

      // Debounce updates
      this.debouncedEmit('changesUpdated', {
        uri: uri.toString(),
        pendingChanges: { ...this.pendingChanges },
        linesChanged: changeMetrics.linesChanged,
        symbolCount: changeMetrics.symbolsChanged,
        editCount: changeMetrics.edits,
        thresholdReached,
      });
    } catch (error) {
      logError('[LiveTracker] Failed to handle file change', error);
    }
  }

  private debouncedEmit(event: string, data: any): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.emit(event, data);
      this.resetPendingChanges();
    }, this.debounceMs);
  }

  private resetPendingChanges(): void {
    this.pendingChanges = { files: 0, totalEdits: 0 };
  }

  startTracking(): void {
    this.isTracking = true;
    logInfo('[LiveTracker] Started tracking workspace changes');
  }

  stopTracking(): void {
    this.isTracking = false;
    this.resetPendingChanges();
    logInfo('[LiveTracker] Stopped tracking workspace changes');
  }

  dispose(): void {
    this.stopTracking();
    this.watchers.forEach(w => w.dispose());
    this.watchers = [];

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }
}
```

## Architecture

### Event-Driven Design

The live tracker uses an event-driven architecture:

```
File Change → Metrics Calculation → Threshold Check → Debounced Event → UI Update
```

### Threshold-Based Triggers

Analysis is triggered based on configurable thresholds:

```typescript
private checkThresholds(metrics: ChangeMetrics): boolean {
  return metrics.linesChanged >= this.thresholds.linesChanged ||
         metrics.symbolsChanged >= this.thresholds.symbolsChanged;
}
```

### Debounced Updates

Changes are batched to prevent excessive analysis:

```typescript
private debouncedEmit(event: string, data: any): void {
  // Batch rapid changes into single update
  setTimeout(() => emit(event, data), debounceMs);
}
```

## Key Concepts

### Change Metrics Calculation

Tracks different types of changes:

```typescript
interface ChangeMetrics {
  edits: number;        // Character-level changes
  linesChanged: number; // Lines added/removed
  symbolsChanged: number; // Symbols modified
}

private async calculateChangeMetrics(uri: vscode.Uri, changeType: string): Promise<ChangeMetrics> {
  // Calculate diff metrics for the changed file
  const content = await fs.readFile(uri.fsPath, 'utf8');
  // Compare with cached version, calculate metrics
}
```

### Incremental Analysis Integration

Works with LiveAnalysisEngine for incremental updates:

```typescript
// In extension.ts
liveTracker.on('changesUpdated', async data => {
  if (data.thresholdReached) {
    // Trigger incremental analysis
    await liveEngine.analyzeLiveChanges(data);
  }

  // Update UI with pending changes
  orchestrator.updateLiveState({
    pendingChanges: data.pendingChanges.files,
    totalEdits: data.pendingChanges.totalEdits,
    isTracking: true,
  });
});
```

### Resource Management

Proper cleanup of watchers and timers:

```typescript
dispose(): void {
  this.watchers.forEach(w => w.dispose());
  if (this.debounceTimer) {
    clearTimeout(this.debounceTimer);
  }
}
```

## Dependencies

- **analysis/** - Live analysis engine integration
- **utils/** - Logging and file utilities
- **vscode** - File system watching API

## Usage Examples

### Basic Tracking Setup

```typescript
import { LiveDiffTracker } from './liveTracker';

const tracker = new LiveDiffTracker();

// Start tracking
tracker.startTracking();

// Listen for changes
tracker.on('changesUpdated', data => {
  console.log(`Files changed: ${data.pendingChanges.files}`);
  console.log(`Total edits: ${data.pendingChanges.totalEdits}`);
});

// Stop when done
tracker.stopTracking();
tracker.dispose();
```

### Integration with Analysis

```typescript
// In cockpit orchestrator
liveTracker.on('changesUpdated', async data => {
  // Update live state
  this.updateLiveState({
    status: data.thresholdReached ? 'analyzing' : 'idle',
    pendingChanges: data.pendingChanges.files,
    totalEdits: data.pendingChanges.totalEdits,
  });

  // Trigger analysis if threshold reached
  if (data.thresholdReached) {
    const analysis = await liveEngine.analyzeLiveChanges(data.changes);
    this.updateLiveState({
      status: 'ready',
      facts: analysis.facts,
      summary: analysis.summary,
    });
  }
});
```

### Custom Thresholds

```typescript
const tracker = new LiveDiffTracker();
tracker.setThresholds({
  linesChanged: 100, // More tolerant for large files
  symbolsChanged: 3, // More sensitive for symbol changes
});
```
