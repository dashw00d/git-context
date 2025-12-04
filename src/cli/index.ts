#!/usr/bin/env node

import * as path from 'path';
import chalk from 'chalk';
import { Command } from 'commander';
import moduleAlias from 'module-alias';
import { prepare } from '../storage/statement-wrapper';
import { logError, logInfo } from '../utils/logger';
import { installHooks } from './hooks';
import { searchSymbol, showCommit, showLastCommits } from './queries';
moduleAlias.addAlias('vscode', path.join(__dirname, 'vscode-mock'));
const program = new Command();
program.name('ct').description('Commit Tracker CLI').version('0.1.0');

program
  .command('analyze')
  .description('Analyze commits')
  .option('-c, --count <number>', 'number of commits to analyze', '5')
  .action(async options => {
    const count = parseInt(options.count);
    logInfo(chalk.blue(`Analyzing last ${count} commits...`));

    try {
      const { getRefactorPipeline } = await import('../services/pipelineFactory');
      const { GitOperations } = await import('../analysis/git');
      const { BranchManager } = await import('../storage/branchManager');
      const { getDatabaseManager, ensureDatabaseInitialized } = await import('../storage/database');

      await ensureDatabaseInitialized();
      const refactorPipeline = await getRefactorPipeline();
      const git = new GitOperations();
      const db = getDatabaseManager().getDatabase();
      const branchManager = new BranchManager(db);

      const recentCommits = await git.getRecentCommits(count);
      const shas = recentCommits.map(c => c.sha);

      const branch = await git.getCurrentBranch();
      if (branch && recentCommits.length > 0) {
        for (const commit of recentCommits) {
          branchManager.recordCommit(commit.sha, branch);
        }
        branchManager.updateBranchHead(branch, recentCommits[0].sha);
      }

      await refactorPipeline.analyzeBundle(shas, false, undefined);

      logInfo(chalk.green('Analysis complete!'));
    } catch (error) {
      logError(chalk.red(`Analysis failed: ${error}`));
      process.exit(1);
    }
  });

program
  .command('staged')
  .description('Analyze staged changes')
  .action(async () => {
    logInfo(chalk.blue('Analyzing staged changes...'));

    try {
      const { getRefactorPipeline } = await import('../services/pipelineFactory');
      const { ensureDatabaseInitialized } = await import('../storage/database');

      await ensureDatabaseInitialized();
      const refactorPipeline = await getRefactorPipeline();

      await refactorPipeline.analyzeBundle([], true, new Set(['staged', 'unstaged']));

      logInfo(chalk.green('Staged analysis complete!'));
    } catch (error) {
      logError(chalk.red(`Staged analysis failed: ${error}`));
      process.exit(1);
    }
  });

program
  .command('analyze-commit <sha>')
  .description('Analyze a specific commit')
  .action(async sha => {
    logInfo(chalk.blue(`Analyzing commit ${sha}...`));

    try {
      const { getRefactorPipeline } = await import('../services/pipelineFactory');
      const { ensureDatabaseInitialized } = await import('../storage/database');

      await ensureDatabaseInitialized();
      const refactorPipeline = await getRefactorPipeline();

      await refactorPipeline.indexCommits([sha]);
      await refactorPipeline.analyzeBundle([sha], false, undefined);

      logInfo(chalk.green(`Commit ${sha} analysis complete!`));
    } catch (error) {
      logError(chalk.red(`Commit analysis failed: ${error}`));
      process.exit(1);
    }
  });

program
  .command('show <sha>')
  .description('Show commit analysis')
  .action(async sha => {
    try {
      await showCommit(sha);
    } catch (error) {
      logError(chalk.red(`Failed to show commit: ${error}`));
      process.exit(1);
    }
  });

program
  .command('symbol <name>')
  .description('Search symbol history')
  .action(async name => {
    try {
      await searchSymbol(name);
    } catch (error) {
      logError(chalk.red(`Symbol search failed: ${error}`));
      process.exit(1);
    }
  });

program
  .command('last [count]')
  .description('Show last analyzed commits')
  .option('-n, --count <number>', 'number of commits to show', '5')
  .action(async options => {
    try {
      await showLastCommits(parseInt(options.count));
    } catch (error) {
      logError(chalk.red(`Failed to show commits: ${error}`));
      process.exit(1);
    }
  });

