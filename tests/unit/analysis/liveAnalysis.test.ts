import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveAnalysisEngine } from '../../../src/analysis/liveAnalysis';
import { LiveDiffTracker } from '../../../src/liveTracker';

// Mock dependencies
vi.mock('../../../src/liveTracker', () => ({
  LiveDiffTracker: class {
    getDirtyContent = vi.fn(() => new Map());
    on = vi.fn();
    removeAllListeners = vi.fn();
    startTracking = vi.fn();
    stopTracking = vi.fn();
  },
}));

const mockStore = {
  getState: vi.fn(),
  dispatch: vi.fn(),
};

vi.mock('../../../src/state/store', () => ({
  getStore: vi.fn(() => mockStore),
}));

const mockPipeline = {
  analyzeLive: vi.fn(() =>
    Promise.resolve({
      drift: {
        missing_symbols: [],
        zombie_symbols: [],
        divergent_symbols: [],
        hybridDrifts: [],
      },
      legacy: {
        dead: [],
        legacy: [],
      },
    })
  ),
};

vi.mock('../../../src/services/pipelineFactory', () => ({
  getRefactorPipeline: vi.fn(() => Promise.resolve(mockPipeline)),
}));

vi.mock('../../../src/utils/logger', () => ({
  logInfo: vi.fn(),
  logDebug: vi.fn(),
  logError: vi.fn(),
}));

describe('LiveAnalysisEngine', () => {
  let engine: LiveAnalysisEngine;
  let tracker: LiveDiffTracker;

  beforeEach(() => {
    vi.clearAllMocks();
    tracker = new LiveDiffTracker() as any;
    engine = new LiveAnalysisEngine(tracker);
  });

  it('should initialize correctly', () => {
    expect(engine).toBeDefined();
  });

  it('should skip analysis if no bundle facts', async () => {
    mockStore.getState.mockReturnValue({
      bundleFacts: null,
    });

    await engine.analyze();

    expect(mockStore.dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'LIVE_ANALYSIS_UPDATED' })
    );
  });

  it('should update state with analysis results', async () => {
    mockStore.getState.mockReturnValue({
      bundleFacts: {
        bundle: { shas: ['abc123'] },
        evidence: {},
      },
    });

    await engine.analyze();

    expect(mockStore.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'LIVE_ANALYSIS_UPDATED',
        payload: expect.objectContaining({
          status: 'analyzing',
        }),
      })
    );

    expect(mockStore.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'LIVE_ANALYSIS_UPDATED',
        payload: expect.objectContaining({
          status: 'idle',
          summary: expect.any(Object),
        }),
      })
    );
  });
});
