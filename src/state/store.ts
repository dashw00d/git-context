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
    const prevState = this.state;
    this.state = cockpitReducer(this.state, action);

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
