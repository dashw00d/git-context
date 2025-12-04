/* eslint-disable no-restricted-syntax */
import { buildRefactorBundleFacts } from '../../../facts/factsAssembler';
import { logDebug, logError } from '../../../utils/logger';
import { PipelineState, PipelineStep } from '../pipelineTypes';
import { updateState } from './utils';
import type { DriftFindings } from '../../../facts/driftDetector';
import type { LegacyAuditResult } from '../../../facts/legacyAudit';

function buildEmptyDrift(): DriftFindings {
  return {
    missing_symbols: [],
    zombie_symbols: [],
    divergent_symbols: [],
    missing_edges: [],
    zombie_edges: [],
    hotspots: [],
  };
}

function buildEmptyLegacy(): LegacyAuditResult {
  return {
    dead: [],
    legacyUsed: [],
    replacedLeftovers: [],
  };
}

export function createBundleFactsStep(): PipelineStep {
  return {
    id: 'bundle_facts',
    label: 'Aggregate bundle facts',
    deps: ['scope', 'intended', 'working', 'drift', 'legacy', 'hotspots', 'index_commits'],

    async run(state: PipelineState) {
      logDebug('[BundleFacts] Checking prerequisites...');
      logDebug(`[BundleFacts] - commitFacts: ${state.commitFacts?.length ?? 'undefined'} items`);
      logDebug(`[BundleFacts] - scope: ${state.scope ? 'present' : 'missing'}`);
      logDebug(`[BundleFacts] - intended: ${state.intended ? 'present' : 'missing'}`);
      logDebug(`[BundleFacts] - working: ${state.working ? 'present' : 'missing'}`);

      if (!state.commitFacts) {
        const message = 'commitFacts is undefined (should be at least an empty array)';
        logError(`[BundleFacts] FAILED: ${message}`);
        state.partialReasons = state.partialReasons ?? [];
        state.partialReasons.push(message);
        throw new Error(message);
      }

      if (state.commitFacts.length === 0 && !state.workspaceFacts) {
        const message = 'No commit facts or workspace facts available - at least one is required';
        logError(`[BundleFacts] FAILED: ${message}`);
        state.partialReasons = state.partialReasons ?? [];
        state.partialReasons.push(message);
        throw new Error(message);
      }

      if (!state.scope || !state.intended || !state.working) {
        const message = 'Missing required pipeline data for bundle facts';
        logError(`[BundleFacts] FAILED: ${message}`);
        logError(
          `[BundleFacts] Details: scope=${!!state.scope}, intended=${!!state.intended}, working=${!!state.working}`
        );
        state.partialReasons = state.partialReasons ?? [];
        state.partialReasons.push(message);
        throw new Error(message);
      }

      state.partialReasons = state.partialReasons ?? [];
      const fallbackReasons: string[] = [];

      const drift =
        state.drift ??
        (() => {
          fallbackReasons.push('Drift analysis unavailable; using empty findings');
          return buildEmptyDrift();
        })();
      const legacy =
        state.legacy ??
        (() => {
          fallbackReasons.push('Legacy audit unavailable; using empty results');
          return buildEmptyLegacy();
        })();
      const hotspots = state.hotspots ?? [];

      if (fallbackReasons.length > 0) {
        state.partialReasons.push(...fallbackReasons);
      }

      const bundleFacts = await buildRefactorBundleFacts(
        state.commitFacts,
        state.workspaceFacts ?? null,
        {
          commitShas: state.selectedCommitShas,
          scope: state.scope,
          intended: state.intended,
          working: state.working,
          drift,
          legacy,
          hotspots,
          timeline: state.explicitTimeline,
          movedLineage: state.movedLineage || [],
          totalCommits: state.commitFacts?.length || 0,
        }
      );

      if (state.partialReasons && state.partialReasons.length > 0) {
        bundleFacts.partial = true;
        bundleFacts.partialReasons = state.partialReasons;
      }

      updateState(state, 'bundleFacts', bundleFacts);
    },
  };
}
