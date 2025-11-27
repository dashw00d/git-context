import { ensureDatabaseInitialized, getDatabaseManager } from '../src/storage/database';
import { GitOperations } from '../src/analysis/git';
import { SymbolExtractor } from '../src/analysis/symbols';
import { DependencyExtractor } from '../src/analysis/dependencies';
import { SnapshotManager } from '../src/analysis/snapshotManager';
import { StructuralDiffManager } from '../src/analysis/structuralDiffManager';
import { WorkspaceIndexer } from '../src/analysis/workspaceIndexer';
import { RiskDetector } from '../src/analysis/heuristics';
import { HotspotDetector } from '../src/analysis/hotspotDetector';
import { MovedBlockDetector } from '../src/analysis/movedBlockDetector';
import { CommitIndexer } from '../src/analysis/commitIndexer';
import { EmbeddingIndexer } from '../src/analysis/embeddingIndexer';
import { LlmAnalyst } from '../src/analysis/llmAnalyst/runner';
import { BundleStoryEngine } from '../src/analysis/bundleStoryEngine';
import * as fs from 'fs';
import * as path from 'path';

// --- Aggregation Utilities ---

interface AggregatedItem<T> {
    item: T;
    count: number;
}

function aggregateItems<T>(items: T[], keyFn: (item: T) => string): AggregatedItem<T>[] {
    const map = new Map<string, { item: T; count: number }>();
    for (const item of items) {
        const key = keyFn(item);
        if (map.has(key)) {
            map.get(key)!.count++;
        } else {
            map.set(key, { item, count: 1 });
        }
    }
    return Array.from(map.values());
}

// --- Main Script ---

