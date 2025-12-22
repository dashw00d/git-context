import pLimit = require('p-limit');
import { LegacyDetector } from '../../../facts/legacyAudit';
import { isCstFact } from '../../../types/cstFacts';
import { detectLanguage, getExtensionConfig, isCstOnlyLanguage } from '../../../utils/config';
import { logDebug, logInfo } from '../../../utils/logger';
import { getCstTimelineManager } from '../../cstTimeline';
import { PipelineState, PipelineStep } from '../pipelineTypes';

export function createLegacyStep(): PipelineStep {
  return {
    id: 'legacy',
    label: 'Audit legacy code',
    deps: ['intended', 'working', 'scope', 'index_commits', 'workspace_overlay'],

    async run(state: PipelineState) {
      if (!state.intended || !state.working || !state.scope) {
        logDebug('[LegacyStep] Intended, working, and scope required. Skipping.');
        return;
      }

      const detector = new LegacyDetector();
      const legacy = await detector.detect({
        intended: state.intended,
        working: state.working,
        scope: state.scope,
      });

      logDebug(
        `[LegacyStep] Legacy detection complete: ${legacy.dead.length} dead, ${legacy.legacyUsed.length} legacy used, ${legacy.replacedLeftovers.length} replaced leftovers`
      );

      if (state.drift && state.explicitTimeline && legacy.dead.length > 0) {
        for (const deadSym of legacy.dead) {
          const driftEntry = state.drift.missing_symbols.find(
            d => d.symbol_id === deadSym.symbol_id
          );

          if (driftEntry) {
            const hybridDrift = state.drift.hybridDrifts?.find(
              hd => hd.fact.id === deadSym.symbol_id && hd.timelineDelta
            );

            if (hybridDrift?.timelineDelta && hybridDrift.timelineDelta.length > 0) {
              const lastDelta = hybridDrift.timelineDelta[hybridDrift.timelineDelta.length - 1];
              (deadSym as any).lastSeenVersion = lastDelta.version;
            } else if (driftEntry.expected?.lastSha) {
              (deadSym as any).lastSeenVersion = driftEntry.expected.lastSha;
            }
          }
        }

        logDebug(`[LegacyStep] Enhanced ${legacy.dead.length} dead symbols with timeline context`);
      }

      const config = getExtensionConfig();
      const enableCst = config.enableCstTracking ?? true;
      const enableAugment = config.enableCstAugmentation ?? false;

      if (enableCst || enableAugment) {
        const timelineManager = getCstTimelineManager();
        const scopeFiles = Array.from(state.scope.allPaths);

        if (!state.completedSteps.has('index_commits')) {
          logDebug(
            `[LegacyStep] WARNING: index_commits not completed, hybrid facts may be missing`
          );
        }
        if (state.includeWorkspace && !state.completedSteps.has('workspace_overlay')) {
          logDebug(
            `[LegacyStep] WARNING: workspace_overlay not completed, workspace hybrid facts may be missing`
          );
        }

        const limit = pLimit(1); // DEBUG: Sequential processing
        await Promise.all(
          scopeFiles.map((filePath, idx) =>
            limit(async () => {
              const fileStartTime = Date.now();
              const language = detectLanguage(filePath);
              if (!language) return;

              const isCstOnly = isCstOnlyLanguage(language);
              if (!isCstOnly && !enableAugment) return;

              try {
                let versionToCheck: string;
                if (state.scope!.unstagedFiles?.has(filePath)) {
                  versionToCheck = 'workspace-unstaged';
                } else if (state.scope!.stagedFiles?.has(filePath)) {
                  versionToCheck = 'workspace-staged';
                } else {
                  versionToCheck = state.selectedCommitShas?.[0] || 'HEAD';
                }
                const facts = (await timelineManager.getPriorFacts(filePath, versionToCheck)) || [];

                if (facts.length > 0) {
                  // logDebug(`[LegacyStep] Retrieved ${facts.length} hybrid facts for ${filePath}@${versionToCheck}`);
                }

                for (const fact of facts) {
                  if (isCstFact(fact) && fact.timeline.length > 5) {
                    logDebug(
                      `[LegacyStep] CST fact ${fact.name} has long timeline (${fact.timeline.length} versions)`
                    );
                  }
                }
                const fileDuration = Date.now() - fileStartTime;
                logInfo(
                  `[LegacyStep] 🕐 File ${idx + 1}/${scopeFiles.length} ${filePath}: ${fileDuration}ms`
                );
              } catch (error) {
                logDebug(`[LegacyStep] Error checking CST legacy for ${filePath}: ${error}`);
              }
            })
          )
        );
      }

      state.legacy = legacy;
    },
  };
}
