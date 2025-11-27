import { ensureDatabaseInitialized, getDatabaseManager } from './src/storage/database';
import { getRefactorPipeline } from './src/extension';
import { ReportService } from './src/services/reportService';
import { GitOperations } from './src/analysis/git';
import { getGitRoot } from './src/utils/config';
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
        logStream.end();
        console.log(`\n📄 Log file saved to: ${logFilePath}`);
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

// Timing utilities
interface TimingData {
    name: string;
    start: number;
    end?: number;
    duration?: number;
}

const timings: TimingData[] = [];

function startTimer(name: string): number {
    const start = Date.now();
    timings.push({ name, start });
    return start;
}

function endTimer(name: string): number {
    const timing = timings.find(t => t.name === name && !t.end);
    if (timing) {
        timing.end = Date.now();
        timing.duration = timing.end - timing.start;
        return timing.duration;
    }
    return 0;
}

function printTimings() {
    const output: string[] = [];
    output.push('\n' + '='.repeat(80));
    output.push('PERFORMANCE TIMINGS');
    output.push('='.repeat(80));

    const completed = timings.filter(t => t.duration !== undefined);
    const total = completed.reduce((sum, t) => sum + (t.duration || 0), 0);

    completed.forEach(t => {
        const seconds = ((t.duration || 0) / 1000).toFixed(2);
        const percent = ((t.duration || 0) / total * 100).toFixed(1);
        output.push(`  ${t.name.padEnd(40)} ${seconds.padStart(8)}s (${percent.padStart(5)}%)`);
    });

    output.push('  ' + '-'.repeat(60));
    output.push(`  ${'TOTAL'.padEnd(40)} ${(total / 1000).toFixed(2).padStart(8)}s`);

    const timingOutput = output.join('\n');
    console.log(timingOutput);
}

// LLM call tracking
interface LLMCall {
    timestamp: number;
    purpose: string;
    model?: string;
    tokens?: number;
    duration?: number;
    inputTokens?: number;
    outputTokens?: number;
    cost?: number;
}

const llmCalls: LLMCall[] = [];

function trackLLMCall(purpose: string, model?: string, tokens?: number, duration?: number, inputTokens?: number, outputTokens?: number, cost?: number) {
    llmCalls.push({
        timestamp: Date.now(),
        purpose,
        model,
        tokens,
        duration,
        inputTokens,
        outputTokens,
        cost
    });
}

function printLLMStats() {
    const output: string[] = [];

    if (llmCalls.length === 0) {
        const message = '\n[LLM] No LLM calls made';
        console.log(message);
        return;
    }

    output.push('\n' + '='.repeat(80));
    output.push('LLM USAGE STATISTICS');
    output.push('='.repeat(80));
    output.push(`  Total calls: ${llmCalls.length}`);

    const byPurpose = new Map<string, number>();
    const byModel = new Map<string, number>();
    llmCalls.forEach(call => {
        byPurpose.set(call.purpose, (byPurpose.get(call.purpose) || 0) + 1);
        if (call.model) {
            byModel.set(call.model, (byModel.get(call.model) || 0) + 1);
        }
    });

    output.push('\n  Calls by purpose:');
    Array.from(byPurpose.entries())
        .sort((a, b) => b[1] - a[1])
        .forEach(([purpose, count]) => {
            output.push(`    ${purpose.padEnd(35)} ${count.toString().padStart(3)} calls`);
        });

    if (byModel.size > 0) {
        output.push('\n  Calls by model:');
        Array.from(byModel.entries())
            .sort((a, b) => b[1] - a[1])
            .forEach(([model, count]) => {
                output.push(`    ${model.padEnd(35)} ${count.toString().padStart(3)} calls`);
            });
    }

    const totalTokens = llmCalls.reduce((sum, call) => sum + (call.tokens || 0), 0);
    const totalInputTokens = llmCalls.reduce((sum, call) => sum + (call.inputTokens || 0), 0);
    const totalOutputTokens = llmCalls.reduce((sum, call) => sum + (call.outputTokens || 0), 0);
    const totalCost = llmCalls.reduce((sum, call) => sum + (call.cost || 0), 0);
    const totalDuration = llmCalls.reduce((sum, call) => sum + (call.duration || 0), 0);

    if (totalTokens > 0) {
        output.push(`\n  Token usage:`);
        output.push(`    Total tokens: ${totalTokens.toLocaleString()}`);
        if (totalInputTokens > 0) output.push(`    Input tokens: ${totalInputTokens.toLocaleString()}`);
        if (totalOutputTokens > 0) output.push(`    Output tokens: ${totalOutputTokens.toLocaleString()}`);
    }

    if (totalDuration > 0) {
        output.push(`\n  Total LLM time: ${(totalDuration / 1000).toFixed(2)}s`);
    }

    if (totalCost > 0) {
        output.push(`\n  Estimated cost: $${totalCost.toFixed(4)}`);
    }

    // Show individual calls
    output.push('\n  Individual calls:');
    llmCalls.forEach((call, idx) => {
        const duration = call.duration ? ` (${(call.duration / 1000).toFixed(2)}s)` : '';
        const tokens = call.tokens ? ` ${call.tokens} tokens` : '';
        const model = call.model ? ` via ${call.model}` : '';
        output.push(`    ${idx + 1}. ${call.purpose}${model}${tokens}${duration}`);
    });

    const llmOutput = output.join('\n');
    console.log(llmOutput);
}

