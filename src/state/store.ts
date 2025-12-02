/* eslint-disable no-console */
import { EventEmitter } from 'events';
import { CockpitState } from '../types/cockpit';
import { StateDebugger } from '../utils/stateDebugger';
import { Action } from './actions';
import { cockpitReducer, initialState } from './reducers';

export class CockpitStore extends EventEmitter {
  private state: CockpitState;
  private debugger: StateDebugger;
  private traceActions: boolean;

  constructor() {
    super();
    this.state = initialState;
    // Always create debugger, it will check getDebugMode() internally for logging
    this.debugger = new StateDebugger();
    this.traceActions = process.env.GIT_CONTEXT_TRACE_ACTIONS === '1';
  }

  getState(): CockpitState {
    return this.state;
  }

  dispatch(action: Action): void {
    // Capture prevState before any changes
    const prevState = this.state;

    // Single reduce - compute next state
    const baseNextState = cockpitReducer(prevState, action);

    // Append action to history (capped at 50)
    const newHistory = [
      ...(baseNextState.actionHistory || []),
      {
        type: action.type,
        payload: (action as any).payload,
        timestamp: new Date().toISOString(),
      },
    ].slice(-50);

    // Assign final state with updated history
    const nextState = { ...baseNextState, actionHistory: newHistory };
    this.state = nextState;

    // Debug logging with StateDebugger (conditional)
    if (this.debugger) {
      this.debugger.logTransition(action, prevState, nextState);
    }

    // Log state transition
    if (this.traceActions) {
      try {
        const { getStateLogger } = require('../services/stateLogger');
        getStateLogger().log({
          actionType: action.type,
          payload: (action as any).payload,
          stateBefore: prevState,
          stateAfter: nextState,
        });
      } catch (e) {
        // Ignore logging errors to prevent app crash
      }

      // Minimal console trace to avoid noisy dumps
      const payloadKeys = Object.keys((action as any).payload || {});
      console.log(
        `[Store] Action: ${action.type}`,
        payloadKeys.length ? `payloadKeys=${payloadKeys.join(',')}` : ''
      );
    }

    this.emit('stateChanged', this.state, action);
  }

  subscribe(listener: (state: CockpitState, action: Action) => void): () => void {
    this.on('stateChanged', listener);
    return () => this.off('stateChanged', listener);
  }
}

// Singleton instance
let store: CockpitStore | null = null;

export function getStore(): CockpitStore {
  if (!store) {
    store = new CockpitStore();
  }
  return store;
}
