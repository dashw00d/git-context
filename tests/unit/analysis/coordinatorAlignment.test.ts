
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { setupSandboxRepo, SANDBOX_DIR } from '../../fixtures/setupSandbox';
import { getDatabaseManager, setDatabaseManagerForTesting } from '../../../src/storage/database';
import { DatabaseWriteQueue } from '../../../src/storage/databaseWriteQueue';
import { AnalysisCoordinator, getAnalysisCoordinator } from '../../../src/services/analysisCoordinator';
import { getStore } from '../../../src/state/store';

// Mock vscode as it might be imported by AnalysisCoordinator or its dependencies
vi.mock('vscode', () => ({
  default: {
    CancellationTokenSource: class {
      token = { isCancellationRequested: false };
    }
  }
}));


describe('AnalysisCoordinator Alignment', () => {
  let repoPath: string;
  let commits: string[];
  let dbManager: DatabaseManager;
  let coordinator: AnalysisCoordinator;
  let originalCwd: string;

  vi.setConfig({ testTimeout: 30000 });

  beforeAll(async () => {
    originalCwd = process.cwd();
    const result = setupSandboxRepo();
    repoPath = result.repoPath;
    commits = result.commits;

    process.chdir(repoPath);

    // Reset singleton to ensure we get a fresh instance for this test's repo directory
    setDatabaseManagerForTesting(null);

    // Use the default database singleton (created at gitRoot/.git/commit-tracker/...)
    // This avoids the database mismatch issue where the DatabaseWriteQueue uses a different DB
    dbManager = getDatabaseManager();
    await dbManager.initialize();

    coordinator = getAnalysisCoordinator();
  });

  afterAll(() => {
    try {
      if (originalCwd && fs.existsSync(originalCwd)) {
        process.chdir(originalCwd);
      }
    } catch (error) {}

    if (dbManager) dbManager.close();
  });

  it('should successfully run frame analysis through coordinator', async () => {
    // requestFrameAnalysis uses the pipeline and dispatches actions
    const result = await coordinator.requestFrameAnalysis(commits);

    expect(result).toBeDefined();
    expect(result.bundleFacts).toBeDefined();

    // Verify facts are present (using values confirmed in Phase 2)
    // Working symbols should be around 63 after all 6 commits
    expect(result.bundleFacts?.working?.symbols).toBe(63);
  });

  it('should dispatch proper actions to the store', async () => {
    // We can't easily check the real store unless we spy on dispatch
    const store = getStore();
    const spy = vi.spyOn(store, 'dispatch');

    await coordinator.requestFrameAnalysis([commits[0]]);

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'ANALYSIS_STARTED'
    }));

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'ANALYSIS_COMPLETED'
    }));
  });
});
