#!/usr/bin/env node

import { Command } from 'commander';
// Analysis functions moved to RefactorPipeline service
import { showCommit, searchSymbol, showLastCommits } from './queries';
import { installHooks } from './hooks';
import chalk from 'chalk';
import { logInfo, logError } from '../utils/logger';

const program = new Command();

program
  .name('ct')
  .description('Commit Tracker CLI')
  .version('0.1.0');

program
  .command('analyze')
  .description('Analyze commits')
  .option('-c, --count <number>', 'number of commits to analyze', '5')
  .action(async (options) => {
    const count = parseInt(options.count);
    logInfo(chalk.blue(`Analyzing last ${count} commits...`));

    try {
      const { getRefactorPipeline } = await import('../extension');
      const { GitOperations } = await import('../analysis/git');
      const { BranchManager } = await import('../storage/branchManager');
      const { getDatabaseManager } = await import('../storage/database');

      const refactorPipeline = await getRefactorPipeline();
      const git = new GitOperations();
      const db = getDatabaseManager().getDatabase();
      const branchManager = new BranchManager(db);

      // Load recent commits directly
      const recentCommits = git.getRecentCommits(count);
      const shas = recentCommits.map(c => c.sha);

      // Record commits in branch manager
      const branch = git.getCurrentBranch();
      if (branch && recentCommits.length > 0) {
        for (const commit of recentCommits) {
          branchManager.recordCommit(commit.sha, branch);
        }
        branchManager.updateBranchHead(branch, recentCommits[0].sha);
      }

      // Then analyze
      await refactorPipeline.analyzeBundle(shas);

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
      const { getRefactorPipeline } = await import('../extension');
      const refactorPipeline = await getRefactorPipeline();

      // Analyze with workspace enabled to include staged changes
      await refactorPipeline.analyzeBundle([], true);

      logInfo(chalk.green('Staged analysis complete!'));
    } catch (error) {
      logError(chalk.red(`Staged analysis failed: ${error}`));
      process.exit(1);
    }
  });

program
  .command('analyze-commit <sha>')
  .description('Analyze a specific commit')
  .action(async (sha) => {
    logInfo(chalk.blue(`Analyzing commit ${sha}...`));

    try {
      const { getRefactorPipeline } = await import('../extension');
      const refactorPipeline = await getRefactorPipeline();

      // Index and analyze the specific commit
      await refactorPipeline.indexCommits([sha]);
      await refactorPipeline.analyzeBundle([sha]);

      logInfo(chalk.green(`Commit ${sha} analysis complete!`));
    } catch (error) {
      logError(chalk.red(`Commit analysis failed: ${error}`));
      process.exit(1);
    }
  });

program
  .command('show <sha>')
  .description('Show commit analysis')
  .action(async (sha) => {
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
  .action(async (name) => {
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
  .action(async (options) => {
    try {
      await showLastCommits(parseInt(options.count));
    } catch (error) {
      logError(chalk.red(`Failed to show commits: ${error}`));
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

program.parse();
