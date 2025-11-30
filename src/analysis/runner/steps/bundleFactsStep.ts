import { PipelineStep, PipelineState } from '../pipelineTypes';
import { buildRefactorBundleFacts } from '../../../facts/factsAssembler';

export function createBundleFactsStep(): PipelineStep {
  return {
    id: 'bundle_facts',
    label: 'Aggregate bundle facts',
    deps: ['scope', 'intended', 'working', 'drift', 'legacy', 'hotspots', 'index_commits', 'moved_blocks'],

    async run(state: PipelineState) {
      if (!state.commitFacts || state.commitFacts.length === 0) {
        throw new Error('No commit facts available');
      }

      // Use full logic if all facts are available, otherwise fallback
      const options: any = {
        commitShas: state.selectedCommitShas
      };

      if (state.scope && state.intended && state.working && state.drift && state.legacy) {
        options.scope = state.scope;
        options.intended = state.intended;
        options.working = state.working;
        options.drift = state.drift;
        options.legacy = state.legacy;
        options.hotspots = state.hotspots;
      }

      // Add timeline and movedLineage if available
      if (state.explicitTimeline) {
        options.timeline = state.explicitTimeline;
      }
      if (state.movedLineage) {
        options.movedLineage = state.movedLineage;
      }

      const bundleFacts = await buildRefactorBundleFacts(
        state.commitFacts,
        state.workspaceFacts ?? null,
        options
      );

      state.bundleFacts = bundleFacts;
    }
  };
}
