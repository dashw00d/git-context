import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analysisActions, liveActions } from '../../../src/state/actionCreators';
import { CockpitStore } from '../../../src/state/store';

// Mock state logger to avoid console output
vi.mock('../../../src/services/stateLogger', () => ({
  getStateLogger: vi.fn(() => ({
    log: vi.fn(),
  })),
}));

describe('CockpitStore', () => {
  let store: CockpitStore;
  let _subscribeCallback: (state: any, action: any) => void;

  beforeEach(() => {
    // Reset singleton instance
    (CockpitStore as any).resetForTesting?.() || vi.clearAllMocks();

    store = new CockpitStore();

    // Mock the subscribe method to capture callback
    const originalSubscribe = store.subscribe.bind(store);
    store.subscribe = vi.fn(cb => {
      _subscribeCallback = cb;
      return originalSubscribe(cb);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with initial state', () => {
    const state = store.getState();
    expect(state).toMatchObject({
      activeFrame: {
        id: 'root',
        level: 'bundle',
        name: 'Bundle Overview',
        status: 'ready',
      },
      history: [],
      bundleView: null,
      explorerData: [],
      actionHistory: [],
      isAnalyzing: false,
    });
    // analysisStep and analysisProgress should not be present initially
    expect(state.analysisStep).toBeUndefined();
    expect(state.analysisProgress).toBeUndefined();
  });

  it('should dispatch actions and update state', () => {
    const action = analysisActions.start('init');
    store.dispatch(action);

    const state = store.getState();
    expect(state.isAnalyzing).toBe(true);
    expect(state.analysisStep).toBe('init');
    expect(state.analysisProgress).toBe(0);
  });

  it('should handle multiple state transitions', () => {
    store.dispatch(analysisActions.start('parsing'));
    store.dispatch(analysisActions.progress(true, 'processing', 75));

    const state = store.getState();
    expect(state.isAnalyzing).toBe(true);
    expect(state.analysisStep).toBe('processing');
    expect(state.analysisProgress).toBe(75);
  });

  it('should emit stateChanged events on dispatch', () => {
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    const action = analysisActions.start('test');
    store.dispatch(action);

    expect(listener).toHaveBeenCalledWith(store.getState(), action);

    unsubscribe();
  });

  it('should handle live analysis updates', () => {
    const payload = { status: 'analyzing' as const };
    store.dispatch(liveActions.update(payload));

    const state = store.getState();
    expect(state.liveAnalysis.status).toBe('analyzing');
  });

  it('should maintain action history', () => {
    store.dispatch(analysisActions.start('test1'));
    store.dispatch(analysisActions.progress(true, 'test2', 50));

    const state = store.getState();
    expect(state.actionHistory).toHaveLength(2);
    expect(state.actionHistory?.[0].type).toBe('ANALYSIS_STARTED');
    expect(state.actionHistory?.[1].type).toBe('ANALYSIS_PROGRESS_UPDATED');
  });
});
