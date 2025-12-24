/**
 * Type guards for pipeline state properties
 * These enable compile-time type narrowing for precondition checking
 */

import type { PipelineState } from './pipelineTypes';
import type { DriftFindings } from '../../facts/driftDetector';
import type { IntendedState } from '../../facts/intendedMap';
import type { LegacyAuditResult } from '../../facts/legacyAudit';
import type { ScopeSet } from '../../facts/scope';
import type { WorkingSnapshot } from '../../facts/workingSnapshot';

/**
 * Check if state has a valid intended map
 */
export function hasIntended(
  state: PipelineState
): state is PipelineState & { intended: Map<string, IntendedState> } {
  return state.intended !== undefined && state.intended instanceof Map && state.intended.size >= 0;
}

/**
 * Check if state has a valid working snapshot
 */
export function hasWorking(
  state: PipelineState
): state is PipelineState & { working: WorkingSnapshot } {
  return (
    state.working !== undefined &&
    typeof state.working === 'object' &&
    state.working !== null &&
    'symbolsById' in state.working &&
    'edges' in state.working &&
    'analyzedPaths' in state.working
  );
}

/**
 * Check if state has a valid scope set
 */
export function hasScope(state: PipelineState): state is PipelineState & { scope: ScopeSet } {
  return (
    state.scope !== undefined &&
    typeof state.scope === 'object' &&
    state.scope !== null &&
    'allPaths' in state.scope &&
    state.scope.allPaths instanceof Set
  );
}

/**
 * Check if state has valid drift findings
 */
export function hasDrift(state: PipelineState): state is PipelineState & { drift: DriftFindings } {
  return (
    state.drift !== undefined &&
    typeof state.drift === 'object' &&
    state.drift !== null &&
    'missing_symbols' in state.drift &&
    'zombie_symbols' in state.drift
  );
}

/**
 * Check if state has valid legacy audit result
 */
export function hasLegacy(
  state: PipelineState
): state is PipelineState & { legacy: LegacyAuditResult } {
  return (
    state.legacy !== undefined &&
    typeof state.legacy === 'object' &&
    state.legacy !== null &&
    'dead' in state.legacy &&
    'legacyUsed' in state.legacy &&
    'replacedLeftovers' in state.legacy
  );
}

/**
 * Check if state has commit facts
 */
export function hasCommitFacts(
  state: PipelineState
): state is PipelineState & { commitFacts: any[] } {
  return state.commitFacts !== undefined && Array.isArray(state.commitFacts);
}

/**
 * Check if state has valid plan data
 */
export function hasPlan(
  state: PipelineState
): state is PipelineState & { plan: NonNullable<PipelineState['plan']> } {
  return (
    state.plan !== undefined &&
    typeof state.plan === 'object' &&
    state.plan !== null &&
    'fileChanges' in state.plan &&
    'content' in state.plan
  );
}

/**
 * Check if state has bundle facts
 */
export function hasBundleFacts(
  state: PipelineState
): state is PipelineState & { bundleFacts: NonNullable<PipelineState['bundleFacts']> } {
  return (
    state.bundleFacts !== undefined &&
    typeof state.bundleFacts === 'object' &&
    state.bundleFacts !== null
  );
}

/**
 * Check if state has workspace facts
 */
export function hasWorkspaceFacts(
  state: PipelineState
): state is PipelineState & { workspaceFacts: NonNullable<PipelineState['workspaceFacts']> } {
  return (
    state.workspaceFacts !== undefined &&
    typeof state.workspaceFacts === 'object' &&
    state.workspaceFacts !== null
  );
}

/**
 * Check if state has hotspots
 */
export function hasHotspots(
  state: PipelineState
): state is PipelineState & { hotspots: NonNullable<PipelineState['hotspots']> } {
  return state.hotspots !== undefined && Array.isArray(state.hotspots);
}

/**
 * Check if all required state properties for drift detection are present
 */
export function canRunDrift(state: PipelineState): state is PipelineState & {
  intended: Map<string, IntendedState>;
  working: WorkingSnapshot;
  scope: ScopeSet;
} {
  return hasIntended(state) && hasWorking(state) && hasScope(state);
}

/**
 * Check if all required state properties for legacy audit are present
 */
export function canRunLegacy(state: PipelineState): state is PipelineState & {
  intended: Map<string, IntendedState>;
  working: WorkingSnapshot;
  scope: ScopeSet;
} {
  return hasIntended(state) && hasWorking(state) && hasScope(state);
}

/**
 * Check if all required state properties for bundle facts are present
 */
export function canRunBundleFacts(state: PipelineState): state is PipelineState & {
  scope: ScopeSet;
  intended: Map<string, IntendedState>;
  working: WorkingSnapshot;
  commitFacts: any[];
} {
  return hasScope(state) && hasIntended(state) && hasWorking(state) && hasCommitFacts(state);
}