function printLogSummary() {
    const repeated = Array.from(logCounts.entries())
        .filter(([_, count]) => count > 1)
        .sort((a, b) => b[1] - a[1]);

    if (repeated.length > 0) {
        const output: string[] = [];
        output.push('\n' + '='.repeat(80));
        output.push('REPEATED LOG MESSAGES SUMMARY');
        output.push('='.repeat(80));
        repeated.forEach(([msg, count]) => {
            output.push(`  ${count}x: ${msg.substring(0, 100)}${msg.length > 100 ? '...' : ''}`);
        });

        const summaryOutput = output.join('\n');
        console.log(summaryOutput);
    }
}

async function testPipeline() {
    // Initialize file logging
    initLogFile();
    writeToLog(`Test started at: ${new Date().toISOString()}`);
    writeToLog(`Log file: ${logFilePath}`);
    writeToLog('');

    // Clear database first
    console.log('\n[DATABASE] Clearing existing database...');
    writeToLog('Clearing existing database...');
    try {
        const gitRoot = getGitRoot();
        if (gitRoot) {
            const dbPath = path.join(gitRoot, '.git', 'commit-tracker', 'commit_tracker.db');
            if (fs.existsSync(dbPath)) {
                fs.unlinkSync(dbPath);
                console.log(`[DATABASE] ✓ Cleared existing database: ${dbPath}`);
                writeToLog(`Cleared existing database: ${dbPath}`);
            } else {
                console.log('[DATABASE] No existing database file to clear');
                writeToLog('No existing database file to clear');
            }
        } else {
            console.warn('[DATABASE] Could not determine git root, skipping database clear');
            writeToLog('Could not determine git root, skipping database clear');
        }
    } catch (error) {
        console.error('[DATABASE] ✗ Failed to clear database:', error);
        writeToLog(`Failed to clear database: ${error}`);
    }

    const testStart = startTimer('Total Test Time');
    console.log('='.repeat(80));
    console.log('LAYERED PIPELINE INTEGRATION TEST - Full UI Simulation (with LLM analysis)');
    console.log('⚠️  WARNING: This test enables LLM calls and may incur API costs!');
    console.log('='.repeat(80));

    // 1. Initialize Database Singleton (this fixes the ReportService issue)
    console.log('\n[INIT] Initializing database singleton...');
    await ensureDatabaseInitialized();
    const dbManager = getDatabaseManager();
    const db = dbManager.getDatabase();
    console.log('[INIT] ✓ Database singleton initialized');

    // 2. Initialize Git
    console.log('[INIT] Initializing git operations...');
    const git = new GitOperations();
    const headSha = git.getHeadSha();
    const currentBranch = git.getCurrentBranch();
    console.log(`[INIT] Current HEAD: ${headSha.substring(0, 8)} on branch: ${currentBranch}`);

    // 3. Get commit history
    const commitLog = git.getRecentCommits(3);
    console.log(`[INIT] Found ${commitLog.length} commits in history`);

    const selectedCommits = commitLog.slice(0, 3);
    console.log('[INIT] Selected commits:');
    selectedCommits.forEach((commit: any, idx: number) => {
        console.log(`  ${idx + 1}. ${commit.sha.substring(0, 8)} - ${commit.message.split('\n')[0]}`);
    });

    // 4. Get Pipeline (uses singleton database)
    console.log('\n[INIT] Getting refactor pipeline...');
    const pipeline = await getRefactorPipeline();
    console.log('[INIT] ✓ Pipeline initialized');

    // 5. Get Report Service
    const reportService = ReportService.getInstance();
    console.log('[INIT] ✓ Report service initialized');

    console.log('\n' + '='.repeat(80));
    console.log('PHASE 1: Analyzing Workspace Changes (Staged + Unstaged)');
    console.log('='.repeat(80));
    startTimer('Phase 1: Workspace Analysis');

    const workspaceShas: string[] = [];
    const analysisDetails: any[] = [];

    // Analyze Staged Changes
    console.log('\n[WORKSPACE] Analyzing staged changes...');
    startTimer('Staged Analysis');
    try {
        const workspaceIndexer = pipeline.workspaceIndexer;
        const stagedFacts = await workspaceIndexer.analyzeWorkspace('staged');
        if (stagedFacts) {
            const stagedSha = `workspace-staged@${currentBranch}`;
            workspaceShas.push(stagedSha);
            analysisDetails.push({
                type: 'workspace',
                mode: 'staged',
                sha: stagedSha,
                facts: stagedFacts
            });
            console.log(`[WORKSPACE] ✓ Staged analysis complete: ${stagedSha}`);
            console.log(`  - Symbols: +${stagedFacts.symbolsAdded} -${stagedFacts.symbolsRemoved} ~${stagedFacts.symbolsModified}`);
            console.log(`  - Files: ${stagedFacts.filesChanged}`);
            console.log(`  - Risks: [${stagedFacts.risks.join(', ')}]`);
        } else {
            console.log('[WORKSPACE] No staged changes to analyze');
        }
    } catch (error) {
        console.error('[WORKSPACE] ✗ Staged analysis failed:', error);
    }
    const stagedTime = endTimer('Staged Analysis');
    console.log(`[WORKSPACE] Staged analysis took ${(stagedTime / 1000).toFixed(2)}s`);

    // Analyze Unstaged Changes
    console.log('\n[WORKSPACE] Analyzing unstaged changes...');
    startTimer('Unstaged Analysis');
    try {
        const workspaceIndexer = pipeline.workspaceIndexer;
        const unstagedFacts = await workspaceIndexer.analyzeWorkspace('unstaged');
        if (unstagedFacts) {
            const unstagedSha = `workspace-unstaged@${currentBranch}`;
            workspaceShas.push(unstagedSha);
            analysisDetails.push({
                type: 'workspace',
                mode: 'unstaged',
                sha: unstagedSha,
                facts: unstagedFacts
            });
            console.log(`[WORKSPACE] ✓ Unstaged analysis complete: ${unstagedSha}`);
            console.log(`  - Symbols: +${unstagedFacts.symbolsAdded} -${unstagedFacts.symbolsRemoved} ~${unstagedFacts.symbolsModified}`);
            console.log(`  - Files: ${unstagedFacts.filesChanged}`);
            console.log(`  - Risks: [${unstagedFacts.risks.join(', ')}]`);
        } else {
            console.log('[WORKSPACE] No unstaged changes to analyze');
        }
    } catch (error) {
        console.error('[WORKSPACE] ✗ Unstaged analysis failed:', error);
    }
    const unstagedTime = endTimer('Unstaged Analysis');
    console.log(`[WORKSPACE] Unstaged analysis took ${(unstagedTime / 1000).toFixed(2)}s`);
    endTimer('Phase 1: Workspace Analysis');

    console.log('\n' + '='.repeat(80));
    console.log('PHASE 2: Analyzing Selected Commits');
    console.log('='.repeat(80));
    startTimer('Phase 2: Commit Analysis');

    const commitShas: string[] = [];
    console.log(`\n[COMMIT] Indexing ${selectedCommits.length} commits...`);
    startTimer('Commit Indexing');

    try {
        // Use the new pipeline's indexCommits for quick indexing
        await pipeline.indexCommits(selectedCommits.map(c => c.sha));
        commitShas.push(...selectedCommits.map(c => c.sha));

        // Get facts from the indexer for display purposes
        const commitIndexer = (pipeline as any).commitIndexer; // Access internal indexer
        for (let i = 0; i < selectedCommits.length; i++) {
            const commit = selectedCommits[i];
            const commitFacts = await commitIndexer.ensureCommitIndexed(commit.sha);
            analysisDetails.push({
                type: 'commit',
                sha: commit.sha,
                facts: commitFacts
            });

            const shortSha = commit.sha.substring(0, 8);
            console.log(`[COMMIT ${i + 1}] ✓ Indexed ${shortSha}`);
            console.log(`  - Message: ${commit.message.split('\n')[0]}`);
            console.log(`  - Symbols: +${commitFacts.symbolsAdded} -${commitFacts.symbolsRemoved} ~${commitFacts.symbolsModified}`);
            console.log(`  - Edges: +${commitFacts.edgesAdded} -${commitFacts.edgesRemoved}`);
            console.log(`  - Risks: [${commitFacts.risks.join(', ')}]`);
            console.log(`  - Files: ${commitFacts.filesChanged}`);
        }
    } catch (error) {
        console.error(`[COMMIT] ✗ Indexing failed:`, error);
    }

    const commitTime = endTimer('Commit Indexing');
    console.log(`[COMMIT] Commit indexing took ${(commitTime / 1000).toFixed(2)}s`);
    endTimer('Phase 2: Commit Analysis');

    console.log('\n' + '='.repeat(80));
    console.log('PHASE 3: Generating Report (Mimicking UI "Analyze" Button)');
    console.log('='.repeat(80));
    startTimer('Phase 3: Report Generation');

    const allShas = [...workspaceShas, ...commitShas];
    console.log(`\n[REPORT] Generating report for ${allShas.length} items:`);;
    allShas.forEach((sha, idx) => {
        console.log(`  ${idx + 1}. ${sha}`);
    });

    let reportId: string | null = null;
    let reportData: any = null;
    try {
        console.log('[REPORT] Starting report generation (with LLM analysis enabled)...');
        startTimer('Report Generation Core');
        reportId = await reportService.generateReport(allShas, 'partial', {
            skipLLM: false,
            force: true, // Force regeneration to ensure LLM analysis runs
            llmCallTracker: trackLLMCall
        });
        const reportGenTime = endTimer('Report Generation Core');
        console.log(`\n[REPORT] ✓ Report generated successfully (${(reportGenTime / 1000).toFixed(2)}s)`);
        console.log(`  - Report ID: ${reportId}`);

        // Extract the full report data
        if (reportId) {
            console.log('[REPORT] Fetching report data from database...');
            startTimer('Report Data Extraction');
            const reportQuery = db.prepare('SELECT * FROM reports WHERE id = ?');
            const reportRow = reportQuery.get(reportId);
            if (reportRow) {
                reportData = {
                    id: reportRow.id,
                    title: reportRow.title,
                    commit_shas: JSON.parse(reportRow.commit_shas || '[]'),
                    selected_files: JSON.parse(reportRow.selected_files || '[]'),
                    workspace_scope: reportRow.workspace_scope,
                    created_at: reportRow.created_at,
                    workspace_hash: reportRow.workspace_hash,
                    facts: reportRow.facts_json ? JSON.parse(reportRow.facts_json) : null,
                    analysis: reportRow.analysis_json ? JSON.parse(reportRow.analysis_json) : null,
                    summary: reportRow.summary,
                    critical_count: reportRow.critical_count,
                    warning_count: reportRow.warning_count,
                    is_pinned: reportRow.is_pinned,
                    fingerprint: reportRow.fingerprint,
                    pipeline_version: reportRow.pipeline_version,
                    prompt_version: reportRow.prompt_version,
                    mode: reportRow.mode
                };
                const extractTime = endTimer('Report Data Extraction');
                console.log(`[REPORT] Report data extracted (${(extractTime / 1000).toFixed(2)}s):`);
                console.log(`  - Title: ${reportData.title}`);
                console.log(`  - Commits: ${reportData.commit_shas.length}`);
                console.log(`  - Files: ${reportData.selected_files.length}`);
                console.log(`  - Facts: ${reportData.facts ? 'Present' : 'None'}`);
                console.log(`  - Analysis: ${reportData.analysis ? 'Present' : 'None'}`);
            }
        }
    } catch (error) {
        console.error('[REPORT] ✗ Report generation failed:', error);
        // End timers even on error
        if (timings.find(t => t.name === 'Report Generation Core' && !t.end)) {
            endTimer('Report Generation Core');
        }
        if (timings.find(t => t.name === 'Report Data Extraction' && !t.end)) {
            endTimer('Report Data Extraction');
        }
    }
    endTimer('Phase 3: Report Generation');

    console.log('\n' + '='.repeat(80));
    console.log('PHASE 4: Extracting Complete UI Data (What Cockpit Receives)');
    console.log('='.repeat(80));
    startTimer('Phase 4: UI Data Extraction');

    // Simulate what the UI receives by querying the database
    console.log('\n[UI-DATA] Fetching complete analysis data from database...');
    const uiData: any = {
        report: reportData,
        commits_analysis: [],
        commits_metadata: [],
        symbols: [],
        edges: [],
        files: [],
        workspace_files: { staged: [], unstaged: [] },
        facts: null,
        mismatches: [],
        issues: []
    };

    // 1. Get commits analysis (what powers the analysis display)
    console.log('[UI-DATA] Querying commits_analysis table...');
    startTimer('Query Commits Analysis');
    for (const sha of allShas) {
        const dbAnalysis = db.prepare('SELECT * FROM commits_analysis WHERE sha = ?').get([sha]);
        if (dbAnalysis) {
            const parsed = {
                sha: dbAnalysis.sha,
                summary_md: dbAnalysis.summary_md,
                symbols_added: dbAnalysis.symbols_added,
                symbols_removed: dbAnalysis.symbols_removed,
                symbols_modified: dbAnalysis.symbols_modified,
                edges_added: dbAnalysis.edges_added,
                edges_removed: dbAnalysis.edges_removed,
                risks: JSON.parse(dbAnalysis.risks || '[]'),
                blast_radius: dbAnalysis.blast_radius,
                analyzed_at: dbAnalysis.analyzed_at,
                pipeline_version: dbAnalysis.pipeline_version,
                analysis_version: dbAnalysis.analysis_version,
                status: dbAnalysis.status
            };
            uiData.commits_analysis.push(parsed);

            // Find corresponding facts from our tracking
            const tracked = analysisDetails.find(d => d.sha === sha);
            if (tracked && tracked.facts) {
                const mismatches: string[] = [];
                if (parsed.symbols_added !== tracked.facts.symbolsAdded) {
                    mismatches.push(`symbols_added: DB=${parsed.symbols_added}, Actual=${tracked.facts.symbolsAdded}`);
                }
                if (parsed.symbols_removed !== tracked.facts.symbolsRemoved) {
                    mismatches.push(`symbols_removed: DB=${parsed.symbols_removed}, Actual=${tracked.facts.symbolsRemoved}`);
                }
                if (parsed.symbols_modified !== tracked.facts.symbolsModified) {
                    mismatches.push(`symbols_modified: DB=${parsed.symbols_modified}, Actual=${tracked.facts.symbolsModified}`);
                }
                if (parsed.edges_added !== tracked.facts.edgesAdded) {
                    mismatches.push(`edges_added: DB=${parsed.edges_added}, Actual=${tracked.facts.edgesAdded}`);
                }
                if (parsed.edges_removed !== tracked.facts.edgesRemoved) {
                    mismatches.push(`edges_removed: DB=${parsed.edges_removed}, Actual=${tracked.facts.edgesRemoved}`);
                }
                if (parsed.blast_radius !== tracked.facts.structuralChangeScore) {
                    mismatches.push(`structural_change_score: DB=${parsed.blast_radius}, Actual=${tracked.facts.structuralChangeScore}`);
                }

                if (mismatches.length > 0) {
                    uiData.mismatches.push({
                        sha: sha.substring(0, 40),
                        mismatches
                    });
                }
            }
        } else {
            uiData.issues.push(`No commits_analysis entry for ${sha}`);
        }
    }
    const commitsAnalysisTime = endTimer('Query Commits Analysis');
    console.log(`[UI-DATA] Commits analysis queried (${(commitsAnalysisTime / 1000).toFixed(2)}s)`);

    // 2. Get commits metadata (what powers the commit list)
    console.log('[UI-DATA] Querying commits_metadata table...');
    startTimer('Query Commits Metadata');
    for (const sha of commitShas) {
        const metadata = db.prepare('SELECT * FROM commits_metadata WHERE sha = ?').get(sha);
        if (metadata) {
            uiData.commits_metadata.push({
                sha: metadata.sha,
                author: metadata.author,
                date: metadata.date,
                message: metadata.message,
                files_changed: metadata.files_changed
            });
        }
    }
    const commitsMetadataTime = endTimer('Query Commits Metadata');
    console.log(`[UI-DATA] Commits metadata queried (${(commitsMetadataTime / 1000).toFixed(2)}s)`);

    // 3. Get symbols (what powers symbol tracking)
    console.log('[UI-DATA] Querying symbols table...');
    startTimer('Query Symbols');
    const symbolsQuery = db.prepare(`
        SELECT sha, symbol_id, name, kind, status
        FROM symbols
        WHERE sha IN (${allShas.map(() => '?').join(',')})
        LIMIT 100
    `);
    const symbolsData = symbolsQuery.all(...allShas);
    uiData.symbols = symbolsData.map((s: any) => ({
        sha: s.sha,
        symbol_id: s.symbol_id,
        name: s.name,
        kind: s.kind,
        status: s.status
    }));
    const symbolsTime = endTimer('Query Symbols');
    console.log(`[UI-DATA] Symbols queried (${(symbolsTime / 1000).toFixed(2)}s): ${symbolsData.length} symbols`);

    // 4. Get edges (what powers dependency graph)
    console.log('[UI-DATA] Querying edges table...');
    startTimer('Query Edges');
    const edgesQuery = db.prepare(`
        SELECT sha, from_symbol, to_symbol, status
        FROM edges
        WHERE sha IN (${allShas.map(() => '?').join(',')})
        LIMIT 100
    `);
    const edgesData = edgesQuery.all(...allShas);
    uiData.edges = edgesData.map((e: any) => ({
        sha: e.sha,
        from_symbol: e.from_symbol,
        to_symbol: e.to_symbol,
        status: e.status
    }));
    const edgesTime = endTimer('Query Edges');
    console.log(`[UI-DATA] Edges queried (${(edgesTime / 1000).toFixed(2)}s): ${edgesData.length} edges`);

    // 5. Get files (what powers file list)
    console.log('[UI-DATA] Querying files table...');
    startTimer('Query Files');
    const filesQuery = db.prepare(`
        SELECT sha, path, status
        FROM files
        WHERE sha IN (${allShas.map(() => '?').join(',')})
    `);
    const filesData = filesQuery.all(...allShas);
    uiData.files = filesData.map((f: any) => ({
        sha: f.sha,
        path: f.path,
        status: f.status
    }));
    const filesTime = endTimer('Query Files');
    console.log(`[UI-DATA] Files queried (${(filesTime / 1000).toFixed(2)}s): ${filesData.length} files`);

    // 6. Get workspace files (what powers workspace file selection)
    console.log('[UI-DATA] Fetching workspace files...');
    startTimer('Fetch Workspace Files');
    try {
        const stagedFiles = await git.getStagedFiles();
        const unstagedFiles = await git.getUnstagedFiles();
        uiData.workspace_files = {
            staged: stagedFiles.map((f: any) => ({ path: f.path, status: f.status })),
            unstaged: unstagedFiles.map((f: any) => ({ path: f.path, status: f.status }))
        };
        const workspaceFilesTime = endTimer('Fetch Workspace Files');
        console.log(`[UI-DATA] Workspace files fetched (${(workspaceFilesTime / 1000).toFixed(2)}s): ${stagedFiles.length} staged, ${unstagedFiles.length} unstaged`);
    } catch (error) {
        console.warn('[UI-DATA] Failed to fetch workspace files:', error);
        endTimer('Fetch Workspace Files');
    }

    endTimer('Phase 4: UI Data Extraction');

    console.log('\n[UI-DATA] Summary:');
    console.log(`  - report: ${uiData.report ? 'Present' : 'None'}`);
    console.log(`  - commits_analysis entries: ${uiData.commits_analysis.length}`);
    console.log(`  - commits_metadata entries: ${uiData.commits_metadata.length}`);
    console.log(`  - symbols: ${uiData.symbols.length}`);
    console.log(`  - edges: ${uiData.edges.length}`);
    console.log(`  - files: ${uiData.files.length}`);
    console.log(`  - workspace staged files: ${uiData.workspace_files.staged.length}`);
    console.log(`  - workspace unstaged files: ${uiData.workspace_files.unstaged.length}`);
    console.log(`  - mismatches: ${uiData.mismatches.length}`);
    console.log(`  - issues: ${uiData.issues.length}`);

    // Save detailed UI data to file
    const outputPath = path.join(__dirname, 'test_output_ui_data.json');
    fs.writeFileSync(outputPath, JSON.stringify(uiData, null, 2));
    console.log(`\n[UI-DATA] Full UI data saved to: ${outputPath}`);

    console.log('\n' + '='.repeat(80));
    console.log('PHASE 5: Database Integrity Checks');
    console.log('='.repeat(80));
    startTimer('Phase 5: Database Integrity Checks');

    // Check for duplicates
    console.log('\n[DB-CHECK] Checking for duplicate entries...');
    startTimer('Duplicate Check');
    const allCheckedShas = [...commitShas, ...workspaceShas];
    let duplicatesFound = false;

    for (const sha of allCheckedShas) {
        const count = db.prepare('SELECT count(*) as count FROM commits_analysis WHERE sha = ?').get(sha);
        if (count.count > 1) {
            console.error(`  ✗ DUPLICATE: ${sha} has ${count.count} entries`);
            duplicatesFound = true;
        } else if (count.count === 1) {
            console.log(`  ✓ ${sha.substring(0, 40)}: 1 entry`);
        } else {
            console.warn(`  ⚠ ${sha.substring(0, 40)}: 0 entries (not stored?)`);
        }
    }
    const duplicateCheckTime = endTimer('Duplicate Check');
    console.log(`[DB-CHECK] Duplicate check completed (${(duplicateCheckTime / 1000).toFixed(2)}s)`);

    if (!duplicatesFound) {
        console.log('\n[DB-CHECK] ✓ No duplicates found');
    } else {
        console.error('\n[DB-CHECK] ✗ DUPLICATES DETECTED!');
    }

    // Check for mismatches
    if (uiData.mismatches.length > 0) {
        console.error('\n[MISMATCH] ✗ DATA MISMATCHES DETECTED:');
        uiData.mismatches.forEach((m: any) => {
            console.error(`  SHA: ${m.sha}`);
            m.mismatches.forEach((msg: string) => console.error(`    - ${msg}`));
        });
    } else {
        console.log('\n[MISMATCH] ✓ No data mismatches found');
    }

    // Check for issues
    if (uiData.issues.length > 0) {
        console.error('\n[ISSUES] ⚠ Issues detected:');
        uiData.issues.forEach((issue: string) => console.error(`  - ${issue}`));
    }

    // Check total analysis count
    startTimer('Total Analysis Count Check');
    const totalAnalysis = db.prepare('SELECT count(*) as count FROM commits_analysis').get();
    const totalAnalysisTime = endTimer('Total Analysis Count Check');
    console.log(`\n[DB-CHECK] Total analysis entries in database: ${totalAnalysis.count} (${(totalAnalysisTime / 1000).toFixed(2)}s)`);

    // Edge analysis
    console.log('\n[EDGE-ANALYSIS] Analyzing edge patterns...');
    startTimer('Edge Pattern Analysis');
    const edgeStats = analysisDetails
        .filter(d => d.facts) // Only commits with facts
        .map(d => ({
            sha: d.sha.substring(0, 8),
            added: d.facts.edgesAdded,
            removed: d.facts.edgesRemoved
        }));

    const uniqueEdgeCounts = new Set(edgeStats.map(s => s.added));
    if (uniqueEdgeCounts.size === 1 && edgeStats.length > 1) {
        console.warn(`  ⚠ All commits have identical edge count (${edgeStats[0].added}), possible duplication issue`);
    } else {
        console.log(`  ✓ Edge counts vary across commits (${uniqueEdgeCounts.size} unique values)`);
    }

    edgeStats.forEach((stat: any) => {
        console.log(`    ${stat.sha}: +${stat.added} -${stat.removed}`);
    });
    const edgeAnalysisTime = endTimer('Edge Pattern Analysis');
    console.log(`[EDGE-ANALYSIS] Edge pattern analysis completed (${(edgeAnalysisTime / 1000).toFixed(2)}s)`);

    endTimer('Phase 5: Database Integrity Checks');

    // PHASE 6: Enhanced Pipeline Features Validation
    console.log('\n' + '='.repeat(80));
    console.log('PHASE 6: Enhanced Pipeline Features Validation');
    console.log('='.repeat(80));
    startTimer('Phase 6: Enhanced Features');

    // 6.1 Validate Symbol History Storage
    console.log('\n[VALIDATION] Checking symbol history storage...');
    startTimer('Symbol History Validation');
    try {
        const symbolHistoryCount = db.prepare('SELECT count(*) as count FROM symbol_history').get();
        console.log(`[VALIDATION] ✓ Symbol history entries: ${symbolHistoryCount.count}`);

        if (symbolHistoryCount.count > 0) {
            const sampleHistory = db.prepare('SELECT * FROM symbol_history LIMIT 3').all();
            console.log('[VALIDATION] ✓ Sample symbol history:');
            sampleHistory.forEach((h: any, i: number) => {
                console.log(`  ${i + 1}. ${h.name} (${h.kind}) @ ${h.sha.substring(0, 8)} - ${h.change_type} (impact: ${h.impact_score})`);
            });
        } else {
            console.warn('[VALIDATION] ⚠ No symbol history found - this may be expected if no commits were analyzed');
        }
    } catch (error) {
        console.error('[VALIDATION] ✗ Symbol history validation failed:', error);
    }
    const symbolHistoryTime = endTimer('Symbol History Validation');
    console.log(`[VALIDATION] Symbol history validation completed (${(symbolHistoryTime / 1000).toFixed(2)}s)`);

    // 6.2 Test Enhanced Embedding Indexer
    console.log('\n[VALIDATION] Testing enhanced embedding indexer...');
    startTimer('Embedding Indexer Test');
    try {
        const embeddingIndexer = (pipeline as any).embeddingIndexer;
        if (embeddingIndexer) {
            // Test symbol history loading
            const symbolHistory = embeddingIndexer.loadSymbolHistory?.(selectedCommits[0]?.sha);
            if (symbolHistory) {
                console.log(`[VALIDATION] ✓ Symbol history loaded for ${selectedCommits[0]?.sha?.substring(0, 8)}: ${symbolHistory.length} entries`);
            } else {
                console.log('[VALIDATION] No symbol history to load (expected for first run)');
            }

            // Test metadata loading
            const commitMeta = embeddingIndexer.getCommitMetadata?.(selectedCommits[0]?.sha);
            if (commitMeta) {
                console.log(`[VALIDATION] ✓ Commit metadata loaded: ${commitMeta.author} - "${commitMeta.message?.substring(0, 50)}..."`);
            } else {
                console.warn('[VALIDATION] ⚠ No commit metadata found');
            }
        } else {
            console.warn('[VALIDATION] ⚠ Embedding indexer not accessible for testing');
        }
    } catch (error) {
        console.error('[VALIDATION] ✗ Embedding indexer test failed:', error);
    }
    const embeddingTime = endTimer('Embedding Indexer Test');
    console.log(`[VALIDATION] Embedding indexer test completed (${(embeddingTime / 1000).toFixed(2)}s)`);

    // 6.3 Test Moved Block Detection
    console.log('\n[VALIDATION] Testing moved block detection...');
    startTimer('Moved Block Detection Test');
    try {
        const movedBlockDetector = (pipeline as any).commitIndexer.movedBlockDetector;
        if (movedBlockDetector) {
            // Test moved block detection API
            const testSha = selectedCommits[0]?.sha;
            if (testSha) {
                const movedBlocks = await movedBlockDetector.getMovedBlocks(testSha);
                console.log(`[VALIDATION] ✓ Moved blocks query for ${testSha.substring(0, 8)}: ${movedBlocks.length} moved blocks found`);

                // Test file moves query
                const fileMoves = await movedBlockDetector.getFileMoves('src/analysis/hotspotDetector.ts');
                console.log(`[VALIDATION] ✓ File moves query: ${fileMoves.length} moves involving hotspotDetector.ts`);

                // Test symbol lineage
                const lineage = await movedBlockDetector.getSymbolLineage('test_symbol_id');
                console.log(`[VALIDATION] ✓ Symbol lineage query: ${lineage.length} lineage entries`);
            } else {
                console.warn('[VALIDATION] ⚠ No commits available for moved block testing');
            }
        } else {
            console.warn('[VALIDATION] ⚠ Moved block detector not accessible for testing');
        }
    } catch (error) {
        console.error('[VALIDATION] ✗ Moved block detection test failed:', error);
    }
    const movedBlockTime = endTimer('Moved Block Detection Test');
    console.log(`[VALIDATION] Moved block detection test completed (${(movedBlockTime / 1000).toFixed(2)}s)`);

    // 6.3 Validate Pipeline State Integration
    console.log('\n[VALIDATION] Testing pipeline state integration...');
    startTimer('Pipeline State Test');
    try {
        // Test full pipeline with history retrieval
        console.log('[VALIDATION] Running full pipeline analysis with history...');
        const fullResult = await pipeline.analyzeBundle(
            selectedCommits.slice(0, 2).map(c => c.sha),
            false, // no workspace
            (event) => {
                console.log(`[PIPELINE-EVENT] ${event.type}: ${(event as any).step?.label || 'unknown'}`);
                if (event.type === 'error') {
                    console.error(`[PIPELINE-EVENT] Error in ${(event as any).step?.id}: ${event.error}`);
                }
            }
        );

        if (fullResult.errors.length === 0) {
            console.log('[VALIDATION] ✓ Full pipeline completed successfully');
            console.log(`[VALIDATION] ✓ Bundle facts generated: ${!!fullResult.bundleFacts}`);
            console.log(`[VALIDATION] ✓ LLM outputs generated: ${!!fullResult.llmOutputs}`);
            console.log(`[VALIDATION] ✓ History retrieved: ${!!fullResult.history}`);

            if (fullResult.history) {
                const history = fullResult.history;
                console.log(`[VALIDATION] ✓ History details:`);
                console.log(`    - Similar commits: ${history.similarCommits?.length || 0}`);
                console.log(`    - Similar symbols: ${history.similarSymbols?.length || 0}`);
                console.log(`    - Related refactors: ${history.relatedRefactors?.length || 0}`);
                console.log(`    - Symbol evolutions: ${Object.keys(history.symbolEvolution || {}).length}`);
            }
        } else {
            console.error('[VALIDATION] ✗ Pipeline failed with errors:');
            fullResult.errors.forEach(err => {
                console.error(`    ${err.stepId}: ${err.error}`);
            });
        }
    } catch (error) {
        console.error('[VALIDATION] ✗ Pipeline state test failed:', error);
    }
    const pipelineStateTime = endTimer('Pipeline State Test');
    console.log(`[VALIDATION] Pipeline state test completed (${(pipelineStateTime / 1000).toFixed(2)}s)`);

    endTimer('Phase 6: Enhanced Features');

    // PHASE 7: Performance Benchmarks
    console.log('\n' + '='.repeat(80));
    console.log('PHASE 7: Performance Benchmarks');
    console.log('='.repeat(80));
    startTimer('Phase 7: Benchmarks');

    // 7.1 Commit Indexing Benchmark
    console.log('\n[BENCHMARK] Benchmarking commit indexing...');
    startTimer('Commit Indexing Benchmark');
    try {
        const benchmarkShas = selectedCommits.slice(0, Math.min(10, selectedCommits.length)).map(c => c.sha);
        console.log(`[BENCHMARK] Indexing ${benchmarkShas.length} commits...`);

        const indexStart = Date.now();
        await pipeline.indexCommits(benchmarkShas);
        const indexTime = Date.now() - indexStart;

        const avgTime = indexTime / benchmarkShas.length;
        console.log(`[BENCHMARK] ✓ Commit indexing: ${(indexTime / 1000).toFixed(2)}s total, ${(avgTime / 1000).toFixed(3)}s per commit`);

        // Test cache hit performance
        console.log('[BENCHMARK] Testing cache performance...');
        const cacheStart = Date.now();
        await pipeline.indexCommits(benchmarkShas); // Should hit cache
        const cacheTime = Date.now() - cacheStart;
        const cacheAvgTime = cacheTime / benchmarkShas.length;

        console.log(`[BENCHMARK] ✓ Cache performance: ${(cacheTime / 1000).toFixed(2)}s total, ${(cacheAvgTime / 1000).toFixed(3)}s per commit`);
        console.log(`[BENCHMARK] ✓ Cache speedup: ${(avgTime / cacheAvgTime).toFixed(1)}x faster`);
    } catch (error) {
        console.error('[BENCHMARK] ✗ Commit indexing benchmark failed:', error);
    }
    const commitBenchmarkTime = endTimer('Commit Indexing Benchmark');
    console.log(`[BENCHMARK] Commit indexing benchmark completed (${(commitBenchmarkTime / 1000).toFixed(2)}s)`);

    // 7.2 Workspace Analysis Benchmark
    console.log('\n[BENCHMARK] Benchmarking workspace analysis...');
    startTimer('Workspace Analysis Benchmark');
    try {
        const workspaceIndexer = pipeline.workspaceIndexer;

        // Test staged analysis
        const stagedStart = Date.now();
        const stagedResult = await workspaceIndexer.analyzeWorkspace('staged');
        const stagedTime = Date.now() - stagedStart;
        console.log(`[BENCHMARK] ✓ Staged analysis: ${(stagedTime / 1000).toFixed(2)}s`);

        // Test cache hit
        const stagedCacheStart = Date.now();
        const stagedCacheResult = await workspaceIndexer.analyzeWorkspace('staged');
        const stagedCacheTime = Date.now() - stagedCacheStart;
        console.log(`[BENCHMARK] ✓ Staged cache hit: ${(stagedCacheTime / 1000).toFixed(2)}s (${stagedTime > 0 ? (stagedTime / stagedCacheTime).toFixed(1) : 'N/A'}x speedup)`);

        // Test unstaged analysis
        const unstagedStart = Date.now();
        const unstagedResult = await workspaceIndexer.analyzeWorkspace('unstaged');
        const unstagedTime = Date.now() - unstagedStart;
        console.log(`[BENCHMARK] ✓ Unstaged analysis: ${(unstagedTime / 1000).toFixed(2)}s`);

    } catch (error) {
        console.error('[BENCHMARK] ✗ Workspace analysis benchmark failed:', error);
    }
    const workspaceBenchmarkTime = endTimer('Workspace Analysis Benchmark');
    console.log(`[BENCHMARK] Workspace analysis benchmark completed (${(workspaceBenchmarkTime / 1000).toFixed(2)}s)`);

    // 7.3 Full Pipeline Benchmark
    console.log('\n[BENCHMARK] Benchmarking full pipeline...');
    startTimer('Full Pipeline Benchmark');
    try {
        const pipelineShas = selectedCommits.slice(0, Math.min(5, selectedCommits.length)).map(c => c.sha);

        const fullStart = Date.now();
        const fullResult = await pipeline.analyzeBundle(pipelineShas, true); // include workspace
        const fullTime = Date.now() - fullStart;

        console.log(`[BENCHMARK] ✓ Full pipeline (${pipelineShas.length} commits + workspace): ${(fullTime / 1000).toFixed(2)}s`);
        console.log(`[BENCHMARK] ✓ Average time per commit: ${(fullTime / pipelineShas.length / 1000).toFixed(3)}s`);

        if (fullResult.errors.length === 0) {
            console.log('[BENCHMARK] ✓ Pipeline completed without errors');
        } else {
            console.warn(`[BENCHMARK] ⚠ Pipeline completed with ${fullResult.errors.length} errors`);
        }
    } catch (error) {
        console.error('[BENCHMARK] ✗ Full pipeline benchmark failed:', error);
    }
    const fullBenchmarkTime = endTimer('Full Pipeline Benchmark');
    console.log(`[BENCHMARK] Full pipeline benchmark completed (${(fullBenchmarkTime / 1000).toFixed(2)}s)`);

    endTimer('Phase 7: Benchmarks');

    printLogSummary();
    printLLMStats();

    console.log('\n' + '='.repeat(80));
    console.log('TEST COMPLETE');
    console.log('='.repeat(80));

    if (duplicatesFound || uiData.mismatches.length > 0) {
        console.error('\n⚠️  TEST REVEALED ISSUES - Check output above');
        closeLogFile();
        process.exit(1);
    }

    closeLogFile();
}

testPipeline().catch(err => {
    console.error('\n' + '='.repeat(80));
    console.error('PIPELINE TEST FAILED');
    console.error('='.repeat(80));
    console.error(err);
    closeLogFile();
    process.exit(1);
});
