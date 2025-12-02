/* eslint-disable @typescript-eslint/no-explicit-any */
import { Action } from '../state/actions';
import { BundleViewSchema, ContextFrameSchema, ExplorerNodeSchema } from '../state/schemas';
import { CockpitState } from '../types/cockpit';
import { logDebug, logWarn, logError } from './logger';

interface StateDiff {
  [key: string]: {
    changed: boolean;
    from?: any;
    to?: any;
    details?: string;
  };
}

interface StateTransition {
  timestamp: number;
  action: Action;
  diff: StateDiff;
  validationErrors: string[];
  stackTrace?: string;
}

export class StateDebugger {
  private transitions: StateTransition[] = [];
  private maxHistory = 100;

  logTransition(action: Action, prevState: CockpitState, nextState: CockpitState): void {
    const timestamp = Date.now();
    const diff = this.computeDiff(prevState, nextState, action.type);
    const validationErrors = this.validateState(nextState, action);

    const transition: StateTransition = {
      timestamp,
      action,
      diff,
      validationErrors,
      stackTrace: new Error().stack,
    };

    this.transitions.push(transition);
    if (this.transitions.length > this.maxHistory) {
      this.transitions.shift();
    }

    // Log to output channel
    this.prettyPrint(transition);
  }

  private computeDiff(prev: CockpitState, next: CockpitState, actionType: string): StateDiff {
    const diff: StateDiff = {};

    // Always check critical navigation fields
    if (prev.activeFrame.id !== next.activeFrame.id) {
      diff.activeFrame = {
        changed: true,
        from: `${prev.activeFrame.level}:${prev.activeFrame.id} (${prev.activeFrame.status})`,
        to: `${next.activeFrame.level}:${next.activeFrame.id} (${next.activeFrame.status})`,
        details: `tier: ${prev.activeFrame.tier} → ${next.activeFrame.tier}`,
      };
    } else if (
      prev.activeFrame.status !== next.activeFrame.status ||
      prev.activeFrame.tier !== next.activeFrame.tier
    ) {
      diff.activeFrame = {
        changed: true,
        details: `status: ${prev.activeFrame.status} → ${next.activeFrame.status}, tier: ${prev.activeFrame.tier} → ${next.activeFrame.tier}`,
      };
    }

    // Check frame.data changes
    const prevDataKeys = Object.keys(prev.activeFrame.data || {});
    const nextDataKeys = Object.keys(next.activeFrame.data || {});
    if (
      prevDataKeys.length !== nextDataKeys.length ||
      !prevDataKeys.every(k => nextDataKeys.includes(k))
    ) {
      diff['activeFrame.data'] = {
        changed: true,
        from: prevDataKeys.join(', ') || 'empty',
        to: nextDataKeys.join(', ') || 'empty',
      };
    }

    // History changes
    if (prev.history.length !== next.history.length) {
      diff.history = {
        changed: true,
        from: `${prev.history.length} entries`,
        to: `${next.history.length} entries`,
        details:
          next.history.length > prev.history.length
            ? `Added: ${next.history[next.history.length - 1]?.id}`
            : `Removed from top`,
      };
    }

    // BundleView changes
    if (prev.bundleView !== next.bundleView) {
      const prevHotspots = prev.bundleView?.hotspots?.length || 0;
      const nextHotspots = next.bundleView?.hotspots?.length || 0;
      diff.bundleView = {
        changed: true,
        from: prev.bundleView ? `${prevHotspots} hotspots, tier: ${prev.bundleView.tier}` : 'null',
        to: next.bundleView ? `${nextHotspots} hotspots, tier: ${next.bundleView.tier}` : 'null',
      };
    }

    // ExplorerData changes
    if (prev.explorerData.length !== next.explorerData.length) {
      diff.explorerData = {
        changed: true,
        from: `${prev.explorerData.length} nodes`,
        to: `${next.explorerData.length} nodes`,
      };
    }

    // BundleFacts changes
    if (prev.bundleFacts !== next.bundleFacts) {
      diff.bundleFacts = {
        changed: true,
        from: prev.bundleFacts ? 'present' : 'null',
        to: next.bundleFacts ? 'present' : 'null',
      };
    }

    // Check for suspicious patterns
    this.detectSuspiciousPatterns(diff, actionType, prev, next);

    return diff;
  }

