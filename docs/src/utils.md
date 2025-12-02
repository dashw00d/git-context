# Utils Module (`utils/`)

## Purpose

The `utils/` module provides shared utility functions and helpers used throughout the Git Context extension. It contains configuration management, logging, error handling, and common operations that don't belong to any specific domain.

## Key Components

### Configuration (`config.ts`)

Centralized configuration management with VS Code settings integration.

```typescript
export interface ExtensionConfig {
  openRouterApiKey?: string;
  openRouterModel: string;
  apiEndpoint: string;
  difftasticPath?: string;
  defaultCommitCount: number;
  enableDebugLogging: boolean;
  maxAnalysisConcurrency: number;
  cacheTTL: number;
  autoInstallHooks: boolean;
}

export function getExtensionConfig(): ExtensionConfig {
  const config = vscode.workspace.getConfiguration('git-context');

  return {
    openRouterApiKey: config.get('openRouterApiKey'),
    openRouterModel: config.get('openRouterModel', 'anthropic/claude-3-haiku:beta'),
    apiEndpoint: config.get('apiEndpoint', 'https://openrouter.ai/api/v1'),
    difftasticPath: config.get('difftasticPath'),
    defaultCommitCount: config.get('defaultCommitCount', 5),
    enableDebugLogging: config.get('enableDebugLogging', false),
    maxAnalysisConcurrency: config.get('maxAnalysisConcurrency', 8),
    cacheTTL: config.get('cacheTTL', 3600000), // 1 hour
    autoInstallHooks: config.get('autoInstallHooks', false),
  };
}

export function getGitRoot(): string | null {
  // Find .git directory
  let dir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!dir) return null;

  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }

  return null;
}
```

### Logging (`logger.ts`)

Structured logging with different levels and VS Code integration.

```typescript
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class Logger {
  private level: LogLevel = LogLevel.INFO;
  private outputChannel?: vscode.OutputChannel;
  private debugChannel?: vscode.OutputChannel;

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setOutputChannels(output: vscode.OutputChannel, debug: vscode.OutputChannel): void {
    this.outputChannel = output;
    this.debugChannel = debug;
  }

  debug(message: string, ...args: any[]): void {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.log(LogLevel.INFO, message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.log(LogLevel.WARN, message, ...args);
  }

  error(message: string, error?: any): void {
    this.log(LogLevel.ERROR, message, error);
  }

  private log(level: LogLevel, message: string, ...args: any[]): void {
    if (level < this.level) return;

    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    const formatted = `[${timestamp}] [${levelName}] ${message}`;

    // Console logging
    console.log(formatted, ...args);

    // VS Code output channels
    const channel = level === LogLevel.DEBUG ? this.debugChannel : this.outputChannel;
    if (channel) {
      channel.appendLine(formatted);
      if (args.length > 0) {
        channel.appendLine(`  ${JSON.stringify(args, null, 2)}`);
      }
    }
  }
}

const logger = new Logger();
export { logger };
export const logDebug = logger.debug.bind(logger);
export const logInfo = logger.info.bind(logger);
export const logWarn = logger.warn.bind(logger);
export const logError = logger.error.bind(logger);
```

### Error Handling (`errors.ts`)

Common error types and handling utilities.

```typescript
export class ExtensionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'ExtensionError';
  }
}

export class GitError extends ExtensionError {
  constructor(message: string, details?: any) {
    super(message, 'GIT_ERROR', details);
  }
}

export class AnalysisError extends ExtensionError {
  constructor(message: string, details?: any) {
    super(message, 'ANALYSIS_ERROR', details);
  }
}

export function handleError(error: unknown, context: string): void {
  if (error instanceof ExtensionError) {
    logError(`${context}: ${error.message}`, error.details);
    vscode.window.showErrorMessage(`${context}: ${error.message}`);
  } else if (error instanceof Error) {
    logError(`${context}: ${error.message}`, error);
    vscode.window.showErrorMessage(`${context}: An unexpected error occurred`);
  } else {
    logError(`${context}: Unknown error`, error);
    vscode.window.showErrorMessage(`${context}: An unexpected error occurred`);
  }
}

export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    handleError(error, context);
    return null;
  }
}
```

### Path Filtering (`pathFilter.ts`)

Utilities for filtering and matching file paths.

```typescript
export function filterPath(path: string, filters: PathFilter[]): boolean {
  return filters.every(filter => {
    switch (filter.type) {
      case 'include':
        return matchesPattern(path, filter.pattern);
      case 'exclude':
        return !matchesPattern(path, filter.pattern);
      default:
        return true;
    }
  });
}

export function matchesPattern(path: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regex = new RegExp(
    pattern.replace(/\*/g, '[^/]*').replace(/\*\*/g, '.*').replace(/\?/g, '[^/]')
  );

  return regex.test(path);
}

export function isSupportedFile(filePath: string): boolean {
  const supportedExtensions = [
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.py',
    '.java',
    '.cpp',
    '.c',
    '.h',
    '.php',
    '.rb',
    '.go',
    '.rs',
    '.swift',
    '.kt',
    '.scala',
  ];

  const ext = path.extname(filePath).toLowerCase();
  return supportedExtensions.includes(ext);
}
```

### Stats Formatting (`statsFormatter.ts`)

Utilities for formatting analysis statistics and metrics.

```typescript
export function formatFileCount(count: number): string {
  if (count === 0) return 'no files';
  if (count === 1) return '1 file';
  return `${count} files`;
}

export function formatSymbolCount(count: number): string {
  if (count === 0) return 'no symbols';
  if (count === 1) return '1 symbol';
  return `${count} symbols`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(1);
  return `${minutes}m ${seconds}s`;
}

export function formatPercentage(value: number, total: number): string {
  if (total === 0) return '0%';
  const percentage = Math.round((value / total) * 100);
  return `${percentage}%`;
}
```

