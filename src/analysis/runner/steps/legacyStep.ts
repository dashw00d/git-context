import { PipelineStep, PipelineState } from '../pipelineTypes';
import { auditLegacy } from '../../../facts/legacyAudit';
import { getCstTimelineManager } from '../../cstTimeline';
import { getExtensionConfig, isCstOnlyLanguage, detectLanguage } from '../../../utils/config';
import { isCstFact } from '../../../types/cstFacts';
import { logDebug } from '../../../utils/logger';

export function createLegacyStep(): PipelineStep {
  return {
    id: 'legacy',
    label: 'Audit legacy code',
    deps: ['intended', 'working', 'scope'],

    async run(state: PipelineState) {
      if (!state.intended || !state.working || !state.scope) {
        throw new Error('Intended, working, and scope required');
      }

      const legacy = await auditLegacy(state.intended, state.working, state.scope);

      // Check for legacy CST facts (unchanged since v1 = low risk, but track)
      const config = getExtensionConfig();
      const enableCst = config.enableCstTracking ?? true;
      const enableAugment = config.enableCstAugmentation ?? false;

      if (enableCst || enableAugment) {
        const timelineManager = getCstTimelineManager();
        const scopeFiles = state.scope.allPaths;

        for (const filePath of scopeFiles) {
          const language = detectLanguage(filePath);
          if (!language) continue;

          const isCstOnly = isCstOnlyLanguage(language);
          if (!isCstOnly && !enableAugment) continue;

          try {
            // Get facts for oldest commit in bundle, or workspace if no commits
            const versionToCheck = state.selectedCommitShas?.[0] || 'workspace';
            const facts = await timelineManager.getPriorFactsWithFallback(filePath, versionToCheck);
            
            // Check for CST facts with long timelines (unchanged = legacy)
            for (const fact of facts) {
              if (isCstFact(fact) && fact.timeline.length > 5) {
                // Fact has been unchanged for many versions - could be legacy
                // Note: This is informational, not added to legacy.dead since CST facts
                // don't have the same "dead code" concept as semantic symbols
                logDebug(`[LegacyStep] CST fact ${fact.name} has long timeline (${fact.timeline.length} versions)`);
              }
            }
          } catch (error) {
            logDebug(`[LegacyStep] Error checking CST legacy for ${filePath}: ${error}`);
          }
        }
      }

      state.legacy = legacy;
    }
  };
}
