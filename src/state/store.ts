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

    this.debugger = new StateDebugger();
    this.traceActions = process.env.GIT_CONTEXT_TRACE_ACTIONS === '1';
  }

  getState(): CockpitState {
    return this.state;
  }

  dispatch(action: Action): void {
    const prevState = this.state;

    const baseNextState = cockpitReducer(prevState, action);

    const newHistory = [
      ...(baseNextState.actionHistory || []),
      {
        type: action.type,
        payload: (action as any).payload,
        timestamp: new Date().toISOString(),
      },
    ].slice(-50);

    const nextState = { ...baseNextState, actionHistory: newHistory };
    this.state = nextState;

    if (this.debugger) {
      this.debugger.logTransition(action, prevState, nextState);
    }

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
        //empty
      }

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

let store: CockpitStore | null = null;

export function getStore(): CockpitStore {
  if (!store) {
    store = new CockpitStore();
  }
  return store;
}
