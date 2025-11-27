import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LiveAnalysisEngine } from '../src/analysis/liveAnalysis';
import { LiveDiffTracker } from '../src/liveTracker';
import { CockpitOrchestrator } from '../src/state/cockpitOrchestrator';

// Mock dependencies
vi.mock('../src/liveTracker', () => ({
  LiveDiffTracker: class {
    getDirtyContent = vi.fn(() => new Map());
    on = vi.fn();
    removeAllListeners = vi.fn();
  }
}));

vi.mock('../src/state/cockpitOrchestrator', () => ({
  CockpitOrchestrator: class {
    getState = vi.fn(() => ({
      bundleFacts: {
        bundle: { shas: [] },
        evidence: {}
      }
    }));
    updateLiveState = vi.fn();
  },
  getCockpitOrchestrator: vi.fn(() => ({
    getState: vi.fn(() => ({
      bundleFacts: {
        bundle: { shas: [] },
        evidence: {}
      }
    })),
    updateLiveState: vi.fn()
  }))
}));

vi.mock('../src/facts/workingSnapshot', () => ({
  getWorkingSnapshot: vi.fn(() => Promise.resolve(new Map()))
}));

vi.mock('../src/facts/driftDetector', () => ({
  detectDrift: vi.fn(() => ({
    missing_symbols: [],
    zombie_symbols: [],
    divergent_symbols: []
  }))
}));

vi.mock('../src/facts/legacyAudit', () => ({
  auditLegacy: vi.fn(() => Promise.resolve({
    dead: [],
    legacy: []
  }))
}));

vi.mock('../src/facts/intendedMap', () => ({
  buildIntendedMap: vi.fn(() => Promise.resolve(new Map()))
}));

vi.mock('../src/utils/logger', () => ({
  logInfo: vi.fn(),
  logDebug: vi.fn(),
  logError: vi.fn()
}));

describe('LiveAnalysisEngine', () => {
  let engine: LiveAnalysisEngine;
  let tracker: LiveDiffTracker;
  let orchestrator: CockpitOrchestrator;

  beforeEach(() => {
    tracker = new LiveDiffTracker() as any;
    orchestrator = new CockpitOrchestrator() as any;
    engine = new LiveAnalysisEngine(tracker, orchestrator);
  });

  it('should initialize correctly', () => {
    expect(engine).toBeDefined();
  });

  it('should skip analysis if no bundle facts', async () => {
    (orchestrator.getState as any).mockReturnValue({
      bundleFacts: null
    });

    await engine.analyze();
    
    // Should not throw and should not call updateLiveState when bundleFacts is null
    expect(orchestrator.updateLiveState).not.toHaveBeenCalled();
  });

  it('should update state with analysis results', async () => {
    (orchestrator.getState as any).mockReturnValue({
      bundleFacts: {
        bundle: { shas: ['abc123'] },
        evidence: {}
      }
    });

    await engine.analyze();

    // Should be called at least twice: once for 'analyzing' and once for final state
    expect(orchestrator.updateLiveState).toHaveBeenCalled();
    expect(orchestrator.updateLiveState).toHaveBeenCalledWith(
      expect.objectContaining({
        status: expect.any(String)
      })
    );
  });
});

