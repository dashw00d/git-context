/**
 * Cross-Step Invariant Verification
 * Verifies consistency relationships between related step outputs
 */

import { logError, logWarn, logDebug } from '../../utils/logger';
import type { PipelineState } from './pipelineTypes';
import type { DriftFindings } from '../../facts/driftDetector';
import type { IntendedState } from '../../facts/intendedMap';
import type { LegacyAuditResult } from '../../facts/legacyAudit';
import type { WorkingSnapshot } from '../../facts/workingSnapshot';

/**
 * Verify invariants between drift findings and intended/working states
 */
export function verifyDriftInvariants(
  intended: Map<string, IntendedState>,
  working: WorkingSnapshot,
  drift: DriftFindings
): string[] {
  const errors: string[] = [];

  // Invariant: All missing_symbols must reference symbols in intended map with expect='present'
  for (const missing of drift.missing_symbols || []) {
    const symbolId = missing.symbol_id;
    if (!intended.has(symbolId)) {
      errors.push(
        `Drift invariant violation: missing_symbol '${symbolId}' references non-existent intended entry`
      );
    } else {
      const intendedState = intended.get(symbolId)!;
      if (intendedState.expect !== 'present') {
        errors.push(
          `Drift invariant violation: missing_symbol '${symbolId}' expected 'present' but intended says '${intendedState.expect}'`
        );
      }
    }
  }

  // Invariant: All zombie_symbols must reference symbols in working snapshot
  for (const zombie of drift.zombie_symbols || []) {
    const symbolId = zombie.symbol_id;
    if (!working.symbolsById.has(symbolId)) {
      errors.push(
        `Drift invariant violation: zombie_symbol '${symbolId}' references non-existent working entry`
      );
    }
  }

  // Invariant: All divergent_symbols must exist in both intended and working
  for (const divergent of drift.divergent_symbols || []) {
    const symbolId = divergent.symbol_id;
    if (!intended.has(symbolId)) {
      errors.push(
        `Drift invariant violation: divergent_symbol '${symbolId}' missing from intended map`
      );
    }
    if (!working.symbolsById.has(symbolId)) {
      errors.push(
        `Drift invariant violation: divergent_symbol '${symbolId}' missing from working snapshot`
      );
    }
  }

  return errors;
}

/**
 * Verify invariants between legacy audit and related states
 */
export function verifyLegacyInvariants(
  intended: Map<string, IntendedState>,
  working: WorkingSnapshot,
  legacy: LegacyAuditResult
): string[] {
  const errors: string[] = [];

  // Invariant: All dead symbols must exist in working snapshot
  for (const dead of legacy.dead || []) {
    const symbolId = dead.symbol_id;
    if (symbolId && !working.symbolsById.has(symbolId)) {
      errors.push(
        `Legacy invariant violation: dead symbol '${symbolId}' not found in working snapshot`
      );
    }
  }

  // Invariant: replacedLeftovers should have confidence between 0 and 1
  for (const replaced of legacy.replacedLeftovers || []) {
    if (replaced.confidence < 0 || replaced.confidence > 1) {
      errors.push(
        `Legacy invariant violation: replacedLeftover has invalid confidence ${replaced.confidence}`
      );
    }
  }

  return errors;
}

/**
 * Verify bundle facts invariants
 */
export function verifyBundleFactsInvariants(state: PipelineState): string[] {
  const errors: string[] = [];

  if (!state.bundleFacts) {
    return errors; // Bundle facts are optional
  }

  // Invariant: Bundle facts should have valid structure
  if (state.bundleFacts.incompleteness) {
    const missing = state.bundleFacts.incompleteness?.missing || [];
    const driftMissing = state.drift?.missing_symbols || [];

    // Check that bundle facts missing symbols are a subset of drift missing symbols
    const driftMissingIds = new Set(driftMissing.map((m: { symbol_id: string }) => m.symbol_id));
    for (const bundleMissingItem of missing) {
      if (bundleMissingItem.symbol_id && !driftMissingIds.has(bundleMissingItem.symbol_id)) {
        errors.push(
          `Bundle facts invariant violation: missing symbol '${bundleMissingItem.symbol_id}' in bundle facts but not in drift findings`
        );
      }
    }
  }

  return errors;
}

/**
 * Verify all relevant invariants after a step completes
 */
export function verifyStepInvariants(
  stepId: string,
  state: PipelineState,
  strict: boolean = false
): void {
  const allErrors: string[] = [];

  // Verify drift invariants (if drift step just completed)
  if (stepId === 'drift' && state.intended && state.working && state.drift) {
    const errors = verifyDriftInvariants(state.intended, state.working, state.drift);
    allErrors.push(...errors);
  }

  // Verify legacy invariants (if legacy step just completed)
  if (stepId === 'legacy' && state.intended && state.working && state.legacy) {
    const errors = verifyLegacyInvariants(state.intended, state.working, state.legacy);
    allErrors.push(...errors);
  }

  // Verify bundle facts invariants (if bundle_facts step just completed)
  if (stepId === 'bundle_facts') {
    const errors = verifyBundleFactsInvariants(state);
    allErrors.push(...errors);
  }

  // Report errors
  if (allErrors.length > 0) {
    const errorMessage = `[${stepId}] Invariant violations:\n${allErrors.map(e => `  - ${e}`).join('\n')}`;

    if (strict) {
      logError(errorMessage);
      // eslint-disable-next-line no-restricted-syntax
      throw new Error(errorMessage);
    } else {
      logWarn(errorMessage);
    }
  } else {
    logDebug(`[Verification] Invariants passed for step: ${stepId}`);
  }
}
