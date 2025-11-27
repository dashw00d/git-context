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

// File logging setup
const logFilePath = path.join(process.cwd(), 'test_pipeline_log.txt');
let logStream: fs.WriteStream;

// Initialize log file
function initLogFile() {
    // Clear existing log file
    if (fs.existsSync(logFilePath)) {
        fs.unlinkSync(logFilePath);
    }
    logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
}

// Write to log file
function writeToLog(message: string) {
    if (logStream) {
        logStream.write(message + '\n');
    }
}

// Close log file
function closeLogFile() {
    if (logStream) {
        writeToLog(`\nTest completed at: ${new Date().toISOString()}`);
        // Give async writes time to complete before closing
        setTimeout(() => {
            logStream.end();
            logStream.destroy();
            console.log(`\n📄 Log file saved to: ${logFilePath}`);
        }, 100);
    }
}

// Enhanced logging that goes to both console and file
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

console.log = function(...args: any[]) {
    const message = args.join(' ');
    originalConsoleLog(...args);
    writeToLog(message);
};

console.warn = function(...args: any[]) {
    const message = args.join(' ');
    originalConsoleWarn(...args);
    writeToLog('[WARN] ' + message);
};

console.error = function(...args: any[]) {
    const message = args.join(' ');
    originalConsoleError(...args);
    writeToLog('[ERROR] ' + message);
};

// Log deduplication
const logCounts = new Map<string, number>();
function logOnce(message: string, level: 'log' | 'warn' | 'error' = 'log') {
    const count = logCounts.get(message) || 0;
    logCounts.set(message, count + 1);

    if (count === 0) {
        console[level](message);
    } else if (count === 1) {
        console[level](`${message} (repeated)`);
    }
    // After second occurrence, just increment counter silently
}

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

// Test git parsing helpers for various git command outputs
async function testGitParsingHelpers() {
    console.log('\n[TEST] Testing git parsing helpers...');

    try {
        const git = new GitOperations();

        // Test parseGitPath
        console.log('[TEST] Testing parseGitPath...');
        const pathTestCases = [
            { input: 'normal/path.txt', expected: 'normal/path.txt' },
            { input: '"path with space.txt"', expected: 'path with space.txt' },
            { input: '"path\\141with\\142octal"', expected: 'pathawithboctal' }, // \141='a', \142='b'
            { input: '"path\\\\with\\\\backslash"', expected: 'path\\with\\backslash' },
            { input: '"tab\\011space"', expected: 'tab\tspace' } // \011 is tab
        ];

        const parseGitPath = (git as any).parseGitPath.bind(git);
        for (const testCase of pathTestCases) {
            const result = parseGitPath(testCase.input);
            if (result === testCase.expected) {
                console.log(`[TEST] ✓ parseGitPath "${testCase.input}" → "${result}"`);
            } else {
                console.error(`[TEST] ✗ parseGitPath "${testCase.input}" → expected "${testCase.expected}", got "${result}"`);
                return false;
            }
        }

        // Test parseLsTreeLine
        console.log('[TEST] Testing parseLsTreeLine...');
        const lsTreeTestCases = [
            {
                input: '100644 blob 9f2b66a557cc4c8e5723062776cf0001367d92e8\tsrc/analysis/git.ts',
                expected: { mode: '100644', type: 'blob', sha: '9f2b66a557cc4c8e5723062776cf0001367d92e8', path: 'src/analysis/git.ts' }
            },
            {
                input: '100644 blob abc123def\ttest file with spaces.txt',
                expected: { mode: '100644', type: 'blob', sha: 'abc123def', path: 'test file with spaces.txt' }
            }
        ];

        const parseLsTreeLine = (git as any).parseLsTreeLine.bind(git);
        for (const testCase of lsTreeTestCases) {
            const result = parseLsTreeLine(testCase.input);
            if (JSON.stringify(result) === JSON.stringify(testCase.expected)) {
                console.log(`[TEST] ✓ parseLsTreeLine parsed correctly`);
            } else {
                console.error(`[TEST] ✗ parseLsTreeLine failed:`, { input: testCase.input, expected: testCase.expected, got: result });
                return false;
            }
        }

        // Test isGitPathMissing
        console.log('[TEST] Testing isGitPathMissing...');
        const errorTestCases = [
            { input: new Error('path src/test.ts does not exist in abc123'), expected: true },
            { input: new Error('fatal: path \'bad file.txt\' did not match any file(s)'), expected: true },
            { input: new Error('some other error'), expected: false },
            { input: new Error('exists on disk, but not in'), expected: true }
        ];

        const isGitPathMissing = (git as any).isGitPathMissing.bind(git);
        for (const testCase of errorTestCases) {
            const result = isGitPathMissing(testCase.input);
            if (result === testCase.expected) {
                console.log(`[TEST] ✓ isGitPathMissing "${testCase.input.message}" → ${result}`);
            } else {
                console.error(`[TEST] ✗ isGitPathMissing "${testCase.input.message}" → expected ${testCase.expected}, got ${result}`);
                return false;
            }
        }

        // Test parseLogCommits
        console.log('[TEST] Testing parseLogCommits...');
        const logOutput = 'abc123\nauthor1\ndate1\nmessage1\nparent1\ndef456\nauthor2\ndate2\nmessage2\nparent2';
        const parseLogCommits = (git as any).parseLogCommits.bind(git);
        const commits = parseLogCommits(logOutput, 'multi') as any[];

        if (commits.length === 2 &&
            commits[0].sha === 'abc123' && commits[0].parent === 'parent1' &&
            commits[1].sha === 'def456' && commits[1].parent === 'parent2') {
            console.log(`[TEST] ✓ parseLogCommits parsed multi-commit correctly`);
        } else {
            console.error(`[TEST] ✗ parseLogCommits multi failed:`, commits);
            return false;
        }

        // Test parseFileList
        console.log('[TEST] Testing parseFileList...');
        const fileListOutput = 'file1.txt\nfile2.txt\n\nfile3.txt\n';
        const parseFileList = (git as any).parseFileList.bind(git);
        const files = parseFileList(fileListOutput);

        if (files.length === 3 && files[0] === 'file1.txt' && files[1] === 'file2.txt' && files[2] === 'file3.txt') {
            console.log(`[TEST] ✓ parseFileList parsed correctly`);
        } else {
            console.error(`[TEST] ✗ parseFileList failed:`, files);
            return false;
        }

        console.log('[TEST] ✓ All git parsing helpers tests passed');
        return true;
    } catch (error) {
        console.error('[TEST] ✗ Git parsing helpers test failed:', error);
        return false;
    }
}

