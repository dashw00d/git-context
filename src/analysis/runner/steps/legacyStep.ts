import { PipelineStep, PipelineState } from '../pipelineTypes';
import { LegacyDetector } from '../../../facts/legacyAudit';
import { getCstTimelineManager } from '../../cstTimeline';
import { getExtensionConfig, isCstOnlyLanguage, detectLanguage } from '../../../utils/config';
import { isCstFact } from '../../../types/cstFacts';
import { logDebug } from '../../../utils/logger';

export function createLegacyStep(): PipelineStep {
  return {
    id: 'legacy',
    label: 'Audit legacy code',
    deps: ['intended', 'working', 'scope', 'drift', 'index_commits', 'workspace_overlay'],

    async run(state: PipelineState) {
      if (!state.intended || !state.working || !state.scope) {
        throw new Error('Intended, working, and scope required');
      }

      // Use V2 detector with BaseDetector enhancements
      const detector = new LegacyDetector();
      const legacy = await detector.detect({
        intended: state.intended,
        working: state.working,
        scope: state.scope
      });

      // Enhance legacy audit results with timeline context from drift data
      if (state.drift && state.explicitTimeline && legacy.dead.length > 0) {
        for (const deadSym of legacy.dead) {
          // Find corresponding entry in drift.missing
          const driftEntry = state.drift.missing_symbols.find(d => d.symbol_id === deadSym.symbol_id);
          
          if (driftEntry) {
            // Check for timelineDelta in hybrid drifts (if present)
            const hybridDrift = state.drift.hybridDrifts?.find(
              hd => hd.fact.id === deadSym.symbol_id && hd.timelineDelta
            );
            
            if (hybridDrift?.timelineDelta && hybridDrift.timelineDelta.length > 0) {
              // Find last version where symbol appeared
              const lastDelta = hybridDrift.timelineDelta[hybridDrift.timelineDelta.length - 1];
              (deadSym as any).lastSeenVersion = lastDelta.version;
            } else if (driftEntry.expected?.lastSha) {
              // Use lastSha from intended state as fallback
              (deadSym as any).lastSeenVersion = driftEntry.expected.lastSha;
            }
          }
        }
        
        logDebug(`[LegacyStep] Enhanced ${legacy.dead.length} dead symbols with timeline context`);
      }

      // Check for legacy CST facts (unchanged since v1 = low risk, but track)
      const config = getExtensionConfig();
      const enableCst = config.enableCstTracking ?? true;
      const enableAugment = config.enableCstAugmentation ?? false;

      if (enableCst || enableAugment) {
        const timelineManager = getCstTimelineManager();
        const scopeFiles = state.scope.allPaths;

        // Verify that index_commits and workspace_overlay have completed (hybrid facts should be available)
        if (!state.completedSteps.has('index_commits')) {
          logDebug(`[LegacyStep] WARNING: index_commits not completed, hybrid facts may be missing`);
        }
        if (state.includeWorkspace && !state.completedSteps.has('workspace_overlay')) {
          logDebug(`[LegacyStep] WARNING: workspace_overlay not completed, workspace hybrid facts may be missing`);
        }

        for (const filePath of scopeFiles) {
          const language = detectLanguage(filePath);
          if (!language) continue;

          const isCstOnly = isCstOnlyLanguage(language);
          if (!isCstOnly && !enableAugment) continue;

          try {
            // Get facts using version-based querying based on scope membership
            let versionToCheck: string;
            if (state.scope.unstagedFiles?.has(filePath)) {
              versionToCheck = 'workspace-unstaged';
            } else if (state.scope.stagedFiles?.has(filePath)) {
              versionToCheck = 'workspace-staged';
            } else {
              versionToCheck = state.selectedCommitShas?.[0] || 'HEAD';
            }
            const facts = await timelineManager.getPriorFacts(filePath, versionToCheck) || [];
            
            if (facts.length > 0) {
              logDebug(`[LegacyStep] Retrieved ${facts.length} hybrid facts for ${filePath}@${versionToCheck}`);
            }
            
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
