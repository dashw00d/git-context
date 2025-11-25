import { EventEmitter } from 'events';
import { CockpitState } from '../types/cockpit';
import { logDebug } from '../utils/logger';

export type CockpitStateChange = {
  full: CockpitState;
  partial: Partial<CockpitState>;
  reason?: string;
  timestamp: number;
};

export function createDefaultCockpitState(): CockpitState {
  return {
    repoName: null,
    branchName: null,
    activeSection: 'commits',
    isAnalyzing: false,
    analysisStep: undefined,
    analysisProgress: undefined,
    error: null,
    selectedCommitShas: [],
    selectedStagedPaths: [],
    selectedUnstagedPaths: [],
    selectedFiles: [],
    hasMoreCommits: false,
    commitsFilterText: '',
    commitsFilterScopes: { staged: true, unstaged: true, history: true },
    lastNCommits: 20,
    stagedFiles: [],
    unstagedFiles: [],
    workspaceScope: 'workspace',
    commits: [],
    bundleSummary: null,
    bundleFacts: null,
    bundleReportId: null,
    symbols: [],
    symbolFilterText: '',
    symbolKindFilter: 'all',
    symbolChangeFilter: 'all',
    activeSymbolId: null,
    activeSymbolHistory: [],
    reports: [],
    reportsFilterText: '',
    reportsBranchFilter: 'all',
    reportsShowPinnedOnly: false
  };
}

export class CockpitOrchestrator extends EventEmitter {
  private static instance: CockpitOrchestrator;
  private state: CockpitState;
  private pendingPartial: Partial<CockpitState> | null = null;
  private flushTimeout: NodeJS.Timeout | null = null;
  private readonly debounceMs: number;

  private constructor(debounceMs = 25) {
    super();
    this.debounceMs = debounceMs;
    this.state = createDefaultCockpitState();
  }

  static getInstance(): CockpitOrchestrator {
    if (!CockpitOrchestrator.instance) {
      CockpitOrchestrator.instance = new CockpitOrchestrator();
    }
    return CockpitOrchestrator.instance;
  }

  getState(): CockpitState {
    return this.state;
  }

  reset(partial?: Partial<CockpitState>, reason = 'reset'): void {
    this.state = { ...createDefaultCockpitState(), ...(partial ?? {}) };
    this.emitChange(partial ?? {}, reason);
  }

  updateState(partial: Partial<CockpitState>, reason = 'updateState'): void {
    if (!partial || Object.keys(partial).length === 0) {
      return;
    }
    this.state = { ...this.state, ...partial };
    this.queueEmit(partial, reason);
  }

  updatePartial<K extends keyof CockpitState>(key: K, value: CockpitState[K], reason?: string): void {
    this.updateState({ [key]: value } as Partial<CockpitState>, reason ?? `update:${String(key)}`);
  }

  subscribe(cb: (change: CockpitStateChange) => void): () => void {
    this.on('stateChange', cb);
    return () => this.off('stateChange', cb);
  }

  private queueEmit(partial: Partial<CockpitState>, reason?: string): void {
    this.pendingPartial = { ...(this.pendingPartial ?? {}), ...partial };
    if (this.flushTimeout) {
      return;
    }
    this.flushTimeout = setTimeout(() => this.flush(reason), this.debounceMs);
  }

  private flush(reason?: string): void {
    const partial = this.pendingPartial ?? {};
    this.pendingPartial = null;
    this.flushTimeout = null;
    this.emitChange(partial, reason);
  }

  private emitChange(partial: Partial<CockpitState>, reason?: string): void {
    const change: CockpitStateChange = {
      full: this.state,
      partial,
      reason,
      timestamp: Date.now()
    };
    try {
      this.emit('stateChange', change);
      logDebug(`[CockpitOrchestrator] Emitted state change (${reason || 'unspecified'})`);
    } catch (error) {
      logDebug(`[CockpitOrchestrator] Failed to emit state change (${reason || 'unspecified'}) - ${error}`);
    }
  }
}

export function getCockpitOrchestrator(): CockpitOrchestrator {
  return CockpitOrchestrator.getInstance();
}
