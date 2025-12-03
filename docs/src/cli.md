# CLI Module (`cli/`)

## Purpose

The `cli/` module provides a command-line interface (`ct` command) for Git Context analysis and querying. It enables users to run analysis, query historical data, and manage the extension from the terminal, complementing the VS Code UI.

## Key Components

### CLI Entry Point (`index.ts`)

Main CLI application that parses arguments and routes to appropriate commands.

```typescript
#!/usr/bin/env node

import { Command } from 'commander';
import { analyzeCommand } from './commands/analyze';
import { indexCommand } from './commands/index';
import { queryCommand } from './commands/query';
import { hooksCommand } from './commands/hooks';

const program = new Command();

program.name('ct').description('Git Context - Commit Intelligence CLI').version('1.0.0');

// Register commands
program.addCommand(analyzeCommand());
program.addCommand(indexCommand());
program.addCommand(queryCommand());
program.addCommand(hooksCommand());

// Legacy command aliases
program
  .command('last [count]')
  .description('Show recent analyzed commits')
  .action(async (count?: string) => {
    // Redirect to query command
    await queryCommand().parseAsync(['last', count || '5']);
  });

program.parse();
```

**Key Features:**

- **Commander.js Integration**: Uses Commander.js for argument parsing and help generation
- **Command Registration**: Modular command registration system
- **Legacy Compatibility**: Maintains backward compatibility with old command names

### Analyze Command (`commands/analyze.ts`)

Runs analysis on commits and displays results.

```typescript
export function analyzeCommand() {
  return new Command('analyze')
    .description('Analyze commits and display results')
    .option('-c, --count <number>', 'Number of commits to analyze', '5')
    .option('--staged', 'Include staged changes')
    .option('--unstaged', 'Include unstaged changes')
    .option('--force', 'Force re-analysis even if already analyzed')
    .action(async options => {
      const { count, staged, unstaged, force } = options;

      // Initialize database and pipeline
      await ensureDatabaseInitialized();
      const pipeline = await getRefactorPipeline();

      // Get commits to analyze
      const commits = await getRecentCommits(parseInt(count));

      // Run analysis
      const results = await pipeline.analyze({
        selectedCommitShas: commits.map(c => c.sha),
        includeWorkspace: staged || unstaged,
        workspaceParts: new Set((staged ? ['staged'] : []).concat(unstaged ? ['unstaged'] : [])),
      });

      // Display results
      displayAnalysisResults(results);
    });
}
```

### Index Command (`commands/index.ts`)

Manages the commit indexing process and database maintenance.

```typescript
export function indexCommand() {
  return new Command('index')
    .description('Index commits into the database')
    .option('--reindex', 'Force re-indexing of all commits')
    .option('--modules <modules>', 'Specific modules to reindex (comma-separated)')
    .option('--reset-db', 'Reset database before indexing')
    .action(async options => {
      const { reindex, modules, resetDb } = options;

      if (resetDb) {
        console.log('Resetting database...');
        await resetDatabase();
      }

      // Initialize indexing
      const indexer = new CommitIndexer(/* ... */);

      if (reindex) {
        console.log('Re-indexing all commits...');
        await indexer.reindexAll();
      } else if (modules) {
        const moduleList = modules.split(',');
        console.log(`Re-indexing modules: ${moduleList.join(', ')}`);
        await indexer.reindexModules(moduleList);
      } else {
        // Normal incremental indexing
        const commits = await getUnindexedCommits();
        await indexer.indexCommits(commits);
      }

      console.log('Indexing complete.');
    });
}
```

### Query Command (`commands/query.ts`)

Provides various query operations for exploring indexed data.

```typescript
export function queryCommand() {
  const query = new Command('query');

  query
    .command('commits [count]')
    .description('List recent analyzed commits')
    .action(async (count = 10) => {
      const commits = await getRecentAnalyzedCommits(parseInt(count));
      displayCommitsTable(commits);
    });

  query
    .command('symbol <name>')
    .description('Search for symbol history')
    .option('-l, --limit <number>', 'Limit results', '20')
    .action(async (name, options) => {
      const history = await searchSymbolHistory(name, parseInt(options.limit));
      displaySymbolHistory(history);
    });

  query
    .command('stats')
    .description('Show database statistics')
    .action(async () => {
      const stats = await getDatabaseStats();
      displayStats(stats);
    });

  return query;
}
```

### Hooks Command (`commands/hooks.ts`)

