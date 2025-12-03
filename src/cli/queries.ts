import chalk from 'chalk';
import { getDatabaseService } from '../services/databaseService';
import { getSymbolService } from '../services/symbolService';
import { getSearchIndex } from '../storage/index';
import { prepare } from '../storage/statement-wrapper';
import { logInfo } from '../utils/logger';

export async function showCommit(sha: string): Promise<void> {
  const dbService = getDatabaseService();

  const commit = await dbService.getCommitMetadata(sha);

  if (!commit) {
    logInfo(chalk.red(`Commit ${sha} not found in database. Run 'ct analyze' first.`));
    return;
  }

  logInfo(chalk.blue(`Commit: ${commit.sha}`));
  logInfo(chalk.gray(`Author: ${commit.author}`));
  logInfo(chalk.gray(`Date: ${commit.date.toISOString()}`));
  logInfo(chalk.yellow(`Message: ${commit.message}`));
  logInfo('');

  const analysis = await dbService.getCommitAnalysis(sha);

  if (analysis?.summary_md) {
    logInfo(chalk.green('Summary:'));
    logInfo(analysis.summary_md);
    logInfo('');
  }

  if (analysis) {
    logInfo(chalk.cyan('Statistics:'));
    logInfo(`Files changed: ${commit.filesChanged}`);
    logInfo(
      `Symbols: +${analysis.symbols_added} -${analysis.symbols_removed} ~${analysis.symbols_modified}`
    );
    logInfo(`Edges: +${analysis.edges_added} -${analysis.edges_removed}`);
  }

  if (analysis?.risks) {
    const risks = JSON.parse(analysis.risks);
    if (risks.length > 0) {
      logInfo('');
      logInfo(chalk.red('Risk flags:'));
      risks.forEach((risk: string) => logInfo(`• ${risk}`));
    }
  }

  const symbolService = getSymbolService();
  const symbols = await symbolService.getSymbolsByCommit(sha);
  if (symbols.length > 0) {
    logInfo('');
    logInfo(chalk.cyan('Symbol changes:'));

    await import('../storage/database').then(m => m.ensureDatabaseInitialized());
    const symbolsWithChange = prepare(`
      SELECT name, kind, change_type FROM symbols
      WHERE sha = ? ORDER BY kind, name
    `).all(sha) as any[];

    const added = symbolsWithChange.filter(s => s.change_type === 'added');
    const removed = symbolsWithChange.filter(s => s.change_type === 'removed');
    const modified = symbolsWithChange.filter(
      s => s.change_type !== 'added' && s.change_type !== 'removed'
    );

    if (added.length > 0) {
      logInfo(chalk.green('Added:'));
      added.forEach(s => logInfo(`  + ${s.kind} ${s.name}`));
    }

    if (removed.length > 0) {
      logInfo(chalk.red('Removed:'));
      removed.forEach(s => logInfo(`  - ${s.kind} ${s.name}`));
    }

    if (modified.length > 0) {
      logInfo(chalk.yellow('Modified:'));
      modified.forEach(s => logInfo(`  ~ ${s.kind} ${s.name} (${s.change_type})`));
    }
  }
}

export async function searchSymbol(name: string): Promise<void> {
  const searchIndex = getSearchIndex();

  logInfo(chalk.blue(`Searching for symbol: ${name}`));

  const results = await searchIndex.searchSymbolsByName(name, 20);

  if (results.length === 0) {
    logInfo('No symbols found matching that name.');
    return;
  }

  logInfo(chalk.cyan(`Found ${results.length} matches:`));
  logInfo('');

  for (const result of results) {
    logInfo(chalk.yellow(`${result.name}`));
    logInfo(`  Path: ${result.path}`);
    logInfo(`  Commit: ${result.sha}`);
    if (result.summary_snippet) {
      logInfo(`  Context: ${result.summary_snippet}`);
    }
    logInfo('');
  }
}

export async function showLastCommits(count: number): Promise<void> {
  const dbService = getDatabaseService();
  const commits = await dbService.getRecentCommits(count);

  if (commits.length === 0) {
    logInfo(chalk.yellow('No analyzed commits found. Run "ct analyze" first.'));
    return;
  }

  logInfo(chalk.blue(`Last ${commits.length} analyzed commits:`));
  logInfo('');

  for (const commit of commits) {
    logInfo(chalk.green(commit.sha.substring(0, 8)));
    logInfo(`  ${commit.message.split('\n')[0]}`);
    logInfo(chalk.gray(`  ${commit.author} on ${commit.date.toISOString()}`));
    logInfo(`  ${commit.changes} files`);
    logInfo('');
  }
}
