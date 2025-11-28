import * as vscode from 'vscode';
import { LiveDiffTracker } from '../liveTracker';
import { CockpitOrchestrator } from '../state/cockpitOrchestrator';
import { getWorkingSnapshot } from '../facts/workingSnapshot';
import { detectDrift } from '../facts/driftDetector';
import { auditLegacy } from '../facts/legacyAudit';
import { ScopeSet } from '../facts/scope';
import { IntendedState, buildIntendedMap } from '../facts/intendedMap';
import { logInfo, logDebug, logError } from '../utils/logger';
import { detectHybridDrift } from './hybridDriftDetector';
import { getCstTimelineManager } from './cstTimeline';
import { getExtensionConfig, isCstOnlyLanguage, detectLanguage } from '../utils/config';
import { GitOperations } from './git';

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
            let intended: Map<string, IntendedState>;

            // Use buildIntendedMap if we have commit SHAs
            if (state.bundleFacts.bundle.shas && state.bundleFacts.bundle.shas.length > 0) {
                try {
                    intended = await buildIntendedMap(state.bundleFacts.bundle.shas);
                    logDebug(`[LiveAnalysis] Rebuilt intended map from database: ${intended.size} symbols`);
                } catch (error) {
                    logError('[LiveAnalysis] Failed to rebuild intended map from database', error);
                    // Fallback to evidence-based reconstruction
                    intended = this.reconstructIntendedFromEvidence(state.bundleFacts.evidence);
                    logDebug(`[LiveAnalysis] Using evidence-based reconstruction: ${intended.size} symbols`);
                }
            } else {
                // No commit SHAs available (workspace-only analysis), use evidence
                intended = this.reconstructIntendedFromEvidence(state.bundleFacts.evidence);
                logDebug(`[LiveAnalysis] No SHAs available, reconstructed from evidence: ${intended.size} symbols`);
            }

            // 3. Reconstruct Scope with staged/unstaged tracking
            const scopePaths = new Set<string>();
            const git = new GitOperations();
            const scopeFiles = (state.bundleFacts?.evidence?.['scope.files'] as string[] | undefined) || [];
            scopeFiles.forEach(f => scopePaths.add(f));

            // Build scope with staged/unstaged tracking for hybrid drift detection
            const staged = await git.getStagedFiles();
            const unstaged = await git.getUnstagedFiles();
            
            const scope: ScopeSet = {
                commitFiles: scopePaths,
                workingChanged: new Set(liveOverrides.keys()),
                stagedFiles: new Set(staged.map(f => f.path)),
                unstagedFiles: new Set(unstaged.map(f => f.path)),
                blastRadius: new Set(),
                allPaths: scopePaths
            };

            // 4. Get Working Snapshot (with Live Overrides)
            const working = await getWorkingSnapshot(scopePaths, liveOverrides);

            // 5. Run Detectors
            const drift = detectDrift(intended, working);

            // Detect hybrid drifts (CST facts)
            const config = getExtensionConfig();
            const enableCst = config.enableCstTracking ?? true;
            const enableAugment = config.enableCstAugmentation ?? false;

            if (enableCst || enableAugment) {
                const timelineManager = getCstTimelineManager();
                const hybridDrifts: any[] = [];

                // Get hybrid facts for files in scope and detect drifts
                for (const filePath of scopePaths) {
                    const language = detectLanguage(filePath);
                    if (!language) continue;

                    const isCstOnly = isCstOnlyLanguage(language);
                    if (!isCstOnly && !enableAugment) continue;

                    try {
                        // Determine version based on scope membership
                        const version = scope.unstagedFiles?.has(filePath) ? 'workspace-unstaged' 
                            : scope.stagedFiles?.has(filePath) ? 'workspace-staged' 
                            : 'HEAD';
                        const currentFacts = await timelineManager.getPriorFacts(filePath, version) || [];

                        if (currentFacts.length > 0) {
                            const fileDrifts = await detectHybridDrift(
                                filePath,
                                currentFacts,
                                intended,
                                version,
                                scope,
                                state.bundleFacts.bundle.shas || []
                            );
                            hybridDrifts.push(...fileDrifts);
                        }
                    } catch (error) {
                        logDebug(`[LiveAnalysis] Error detecting hybrid drift for ${filePath}: ${error}`);
                    }
                }

                // Add hybrid drifts to findings
                drift.hybridDrifts = hybridDrifts;
            }

            const legacy = await auditLegacy(intended, working, scope);

            // 6. Update State
            this.orchestrator.updateLiveState({
                status: 'idle',
                summary: {
                    missing: drift.missing_symbols.length,
                    zombies: drift.zombie_symbols.length,
                    drift: drift.divergent_symbols.length,
                    dead: legacy.dead.length,
                    hybridDrifts: drift.hybridDrifts?.length || 0
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

    /**
     * Reconstruct IntendedState from evidence arrays when database unavailable
     */
    private reconstructIntendedFromEvidence(evidence: Record<string, any>): Map<string, IntendedState> {
        const intended = new Map<string, IntendedState>();

        if (!evidence) {
            return intended;
        }

        const present = evidence["intended.present"] as string[] || [];
        const absent = evidence["intended.absent"] as string[] || [];
        const renamed = evidence["intended.renamed"] as string[] || [];
        const renamedSet = new Set(renamed);

        // Parse symbol IDs: path:kind:name
        function parseSymbolId(id: string): { path: string; kind: string; name: string } {
            const parts = id.split(':');
            if (parts.length >= 3) {
                return {
                    path: parts[0],
                    kind: parts[1],
                    // Handle names with colons (e.g., "namespace:ClassName")
                    name: parts.slice(2).join(':')
                };
            }
            // Fallback for malformed IDs
            return {
                path: parts[0] || '',
                kind: parts[1] || 'unknown',
                name: parts[parts.length - 1] || ''
            };
        }

        // Process present symbols
        present.forEach(id => {
            const parsed = parseSymbolId(id);
            intended.set(id, {
                expect: 'present',
                lastSha: 'bundle',
                lastName: parsed.name,
                lastPath: parsed.path,
                isRenamed: renamedSet.has(id)
            });
        });

        // Process absent symbols
        absent.forEach(id => {
            const parsed = parseSymbolId(id);
            intended.set(id, {
                expect: 'absent',
                lastSha: 'bundle',
                lastName: parsed.name,
                lastPath: parsed.path
            });
        });

        return intended;
    }
}
