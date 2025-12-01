/* eslint-disable no-console */
import { EventEmitter } from 'events';
import { CockpitState } from '../types/cockpit';
import { Action } from './actions';
import { cockpitReducer, initialState } from './reducers';

export class CockpitStore extends EventEmitter {
  private state: CockpitState;

  constructor() {
    super();
    this.state = initialState;
  }

  getState(): CockpitState {
    return this.state;
  }

  dispatch(action: Action): void {
    const _prevState = this.state;
    this.state = cockpitReducer(this.state, action);

    const historyEntry = {
      type: action.type,
      payload: (action as any).payload,
      timestamp: new Date().toISOString(),
    };
    // Keep last 50 actions for debugging
    const newHistory = [
      { type: action.type, payload: (action as any).payload, timestamp: historyEntry.timestamp },
      ...(this.state.actionHistory || []),
    ].slice(0, 50);

    const prevState = this.state;
    // Create a temporary state with updated history to pass to reducer
    // This ensures newState has the updated history without mutating prevState
    const stateWithHistory = { ...this.state, actionHistory: newHistory };

    const newState = cockpitReducer(stateWithHistory, action);
    this.state = newState;

    // Log state transition
    try {
      const { getStateLogger } = require('../services/stateLogger');
      getStateLogger().log({
        actionType: action.type,
        payload: (action as any).payload,
        stateBefore: prevState,
        stateAfter: newState,
      });
    } catch (e) {
      // Ignore logging errors to prevent app crash
    }

    // Calculate partial change for efficient updates
    const partial: Partial<CockpitState> = {};
    // Log action and state diff (simplified)
    console.log(`[Store] Action: ${action.type}`, 'Payload:', (action as any).payload);

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
