import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveAnalysisEngine } from '../../../src/analysis/liveAnalysis';
import { LiveDiffTracker } from '../../../src/liveTracker';
import { CockpitOrchestrator } from '../../../src/state/cockpitOrchestrator';

// Mock dependencies
vi.mock('../../../src/liveTracker', () => ({
  LiveDiffTracker: class {
    getDirtyContent = vi.fn(() => new Map());
    on = vi.fn();
    removeAllListeners = vi.fn();
  },
}));

const mockOrchestratorInstance = {
  getState: vi.fn(() => ({
    bundleFacts: {
      bundle: { shas: [] },
      evidence: {},
    },
  })),
  updateLiveState: vi.fn(),
};

vi.mock('../../../src/state/cockpitOrchestrator', () => ({
  CockpitOrchestrator: class {
    static getInstance = vi.fn(() => mockOrchestratorInstance);
    getState = vi.fn(() => ({
      bundleFacts: {
        bundle: { shas: [] },
        evidence: {},
      },
    }));
    updateLiveState = vi.fn();
  },
  getCockpitOrchestrator: vi.fn(() => mockOrchestratorInstance),
}));

vi.mock('../../../src/facts/workingSnapshot', () => ({
  getWorkingSnapshot: vi.fn(() => Promise.resolve(new Map())),
}));

vi.mock('../../../src/facts/driftDetector', () => ({
  detectDrift: vi.fn(() => ({
    missing_symbols: [],
    zombie_symbols: [],
    divergent_symbols: [],
  })),
}));

vi.mock('../../../src/facts/legacyAudit', () => ({
  auditLegacy: vi.fn(() =>
    Promise.resolve({
      dead: [],
      legacy: [],
    })
  ),
}));

vi.mock('../../../src/facts/intendedMap', () => ({
  buildIntendedMap: vi.fn(() => Promise.resolve(new Map())),
}));

vi.mock('../../../src/utils/logger', () => ({
  logInfo: vi.fn(),
  logDebug: vi.fn(),
  logError: vi.fn(),
}));

describe('LiveAnalysisEngine', () => {
  let engine: LiveAnalysisEngine;
  let tracker: LiveDiffTracker;
  let orchestrator: CockpitOrchestrator;

  beforeEach(() => {
    vi.clearAllMocks();
    tracker = new LiveDiffTracker() as any;
    orchestrator = CockpitOrchestrator.getInstance();
    engine = new LiveAnalysisEngine(tracker, orchestrator);
  });

  it('should initialize correctly', () => {
    expect(engine).toBeDefined();
  });

  it('should skip analysis if no bundle facts', async () => {
    (orchestrator.getState as any).mockReturnValue({
      bundleFacts: null,
    });

    await engine.analyze();

    expect(orchestrator.updateLiveState).not.toHaveBeenCalled();
  });

  it('should update state with analysis results', async () => {
    (orchestrator.getState as any).mockReturnValue({
      bundleFacts: {
        bundle: { shas: ['abc123'] },
        evidence: {},
      },
    });

    await engine.analyze();

    expect(orchestrator.updateLiveState).toHaveBeenCalled();
    expect(orchestrator.updateLiveState).toHaveBeenCalledWith(
      expect.objectContaining({
        status: expect.any(String),
      })
    );
  });
});
