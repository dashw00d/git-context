import * as vscode from 'vscode';
import { LiveDiffTracker } from '../liveTracker';
import { CockpitOrchestrator } from '../state/cockpitOrchestrator';
import { getWorkingSnapshot } from '../facts/workingSnapshot';
import { detectDrift } from '../facts/driftDetector';
import { auditLegacy } from '../facts/legacyAudit';
import { ScopeSet } from '../facts/scope';
import { IntendedState } from '../facts/intendedMap';
import { logInfo, logDebug, logError } from '../utils/logger';

export class LiveAnalysisEngine {
    private tracker: LiveDiffTracker;
    private orchestrator: CockpitOrchestrator;
    private isAnalyzing = false;

    constructor(tracker: LiveDiffTracker, orchestrator: CockpitOrchestrator) {
        this.tracker = tracker;
        this.orchestrator = orchestrator;
    }

    /**
     * Run analysis on current live state
     */
    public async analyze(): Promise<void> {
        if (this.isAnalyzing) {
            logDebug('[LiveAnalysis] Analysis already in progress, skipping');
            return;
        }

        const state = this.orchestrator.getState();
        if (!state.bundleFacts) {
            logDebug('[LiveAnalysis] No active bundle, skipping analysis');
            return;
        }

        this.isAnalyzing = true;
        this.orchestrator.updateLiveState({ status: 'analyzing' });

        try {
            logInfo('[LiveAnalysis] Starting live analysis...');
            const startTime = Date.now();

            // 1. Get Live Content
            const liveOverrides = this.tracker.getDirtyContent();

            // 2. Reconstruct Scope & Intended State from Bundle Facts
            // We need to rebuild these maps from the stored facts
            const intended = new Map<string, IntendedState>();
            // TODO: We need a way to hydrate IntendedState from bundleFacts.
            // For now, we might need to rely on the fact that we don't have the full IntendedState object
            // readily available unless we persist it or re-compute it.
            // However, we can reconstruct a partial IntendedState from facts.intended lists.

            if (state.bundleFacts.evidence) {
                const evidence = state.bundleFacts.evidence;
                // @ts-ignore - accessing dynamic evidence properties
                const present = evidence["intended.present"] as string[] || [];
                // @ts-ignore
                const absent = evidence["intended.absent"] as string[] || [];

                present.forEach(id => {
                    const name = id.split(':').pop() || '';
                    intended.set(id, { expect: 'present', lastSha: 'bundle', lastName: name });
                });
                absent.forEach(id => {
                    const name = id.split(':').pop() || '';
                    intended.set(id, { expect: 'absent', lastSha: 'bundle', lastName: name });
                });
            }

            // 3. Reconstruct Scope
            const scopePaths = new Set<string>();
            // @ts-ignore
            const scopeFiles = state.bundleFacts.evidence?.["scope.files"] as string[] || [];
            scopeFiles.forEach(f => scopePaths.add(f));

            // 4. Get Working Snapshot (with Live Overrides)
            const working = await getWorkingSnapshot(scopePaths, liveOverrides);

            // 5. Run Detectors
            const drift = detectDrift(intended, working);

            // We need a ScopeSet for auditLegacy. Reconstructing it minimally.
            const scope: ScopeSet = {
                commitFiles: scopePaths,
                workingChanged: new Set(liveOverrides.keys()), // Add workingChanged
                blastRadius: new Set(), // We might miss blast radius files if not in facts
                allPaths: scopePaths
            };

            const legacy = await auditLegacy(intended, working, scope);

            // 6. Update State
            this.orchestrator.updateLiveState({
                status: 'idle',
                summary: {
                    missing: drift.missing_symbols.length,
                    zombies: drift.zombie_symbols.length,
                    drift: drift.divergent_symbols.length,
                    dead: legacy.dead.length
                },
                facts: {
                    drift,
                    legacy
                }
            });

            logInfo(`[LiveAnalysis] Analysis complete in ${Date.now() - startTime}ms`);

        } catch (error) {
            logError('[LiveAnalysis] Failed', error);
            this.orchestrator.updateLiveState({ status: 'error' });
        } finally {
            this.isAnalyzing = false;
        }
    }
}

