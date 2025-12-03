import { buildRefactorBundleFacts } from '../../../facts/factsAssembler';
import { logError } from '../../../utils/logger';
import { PipelineState, PipelineStep } from '../pipelineTypes';

export function createBundleFactsStep(): PipelineStep {
  return {
    id: 'bundle_facts',
    label: 'Aggregate bundle facts',
    deps: [
      'scope',
      'intended',
      'working',
      'drift',
      'legacy',
      'hotspots',
      'index_commits',
      'moved_blocks',
    ],

    async run(state: PipelineState) {
      if (!state.commitFacts || state.commitFacts.length === 0) {
        logError('No commit facts available');
        return;
      }

      if (!state.scope || !state.intended || !state.working || !state.drift || !state.legacy) {
        logError('Missing required pipeline data for bundle facts');
        return;
      }

      const bundleFacts = await buildRefactorBundleFacts(
        state.commitFacts,
        state.workspaceFacts ?? null,
        {
          commitShas: state.selectedCommitShas,
          scope: state.scope,
          intended: state.intended,
          working: state.working,
          drift: state.drift,
          legacy: state.legacy,
          hotspots: state.hotspots,
          timeline: state.explicitTimeline,
          movedLineage: state.movedLineage,
        }
      );

      if (state.partialReasons && state.partialReasons.length > 0) {
        (bundleFacts as any).partial = true;
        (bundleFacts as any).partialReasons = state.partialReasons;
      }

      state.bundleFacts = bundleFacts;
    },
  };
}
