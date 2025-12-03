import { EventEmitter } from 'events';
import { CockpitState } from '../types/cockpit';
import { logDebug } from '../utils/logger';
import { CockpitStore, getStore } from './store';

export type CockpitStateChange = {
  full: CockpitState;
  partial: Partial<CockpitState>;
  reason?: string;
  timestamp: number;
};

export type CockpitMetrics = {
  debtScore?: number;
  symbolCount?: number;
  fileCount?: number;
};

export type StateChangeHandler = (change: CockpitStateChange) => void | Promise<void>;
export type StateEffect<T extends keyof CockpitState = keyof CockpitState> = {
  key?: T | T[];
  handler: StateChangeHandler;
  priority?: number;
};

/**
 * ARCHITECTURE NOTE: The orchestrator creates a duplicate bus for state updates.
 * - CockpitProvider subscribes directly to the store and diffs manually
 * - Orchestrator subscribes to store, guesses partials, debounces, and emits
 *
 * RECOMMENDATION: Remove orchestrator for UI updates. Use selectors/hooks only,
 * or make CockpitProvider subscribe to orchestrator exclusively and remove manual diffs.
 *
 * Current partial guessing is error-prone - a missed action type means no UI update.
 * Consider emitting full state or using selector-derived deltas only.
 */
export class CockpitOrchestrator extends EventEmitter {
  private static instance: CockpitOrchestrator;
  private store: CockpitStore;
  private effects: StateEffect[] = [];

  private pendingPartial: Partial<CockpitState> | null = null;
  private flushTimeout: NodeJS.Timeout | null = null;
  private readonly debounceMs: number;

  private constructor(debounceMs = 25) {
    super();
    this.debounceMs = debounceMs;
    this.store = getStore();

    this.store.subscribe((state, action) => {
      let partial: Partial<CockpitState> = {};
      const reason: string = action.type;

      if (action.type === 'ANALYSIS_STARTED')
        partial = { isAnalyzing: true, analysisStep: action.payload.step };
      else if (action.type === 'ANALYSIS_COMPLETED')
        partial = { isAnalyzing: false, bundleFacts: action.payload.facts };
      else if (action.type === 'ANALYSIS_PROGRESS_UPDATED')
        partial = {
          isAnalyzing: action.payload.isAnalyzing,
          analysisStep: action.payload.step,
          analysisProgress: action.payload.progress,
        };
      else if (action.type === 'SELECTION_TOGGLED')
        partial = { selectedCommitShas: state.selectedCommitShas };
      else if (action.type === 'SECTION_CHANGED')
        partial = { activeSection: action.payload.section };
      else if (action.type === 'EXPLORER_UPDATED') partial = { explorerData: action.payload.nodes };
      else if (action.type === 'BUNDLE_VIEW_UPDATED') partial = { bundleView: action.payload.view };
      else if (action.type === 'LIVE_ANALYSIS_UPDATED')
        partial = { liveAnalysis: { ...this.store.getState().liveAnalysis, ...action.payload } };

      this.queueEmit(state, partial, reason);
    });
  }

  static getInstance(): CockpitOrchestrator {
    if (!CockpitOrchestrator.instance) {
      CockpitOrchestrator.instance = new CockpitOrchestrator();
    }
    return CockpitOrchestrator.instance;
  }

  getState(): CockpitState {
    return this.store.getState();
  }

  get metrics(): CockpitMetrics {
    const state = this.store.getState();
    const facts = state.bundleFacts;
    if (!facts) return {};
    const symbolCount = facts.working?.symbols ?? 0;
    const fileCount = facts.scope?.files ?? facts.evidence?.['bundle.files']?.length ?? 0;
    const findings = facts.findings || ({} as any);
    const debtScore = [
      findings.incompleteness?.missing ?? 0,
      findings.incompleteness?.zombies ?? 0,
      findings.legacyAudit?.dead ?? 0,
      findings.legacyAudit?.replacedLeftovers?.length ?? 0,
    ].reduce((a, b) => a + b, 0);
    return { debtScore, symbolCount, fileCount };
  }

  reset(): void {
    this.store.dispatch({ type: 'RESET_ALL_STATE' });
  }

  getStore(): CockpitStore {
    return this.store;
  }

  updateLiveState(partial: Partial<CockpitState['liveAnalysis']>, _reason = 'live:update'): void {
    this.store.dispatch({
      type: 'LIVE_ANALYSIS_UPDATED',
      payload: partial,
    });
  }

  registerEffect(effect: StateEffect): () => void {
    this.effects.push(effect);
    this.effects.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
    return () => {
      const index = this.effects.indexOf(effect);
      if (index > -1) this.effects.splice(index, 1);
    };
  }

  onStateChange<T extends keyof CockpitState>(
    keys: T | T[],
    handler: StateChangeHandler
  ): () => void {
    const keyArray = Array.isArray(keys) ? keys : [keys];
    return this.registerEffect({ key: keyArray as T[], handler, priority: 100 });
  }

  subscribe(cb: (change: CockpitStateChange) => void): () => void {
    this.on('stateChange', cb);
    return () => this.off('stateChange', cb);
  }

  private queueEmit(
    fullState: CockpitState,
    partial: Partial<CockpitState>,
    reason?: string
  ): void {
    this.pendingPartial = { ...(this.pendingPartial ?? {}), ...partial };

    if (this.flushTimeout) return;

    this.flushTimeout = setTimeout(() => {
      this.flush(fullState, reason);
    }, this.debounceMs);
  }

  private flush(fullState: CockpitState, reason?: string): void {
    const partial = this.pendingPartial ?? {};
    this.pendingPartial = null;
    this.flushTimeout = null;
    this.emitChange(fullState, partial, reason);
  }

  private emitChange(
    fullState: CockpitState,
    partial: Partial<CockpitState>,
    reason?: string
  ): void {
    const change: CockpitStateChange = {
      full: fullState,
      partial,
      reason,
      timestamp: Date.now(),
    };
    try {
      this.emit('stateChange', change);
      this.runEffects(change).catch(err =>
        logDebug(
          `[CockpitOrchestrator] Effects error: ${err instanceof Error ? err.message : String(err)}`
        )
      );
    } catch (error) {
      logDebug(`[CockpitOrchestrator] Failed to emit state change - ${error}`);
    }
  }

  private async runEffects(change: CockpitStateChange): Promise<void> {
    const changedKeys = Object.keys(change.partial) as Array<keyof CockpitState>;
    for (const effect of this.effects) {
      const shouldRun =
        !effect.key ||
        (Array.isArray(effect.key)
          ? effect.key.some(k => changedKeys.includes(k))
          : changedKeys.includes(effect.key));

      if (shouldRun) {
        try {
          await Promise.resolve(effect.handler(change));
        } catch (error) {
          logDebug(`[CockpitOrchestrator] Effect handler error: ${error}`);
        }
      }
    }
  }
}

export function getCockpitOrchestrator(): CockpitOrchestrator {
  return CockpitOrchestrator.getInstance();
}