Manages Git hooks for automatic analysis on commits.

```typescript
export function hooksCommand() {
  return new Command('hooks')
    .description('Manage Git hooks for automatic analysis')
    .command('install')
    .description('Install post-commit hook')
    .action(async () => {
      const gitRoot = getGitRoot();
      if (!gitRoot) {
        logDebug('Not in a Git repository');
        process.exit(1);
      }

      const hooksDir = path.join(gitRoot, '.git', 'hooks');
      const postCommitHook = path.join(hooksDir, 'post-commit');

      // Create post-commit hook
      const hookContent = `#!/bin/sh
# Git Context post-commit hook
exec ct analyze --count 1 --quiet
`;

      fs.writeFileSync(postCommitHook, hookContent, { mode: 0o755 });
      console.log('Post-commit hook installed successfully.');
    })

    .command('uninstall')
    .description('Remove Git hooks')
    .action(async () => {
      const gitRoot = getGitRoot();
      const postCommitHook = path.join(gitRoot, '.git', 'hooks', 'post-commit');

      if (fs.existsSync(postCommitHook)) {
        fs.unlinkSync(postCommitHook);
        console.log('Post-commit hook removed.');
      }
    });
}
```

## Architecture

### Command Structure

CLI commands follow a consistent structure:

```
CLI Entry → Command Parser → Action Handler → Business Logic → Output Formatter
```

### Data Flow

```
User Input → Argument Parsing → Command Execution → Database/Service Access → Result Formatting → Console Output
```

## Key Concepts

### Commander.js Integration

The CLI uses Commander.js for robust argument parsing:

```typescript
const command = new Command('analyze')
  .description('Analyze recent commits')
  .option('-c, --count <number>', 'Number of commits', '5')
  .option('--force', 'Force re-analysis')
  .action(async options => {
    // Command implementation
  });
```

### Asynchronous Operations

All CLI operations are async to handle database and analysis operations:

```typescript
.action(async (options) => {
  await ensureDatabaseInitialized();
  const results = await runAnalysis(options);
  displayResults(results);
});
```

### Error Handling

CLI provides user-friendly error messages and proper exit codes:

```typescript
try {
  await runCommand(options);
} catch (error) {
  logDebug(`Error: ${error.message}`);
  process.exit(1);
}
```

### Output Formatting

Structured output for both human-readable and machine-readable formats:

```typescript
function displayAnalysisResults(results: AnalysisResults) {
  if (process.stdout.isTTY) {
    // Human-readable table
    console.table(results.summary);
  } else {
    // JSON for scripting
    console.log(JSON.stringify(results, null, 2));
  }
}
```

## Dependencies

- **storage/** - Database access for queries and indexing
- **analysis/** - Pipeline execution for analysis commands
- **services/** - Business logic services
- **utils/** - Configuration and helper functions

## Usage Examples

### Basic Analysis

```bash
# Analyze last 5 commits
ct analyze

# Analyze specific number of commits
ct analyze --count 10

# Include workspace changes
ct analyze --staged --unstaged
```

### Database Management

```bash
# Re-index all commits (useful after schema changes)
ct index --reindex

# Re-index specific modules
ct index --modules symbols,edges

# Reset database and re-index
ct index --reset-db
```

### Data Queries

```bash
# List recent analyzed commits
ct query commits 10

# Search symbol history
ct query symbol UserService

# Show database statistics
ct query stats
```

### Git Hooks

```bash
# Install automatic analysis on commit
ct hooks install

# Remove hooks
ct hooks uninstall
```

### Legacy Commands

```bash
# Old-style commands still work
ct last 5        # Same as: ct query commits 5
ct symbol Auth   # Same as: ct query symbol Auth
```

## Performance Characteristics

- **Incremental Indexing**: Only processes new/unanalyzed commits
- **Batch Operations**: Database operations batched for efficiency
- **Streaming Output**: Large result sets displayed progressively
- **Memory Efficient**: Results processed in chunks to avoid memory issues

## Error Handling

- **User-Friendly Messages**: Clear error descriptions for common issues
- **Exit Codes**: Proper exit codes for scripting (0=success, 1=error)
- **Recovery Suggestions**: Helpful hints for resolving issues
- **Logging**: Debug information available with verbose flags

## Related Documentation

- [Analysis Module](analysis.md) - Analysis pipeline used by CLI
- [Storage Module](storage.md) - Database operations
- [Services Module](services.md) - Business logic services
