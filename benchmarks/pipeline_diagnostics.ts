import * as fs from 'fs';
import * as path from 'path';

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
import { runPipeline } from '../src/analysis/runner/pipelineRunner';
import { PipelineStep } from '../src/analysis/runner/pipelineTypes';

import { createIndexCommitsStep } from '../src/analysis/runner/steps/indexCommitsStep';
import { createScopeStep } from '../src/analysis/runner/steps/scopeStep';
import { createIntendedStep } from '../src/analysis/runner/steps/intendedStep';
import { createWorkingStep } from '../src/analysis/runner/steps/workingStep';
import { createDriftStep } from '../src/analysis/runner/steps/driftStep';
import { createLegacyStep } from '../src/analysis/runner/steps/legacyStep';
import { createHotspotStep } from '../src/analysis/runner/steps/hotspotStep';
import { createWorkspaceOverlayStep } from '../src/analysis/runner/steps/workspaceStep';
import { createEmbeddingStep } from '../src/analysis/runner/steps/embeddingStep';
import { createBundleFactsStep } from '../src/analysis/runner/steps/bundleFactsStep';
import { createHistoryRetrievalStep } from '../src/analysis/runner/steps/historyStep';
import { createStoryStep } from '../src/analysis/runner/steps/storyStep';

import {
  applySnapshotToState,
  loadStepSnapshot,
  saveStepSnapshot,
  serializeStepState,
  stableHash
} from './mocks/framework/snapshot';

type CliOptions = {
  freeze: boolean;
  replayStep?: string;
  replayFrom?: string;
  snapshotDir: string;
  focusSteps?: Set<string>;
  commitCount: number;
  includeWorkspace: boolean;
  resetDb: boolean;
};

function parseArgs(args: string[]): CliOptions {
  const flag = (name: string) => args.includes(name);
  const getArg = (name: string, defaultValue = '') => {
    const prefix = `${name}=`;
    const found = args.find(a => a.startsWith(prefix));
    return found ? found.substring(prefix.length) : defaultValue;
  };

  const focusArg = getArg('--focus');
  return {
    freeze: flag('--freeze'),
    replayStep: getArg('--replay') || undefined,
    replayFrom: getArg('--replay-from') || undefined,
    snapshotDir: getArg('--out', path.join(process.cwd(), 'benchmarks', 'fixtures', 'pipeline_frozen')),
    focusSteps: focusArg ? new Set(focusArg.split(',').map(s => s.trim()).filter(Boolean)) : undefined,
    commitCount: parseInt(getArg('--commits', '6'), 10) || 6,
    includeWorkspace: !flag('--no-workspace'),
    resetDb: flag('--reset-db')
  };
}

function summarizeStep(stepId: string, data: any): string {
  if (!data) return '';
  switch (stepId) {
    case 'scope':
      return `files=${(data.commitFiles || []).length}, working=${(data.workingChanged || []).length}, blast=${(data.blastRadius || []).length}`;
    case 'intended':
      return `symbols=${data.length}, present=${data.filter((i: any) => i.expect === 'present').length}, absent=${data.filter((i: any) => i.expect === 'absent').length}, renamed=${data.filter((i: any) => i.isRenamed).length}`;
    case 'working':
      return `symbols=${(data.symbols || []).length}, edges=${(data.edges || []).length}, paths=${(data.analyzedPaths || []).length}`;
    case 'drift':
      return `missing=${data.missing_symbols?.length || 0}, zombies=${data.zombie_symbols?.length || 0}, divergent=${data.divergent_symbols?.length || 0}`;
    case 'legacy':
      return `dead=${data.dead?.length || 0}, legacyUsed=${data.legacyUsed?.length || 0}, leftovers=${data.replacedLeftovers?.length || 0}`;
    case 'workspace_overlay':
      return `files=${data.filesChanged || 0}, symbols=${(data.symbolsAdded || 0) + (data.symbolsModified || 0) + (data.symbolsRemoved || 0)}`;
    case 'index_commits':
      return `commits=${data.length || 0}`;
    case 'bundle_facts':
      return `intended.present=${data.intended?.present || 0}, absent=${data.intended?.absent || 0}, renamed=${data.intended?.renamed || 0}`;
    default:
      return '';
  }
}

function deleteDatabaseIfRequested(reset: boolean) {
  if (!reset) return;
  try {
    const config = require('../src/utils/config');
    const gitRoot = config.getGitRoot?.();
    if (!gitRoot) return;
    const dbPath = path.join(gitRoot, '.git', 'commit-tracker', 'commit_tracker.db');
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      console.log(`🧹 Deleted existing database at ${dbPath}`);
    }
  } catch (error: any) {
    console.warn(`⚠ Could not delete database: ${error?.message || error}`);
  }
}