### Supported Languages (`supportedLanguages.ts`)

Language detection and Tree-sitter grammar management.

```typescript
export const SUPPORTED_LANGUAGES = [
  { id: 'typescript', extensions: ['.ts', '.tsx'], treeSitter: 'typescript' },
  { id: 'javascript', extensions: ['.js', '.jsx'], treeSitter: 'javascript' },
  { id: 'python', extensions: ['.py'], treeSitter: 'python' },
  { id: 'java', extensions: ['.java'], treeSitter: 'java' },
  { id: 'cpp', extensions: ['.cpp', '.cc', '.cxx'], treeSitter: 'cpp' },
  { id: 'c', extensions: ['.c', '.h'], treeSitter: 'c' },
  { id: 'php', extensions: ['.php'], treeSitter: 'php' },
  { id: 'ruby', extensions: ['.rb'], treeSitter: 'ruby' },
  { id: 'go', extensions: ['.go'], treeSitter: 'go' },
  { id: 'rust', extensions: ['.rs'], treeSitter: 'rust' },
];

export function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const language = SUPPORTED_LANGUAGES.find(lang => lang.extensions.includes(ext));

  return language?.id || 'unknown';
}

export function getTreeSitterLanguageId(filePath: string): string | null {
  const language = SUPPORTED_LANGUAGES.find(lang =>
    lang.extensions.some(ext => filePath.endsWith(ext))
  );

  return language?.treeSitter || null;
}
```

### Debug Configuration (`debugConfig.ts`)

Debugging utilities and configuration.

```typescript
export function getDebugMode(): boolean {
  return getExtensionConfig().enableDebugLogging;
}

export function createDebugTimer(label: string): () => void {
  const start = Date.now();
  return () => {
    const duration = Date.now() - start;
    logDebug(`[${label}] Completed in ${formatDuration(duration)}`);
  };
}

export async function withDebugTiming<T>(label: string, operation: () => Promise<T>): Promise<T> {
  const done = createDebugTimer(label);
  try {
    const result = await operation();
    done();
    return result;
  } catch (error) {
    done();
    throw error;
  }
}
```

## Architecture

### Utility Organization

Utilities are organized by concern:

```
config.ts        - Configuration management
logger.ts        - Logging infrastructure
errors.ts        - Error handling
pathFilter.ts    - Path and file filtering
statsFormatter.ts - Data formatting
supportedLanguages.ts - Language detection
debugConfig.ts   - Debug utilities
```

### Shared Dependencies

Utilities have minimal dependencies and can be imported anywhere:

```typescript
// Safe to import in any module
import { logInfo, logError } from '../utils/logger';
import { getExtensionConfig } from '../utils/config';
import { detectLanguage } from '../utils/supportedLanguages';
```

## Key Concepts

### Configuration Hierarchy

Configuration follows VS Code's settings hierarchy:

1. **User Settings**: Global user preferences
2. **Workspace Settings**: Project-specific overrides
3. **Default Values**: Extension fallbacks

### Structured Logging

Logging provides context and structured data:

```typescript
// Good: Structured logging with context
logInfo(`[Analysis] Starting analysis of ${commits.length} commits`);
logError(`[Git] Failed to get commits`, { error: e.message, count });

// Bad: Unstructured logging
console.log('Starting analysis');
console.log('Error:', e);
```

### Error Classification

Errors are categorized for appropriate handling:

```typescript
// User errors - show in UI
throw new ExtensionError('Invalid commit SHA format', 'USER_ERROR');

// System errors - log and continue
logError('Database connection failed', error);

// Fatal errors - crash gracefully
throw new ExtensionError('Cannot initialize database', 'FATAL_ERROR');
```

### Path Pattern Matching

Flexible glob pattern matching for file filtering:

```typescript
// Include TypeScript files
filterPath('src/main.ts', [{ type: 'include', pattern: '**/*.ts' }]); // true

// Exclude node_modules
filterPath('node_modules/lib.js', [{ type: 'exclude', pattern: 'node_modules/**' }]); // false
```

## Dependencies

- **vscode** - VS Code API for configuration and workspace access
- **fs/path** - Node.js file system operations

## Usage Examples

### Configuration Access

```typescript
import { getExtensionConfig, getGitRoot } from './utils/config';

const config = getExtensionConfig();
const gitRoot = getGitRoot();

if (config.enableDebugLogging) {
  // Enable debug features
}
```

### Logging

```typescript
import { logInfo, logError, logDebug } from './utils/logger';

// Info level logging
logInfo('[Analysis] Starting commit analysis');

// Error with context
logError('[Git] Failed to read commits', { sha: commitSha, error: e });

// Debug with timing
logDebug('[Pipeline] Step completed', { duration: 1500, stepId: 'index' });
```

### Error Handling

```typescript
import { handleError, withErrorHandling } from './utils/errors';

// Direct error handling
try {
  await riskyOperation();
} catch (error) {
  handleError(error, 'Risky operation failed');
}

// Wrapped error handling
const result = await withErrorHandling(() => performAnalysis(), 'Analysis operation');
```

### Path Filtering

```typescript
import { filterPath, isSupportedFile } from './utils/pathFilter';

// Check if file should be analyzed
if (isSupportedFile(filePath) && filterPath(filePath, exclusionFilters)) {
  await analyzeFile(filePath);
}
```

### Stats Formatting

```typescript
import { formatFileCount, formatDuration } from './utils/statsFormatter';

const message = `Analyzed ${formatFileCount(fileCount)} in ${formatDuration(duration)}`;
vscode.window.showInformationMessage(message);
```
