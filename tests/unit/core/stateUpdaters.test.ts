import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock vscode module first
vi.mock('vscode', () => ({
  commands: {
    executeCommand: vi.fn(),
  },
  Uri: {
    file: (path: string) => ({ fsPath: path }),
    joinPath: () => ({ fsPath: 'mock/path' }),
  },
}));

import { updateCommitsState } from '../../../src/core/stateUpdaters';
import { ActiveBundleProvider } from '../../../src/providers/activeBundleProvider';
import { CommitsProvider } from '../../../src/providers/commitsProvider';
import { CockpitOrchestrator } from '../../../src/state/cockpitOrchestrator';

// Mock dependencies
vi.mock('../../../src/utils/config', () => ({
  getExtensionConfig: () => ({ defaultCommitCount: 20 }),
  getGitRoot: () => '/mock/root',
}));

vi.mock('../../../src/storage/database', () => ({
  getDatabaseManager: () => ({
    getDatabase: () => ({
      prepare: () => ({
        get: () => ({ count: 0 }),
      }),
    }),
  }),
}));

vi.mock('../../../src/storage/schema', () => ({
  ANALYSIS_VERSION: 1,
}));

vi.mock('../../../src/analysis/git', () => ({
  GitOperations: class {
    getCurrentBranch() {
      return Promise.resolve('main');
    }
  },
}));

describe('stateUpdaters', () => {
  let orchestrator: any;
  let commitsProvider: any;
  let activeBundleProvider: any;
  let state: any;

  beforeEach(async () => {
    state = {
      commitsFilterText: '',
      commitsFilterScopes: { staged: true, unstaged: true, history: true },
      lastNCommits: 20,
      selectedCommitShas: [],
      selectedStagedPaths: [],
      selectedUnstagedPaths: [],
      bundleFacts: null,
    };

    orchestrator = {
      getState: () => state,
      updateState: vi.fn(newState => {
        Object.assign(state, newState);
      }),
    };

    commitsProvider = {
      initializeDatabase: vi.fn(),
      exportCommitsDto: vi.fn().mockResolvedValue([]),
      exportSelectionDto: vi.fn().mockReturnValue({
        selectedCommitShas: [],
        selectedFiles: [],
        workspaceScope: 'workspace',
      }),
      exportWorkspaceFilesDto: vi.fn().mockReturnValue({
        staged: [],
        unstaged: [],
      }),
      loadMoreOffset: 0,
    };

    activeBundleProvider = {
      exportBundleFacts: vi.fn().mockReturnValue(null),
    };

    const { CockpitEffects } = await import('../../../src/state/effects');
    const { getStore } = await import('../../../src/state/store');
    const store = getStore();

    // Mock store.getState to return our test state
    vi.spyOn(store, 'getState').mockReturnValue(state);

    vi.spyOn(store, 'dispatch');

    new CockpitEffects(store, {
      commitsProvider,
      activeBundleProvider,
      symbolHistoryProvider: {} as any,
    });
  });

  it('should respect lastNCommits when fetching commits', async () => {
    state.lastNCommits = 50;

    await updateCommitsState(
      orchestrator as unknown as CockpitOrchestrator,
      commitsProvider as unknown as CommitsProvider,
      activeBundleProvider as unknown as ActiveBundleProvider
    );

    await new Promise(resolve => setTimeout(resolve, 100));

    const calls = (commitsProvider.exportCommitsDto as any).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const limitArg = calls[0][0];
    expect(limitArg).toBeGreaterThanOrEqual(50);
  });

  it('should use default limit if lastNCommits is small', async () => {
    state.lastNCommits = 2;

    await updateCommitsState(
      orchestrator as unknown as CockpitOrchestrator,
      commitsProvider as unknown as CommitsProvider,
      activeBundleProvider as unknown as ActiveBundleProvider
    );

    await new Promise(resolve => setTimeout(resolve, 100));

    const calls = (commitsProvider.exportCommitsDto as any).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const limitArg = calls[0][0];
    expect(limitArg).toBeGreaterThanOrEqual(5);
  });
});