program
  .command('index')
  .description('Index commits into database')
  .option('-r, --reindex', 'force reindex all commits or legacy modules')
  .option('-m, --modules <list>', 'comma-separated list of modules to reindex (e.g., "edges")')
  .action(async options => {
    logInfo(chalk.blue('Indexing commits...'));

    try {
      const { CommitIndexer } = await import('../analysis/commitIndexer');
      const { GitOperations } = await import('../analysis/git');
      const { SnapshotManager } = await import('../analysis/snapshotManager');
      const { StructuralDiffManager } = await import('../analysis/structuralDiffManager');
      const { RiskDetector } = await import('../analysis/heuristics');
      const { DependencyExtractor } = await import('../analysis/dependencies');
      const { HotspotDetectorV2 } = await import('../analysis/hotspotDetector');
      const { MovedBlockDetectorV2 } = await import('../analysis/movedBlockDetector');
      const { getDatabaseManager, ensureDatabaseInitialized } = await import('../storage/database');

      await ensureDatabaseInitialized();
      const db = getDatabaseManager().getDatabase();

      const git = new GitOperations();
      const { SymbolExtractor } = await import('../analysis/symbols');
      const symbolExtractor = new SymbolExtractor(git);
      const dependencyExtractor = new DependencyExtractor();
      const snapshotManager = new SnapshotManager(db, symbolExtractor, dependencyExtractor);
      const structuralDiffManager = new StructuralDiffManager(db);
      const riskDetector = new RiskDetector();
      const hotspotDetector = new HotspotDetectorV2();
      const movedBlockDetector = new MovedBlockDetectorV2();

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

      let shas: string[] = [];

      if (options.reindex) {
        const allShas = prepare('SELECT sha FROM commits_metadata')
          .all()
          .map((r: any) => r.sha);
        shas = allShas;
        logInfo(chalk.blue(`Reindexing ${shas.length} commits...`));
      } else if (options.modules) {
        const modules = options.modules.split(',').map((m: string) => m.trim());
        const modulePattern = modules
          .map((m: string) => `%legacy_${m}%`)
          .join(' OR analysis_version LIKE ');
        const stmt = prepare(
          `SELECT sha FROM commits_analysis WHERE analysis_version LIKE ${modulePattern}`
        );
        shas = stmt.all().map((r: any) => r.sha);
        logInfo(
          chalk.blue(`Reindexing ${shas.length} commits for modules: ${modules.join(', ')}...`)
        );
      } else {
        const recentCommits = await git.getRecentCommits(10);
        shas = recentCommits.map(c => c.sha);
        logInfo(chalk.blue(`Indexing ${shas.length} recent commits...`));
      }

      await commitIndexer.ensureCommitsIndexed(shas, 8, {
        force: options.reindex,
        modules: options.modules
          ? options.modules.split(',').map((m: string) => m.trim())
          : undefined,
      });

      logInfo(chalk.green('Indexing complete!'));
    } catch (error) {
      logError(chalk.red(`Indexing failed: ${error}`));
      process.exit(1);
    }
  });

program
  .command('install-hooks')
  .description('Install git hooks')
  .action(async () => {
    logInfo(chalk.blue('Installing git hooks...'));

    try {
      await installHooks();
      logInfo(chalk.green('Hooks installed successfully!'));
    } catch (error) {
      logError(chalk.red(`Failed to install hooks: ${error}`));
      process.exit(1);
    }
  });

program
  .command('compare <base> <target>')
  .description('Compare two branches or SHAs and generate a report')
  .option('--json', 'Output JSON report only (no formatted output)')
  .action(async (base, target, options) => {
    logInfo(chalk.blue(`Comparing ${base} -> ${target}...`));

    try {
      const { getRefactorPipeline } = await import('../services/pipelineFactory');
      const { GitOperations } = await import('../analysis/git');
      const { ensureDatabaseInitialized } = await import('../storage/database');
      const { formatAttentionReport } = await import('./reportFormatter');
      const fs = await import('fs');

      await ensureDatabaseInitialized();
      const refactorPipeline = await getRefactorPipeline();
      const git = new GitOperations();

      // Get commits in range base..target
      const range = `${base}..${target}`;
      const commits = await git.getCommitsInRange(range);
      const shas = commits.map(c => c.sha);

      if (shas.length === 0) {
        logInfo(chalk.yellow(`No commits found in range ${range}`));
        return;
      }

      logInfo(chalk.blue(`Found ${shas.length} commits to analyze.`));

      // Run pipeline on these commits
      // We use analyzeBundle with the SHAs.
      // This will index them if needed and generate facts.
      logInfo(chalk.blue('Starting pipeline analysis...'));
      const state = await refactorPipeline.analyzeBundle(shas, false, undefined, event => {
        if (event.type === 'start') {
          logInfo(chalk.gray(`[Step] Starting ${event.step.label}...`));
        } else if (event.type === 'complete') {
          logInfo(chalk.gray(`[Step] Completed ${event.step.label} in ${event.duration}ms`));
        } else if (event.type === 'error') {
          logError(chalk.red(`[Step] Error in ${event.step.label}: ${event.error}`));
        }
      });
      logInfo(chalk.blue('Pipeline analysis returned.'));

      // Generate JSON report
      const report = {
        base,
        target,
        commits: shas.length,
        facts: state.bundleFacts,
        summary: (state as any).bundleSummary,
      };

      const reportPath = 'comparison_report.json';
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

      if (options.json) {
        logInfo(chalk.green(`Report written to ${reportPath}`));
      } else {
        // Generate markdown report with code snippets and context
        const { generateMarkdownReport } = await import('./markdownReportGenerator');
        const markdownReport = generateMarkdownReport(state);

        // Write markdown to file
        const markdownPath = 'ATTENTION_REPORT.md';
        fs.writeFileSync(markdownPath, markdownReport);

        // Also show terminal summary
        const attentionReport = formatAttentionReport(state);
        process.stdout.write(attentionReport + '\n');

        logInfo(chalk.green(`📄 Markdown report: ${markdownPath}`));
        logInfo(chalk.dim(`JSON report: ${reportPath}`));
      }
    } catch (error: any) {
      logError(chalk.red(`Comparison failed: ${error.stack || error}`));
      process.exit(1);
    }
  });

program.parse();
