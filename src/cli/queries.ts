import chalk from 'chalk';
import { getSearchIndex } from '../storage/index';
import { getDatabaseService } from '../services/databaseService';
import { getSymbolService } from '../services/symbolService';

export async function showCommit(sha: string): Promise<void> {
  const dbService = getDatabaseService();

  const commit = await dbService.getCommitMetadata(sha);

  if (!commit) {
    console.log(chalk.red(`Commit ${sha} not found in database. Run 'ct analyze' first.`));
    return;
  }

  console.log(chalk.blue(`Commit: ${commit.sha}`));
  console.log(chalk.gray(`Author: ${commit.author}`));
  console.log(chalk.gray(`Date: ${commit.date.toISOString()}`));
  console.log(chalk.yellow(`Message: ${commit.message}`));
  console.log('');

  // Get additional commit data using service
  const analysis = await dbService.getCommitAnalysis(sha);

  // Display summary
  if (analysis?.summary_md) {
    console.log(chalk.green('Summary:'));
    console.log(analysis.summary_md);
    console.log('');
  }

  // Display stats
  if (analysis) {
    console.log(chalk.cyan('Statistics:'));
    console.log(`Files changed: ${commit.filesChanged}`);
    console.log(`Symbols: +${analysis.symbols_added} -${analysis.symbols_removed} ~${analysis.symbols_modified}`);
    console.log(`Edges: +${analysis.edges_added} -${analysis.edges_removed}`);
  }

  // Display risks
  if (analysis?.risks) {
    const risks = JSON.parse(analysis.risks);
    if (risks.length > 0) {
      console.log('');
      console.log(chalk.red('Risk flags:'));
      risks.forEach((risk: string) => console.log(`• ${risk}`));
    }
  }

  // Display symbol changes using service
  const symbolService = getSymbolService();
  const symbols = await symbolService.getSymbolsByCommit(sha);
  if (symbols.length > 0) {
    console.log('');
    console.log(chalk.cyan('Symbol changes:'));

    // Note: SymbolService returns SymbolInfo, but we need change_type
    // For now, we'll need to query change_type separately or enhance the service
    // This is a temporary solution - the service should be enhanced to include change_type
    const { getDatabaseManager } = await import('../storage/database');
    await import('../storage/database').then(m => m.ensureDatabaseInitialized());
    const db = getDatabaseManager().getDatabase();
    const symbolsWithChange = db.prepare(`
      SELECT name, kind, change_type FROM symbols
      WHERE sha = ? ORDER BY kind, name
    `).all(sha) as any[];

    const added = symbolsWithChange.filter(s => s.change_type === 'added');
    const removed = symbolsWithChange.filter(s => s.change_type === 'removed');
    const modified = symbolsWithChange.filter(s => s.change_type !== 'added' && s.change_type !== 'removed');

    if (added.length > 0) {
      console.log(chalk.green('Added:'));
      added.forEach(s => console.log(`  + ${s.kind} ${s.name}`));
    }

    if (removed.length > 0) {
      console.log(chalk.red('Removed:'));
      removed.forEach(s => console.log(`  - ${s.kind} ${s.name}`));
    }

    if (modified.length > 0) {
      console.log(chalk.yellow('Modified:'));
      modified.forEach(s => console.log(`  ~ ${s.kind} ${s.name} (${s.change_type})`));
    }
  }
}

export async function searchSymbol(name: string): Promise<void> {
  const searchIndex = getSearchIndex();

  console.log(chalk.blue(`Searching for symbol: ${name}`));

  const results = await searchIndex.searchSymbolsByName(name, 20);

  if (results.length === 0) {
    console.log('No symbols found matching that name.');
    return;
  }

  console.log(chalk.cyan(`Found ${results.length} matches:`));
  console.log('');

  for (const result of results) {
    console.log(chalk.yellow(`${result.name}`));
    console.log(`  Path: ${result.path}`);
    console.log(`  Commit: ${result.sha}`);
    if (result.summary_snippet) {
      console.log(`  Context: ${result.summary_snippet}`);
    }
    console.log('');
  }
}

export async function showLastCommits(count: number): Promise<void> {
  const dbService = getDatabaseService();
  const commits = await dbService.getRecentCommits(count);

  if (commits.length === 0) {
    console.log(chalk.yellow('No analyzed commits found. Run "ct analyze" first.'));
    return;
  }

  console.log(chalk.blue(`Last ${commits.length} analyzed commits:`));
  console.log('');

  for (const commit of commits) {
    console.log(chalk.green(commit.sha.substring(0, 8)));
    console.log(`  ${commit.message.split('\n')[0]}`);
    console.log(chalk.gray(`  ${commit.author} on ${commit.date.toISOString()}`));
    console.log(`  ${commit.changes} files`);
    console.log('');
  }
}
