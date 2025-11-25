import chalk from 'chalk';
import { getDatabaseManager, ensureDatabaseInitialized } from '../storage/database';
import { getSearchIndex } from '../storage/index';

export async function showCommit(sha: string): Promise<void> {
  await ensureDatabaseInitialized();
  const db = getDatabaseManager().getDatabase();

  // Get commit data
  const commitStmt = db.prepare(`
    SELECT * FROM commits WHERE sha = ?
  `);

  const commit = commitStmt.get(sha) as any;

  if (!commit) {
    console.log(chalk.red(`Commit ${sha} not found in database. Run 'ct analyze' first.`));
    return;
  }

  console.log(chalk.blue(`Commit: ${commit.sha}`));
  console.log(chalk.gray(`Author: ${commit.author}`));
  console.log(chalk.gray(`Date: ${commit.date}`));
  console.log(chalk.yellow(`Message: ${commit.message}`));
  console.log('');

  // Display summary
  if (commit.summary_md) {
    console.log(chalk.green('Summary:'));
    console.log(commit.summary_md);
    console.log('');
  }

  // Display stats
  console.log(chalk.cyan('Statistics:'));
  console.log(`Files changed: ${commit.files_changed}`);
  console.log(`Symbols: +${commit.symbols_added} -${commit.symbols_removed} ~${commit.symbols_modified}`);
  console.log(`Edges: +${commit.edges_added} -${commit.edges_removed}`);

  // Display risks
  if (commit.risks) {
    const risks = JSON.parse(commit.risks);
    if (risks.length > 0) {
      console.log('');
      console.log(chalk.red('Risk flags:'));
      risks.forEach((risk: string) => console.log(`• ${risk}`));
    }
  }

  // Display symbol changes
  const symbolsStmt = db.prepare(`
    SELECT name, kind, change_type FROM symbols
    WHERE sha = ? ORDER BY kind, name
  `);

  const symbols = symbolsStmt.all(sha) as any[];
  if (symbols.length > 0) {
    console.log('');
    console.log(chalk.cyan('Symbol changes:'));

    const added = symbols.filter(s => s.change_type === 'added');
    const removed = symbols.filter(s => s.change_type === 'removed');
    const modified = symbols.filter(s => s.change_type !== 'added' && s.change_type !== 'removed');

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
  await ensureDatabaseInitialized();
  const db = getDatabaseManager().getDatabase();

  const commitsStmt = db.prepare(`
    SELECT sha, author, date, message, files_changed, symbols_added, symbols_modified, symbols_removed
    FROM commits
    ORDER BY date DESC
    LIMIT ?
  `);

  const commits = commitsStmt.all(count) as any[];

  if (commits.length === 0) {
    console.log(chalk.yellow('No analyzed commits found. Run "ct analyze" first.'));
    return;
  }

  console.log(chalk.blue(`Last ${commits.length} analyzed commits:`));
  console.log('');

  for (const commit of commits) {
    console.log(chalk.green(commit.sha.substring(0, 8)));
    console.log(`  ${commit.message.split('\n')[0]}`);
    console.log(chalk.gray(`  ${commit.author} on ${commit.date}`));
    console.log(`  ${commit.files_changed} files, +${commit.symbols_added} -${commit.symbols_removed} ~${commit.symbols_modified} symbols`);
    console.log('');
  }
}
