import { PipelineStep, PipelineState } from '../pipelineTypes';
import { detectDrift } from '../../../facts/driftDetector';
import { detectHybridDrift } from '../../hybridDriftDetector';
import { getCstTimelineManager } from '../../cstTimeline';
import { getExtensionConfig, isCstOnlyLanguage, detectLanguage } from '../../../utils/config';
import { logDebug, logInfo } from '../../../utils/logger';
// p-limit is CommonJS; use require style to avoid default-import issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
import pLimit = require('p-limit');

export function createDriftStep(): PipelineStep {
  return {
    id: 'drift',
    label: 'Detect drift (missing/zombie/divergent)',
    deps: ['intended', 'working'],

    async run(state: PipelineState) {
      if (!state.intended || !state.working) {
        throw new Error('Intended and working states required');
      }

      const drift = detectDrift(state.intended, state.working, state.selectedCommitShas);

      // Detect hybrid drifts (CST facts)
      const config = getExtensionConfig();
      const enableCst = config.enableCstTracking ?? true;
      const enableAugment = config.enableCstAugmentation ?? false;

      if (enableCst || enableAugment) {
        const timelineManager = getCstTimelineManager();
        const scopeFiles = Array.from(state.scope?.allPaths || new Set<string>());

        // Filter eligible files first (synchronous, fast)
        const eligibleFiles = scopeFiles.filter(filePath => {
          const language = detectLanguage(filePath);
          if (!language) return false;
          const isCstOnly = isCstOnlyLanguage(language);
          return isCstOnly || enableAugment;
        });

        if (eligibleFiles.length === 0) {
          logDebug(`[DriftStep] No eligible files for hybrid drift detection (CST: ${enableCst}, Augment: ${enableAugment})`);
          drift.hybridDrifts = [];
        } else {
          logDebug(`[DriftStep] Processing ${eligibleFiles.length} files for hybrid drift (CST: ${enableCst}, Augment: ${enableAugment})`);
          const currentVersion = state.selectedCommitShas?.[state.selectedCommitShas.length - 1] || 'workspace';
          const priorVersion = state.selectedCommitShas?.[0] || currentVersion;

          // Batch retrieve facts for all eligible files with workspace fallback
          const factsByFile = await timelineManager.getPriorFactsBatchWithFallback(eligibleFiles, currentVersion);

          // Process drift detection in parallel with concurrency limit
          const limit = pLimit(8);
          const startTime = Date.now();

          const driftPromises = eligibleFiles.map(filePath =>
            limit(async () => {
              try {
                const currentFacts = factsByFile.get(filePath) || [];
                if (currentFacts.length === 0) return [];

                // Detect drifts for this file
                const fileDrifts = await detectHybridDrift(
                  filePath,
                  currentFacts,
                  state.intended!, // Safe: checked at function start
                  currentVersion,
                  priorVersion
                );
                return fileDrifts;
              } catch (error) {
                logDebug(`[DriftStep] Error detecting hybrid drift for ${filePath}: ${error}`);
                return [];
              }
            })
          );

          const allDrifts = await Promise.all(driftPromises);
          const hybridDrifts = allDrifts.flat();

          const duration = Date.now() - startTime;
          logInfo(`[DriftStep] Processed ${eligibleFiles.length} files in ${duration}ms (${(eligibleFiles.length / (duration / 1000)).toFixed(1)} files/sec)`);

          // Add hybrid drifts to findings
          drift.hybridDrifts = hybridDrifts;
        }
      }

      state.drift = drift;
    }
  };
}
