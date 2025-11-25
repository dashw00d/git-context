#!/usr/bin/env node

import { Command } from 'commander';
// Analysis functions moved to AnalysisPipeline service
import { showCommit, searchSymbol, showLastCommits } from './queries';
import { installHooks } from './hooks';
import chalk from 'chalk';

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
    console.log(chalk.blue(`Analyzing last ${count} commits...`));

    try {
      const { getAnalysisPipeline } = await import('../analysis/pipeline');
      const pipeline = await getAnalysisPipeline();

      // Load metadata first
      const commits = await pipeline.loadRecentCommits(count);
      const shas = commits.map(c => c.sha);

      // Then analyze
      await pipeline.analyzeCommits(shas);

      console.log(chalk.green('Analysis complete!'));
    } catch (error) {
      console.error(chalk.red(`Analysis failed: ${error}`));
      process.exit(1);
    }
  });

program
  .command('staged')
  .description('Analyze staged changes')
  .action(async () => {
    console.log(chalk.blue('Analyzing staged changes...'));

    try {
      const { getAnalysisPipeline } = await import('../analysis/pipeline');
      const pipeline = await getAnalysisPipeline();
      await pipeline.analyzeStagedChanges();

      console.log(chalk.green('Staged analysis complete!'));
    } catch (error) {
      console.error(chalk.red(`Staged analysis failed: ${error}`));
      process.exit(1);
    }
  });

program
  .command('analyze-commit <sha>')
  .description('Analyze a specific commit')
  .action(async (sha) => {
    console.log(chalk.blue(`Analyzing commit ${sha}...`));

    try {
      const { getAnalysisPipeline } = await import('../analysis/pipeline');
      const pipeline = await getAnalysisPipeline();

      // Load metadata first, then analyze
      await pipeline.loadCommitMetadata(sha);
      await pipeline.analyzeCommit(sha);

      console.log(chalk.green(`Commit ${sha} analysis complete!`));
    } catch (error) {
      console.error(chalk.red(`Commit analysis failed: ${error}`));
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
      console.error(chalk.red(`Failed to show commit: ${error}`));
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
      console.error(chalk.red(`Symbol search failed: ${error}`));
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
      console.error(chalk.red(`Failed to show commits: ${error}`));
      process.exit(1);
    }
  });

program
  .command('install-hooks')
  .description('Install git hooks')
  .action(async () => {
    console.log(chalk.blue('Installing git hooks...'));

    try {
      await installHooks();
      console.log(chalk.green('Hooks installed successfully!'));
    } catch (error) {
      console.error(chalk.red(`Failed to install hooks: ${error}`));
      process.exit(1);
    }
  });

program.parse();