// --- Main Script ---

async function testDirectPipeline() {
    // Initialize file logging
    initLogFile();
    writeToLog(`Test started at: ${new Date().toISOString()}`);
    writeToLog(`Log file: ${logFilePath}`);
    writeToLog('');

    console.log('🔬 DIRECT PIPELINE DIAGNOSTICS RUNNER');
    console.log('='.repeat(50));

    const diagnostics: any = {
        startTime: new Date().toISOString(),
        steps: [],
        events: [],
        errors: []
    };

    try {
        // 0. Test git parsing helpers first
        const parsingTestPassed = await testGitParsingHelpers();
        if (!parsingTestPassed) {
            console.error('❌ Git parsing helpers test failed, aborting pipeline test');
            return;
        }

        // 1. Initialize minimal components
        console.log('\n🏗️ Initializing minimal components...');
        
        // Wipe database for clean test run
        console.log('🧹 Wiping existing database...');
        try {
            const { getGitRoot } = await import('../src/utils/config');
            const gitRoot = getGitRoot();
            if (gitRoot) {
                const dbPath = path.join(gitRoot, '.git', 'commit-tracker', 'commit_tracker.db');
                if (fs.existsSync(dbPath)) {
                    fs.unlinkSync(dbPath);
                    console.log('✓ Database deleted');
                } else {
                    console.log('✓ No existing database to delete');
                }
            }
        } catch (error: any) {
            console.warn(`⚠ Failed to delete database: ${error?.message || error}`);
        }
        
        await ensureDatabaseInitialized();
        const dbManager = getDatabaseManager();
        const db = dbManager.getDatabase();
        
        // Validate schema migration completed
        const missing = dbManager.auditSchemaGaps();
        if (missing.length > 0) {
            throw new Error('Schema migration incomplete: ' + missing.join('; '));
        }
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
            const { getProjectId } = await import('../src/utils/config');
            const qdrant = getQdrantClient();
            const projectId = getProjectId();

            if (projectId) {
                console.log(`[TEST] project_id=${projectId}`);
            }
            
            if (await qdrant.isEnabled()) {
                const client = await qdrant.getClient();
                if (client) {
                    // Clear all collections that might be used (base names or project-specific)
                    const collectionsToCheck = ['commits', 'symbols'];
                    if (projectId) {
                        const commitsColl = qdrant.getCollectionName('commits', projectId);
                        const symbolsColl = qdrant.getCollectionName('symbols', projectId);
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
                                    with_vector: false
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

        // Print errors BEFORE success message
        if (finalState.errors.length > 0) {
            console.log('\n⚠️  ERRORS ENCOUNTERED:');
            console.log('='.repeat(30));
            for (const err of finalState.errors) {
                console.error(`[${err.stepId}] ${err.error}`);
            }
        }

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
${finalState.llmOutputs?.llmAnalysis?.summary || 'No LLM summary generated.'}

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
            console.log('\n❌ FAILURE: Pipeline completed with errors');
            process.exitCode = 1; // Set exit code for CI/CD
        }

        // Wait for async console writes before closing
        await new Promise(resolve => setTimeout(resolve, 200));
        closeLogFile();

    } catch (error) {
        console.error('\n💥 DIRECT PIPELINE TEST FAILED:');
        console.error(error);

        // Try to save whatever diagnostics we have
        const diagnosticsPath = path.join(process.cwd(), 'pipeline_diagnostics.json');
        diagnostics.crashError = String(error);
        fs.writeFileSync(diagnosticsPath, JSON.stringify(diagnostics, null, 2));
        console.log(`\n💾 Crash diagnostics saved to ${diagnosticsPath}`);

        // Wait for async console writes before closing
        await new Promise(resolve => setTimeout(resolve, 200));
        closeLogFile();
    }
}

// Run the direct test
testDirectPipeline().catch(console.error);
