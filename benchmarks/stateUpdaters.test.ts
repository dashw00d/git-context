
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode module first
vi.mock('vscode', () => ({
    commands: {
        executeCommand: vi.fn()
    },
    Uri: {
        file: (path: string) => ({ fsPath: path }),
        joinPath: () => ({ fsPath: 'mock/path' })
    }
}));

import { updateCommitsState } from '../src/core/stateUpdaters';
import { CockpitOrchestrator } from '../src/state/cockpitOrchestrator';
import { CommitsProvider } from '../src/providers/commitsProvider';
import { ActiveBundleProvider } from '../src/providers/activeBundleProvider';

// Mock dependencies
vi.mock('../src/utils/config', () => ({
    getExtensionConfig: () => ({ defaultCommitCount: 20 }),
    getGitRoot: () => '/mock/root'
}));

vi.mock('../src/storage/database', () => ({
    getDatabaseManager: () => ({
        getDatabase: () => ({
            prepare: () => ({
                get: () => ({ count: 0 })
            })
        })
    }),
    ANALYSIS_VERSION: 1
}));

vi.mock('../src/analysis/git', () => ({
    GitOperations: class {
        getCurrentBranch() { return Promise.resolve('main'); }
    }
}));

describe('stateUpdaters', () => {
    let orchestrator: any;
    let commitsProvider: any;
    let activeBundleProvider: any;
    let state: any;

    beforeEach(() => {
        state = {
            commitsFilterText: '',
            commitsFilterScopes: { staged: true, unstaged: true, history: true },
            lastNCommits: 20,
            selectedCommitShas: [],
            selectedStagedPaths: [],
            selectedUnstagedPaths: []
        };

        orchestrator = {
            getState: () => state,
            updateState: vi.fn((newState) => {
                Object.assign(state, newState);
            })
        };

        commitsProvider = {
            initializeDatabase: vi.fn(),
            exportCommitsDto: vi.fn().mockResolvedValue([]),
            exportSelectionDto: vi.fn().mockReturnValue({
                selectedCommitShas: [],
                selectedFiles: [],
                workspaceScope: 'workspace'
            }),
            exportWorkspaceFilesDto: vi.fn().mockReturnValue({
                staged: [],
                unstaged: []
            }),
            loadMoreOffset: 0
        };

        activeBundleProvider = {
            exportBundleFacts: vi.fn().mockReturnValue(null)
        };
    });

    it('should respect lastNCommits when fetching commits', async () => {
        // Set lastNCommits to 50
        state.lastNCommits = 50;

        await updateCommitsState(
            orchestrator as unknown as CockpitOrchestrator,
            commitsProvider as unknown as CommitsProvider,
            activeBundleProvider as unknown as ActiveBundleProvider
        );

        // Expect exportCommitsDto to be called with at least 50
        const calls = (commitsProvider.exportCommitsDto as any).mock.calls;
        expect(calls.length).toBeGreaterThan(0);
        const limitArg = calls[0][0];
        expect(limitArg).toBeGreaterThanOrEqual(50);
    });

    it('should use default limit if lastNCommits is small', async () => {
        state.lastNCommits = 5; // Less than default 20

        await updateCommitsState(
            orchestrator as unknown as CockpitOrchestrator,
            commitsProvider as unknown as CommitsProvider,
            activeBundleProvider as unknown as ActiveBundleProvider
        );

        // Should still use at least default 20
        const calls = (commitsProvider.exportCommitsDto as any).mock.calls;
        expect(calls.length).toBeGreaterThan(0);
        const limitArg = calls[0][0];
        expect(limitArg).toBeGreaterThanOrEqual(20);
    });
});
