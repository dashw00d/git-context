import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommitIndexer } from '../../../src/analysis/commitIndexer';
import { DependencyExtractor } from '../../../src/analysis/dependencies';
import { GitOperations } from '../../../src/analysis/git';
import { HotspotDetectorV2 } from '../../../src/analysis/hotspotDetector';
import { MovedBlockDetectorV2 } from '../../../src/analysis/movedBlockDetector';
import { SnapshotManager } from '../../../src/analysis/snapshotManager';
import { StructuralDiffManager } from '../../../src/analysis/structuralDiffManager';

// Mock dependencies
vi.mock('../../../src/analysis/git');
vi.mock('../../../src/analysis/snapshotManager');
vi.mock('../../../src/analysis/structuralDiffManager');
vi.mock('../../../src/analysis/heuristics');
vi.mock('../../../src/analysis/dependencies');
vi.mock('../../../src/analysis/hotspotDetector');
vi.mock('../../../src/analysis/movedBlockDetector');
vi.mock('../../../src/storage/statement-wrapper', () => ({
  prepare: vi.fn(),
}));
vi.mock('../../../src/utils/config', () => ({
  detectLanguage: vi.fn().mockReturnValue('typescript'),
  getExtensionConfig: vi.fn().mockReturnValue({}),
  isCstOnlyLanguage: vi.fn().mockReturnValue(false),
}));
vi.mock('../../../src/analysis/cstTimeline', () => ({
  getCstTimelineManager: vi.fn().mockReturnValue({
    saveFacts: vi.fn(),
  }),
}));
vi.mock('../../../src/analysis/tree-sitter', () => ({
  getTreeSitterParser: vi.fn().mockReturnValue({
    extractHybridFacts: vi.fn().mockResolvedValue([]),
  }),
}));

describe('CommitIndexer', () => {
  let commitIndexer: CommitIndexer;
  let mockDb: any;
  let mockGit: any;
  let mockSnapshotManager: any;
  let mockStructuralDiffManager: any;
  let mockRiskDetector: any;
  let mockDependencyExtractor: any;
  let mockHotspotDetector: any;
  let mockMovedBlockDetector: any;

  beforeEach(() => {
    mockDb = {
      prepare: vi.fn().mockReturnValue({ run: vi.fn(), get: vi.fn() }),
      transaction: vi.fn(cb => cb()),
    };
    mockGit = new GitOperations();
    mockDependencyExtractor = new DependencyExtractor();
    const mockSymbolExtractor = { extractSymbols: vi.fn() } as any;
    mockSnapshotManager = new SnapshotManager(mockDb, mockSymbolExtractor, mockDependencyExtractor);
    mockStructuralDiffManager = new StructuralDiffManager(mockDb);
    mockHotspotDetector = new HotspotDetectorV2(mockDb);
    mockMovedBlockDetector = new MovedBlockDetectorV2(mockDb);

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
  });

  it('should be defined', () => {
    expect(commitIndexer).toBeDefined();
  });
});
