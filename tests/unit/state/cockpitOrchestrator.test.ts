import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CockpitOrchestrator } from '../../../src/state/cockpitOrchestrator';
import { getStore } from '../../../src/state/store';

// Mock the store
vi.mock('../../../src/state/store', () => ({
  getStore: vi.fn(),
}));

describe('CockpitOrchestrator', () => {
  let mockStore: any;
  let orchestrator: CockpitOrchestrator;
  let subscribeCallback: (state: any, action: any) => void;

  beforeEach(() => {
    // Reset singleton instance (hacky but needed since it's a singleton)
    (CockpitOrchestrator as any).instance = undefined;

    mockStore = {
      getState: vi.fn(() => ({})),
      dispatch: vi.fn(),
      subscribe: vi.fn((cb) => {
        subscribeCallback = cb;
        return vi.fn(); // unsubscribe
      }),
    };
    (getStore as any).mockReturnValue(mockStore);

    orchestrator = CockpitOrchestrator.getInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be a singleton', () => {
    const instance2 = CockpitOrchestrator.getInstance();
    expect(orchestrator).toBe(instance2);
  });

  it('should dispatch LEGACY_STATE_UPDATED on updateState', () => {
    const partial = { isAnalyzing: true };
    orchestrator.updateState(partial, 'test-reason');

    expect(mockStore.dispatch).toHaveBeenCalledWith({
      type: 'LEGACY_STATE_UPDATED',
      payload: { partial, reason: 'test-reason' },
    });
  });

  it('should dispatch LIVE_ANALYSIS_UPDATED on updateLiveState', () => {
    const partial = { status: 'analyzing' as const };
    orchestrator.updateLiveState(partial);

    expect(mockStore.dispatch).toHaveBeenCalledWith({
      type: 'LIVE_ANALYSIS_UPDATED',
      payload: partial,
    });
  });

  it('should trigger effects when state changes', async () => {
    const effectHandler = vi.fn();
    orchestrator.onStateChange('isAnalyzing', effectHandler);

    // Simulate store update
    const newState = { isAnalyzing: true };
    mockStore.getState.mockReturnValue(newState);
    
    // Trigger the subscription callback manually
    // We need to simulate the action that caused the change
    subscribeCallback(newState, {
      type: 'LEGACY_STATE_UPDATED',
      payload: { partial: { isAnalyzing: true } }
    });

    // Wait for debounce
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(effectHandler).toHaveBeenCalled();
    const callArg = effectHandler.mock.calls[0][0];
    expect(callArg.partial).toEqual({ isAnalyzing: true });
  });

  it('should debounce multiple updates', async () => {
    const changeHandler = vi.fn();
    orchestrator.subscribe(changeHandler);

    // Trigger multiple updates rapidly
    subscribeCallback({}, { type: 'TEST_ACTION_1', payload: {} }); // Should result in empty partial or inferred
    
    // We need to simulate actions that the orchestrator understands to populate partials
    subscribeCallback({}, { 
      type: 'ANALYSIS_STARTED', 
      payload: { step: 'init' } 
    });
    
    subscribeCallback({}, { 
      type: 'ANALYSIS_PROGRESS_UPDATED', 
      payload: { isAnalyzing: true, step: 'parsing', progress: 50 } 
    });

    // Wait for debounce
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(changeHandler).toHaveBeenCalledTimes(1);
    const callArg = changeHandler.mock.calls[0][0];
    // It merges partials
    expect(callArg.partial).toEqual({
      isAnalyzing: true,
      analysisStep: 'parsing',
      analysisProgress: 50
    });
  });
});
