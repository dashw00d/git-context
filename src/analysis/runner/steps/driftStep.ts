/* eslint-disable no-restricted-syntax */
import pLimit = require('p-limit');
import { DriftDetector } from '../../../facts/driftDetector';
import { detectLanguage, getExtensionConfig, isCstOnlyLanguage } from '../../../utils/config';
import { logDebug, logInfo } from '../../../utils/logger';
import { describeVersionPosition } from '../../../utils/timeline';
import { getCstTimelineManager } from '../../cstTimeline';
import { detectHybridDrift } from '../../hybridDriftDetector';
import { PipelineState, PipelineStep } from '../pipelineTypes';
// p-limit is CommonJS; use require style to avoid default-import issues
// eslint-disable-next-line @typescript-eslint/no-var-requires

export function createDriftStep(): PipelineStep {
  return {
    id: 'drift',
    label: 'Detect drift (missing/zombie/divergent)',
    deps: ['intended', 'working', 'scope', 'index_commits', 'workspace_overlay'],

    async run(state: PipelineState) {
      if (!state.intended || !state.working) {
        throw new Error('Intended and working states required');
      }

      // Use V2 detector with BaseDetector enhancements
      const detector = new DriftDetector();
      const drift = await detector.detect({
        intended: state.intended,
        working: state.working,
        commitShas: state.selectedCommitShas,
      });

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

          // Verify that index_commits and workspace_overlay have completed (hybrid facts should be available)
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

          // Build version map based on scope membership
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

          // Batch retrieve facts for all eligible files with per-file version selection
          const factsByFile = await timelineManager.getPriorFactsBatchWithVersions(versionMap);

          // Log hybrid facts availability
          const totalFacts = Array.from(factsByFile.values()).reduce(
            (sum, facts) => sum + facts.length,
            0
          );
          logDebug(
            `[DriftStep] Retrieved ${totalFacts} hybrid facts across ${factsByFile.size} files`
          );

          // Process drift detection in parallel with concurrency limit
          const limit = pLimit(8);
          const startTime = Date.now();

          const driftPromises = eligibleFiles.map(filePath =>
            limit(async () => {
              try {
                const currentFacts = factsByFile.get(filePath) || [];
                if (currentFacts.length === 0) return [];

                // Detect drifts for this file with timeline chain support
                const currentVersion = versionMap.get(filePath)!;
                const fileDrifts = await detectHybridDrift(
                  filePath,
                  currentFacts,
                  state.intended!, // Safe: checked at function start
                  currentVersion,
                  state.scope!, // Safe: checked at function start
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

          // Add hybrid drifts to findings
          drift.hybridDrifts = hybridDrifts;
        }
      }

      // Enhance drift findings with timeline annotations
      if (state.explicitTimeline && state.explicitTimeline.length > 0) {
        // Annotate hybrid drifts with version positions
        if (drift.hybridDrifts) {
          for (const hybridDrift of drift.hybridDrifts) {
            if (hybridDrift.timelineDelta && hybridDrift.timelineDelta.length > 0) {
              // Find first version where drift appeared (introduced)
              const firstDelta = hybridDrift.timelineDelta[0];
              hybridDrift.introducedAtVersion = firstDelta.version;

              // Find last version where drift still exists (resolved would be after timeline)
              const lastDelta = hybridDrift.timelineDelta[hybridDrift.timelineDelta.length - 1];
              // If drift still exists at newest version, it's not resolved
              const newestVersion = state.explicitTimeline[0];
              if (lastDelta.version === newestVersion) {
                hybridDrift.resolvedAtVersion = undefined; // Still present
              } else {
                hybridDrift.resolvedAtVersion = lastDelta.version;
              }
            }
          }
        }

        // Annotate missing/zombie/divergent symbols with version info from intended state
        for (const missing of drift.missing_symbols) {
          if (missing.expected?.lastSha) {
            // Find version position in timeline
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

        // Annotate missing edges (same pattern as symbols)
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

        // Annotate zombie edges (same pattern)
        // Note: zombie_edges don't have expected field, so get it from intended map
        for (const edge of drift.zombie_edges || []) {
          // Get expected state from intended map (zombie edges connect to absent symbols)
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
