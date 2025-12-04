/* eslint-disable no-restricted-syntax */
import pLimit = require('p-limit');
import { DriftDetector } from '../../../facts/driftDetector';
import { detectLanguage, getExtensionConfig, isCstOnlyLanguage } from '../../../utils/config';
import { logDebug, logInfo } from '../../../utils/logger';
import { describeVersionPosition } from '../../../utils/timeline';
import { getCstTimelineManager } from '../../cstTimeline';
import { detectHybridDrift } from '../../hybridDriftDetector';
import { PipelineState, PipelineStep } from '../pipelineTypes';

export function createDriftStep(): PipelineStep {
  return {
    id: 'drift',
    label: 'Detect drift (missing/zombie/divergent)',
    deps: ['intended', 'working', 'scope', 'index_commits', 'workspace_overlay'],

    async run(state: PipelineState) {
      if (!state.intended || !state.working) {
        throw new Error('Intended and working states required');
      }

      const detector = new DriftDetector();
      const drift = await detector.detect({
        intended: state.intended,
        working: state.working,
        commitShas: state.selectedCommitShas,
      });

      const config = getExtensionConfig();
      const enableCst = config.enableCstTracking ?? true;
      const enableAugment = config.enableCstAugmentation ?? false;

      if (enableCst || enableAugment) {
        const timelineManager = getCstTimelineManager();
        const scopeFiles = Array.from(state.scope?.allPaths || new Set<string>());

        const eligibleFiles = scopeFiles.filter(filePath => {
          const language = detectLanguage(filePath);
          if (!language) return false;
          const isCstOnly = isCstOnlyLanguage(language);
          return isCstOnly || enableAugment;
        });

        if (eligibleFiles.length === 0) {
          logDebug(
            `[DriftStep] No eligible files for hybrid drift detection (CST: ${enableCst}, Augment: ${enableAugment})`
          );
          drift.hybridDrifts = [];
        } else {
          logDebug(
            `[DriftStep] Processing ${eligibleFiles.length} files for hybrid drift (CST: ${enableCst}, Augment: ${enableAugment})`
          );

          if (!state.scope) {
            throw new Error('Scope required for hybrid drift detection');
          }

          if (!state.completedSteps.has('index_commits')) {
            logDebug(
              `[DriftStep] WARNING: index_commits not completed, hybrid facts may be missing`
            );
          }
          if (state.includeWorkspace && !state.completedSteps.has('workspace_overlay')) {
            logDebug(
              `[DriftStep] WARNING: workspace_overlay not completed, workspace hybrid facts may be missing`
            );
          }

          const versionMap = new Map<string, string>();
          const newestSha = state.selectedCommitShas?.[0];

          for (const filePath of eligibleFiles) {
            const versionFromTimeline = state.scope.fileVersionMap?.get(filePath);
            let version: string;
            if (state.scope.unstagedFiles?.has(filePath)) {
              version = 'workspace-unstaged';
            } else if (state.scope.stagedFiles?.has(filePath)) {
              version = 'workspace-staged';
            } else if (versionFromTimeline) {
              version = versionFromTimeline;
            } else {
              version = newestSha || 'HEAD';
            }
            versionMap.set(filePath, version);
          }

          const factsByFile = await timelineManager.getPriorFactsBatchWithVersions(versionMap);

          const totalFacts = Array.from(factsByFile.values()).reduce(
            (sum, facts) => sum + facts.length,
            0
          );
          logDebug(
            `[DriftStep] Retrieved ${totalFacts} hybrid facts across ${factsByFile.size} files`
          );

          const limit = pLimit(24);
          const startTime = Date.now();

          const driftPromises = eligibleFiles.map(filePath =>
            limit(async () => {
              try {
                const currentFacts = factsByFile.get(filePath) || [];
                if (currentFacts.length === 0) return [];

                const currentVersion = versionMap.get(filePath)!;
                const fileDrifts = await detectHybridDrift(
                  filePath,
                  currentFacts,
                  state.intended!,
                  currentVersion,
                  state.scope!,
                  state.selectedCommitShas || []
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
          logInfo(
            `[DriftStep] Processed ${eligibleFiles.length} files in ${duration}ms (${(
              eligibleFiles.length /
              (duration / 1000)
            ).toFixed(1)} files/sec)`
          );

          drift.hybridDrifts = hybridDrifts;
        }
      }

      if (state.explicitTimeline && state.explicitTimeline.length > 0) {
        if (drift.hybridDrifts) {
          for (const hybridDrift of drift.hybridDrifts) {
            if (hybridDrift.timelineDelta && hybridDrift.timelineDelta.length > 0) {
              const firstDelta = hybridDrift.timelineDelta[0];
              hybridDrift.introducedAtVersion = firstDelta.version;

              const lastDelta = hybridDrift.timelineDelta[hybridDrift.timelineDelta.length - 1];

              const newestVersion = state.explicitTimeline[0];
              if (lastDelta.version === newestVersion) {
                hybridDrift.resolvedAtVersion = undefined;
              } else {
                hybridDrift.resolvedAtVersion = lastDelta.version;
              }
            }
          }
        }

        for (const missing of drift.missing_symbols) {
          if (missing.expected?.lastSha) {
            const versionIndex = state.explicitTimeline.findIndex(
              v =>
                v === missing.expected.lastSha ||
                (v === 'HEAD' &&
                  missing.expected.lastSha ===
                    state.selectedCommitShas?.[state.selectedCommitShas.length - 1])
            );
            if (versionIndex >= 0) {
              missing.introducedAtVersion = state.explicitTimeline[versionIndex];
              missing.versionDescription = describeVersionPosition(
                state.explicitTimeline[versionIndex],
                state.explicitTimeline
              );
            }
          }
        }

        for (const zombie of drift.zombie_symbols) {
          if (zombie.expected?.lastSha) {
            const versionIndex = state.explicitTimeline.findIndex(
              v =>
                v === zombie.expected.lastSha ||
                (v === 'HEAD' &&
                  zombie.expected.lastSha ===
                    state.selectedCommitShas?.[state.selectedCommitShas.length - 1])
            );
            if (versionIndex >= 0) {
              zombie.introducedAtVersion = state.explicitTimeline[versionIndex];
              zombie.versionDescription = describeVersionPosition(
                state.explicitTimeline[versionIndex],
                state.explicitTimeline
              );
            }
          }
        }

        for (const divergent of drift.divergent_symbols) {
          if (divergent.expected?.lastSha) {
            const versionIndex = state.explicitTimeline.findIndex(
              v =>
                v === divergent.expected.lastSha ||
                (v === 'HEAD' &&
                  divergent.expected.lastSha ===
                    state.selectedCommitShas?.[state.selectedCommitShas.length - 1])
            );
            if (versionIndex >= 0) {
              divergent.introducedAtVersion = state.explicitTimeline[versionIndex];
              divergent.versionDescription = describeVersionPosition(
                state.explicitTimeline[versionIndex],
                state.explicitTimeline
              );
            }
          }
        }

        for (const edge of drift.missing_edges || []) {
          if (edge.expected?.lastSha) {
            const versionIndex = state.explicitTimeline.findIndex(
              v =>
                v === edge.expected.lastSha ||
                (v === 'HEAD' &&
                  edge.expected.lastSha ===
                    state.selectedCommitShas?.[state.selectedCommitShas.length - 1])
            );
            if (versionIndex >= 0) {
              edge.introducedAtVersion = state.explicitTimeline[versionIndex];
              edge.versionDescription = describeVersionPosition(
                state.explicitTimeline[versionIndex],
                state.explicitTimeline
              );
            }
          }
        }

        for (const edge of drift.zombie_edges || []) {
          const fromState = state.intended.get(edge.from);
          const toState = state.intended.get(edge.to);
          const expectedState = fromState || toState;

          if (expectedState?.lastSha) {
            const versionIndex = state.explicitTimeline.findIndex(
              v =>
                v === expectedState.lastSha ||
                (v === 'HEAD' &&
                  expectedState.lastSha ===
                    state.selectedCommitShas?.[state.selectedCommitShas.length - 1])
            );
            if (versionIndex >= 0) {
              edge.introducedAtVersion = state.explicitTimeline[versionIndex];
              edge.versionDescription = describeVersionPosition(
                state.explicitTimeline[versionIndex],
                state.explicitTimeline
              );
            }
          }
        }
      }

      state.drift = drift;
    },
  };
}
