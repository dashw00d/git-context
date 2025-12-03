import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { LiveDiffTracker } from '../../../src/liveTracker';

// Mock vscode module
vi.mock('vscode', () => ({
  workspace: {
    onDidChangeTextDocument: vi.fn(),
    onDidSaveTextDocument: vi.fn(),
    onDidChangeConfiguration: vi.fn(),
    textDocuments: [],
    asRelativePath: vi.fn((uri) => uri.fsPath),
    createFileSystemWatcher: vi.fn(() => ({
      dispose: vi.fn()
    })),
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key: string, defaultValue?: any) => {
        if (key === 'enabled') return true;
        if (key === 'thresholds') return { lines: 50, symbols: 5 };
        if (key === 'extensions') return ['ts', 'js'];
        if (key === 'autoRunAfterEdits') return 50;
        return defaultValue;
      })
    }))
  },
  window: {
    showInformationMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    showErrorMessage: vi.fn()
  },
  Uri: {
    parse: vi.fn((uri: string) => ({ toString: () => uri, fsPath: uri })),
    file: vi.fn((path: string) => ({ toString: () => path, fsPath: path }))
  }
}));

// Mock other dependencies
vi.mock('../../../src/analysis/git', () => ({
  GitOperations: class {
    getStagedFiles = vi.fn(() => []);
  }
}));

vi.mock('../../../src/analysis/symbols', () => ({
  SymbolExtractor: class {
    constructor(){
//empty
 }
  }
}));

vi.mock('../../../src/utils/config', () => ({
  getSupportedExtensions: vi.fn(() => ['ts', 'js', 'php']),
  getPackageJsonDefault: vi.fn(() => undefined),
  getPackageJsonDefaultNested: vi.fn(() => undefined)
}));

vi.mock('../../../src/utils/logger', () => ({
  logDebug: vi.fn(),
  logInfo: vi.fn(),
  logError: vi.fn()
}));

describe('LiveDiffTracker', () => {
  let tracker: LiveDiffTracker;

  beforeEach(() => {
    vi.clearAllMocks();
    tracker = new LiveDiffTracker();
  });

  it('should initialize with default thresholds', () => {
    expect(tracker).toBeDefined();
    expect(tracker.hasPendingChanges().files).toBe(0);
  });

  it('should track pending changes', () => {
    const pending = tracker.hasPendingChanges();
    expect(pending.files).toBe(0);
    expect(pending.totalEdits).toBe(0);
  });

  it('should clear all buffers', () => {
    tracker.clearAllBuffers();
    const pending = tracker.hasPendingChanges();
    expect(pending.files).toBe(0);
    expect(pending.totalEdits).toBe(0);
  });

  it('should emit changesUpdated event', async () => {
    const eventPromise = new Promise((resolve) => {
      tracker.on('changesUpdated', (data) => {
        expect(data).toHaveProperty('uri');
        expect(data).toHaveProperty('pendingChanges');
        resolve(data);
      });
    });


    (tracker as any).emit('changesUpdated', {
      uri: 'file:/
      pendingChanges: { files: 1, totalEdits: 1 }
    });

    await eventPromise;
  });

  it('should dispose properly', () => {
    // Mock disposables to have dispose method
    (tracker as any).disposables = [
      { dispose: vi.fn() },
      { dispose: vi.fn() }
    ];

    tracker.dispose();

    expect(tracker.hasPendingChanges().files).toBe(0);
  });
});
