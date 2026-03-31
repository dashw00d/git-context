import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommitIndexer } from '../../src/analysis/commitIndexer';
import { GitOperations } from '../../src/analysis/git';
import { SnapshotManager } from '../../src/analysis/snapshotManager';
import { StructuralDiffManager } from '../../src/analysis/structuralDiffManager';
import { configureDNA } from '../../src/analysis/symbolDna';
import { WorkspaceIndexer } from '../../src/analysis/workspaceIndexer';
import { getDatabaseManager } from '../../src/storage/database';

import { DependencyExtractor } from '../../src/analysis/dependencies';
import { RiskDetector } from '../../src/analysis/heuristics';
import { HotspotDetectorV2 } from '../../src/analysis/hotspotDetector';
import { MovedBlockDetectorV2 } from '../../src/analysis/movedBlockDetector';
import { SymbolExtractor } from '../../src/analysis/symbols';

// Mock dependencies
vi.mock('../../src/analysis/git');
vi.mock('../../src/storage/database');
vi.mock('../../src/storage/statement-wrapper', () => ({
  prepare: vi.fn().mockReturnValue({
    run: vi.fn(),
    get: vi.fn(),
    all: vi.fn(),
    bind: vi.fn(),
    step: vi.fn(),
    reset: vi.fn(),
    free: vi.fn(),
  }),
}));
vi.mock('../../src/analysis/snapshotManager');
vi.mock('../../src/analysis/structuralDiffManager');
vi.mock('../../src/analysis/heuristics');
vi.mock('../../src/analysis/dependencies');
vi.mock('../../src/analysis/hotspotDetector');
vi.mock('../../src/analysis/movedBlockDetector');
vi.mock('../../src/analysis/symbols');

vi.mock('../../src/utils/pathFilter', () => ({
  filterPath: vi.fn().mockImplementation(path => {
    console.log('Mock filterPath called for:', path);
    return Promise.resolve(true);
  }),
  shouldProcessPath: vi.fn().mockResolvedValue({ shouldProcess: true }),
}));
vi.mock('../../src/utils/config', () => ({
  detectLanguage: vi.fn().mockReturnValue('typescript'),
  getExtensionConfig: vi.fn().mockReturnValue({}),
  isCstOnlyLanguage: vi.fn().mockReturnValue(false),
}));
vi.mock('../../src/analysis/tree-sitter', () => ({
  getTreeSitterParser: () => ({
    extractHybridFacts: async (content: string) => {
      const facts = [];
      if (content.includes('function foo')) {
        facts.push({ kind: 'function', name: 'foo' });
      }
      return facts;
    },
    parseText: async () => ({ rootNode: { type: 'program', children: [] } }),
  }),
}));