  private detectSuspiciousPatterns(
    diff: StateDiff,
    actionType: string,
    prev: CockpitState,
    next: CockpitState
  ): void {
    // Pattern 1: Frame changed but data didn't clear
    if (
      diff.activeFrame?.changed &&
      prev.activeFrame.level !== next.activeFrame.level &&
      next.activeFrame.data &&
      Object.keys(next.activeFrame.data).length > 0
    ) {
      diff._suspicious_data_leak = {
        changed: true,
        details: `Frame level changed but data not cleared! ${prev.activeFrame.level} → ${next.activeFrame.level}`,
      };
    }

    // Pattern 2: Duplicate NAVIGATE_TO without NAVIGATE_BACK
    if (
      actionType === 'NAVIGATE_TO' &&
      prev.history.length > 0 &&
      prev.history[prev.history.length - 1]?.id === prev.activeFrame.id
    ) {
      diff._suspicious_duplicate_nav = {
        changed: true,
        details: `NAVIGATE_TO pushed duplicate frame to history: ${prev.activeFrame.id}`,
      };
    }

    // Pattern 3: Bundle view updated but not reflected in frame for bundle level
    if (
      actionType === 'BUNDLE_VIEW_UPDATED' &&
      next.activeFrame.level === 'bundle' &&
      next.activeFrame.id === 'root' &&
      !next.activeFrame.data
    ) {
      diff._suspicious_bundle_sync = {
        changed: true,
        details: 'BundleView updated but activeFrame.data is empty for bundle root',
      };
    }

    // Pattern 4: Explorer cleared unexpectedly
    if (
      diff.explorerData?.changed &&
      next.explorerData.length === 0 &&
      prev.explorerData.length > 5 &&
      actionType !== 'BUNDLE_SWITCH_START' &&
      actionType !== 'RESET_ALL_STATE'
    ) {
      diff._suspicious_explorer_clear = {
        changed: true,
        details: `Explorer cleared from ${prev.explorerData.length} nodes unexpectedly by ${actionType}`,
      };
    }
  }

  private validateState(nextState: CockpitState, action: Action): string[] {
    const errors: string[] = [];

    // Validate activeFrame
    const frameValidation = ContextFrameSchema.safeParse(nextState.activeFrame);
    if (!frameValidation.success) {
      errors.push(
        `activeFrame validation failed: ${frameValidation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')}`
      );
    }

    // Validate bundleView if present
    if (nextState.bundleView) {
      const bundleViewValidation = BundleViewSchema.safeParse(nextState.bundleView);
      if (!bundleViewValidation.success) {
        errors.push(
          `bundleView validation failed: ${bundleViewValidation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')}`
        );
      }
    }

    // Validate explorerData sample (first 3 nodes)
    if (nextState.explorerData.length > 0) {
      const sample = nextState.explorerData.slice(0, 3);
      for (let i = 0; i < sample.length; i++) {
        const nodeValidation = ExplorerNodeSchema.safeParse(sample[i]);
        if (!nodeValidation.success) {
          errors.push(
            `explorerData[${i}] validation failed: ${nodeValidation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')}`
          );
        }
      }
    }

    // Validate tier completion actions have matching frameId
    if (
      action.type === 'FRAME_ANALYSIS_TIER_1_COMPLETE' ||
      action.type === 'FRAME_ANALYSIS_TIER_2_COMPLETE' ||
      action.type === 'FRAME_ANALYSIS_TIER_3_COMPLETE'
    ) {
      const payload = (action as any).payload;
      if (payload.frameId !== nextState.activeFrame.id) {
        errors.push(
          `Tier completion frameId mismatch: action=${payload.frameId}, state=${nextState.activeFrame.id}`
        );
      }
    }

    return errors;
  }