function buildSteps(workspaceIndexer: WorkspaceIndexer, commitIndexer: CommitIndexer, embeddingIndexer: EmbeddingIndexer, storyEngine: BundleStoryEngine): PipelineStep[] {
  return [
    createIndexCommitsStep(commitIndexer, 2),
    createScopeStep(),
    createIntendedStep(),
    createWorkingStep(),
    createDriftStep(),
    createLegacyStep(),
    createHotspotStep(),
    createWorkspaceOverlayStep(workspaceIndexer),
    createEmbeddingStep(embeddingIndexer),
    createBundleFactsStep(),
    createHistoryRetrievalStep(storyEngine),
    createStoryStep(storyEngine)
  ];
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  console.log('🔬 Pipeline diagnostics');
  console.log('='.repeat(40));
  console.log(`Freeze: ${opts.freeze ? 'on' : 'off'}, Replay: ${opts.replayStep || opts.replayFrom || 'none'}, Snapshot dir: ${opts.snapshotDir}`);

  deleteDatabaseIfRequested(opts.resetDb);
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
  const llmAnalyst = new LlmAnalyst();
  const storyEngine = new BundleStoryEngine(llmAnalyst);

  const commitIndexer = new CommitIndexer(
    db,
    git,
    snapshotManager,
    structuralDiffManager,
    riskDetector,
    dependencyExtractor,
    hotspotDetector,
    movedBlockDetector
  );

  const workspaceIndexer = new WorkspaceIndexer(
    db,
    git,
    snapshotManager,
    structuralDiffManager
  );

  const embeddingIndexer = new EmbeddingIndexer(dbManager);
  const steps = buildSteps(workspaceIndexer, commitIndexer, embeddingIndexer, storyEngine);

  const commits = git.getRecentCommits(opts.commitCount);
  if (!commits.length) {
    throw new Error('No commits available to analyze');
  }

  const initialState: any = {
    selectedCommitShas: commits.map(c => c.sha),
    includeWorkspace: opts.includeWorkspace
  };

  const replayAnchor = opts.replayFrom || opts.replayStep || '';
  let replayIndex = replayAnchor ? steps.findIndex(s => s.id === replayAnchor) : -1;
  if (replayAnchor && replayIndex === -1) {
    console.warn(`⚠ Replay target '${replayAnchor}' not found; running full pipeline`);
  } else if (replayIndex >= 0) {
    const snap = loadStepSnapshot(replayAnchor, opts.snapshotDir);
    if (!snap) {
      throw new Error(`Snapshot for '${replayAnchor}' not found at ${opts.snapshotDir}`);
    }
    applySnapshotToState(initialState, snap as any);
    for (let i = 0; i < replayIndex; i++) {
      const original = steps[i];
      steps[i] = {
        ...original,
        run: async () => {
          console.log(`⏭  Skipping ${original.id} (replayed state)`);
        }
      };
    }
  }

  const diagnostics: any = {
    startTime: new Date().toISOString(),
    steps: [],
    errors: []
  };

  const onEvent = (event: any) => {
    if (event.type === 'start') {
      console.log(`▶️  ${event.step.label}`);
    } else if (event.type === 'complete') {
      const stepId = event.step.id;
      if (opts.focusSteps && !opts.focusSteps.has(stepId)) {
        console.log(`✅ ${event.step.label} (not focused)`);
        return;
      }

      const data = serializeStepState(stepId, event.state);
      const hash = data ? stableHash(data) : 'n/a';
      const baseline = loadStepSnapshot(stepId, opts.snapshotDir);
      const summary = summarizeStep(stepId, data);

      let note = '';
      if (baseline && baseline.hash !== hash) {
        note = `Δ baseline (expected ${baseline.hash.substring(0, 8)})`;
      } else if (baseline) {
        note = 'matches baseline';
      } else if (!opts.freeze) {
        note = 'no baseline';
      }

      console.log(`✅ ${event.step.label} :: hash=${hash.toString().substring(0, 8)} ${note} ${summary ? `:: ${summary}` : ''}`);

      if (opts.freeze && data) {
        saveStepSnapshot(stepId, event.state, opts.snapshotDir);
      }

      diagnostics.steps.push({
        stepId,
        hash,
        note,
        summary
      });
    } else if (event.type === 'error') {
      console.error(`❌ ${event.step.label}: ${event.error}`);
      diagnostics.errors.push({ stepId: event.step.id, error: String(event.error) });
    }
  };

  const startTime = Date.now();
  const finalState = await runPipeline(steps, initialState, onEvent);
  const totalTime = Date.now() - startTime;

  diagnostics.endTime = new Date().toISOString();
  diagnostics.totalTimeMs = totalTime;
  diagnostics.completedSteps = Array.from(finalState.completedSteps);
  diagnostics.errorCount = finalState.errors.length;

  const outDir = path.join(process.cwd(), 'benchmarks', 'output');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const diagPath = path.join(outDir, 'pipeline_diagnostics.json');
  fs.writeFileSync(diagPath, JSON.stringify(diagnostics, null, 2));

  console.log('\n📊 Summary');
  console.log('='.repeat(30));
  console.log(`Time: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`Steps completed: ${finalState.completedSteps.size}/${steps.length}`);
  console.log(`Errors: ${finalState.errors.length}`);
  console.log(`Diagnostics saved to ${diagPath}`);

  if (finalState.errors.length > 0) {
    finalState.errors.forEach(err => console.error(`[${err.stepId}] ${err.error}`));
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error('💥 Pipeline diagnostics failed:', err);
  process.exitCode = 1;
});