async function testDirectPipeline() {
    console.log('🔬 DIRECT PIPELINE DIAGNOSTICS RUNNER');
    console.log('='.repeat(50));

    const diagnostics: any = {
        startTime: new Date().toISOString(),
        steps: [],
        events: [],
        errors: []
    };

    try {
        // 1. Initialize minimal components
        console.log('\n🏗️ Initializing minimal components...');
        await ensureDatabaseInitialized();
        const dbManager = getDatabaseManager();
        const db = dbManager.getDatabase();
        const git = new GitOperations();

        const symbolExtractor = new SymbolExtractor(git);
        const dependencyExtractor = new DependencyExtractor();
        const snapshotManager = new SnapshotManager(db, symbolExtractor, dependencyExtractor);
        const structuralDiffManager = new StructuralDiffManager(db);

        const riskDetector = new RiskDetector();
        const hotspotDetector = new HotspotDetector();
        const movedBlockDetector = new MovedBlockDetector();

        // Initialize Story Engine components
        const llmAnalyst = new LlmAnalyst();
        const storyEngine = new BundleStoryEngine(llmAnalyst);

        const commitIndexer = new CommitIndexer(
            db, git, snapshotManager, structuralDiffManager,
            riskDetector, dependencyExtractor, hotspotDetector, movedBlockDetector
        );

        const workspaceIndexer = new WorkspaceIndexer(
            db, git, snapshotManager, structuralDiffManager
        );

        const embeddingIndexer = new EmbeddingIndexer(dbManager);

        console.log('✅ Components initialized');

        // 1.5. Clear Qdrant collections for clean test slate
        console.log('\n🧹 Clearing Qdrant collections...');
        try {
            const { getQdrantClient } = await import('../src/storage/qdrantClient');
            const { getGitRoot } = await import('../src/utils/config');
            const qdrant = getQdrantClient();
            const gitRoot = getGitRoot();
            
            if (gitRoot) {
                console.log(`[TEST] git_root=${gitRoot}`);
            }
            
            if (await qdrant.isEnabled()) {
                const client = await qdrant.getClient();
                if (client) {
                    // Clear all collections that might be used (base names or project-specific)
                    const collectionsToCheck = ['commits', 'symbols'];
                    if (gitRoot) {
                        const commitsColl = qdrant.getCollectionName('commits', gitRoot);
                        const symbolsColl = qdrant.getCollectionName('symbols', gitRoot);
                        collectionsToCheck.push(commitsColl, symbolsColl);
                    }
                    
                    const uniqueCollections = [...new Set(collectionsToCheck)];
                    
                    for (const collName of uniqueCollections) {
                        try {
                            await client.getCollection(collName);
                            // Collection exists, clear it
                            let deletedCount = 0;
                            let nextOffset: any = undefined;
                            
                            while (true) {
                                const scrollRes = await client.scroll(collName, {
                                    limit: 100,
                                    offset: nextOffset,
                                    with_payload: false,
                                    with_vectors: false
                                });
                                
                                if (scrollRes.points.length === 0) break;
                                
                                const ids = scrollRes.points.map(p => p.id);
                                await client.delete(collName, {
                                    wait: true,
                                    points: ids
                                });
                                
                                deletedCount += ids.length;
                                nextOffset = scrollRes.next_page_offset;
                                
                                if (!nextOffset) break;
                            }
                            
                            if (deletedCount > 0) {
                                console.log(`[TEST] ✓ Cleared ${deletedCount} points from ${collName}`);
                            }
                        } catch (error: any) {
                            // Collection doesn't exist, skip
                            if (!error?.message?.includes('doesn\'t exist') && !error?.message?.includes('not found')) {
                                console.warn(`[TEST] ⚠ Failed to clear ${collName}: ${error?.message || error}`);
                            }
                        }
                    }
                    console.log('[TEST] ✓ Qdrant clearing complete');
                } else {
                    console.log('[TEST] Qdrant client not available');
                }
            } else {
                console.log('[TEST] Qdrant not enabled, skipping');
            }
        } catch (error: any) {
            console.warn(`[TEST] ⚠ Failed to clear Qdrant: ${error?.message || error}`);
        }

        // 2. Create pipeline steps directly
        console.log('\n📋 Creating pipeline steps...');

        const { createIndexCommitsStep } = await import('../src/analysis/runner/steps/indexCommitsStep');
        const { createWorkspaceOverlayStep } = await import('../src/analysis/runner/steps/workspaceStep');
        const { createBundleFactsStep } = await import('../src/analysis/runner/steps/bundleFactsStep');
        const { createStoryStep } = await import('../src/analysis/runner/steps/storyStep');
        const { createEmbeddingStep } = await import('../src/analysis/runner/steps/embeddingStep');

        const steps = [
            createIndexCommitsStep(commitIndexer, 2),
            createWorkspaceOverlayStep(workspaceIndexer),
            createEmbeddingStep(embeddingIndexer),
            createBundleFactsStep(),
            createStoryStep(storyEngine)
        ];

        console.log(`✅ Created ${steps.length} pipeline steps`);

        // 3. Create initial pipeline state
        console.log('\n📊 Creating initial pipeline state...');

        const commits = git.getRecentCommits(2);
        const initialState = {
            selectedCommitShas: commits.map(c => c.sha),
            includeWorkspace: true
        };

        diagnostics.initialState = initialState;
        console.log(`📝 Processing ${initialState.selectedCommitShas.length} commits + workspace`);

        // 4. Run pipeline directly
        console.log('\n🚀 Running pipeline...');

        const { runPipeline } = await import('../src/analysis/runner/pipelineRunner');

        const startTime = Date.now();

        // Event handler to track progress
        const rawEvents: any[] = [];
        const onEvent = (event: any) => {
            rawEvents.push({
                type: event.type,
                stepId: event.step?.id,
                timestamp: Date.now(),
                error: event.error ? String(event.error) : undefined
            });

            switch (event.type) {
                case 'start':
                    console.log(`▶️  ${event.step.label}`);
                    break;
                case 'complete':
                    console.log(`✅ ${event.step.label}`);
                    break;
                case 'error':
                    console.error(`❌ ${event.step.label}: ${event.error}`);
                    break;
                case 'finished':
                    console.log('🏁 Pipeline finished');
                    break;
            }
        };

        const finalState = await runPipeline(steps, initialState, onEvent);
        const totalTime = Date.now() - startTime;

        diagnostics.endTime = new Date().toISOString();
        diagnostics.totalTimeMs = totalTime;
        diagnostics.finalState = {
            completedSteps: Array.from(finalState.completedSteps),
            commitFactsCount: finalState.commitFacts?.length,
            workspaceFacts: finalState.workspaceFacts,
            bundleFacts: finalState.bundleFacts,
            llmOutputs: finalState.llmOutputs
        };

        // Aggregate events
        diagnostics.events = aggregateItems(rawEvents, (e) => `${e.type}:${e.stepId}:${e.error || ''}`);

        // Aggregate errors
        diagnostics.errors = aggregateItems(finalState.errors, (e: any) => `${e.stepId}:${e.error}`);

        // 5. Report results
        console.log('\n📊 PIPELINE RESULTS');
        console.log('='.repeat(30));

        console.log(`⏱️  Total time: ${(totalTime / 1000).toFixed(2)}s`);
        console.log(`📋 Steps completed: ${finalState.completedSteps.size}/${steps.length}`);
        console.log(`❌ Errors: ${finalState.errors.length}`);

        // Write diagnostics to file
        const diagnosticsPath = path.join(process.cwd(), 'pipeline_diagnostics.json');
        fs.writeFileSync(diagnosticsPath, JSON.stringify(diagnostics, null, 2));
        console.log(`\n💾 Diagnostics saved to ${diagnosticsPath}`);

        // Write summary to file
        const summaryPath = path.join(process.cwd(), 'final_summary.md');
        const summaryContent = `
# Pipeline Execution Summary

**Date:** ${new Date().toLocaleString()}
**Total Time:** ${(totalTime / 1000).toFixed(2)}s
**Steps Completed:** ${finalState.completedSteps.size}/${steps.length}
**Errors:** ${finalState.errors.length}

## Key Metrics
- **Commits Analyzed:** ${finalState.commitFacts?.length || 0}
- **Workspace Symbols:** 
  - Added: ${finalState.workspaceFacts?.symbolsAdded || 0}
  - Modified: ${finalState.workspaceFacts?.symbolsModified || 0}
  - Removed: ${finalState.workspaceFacts?.symbolsRemoved || 0}

## LLM Insights
${finalState.llmOutputs?.summary || 'No LLM summary generated.'}

## Errors (Aggregated)
${diagnostics.errors.length > 0 ? diagnostics.errors.map((e: any) => `- **${e.count}x** [${e.item.stepId}] ${e.item.error}`).join('\n') : 'No errors found.'}

## Bundle Facts
\`\`\`json
${JSON.stringify(finalState.bundleFacts || {}, null, 2)}
\`\`\`
`;
        fs.writeFileSync(summaryPath, summaryContent.trim());
        console.log(`📝 Summary saved to ${summaryPath}`);

        if (finalState.errors.length === 0) {
            console.log('\n🎉 SUCCESS: Pipeline completed without errors!');
        } else {
            console.log('\n⚠️  PARTIAL: Pipeline completed with some errors');
        }

    } catch (error) {
        console.error('\n💥 DIRECT PIPELINE TEST FAILED:');
        console.error(error);

        // Try to save whatever diagnostics we have
        const diagnosticsPath = path.join(process.cwd(), 'pipeline_diagnostics.json');
        diagnostics.crashError = String(error);
        fs.writeFileSync(diagnosticsPath, JSON.stringify(diagnostics, null, 2));
        console.log(`\n💾 Crash diagnostics saved to ${diagnosticsPath}`);
    }
}

// Run the direct test
testDirectPipeline().catch(console.error);