  private prettyPrint(t: StateTransition): void {
    const time = new Date(t.timestamp).toISOString().split('T')[1].split('.')[0];
    const hasChanges = Object.keys(t.diff).length > 0;

    // Always log action type
    logDebug(`🔄 [${t.action.type}] @ ${time}`);

    // Log payload if present (smartly trimmed)
    const payload = (t.action as any).payload;
    if (payload) {
      const trimmed = this.trimPayload(payload);
      logDebug(`   Payload: ${trimmed}`);
    }

    // Log diff
    if (hasChanges) {
      for (const [key, value] of Object.entries(t.diff)) {
        if (value.changed) {
          if (key.startsWith('_suspicious')) {
            logWarn(`   ⚠️  ${key}: ${value.details}`);
          } else if (value.from && value.to) {
            logDebug(`   ${key}: ${value.from} → ${value.to}`);
            if (value.details) {
              logDebug(`      ${value.details}`);
            }
          } else if (value.details) {
            logDebug(`   ${key}: ${value.details}`);
          }
        }
      }
    }

    // Log validation errors
    if (t.validationErrors.length > 0) {
      logError(`   ❌ Validation Errors:`, new Error(t.validationErrors.join('\n')));
    }

    // Blank line for readability
    logDebug('');
  }

  private trimPayload(payload: any): string {
    if (!payload) return 'null';
    if (typeof payload !== 'object') return String(payload);

    // Special handling for common action payloads
    const trimmed: any = {};

    // Frame actions - show key fields only
    if (payload.frame) {
      trimmed.frame = {
        id: payload.frame.id,
        level: payload.frame.level,
        status: payload.frame.status,
        tier: payload.frame.tier,
        dataKeys: payload.frame.data ? Object.keys(payload.frame.data).join(', ') : 'none',
      };
    }

    // FrameId in tier actions
    if (payload.frameId) {
      trimmed.frameId = payload.frameId;
    }

    // Data in tier completions - just show size and keys
    if (payload.data && typeof payload.data === 'object') {
      const dataKeys = Object.keys(payload.data);
      trimmed.data = {
        keys: dataKeys.slice(0, 5).join(', ') + (dataKeys.length > 5 ? '...' : ''),
        size: JSON.stringify(payload.data).length + ' bytes',
      };
    }

    // View in BUNDLE_VIEW_UPDATED
    if (payload.view) {
      trimmed.view = {
        tier: payload.view.tier,
        hotspots: payload.view.hotspots?.length || 0,
        summary: payload.view.summary,
      };
    }

    // Facts in BUNDLE_FACTS_UPDATED
    if (payload.facts) {
      trimmed.facts = payload.facts ? 'present' : 'null';
      if (payload.facts?.bundle) {
        trimmed.facts = {
          commits: payload.facts.bundle.shas?.length || 0,
          files: payload.facts.scope?.files || 0,
          symbols: payload.facts.working?.symbols || 0,
        };
      }
    }

    // Config
    if (payload.config) {
      trimmed.config = {
        mode: payload.config.mode,
        roots: payload.config.roots?.length || 0,
        exclusions: payload.config.exclusions?.length || 0,
      };
    }

    // Nodes in EXPLORER_UPDATED
    if (payload.nodes) {
      trimmed.nodes = `${payload.nodes.length} nodes`;
    }

    // Action in dispatch
    if (payload.action) {
      trimmed.action = payload.action.type;
    }

    // If nothing was trimmed, show object size
    if (Object.keys(trimmed).length === 0) {
      return `{${Object.keys(payload).join(', ')}} (${JSON.stringify(payload).length} bytes)`;
    }

    return JSON.stringify(trimmed);
  }

  exportHistory(): string {
    return JSON.stringify(
      this.transitions.map(t => ({
        time: new Date(t.timestamp).toISOString(),
        action: t.action.type,
        payload: (t.action as any).payload,
        diff: t.diff,
        errors: t.validationErrors,
      })),
      null,
      2
    );
  }

  getRecentTransitions(count: number = 10): StateTransition[] {
    return this.transitions.slice(-count);
  }
}