describe('Pipeline Integration Test', () => {
  let workspaceIndexer: WorkspaceIndexer;
  let commitIndexer: CommitIndexer;
  let mockGit: any;
  let mockDb: any;
  let mockSnapshotManager: any;
  let mockStructuralDiffManager: any;
  let mockRiskDetector: any;
  let mockDependencyExtractor: any;
  let mockHotspotDetector: any;
  let mockMovedBlockDetector: any;
  let mockSymbolExtractor: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockGit = {
      getRepoRoot: vi.fn().mockResolvedValue('/mock/repo'),
      getCurrentBranch: vi.fn().mockResolvedValue('main'),
      getHeadSha: vi.fn().mockResolvedValue('sha-head'),
      getWorkingDirectoryChanges: vi
        .fn()
        .mockResolvedValue([{ path: 'src/staged.ts', status: 'M' }]),
      getStagedFiles: vi.fn().mockResolvedValue([{ path: 'src/staged.ts', status: 'M' }]),
      getUnstagedFiles: vi.fn().mockResolvedValue([]),
      safeGetStagedContent: vi.fn().mockResolvedValue('function staged() { return 2; }'),
      getFileContent: vi.fn().mockResolvedValue('function original() { return 1; }'),
      getDiff: vi.fn().mockResolvedValue('diff content'),
      getRoot: vi.fn().mockReturnValue('/mock/repo'),
      isIgnored: vi.fn().mockResolvedValue(false),
      getBlobSha: vi.fn().mockResolvedValue('blob-sha'),
      safeGetFileContent: vi.fn().mockResolvedValue('function original() { return 1; }'),
    };
    (GitOperations as any).mockImplementation(() => mockGit);

    mockDb = {
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn(),
      exec: vi.fn(),
      prepare: vi.fn().mockReturnValue({
        all: vi.fn().mockReturnValue([]),
        run: vi.fn(),
        get: vi.fn(),
      }),
    };
    (getDatabaseManager as any).mockReturnValue({
      getRawDatabase: () => mockDb,
    });

    mockSymbolExtractor = new SymbolExtractor(mockGit);
    mockDependencyExtractor = new DependencyExtractor();
    mockSnapshotManager = new SnapshotManager(mockDb, mockSymbolExtractor, mockDependencyExtractor);
    mockSnapshotManager.compareSnapshots = vi.fn().mockReturnValue({
      added: [],
      modified: [],
      removed: [],
    });
    mockStructuralDiffManager = new StructuralDiffManager(mockDb);
    mockStructuralDiffManager.getOrCreateStructuralDiff = vi.fn().mockResolvedValue({
      structuralChangeScore: 0,
      interfaceChanged: false,
      controlFlowChanged: false,
    });
    mockRiskDetector = new RiskDetector();
    mockHotspotDetector = new HotspotDetectorV2(mockDb);
    mockMovedBlockDetector = new MovedBlockDetectorV2(mockDb);

    workspaceIndexer = new WorkspaceIndexer(
      mockDb,
      mockGit,
      mockSnapshotManager,
      mockStructuralDiffManager
    );
    commitIndexer = new CommitIndexer(
      mockDb,
      mockGit,
      mockSnapshotManager,
      mockStructuralDiffManager,
      mockRiskDetector,
      mockDependencyExtractor,
      mockHotspotDetector,
      mockMovedBlockDetector
    );

    configureDNA({ enableV2: true });
  });

  describe('WorkspaceIndexer', () => {
    it('should calculate reverse edge index', async () => {
      // Mock symbols and edges via private method override for testing
      const symbols = [
        {
          id: 'a',
          name: 'A',
          kind: 'function',
          location: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
          signature: '()',
        },
        {
          id: 'b',
          name: 'B',
          kind: 'function',
          location: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
          signature: '()',
        },
      ];
      const edges = [{ from: 'a', to: 'b', type: 'calls' }];

      // Mock snapshotManager to return our test data
      mockSnapshotManager.getOrCreateSnapshot.mockResolvedValue({
        symbols,
        edges,
      });

      // Mock computeWorkspaceHash
      (workspaceIndexer as any).computeWorkspaceHash = vi.fn().mockResolvedValue('hash-123');
      (workspaceIndexer as any).getCachedWorkspace = vi.fn().mockReturnValue(null);

      console.log('mockGit keys:', Object.keys(mockGit));

      const result = await workspaceIndexer.analyzeWorkspace('staged');

      expect(mockGit.safeGetStagedContent).toHaveBeenCalledWith('src/staged.ts');

      expect(result).toBeDefined();
      expect(result?.incoming).toBeDefined();
      expect(result?.outgoing).toBeDefined();

      const incomingToB = result?.incoming?.get('b');
      expect(incomingToB).toBeDefined();
      expect(incomingToB).toContain('a');
    });

    it('should extract staged content correctly', async () => {
      // Mock snapshotManager to return empty data
      mockSnapshotManager.getOrCreateSnapshot.mockResolvedValue({
        symbols: [],
        edges: [],
      });
      (workspaceIndexer as any).computeWorkspaceHash = vi.fn().mockResolvedValue('hash-123');
      (workspaceIndexer as any).getCachedWorkspace = vi.fn().mockReturnValue(null);

      await workspaceIndexer.analyzeWorkspace('staged');

      expect(mockGit.getStagedFiles).toHaveBeenCalled();
    });
  });

  describe('DNA v2 Integration', () => {
    it('should compute DNA v2 during indexing', async () => {
      // Mock snapshotManager
      mockSnapshotManager.getOrCreateSnapshot.mockResolvedValue({
        symbols: [],
        edges: [],
      });
      (workspaceIndexer as any).computeWorkspaceHash = vi.fn().mockResolvedValue('hash-123');
      (workspaceIndexer as any).getCachedWorkspace = vi.fn().mockReturnValue(null);

      const result = await workspaceIndexer.analyzeWorkspace('staged');
      expect(result).toBeDefined();
    });
  });
});
