/**
 * Comprehensive Test Sandbox Repository Setup Script
 *
 * Creates a git repository with known structure for testing:
 * - TypeScript files with functions, classes, interfaces
 * - JavaScript files with CommonJS and ES modules
 * - PHP files with classes and functions
 * - Markdown files for documentation
 *
 * Commit History:
 * 1. Initial: TS math module, JS utils, PHP User class
 * 2. Add: TS Calculator class, JS logger, PHP UserService
 * 3. Modify: Change function signatures, add methods
 * 4. Rename: Rename functions across files
 * 5. Delete: Remove deprecated functions
 * 6. Cross-file: Add dependencies between TS/JS/PHP
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export const SANDBOX_DIR = path.join(__dirname, 'sandbox-repo');

// ============ COMMIT 1: Initial Structure ============

const COMMIT_1_FILES = {
  // TypeScript: Math utilities
  'src/ts/math.ts': `/**
 * Math utilities module
 * @module math
 */

export interface MathResult {
  value: number;
  operation: string;
}

export function add(a: number, b: number): MathResult {
  return { value: a + b, operation: 'add' };
}

export function subtract(a: number, b: number): MathResult {
  return { value: a - b, operation: 'subtract' };
}

export function multiply(a: number, b: number): MathResult {
  return { value: a * b, operation: 'multiply' };
}

export function divide(a: number, b: number): MathResult {
  if (b === 0) throw new Error('Division by zero');
  return { value: a / b, operation: 'divide' };
}
`,

  // TypeScript: Types
  'src/ts/types.ts': `/**
 * Shared type definitions
 */

export interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

export interface Post {
  id: number;
  title: string;
  content: string;
  authorId: number;
}

export type UserRole = 'admin' | 'user' | 'guest';

export enum Status {
  Active = 'active',
  Inactive = 'inactive',
  Pending = 'pending',
}
`,

  // JavaScript: Utils (CommonJS)
  'src/js/utils.js': `/**
 * Utility functions
 * @module utils
 */

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function formatNumber(n) {
  return n.toLocaleString();
}

function parseNumber(s) {
  return parseInt(s, 10);
}

function debounce(fn, delay) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), delay);
  };
}

module.exports = {
  formatDate,
  formatNumber,
  parseNumber,
  debounce,
};
`,

  // JavaScript: Config (ES Module style)
  'src/js/config.mjs': `/**
 * Application configuration
 */

export const APP_NAME = 'TestApp';
export const VERSION = '1.0.0';

export const settings = {
  debug: false,
  apiUrl: 'https://api.example.com',
  timeout: 5000,
};

export function getConfig(key) {
  return settings[key];
}

export function setConfig(key, value) {
  settings[key] = value;
}
`,

  // PHP: User class
  'src/php/User.php': `<?php
/**
 * User entity class
 */

namespace App\\Models;

class User {
    private int $id;
    private string $name;
    private string $email;
    private ?string $password;

    public function __construct(int $id, string $name, string $email) {
        $this->id = $id;
        $this->name = $name;
        $this->email = $email;
        $this->password = null;
    }

    public function getId(): int {
        return $this->id;
    }

    public function getName(): string {
        return $this->name;
    }

    public function setName(string $name): void {
        $this->name = $name;
    }

    public function getEmail(): string {
        return $this->email;
    }

    public function setEmail(string $email): void {
        $this->email = $email;
    }

    public function setPassword(string $password): void {
        $this->password = password_hash($password, PASSWORD_DEFAULT);
    }

    public function verifyPassword(string $password): bool {
        return password_verify($password, $this->password);
    }
}
`,

  // PHP: Helper functions
  'src/php/helpers.php': `<?php
/**
 * Helper functions
 */

function sanitize_input(string $input): string {
    return htmlspecialchars(strip_tags(trim($input)));
}

function generate_uuid(): string {
    return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}

function array_get(array $array, string $key, $default = null) {
    return $array[$key] ?? $default;
}
`,

  // Markdown: README
  'README.md': `# Test Sandbox Repository

This is a test repository for git-context pipeline testing.

## Structure

- \`src/ts/\` - TypeScript modules
- \`src/js/\` - JavaScript modules
- \`src/php/\` - PHP classes and functions

## Features

- Math operations
- User management
- Utility functions
`,
};

// ============ COMMIT 2: Add More Components ============

const COMMIT_2_FILES = {
  // TypeScript: Calculator class
  'src/ts/Calculator.ts': `/**
 * Calculator class with method chaining
 */

import { add, subtract, multiply, divide, MathResult } from './math';

export class Calculator {
  private result: number = 0;
  private history: MathResult[] = [];

  add(n: number): this {
    const result = add(this.result, n);
    this.result = result.value;
    this.history.push(result);
    return this;
  }

  subtract(n: number): this {
    const result = subtract(this.result, n);
    this.result = result.value;
    this.history.push(result);
    return this;
  }

  multiply(n: number): this {
    const result = multiply(this.result, n);
    this.result = result.value;
    this.history.push(result);
    return this;
  }

  divide(n: number): this {
    const result = divide(this.result, n);
    this.result = result.value;
    this.history.push(result);
    return this;
  }

  getResult(): number {
    return this.result;
  }

  getHistory(): MathResult[] {
    return [...this.history];
  }

  reset(): this {
    this.result = 0;
    this.history = [];
    return this;
  }
}
`,

  // JavaScript: Logger
  'src/js/logger.js': `/**
 * Simple logger module
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

let currentLevel = LOG_LEVELS.INFO;

function setLevel(level) {
  currentLevel = LOG_LEVELS[level] || LOG_LEVELS.INFO;
}

function log(level, message, ...args) {
  if (LOG_LEVELS[level] >= currentLevel) {
    const timestamp = new Date().toISOString();
    console.log(\`[\${timestamp}] [\${level}] \${message}\`, ...args);
  }
}

function debug(message, ...args) {
  log('DEBUG', message, ...args);
}

function info(message, ...args) {
  log('INFO', message, ...args);
}

function warn(message, ...args) {
  log('WARN', message, ...args);
}

function error(message, ...args) {
  log('ERROR', message, ...args);
}

module.exports = {
  LOG_LEVELS,
  setLevel,
  debug,
  info,
  warn,
  error,
};
`,

  // PHP: UserService
  'src/php/UserService.php': `<?php
/**
 * User service for managing users
 */

namespace App\\Services;

use App\\Models\\User;

class UserService {
    private array $users = [];

    public function createUser(int $id, string $name, string $email): User {
        $user = new User($id, $name, $email);
        $this->users[$id] = $user;
        return $user;
    }

    public function findById(int $id): ?User {
        return $this->users[$id] ?? null;
    }

    public function findByEmail(string $email): ?User {
        foreach ($this->users as $user) {
            if ($user->getEmail() === $email) {
                return $user;
            }
        }
        return null;
    }

    public function updateUser(int $id, array $data): ?User {
        $user = $this->findById($id);
        if ($user === null) {
            return null;
        }

        if (isset($data['name'])) {
            $user->setName($data['name']);
        }
        if (isset($data['email'])) {
            $user->setEmail($data['email']);
        }
        if (isset($data['password'])) {
            $user->setPassword($data['password']);
        }

        return $user;
    }

    public function deleteUser(int $id): bool {
        if (!isset($this->users[$id])) {
            return false;
        }
        unset($this->users[$id]);
        return true;
    }

    public function getAllUsers(): array {
        return array_values($this->users);
    }
}
`,
};

// ============ COMMIT 3: Modify Signatures ============

const COMMIT_3_CHANGES = {
  // Modify add function signature
  'src/ts/math.ts': `/**
 * Math utilities module
 * @module math
 */

export interface MathResult {
  value: number;
  operation: string;
  precision?: number;
}

export function add(a: number, b: number, precision: number = 2): MathResult {
  const value = parseFloat((a + b).toFixed(precision));
  return { value, operation: 'add', precision };
}

export function subtract(a: number, b: number, precision: number = 2): MathResult {
  const value = parseFloat((a - b).toFixed(precision));
  return { value, operation: 'subtract', precision };
}

export function multiply(a: number, b: number, precision: number = 2): MathResult {
  const value = parseFloat((a * b).toFixed(precision));
  return { value, operation: 'multiply', precision };
}

export function divide(a: number, b: number, precision: number = 2): MathResult {
  if (b === 0) throw new Error('Division by zero');
  const value = parseFloat((a / b).toFixed(precision));
  return { value, operation: 'divide', precision };
}

export function modulo(a: number, b: number): MathResult {
  if (b === 0) throw new Error('Modulo by zero');
  return { value: a % b, operation: 'modulo' };
}
`,

  // Add method to User class
  'src/php/User.php': `<?php
/**
 * User entity class
 */

namespace App\\Models;

class User {
    private int $id;
    private string $name;
    private string $email;
    private ?string $password;
    private ?\\DateTime $lastLogin;

    public function __construct(int $id, string $name, string $email) {
        $this->id = $id;
        $this->name = $name;
        $this->email = $email;
        $this->password = null;
        $this->lastLogin = null;
    }

    public function getId(): int {
        return $this->id;
    }

    public function getName(): string {
        return $this->name;
    }

    public function setName(string $name): void {
        $this->name = $name;
    }

    public function getEmail(): string {
        return $this->email;
    }

    public function setEmail(string $email): void {
        $this->email = $email;
    }

    public function setPassword(string $password): void {
        $this->password = password_hash($password, PASSWORD_DEFAULT);
    }

    public function verifyPassword(string $password): bool {
        return password_verify($password, $this->password);
    }

    public function updateLastLogin(): void {
        $this->lastLogin = new \\DateTime();
    }

    public function getLastLogin(): ?\\DateTime {
        return $this->lastLogin;
    }

    public function toArray(): array {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'lastLogin' => $this->lastLogin?->format('Y-m-d H:i:s'),
        ];
    }
}
`,
};

// ============ COMMIT 4: Rename Functions ============

const COMMIT_4_CHANGES = {
  // Rename formatNumber -> formatCurrency
  'src/js/utils.js': `/**
 * Utility functions
 * @module utils
 */

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function formatCurrency(n, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(n);
}

function parseNumber(s) {
  return parseInt(s, 10);
}

function debounce(fn, delay) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), delay);
  };
}

function throttle(fn, delay) {
  let lastCall = 0;
  return function(...args) {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      return fn.apply(this, args);
    }
  };
}

module.exports = {
  formatDate,
  formatCurrency,
  parseNumber,
  debounce,
  throttle,
};
`,
};

// ============ COMMIT 5: Delete Deprecated ============

const COMMIT_5_CHANGES = {
  // Remove divide function (deprecated)
  'src/ts/math.ts': `/**
 * Math utilities module
 * @module math
 */

export interface MathResult {
  value: number;
  operation: string;
  precision?: number;
}

export function add(a: number, b: number, precision: number = 2): MathResult {
  const value = parseFloat((a + b).toFixed(precision));
  return { value, operation: 'add', precision };
}

export function subtract(a: number, b: number, precision: number = 2): MathResult {
  const value = parseFloat((a - b).toFixed(precision));
  return { value, operation: 'subtract', precision };
}

export function multiply(a: number, b: number, precision: number = 2): MathResult {
  const value = parseFloat((a * b).toFixed(precision));
  return { value, operation: 'multiply', precision };
}

// divide() removed - use safeDivide() instead
export function safeDivide(a: number, b: number, precision: number = 2): MathResult | null {
  if (b === 0) return null;
  const value = parseFloat((a / b).toFixed(precision));
  return { value, operation: 'safeDivide', precision };
}

export function modulo(a: number, b: number): MathResult {
  if (b === 0) throw new Error('Modulo by zero');
  return { value: a % b, operation: 'modulo' };
}
`,
};

// ============ COMMIT 6: Cross-File Dependencies ============

const COMMIT_6_FILES = {
  // TypeScript: Main entry point with cross-file imports
  'src/ts/index.ts': `/**
 * Main entry point
 */

import { add, subtract, multiply, safeDivide, MathResult } from './math';
import { Calculator } from './Calculator';
import { User, UserRole, Status } from './types';

export function runCalculation(a: number, b: number): MathResult[] {
  const results: MathResult[] = [];

  results.push(add(a, b));
  results.push(subtract(a, b));
  results.push(multiply(a, b));

  const divResult = safeDivide(a, b);
  if (divResult) results.push(divResult);

  return results;
}

export function createCalculator(): Calculator {
  return new Calculator();
}

export function processUser(user: User, role: UserRole): void {
  console.log(\`Processing user \${user.name} with role \${role}\`);
}

export { Calculator, User, UserRole, Status };
`,

  // JavaScript: API module using utils
  'src/js/api.js': `/**
 * API module
 */

const { formatDate, formatCurrency, debounce } = require('./utils');
const logger = require('./logger');

async function fetchData(url, options = {}) {
  logger.debug('Fetching data from:', url);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(\`HTTP error: \${response.status}\`);
    }

    const data = await response.json();
    logger.info('Data fetched successfully');
    return data;
  } catch (error) {
    logger.error('Fetch failed:', error.message);
    throw error;
  }
}

function formatApiResponse(data) {
  return {
    ...data,
    formattedDate: data.date ? formatDate(new Date(data.date)) : null,
    formattedAmount: data.amount ? formatCurrency(data.amount) : null,
  };
}

const debouncedFetch = debounce(fetchData, 300);

module.exports = {
  fetchData,
  formatApiResponse,
  debouncedFetch,
};
`,

  // PHP: Controller using UserService
  'src/php/UserController.php': `<?php
/**
 * User controller
 */

namespace App\\Controllers;

use App\\Services\\UserService;
use App\\Models\\User;

class UserController {
    private UserService $userService;

    public function __construct() {
        $this->userService = new UserService();
    }

    public function index(): array {
        $users = $this->userService->getAllUsers();
        return array_map(fn(User $user) => $user->toArray(), $users);
    }

    public function show(int $id): ?array {
        $user = $this->userService->findById($id);
        return $user?->toArray();
    }

    public function store(array $data): array {
        $id = $data['id'] ?? random_int(1, 10000);
        $user = $this->userService->createUser(
            $id,
            $data['name'] ?? '',
            $data['email'] ?? ''
        );
        return $user->toArray();
    }

    public function update(int $id, array $data): ?array {
        $user = $this->userService->updateUser($id, $data);
        return $user?->toArray();
    }

    public function destroy(int $id): bool {
        return $this->userService->deleteUser($id);
    }
}
`,
};

// ============ Expected Results ============

export interface ExpectedSymbol {
  name: string;
  kind: string;
  file: string;
}

export interface ExpectedEdge {
  from: string;
  to: string;
  type: 'calls' | 'imports' | 'uses' | 'extends';
}

export const EXPECTED = {
  commit1: {
    symbols: {
      'src/ts/math.ts': [
        { name: 'MathResult', kind: 'interface' },
        { name: 'add', kind: 'function' },
        { name: 'subtract', kind: 'function' },
        { name: 'multiply', kind: 'function' },
        { name: 'divide', kind: 'function' },
      ],
      'src/ts/types.ts': [
        { name: 'User', kind: 'interface' },
        { name: 'Post', kind: 'interface' },
        { name: 'UserRole', kind: 'type' },
        { name: 'Status', kind: 'enum' },
      ],
      'src/js/utils.js': [
        { name: 'formatDate', kind: 'function' },
        { name: 'formatNumber', kind: 'function' },
        { name: 'parseNumber', kind: 'function' },
        { name: 'debounce', kind: 'function' },
      ],
      'src/php/User.php': [
        { name: 'User', kind: 'class' },
        { name: '__construct', kind: 'method' },
        { name: 'getId', kind: 'method' },
        { name: 'getName', kind: 'method' },
        { name: 'setName', kind: 'method' },
        { name: 'getEmail', kind: 'method' },
        { name: 'setEmail', kind: 'method' },
        { name: 'setPassword', kind: 'method' },
        { name: 'verifyPassword', kind: 'method' },
      ],
      'src/php/helpers.php': [
        { name: 'sanitize_input', kind: 'function' },
        { name: 'generate_uuid', kind: 'function' },
        { name: 'array_get', kind: 'function' },
      ],
    },
    totalSymbols: 25, // Approximate
    totalFiles: 6,
  },
  commit2: {
    added: {
      'src/ts/Calculator.ts': [
        { name: 'Calculator', kind: 'class' },
      ],
      'src/js/logger.js': [
        { name: 'setLevel', kind: 'function' },
        { name: 'debug', kind: 'function' },
        { name: 'info', kind: 'function' },
        { name: 'warn', kind: 'function' },
        { name: 'error', kind: 'function' },
      ],
      'src/php/UserService.php': [
        { name: 'UserService', kind: 'class' },
      ],
    },
    edges: [
      { from: 'src/ts/Calculator.ts:Calculator.add', to: 'src/ts/math.ts:add', type: 'calls' },
      { from: 'src/ts/Calculator.ts', to: 'src/ts/math.ts', type: 'imports' },
    ],
  },
  commit3: {
    modified: {
      'src/ts/math.ts': ['add', 'subtract', 'multiply', 'divide'], // signature changed
    },
    added: {
      'src/ts/math.ts': ['modulo'],
      'src/php/User.php': ['updateLastLogin', 'getLastLogin', 'toArray'],
    },
  },
  commit4: {
    renamed: {
      'src/js/utils.js': [
        { from: 'formatNumber', to: 'formatCurrency' },
      ],
    },
    added: {
      'src/js/utils.js': ['throttle'],
    },
  },
  commit5: {
    removed: {
      'src/ts/math.ts': ['divide'],
    },
    added: {
      'src/ts/math.ts': ['safeDivide'],
    },
  },
  commit6: {
    edges: [
      { from: 'src/ts/index.ts', to: 'src/ts/math.ts', type: 'imports' },
      { from: 'src/ts/index.ts', to: 'src/ts/Calculator.ts', type: 'imports' },
      { from: 'src/ts/index.ts', to: 'src/ts/types.ts', type: 'imports' },
      { from: 'src/js/api.js', to: 'src/js/utils.js', type: 'imports' },
      { from: 'src/js/api.js', to: 'src/js/logger.js', type: 'imports' },
      { from: 'src/php/UserController.php', to: 'src/php/UserService.php', type: 'uses' },
    ],
  },
};

// ============ Setup Functions ============

function runGit(args: string, cwd: string): string {
  return execSync(`git ${args}`, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

function writeFiles(files: Record<string, string>, baseDir: string): void {
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(baseDir, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
  }
}

/**
 * Clean up old sandbox repos to prevent disk bloat.
 * Keeps only the 10 most recent directories.
 */
function cleanupOldSandboxRepos(): void {
  try {
    if (!fs.existsSync(SANDBOX_DIR)) return;

    const entries = fs.readdirSync(SANDBOX_DIR, { withFileTypes: true });
    const repoDirs = entries
      .filter(e => e.isDirectory() && e.name.startsWith('repo-'))
      .map(e => ({
        name: e.name,
        path: path.join(SANDBOX_DIR, e.name),
        mtime: fs.statSync(path.join(SANDBOX_DIR, e.name)).mtime.getTime(),
      }))
      .sort((a, b) => b.mtime - a.mtime); // newest first

    // Keep only 10 most recent
    const MAX_REPOS = 10;
    if (repoDirs.length > MAX_REPOS) {
      const toDelete = repoDirs.slice(MAX_REPOS);
      for (const dir of toDelete) {
        fs.rmSync(dir.path, { recursive: true, force: true });
      }
    }
  } catch {
    // Ignore cleanup errors - not critical
  }
}

export function setupSandboxRepo(): { repoPath: string; commits: string[] } {
  // Use a unique directory for each run to avoid race conditions in parallel tests
  const uniqueId = Math.random().toString(36).substring(2, 10);
  const repoPath = path.join(SANDBOX_DIR, `repo-${uniqueId}`);

  // Ensure base SANDBOX_DIR exists
  if (!fs.existsSync(SANDBOX_DIR)) {
    fs.mkdirSync(SANDBOX_DIR, { recursive: true });
  }

  // Cleanup old sandbox repos (keep only recent ones to avoid disk bloat)
  cleanupOldSandboxRepos();

  // Create unique repo dir
  fs.mkdirSync(repoPath, { recursive: true });

  // Initialize git repo
  runGit('init', repoPath);
  runGit('config user.email "test@test.com"', repoPath);
  runGit('config user.name "Test User"', repoPath);

  const commits: string[] = [];

  // Commit 1: Initial structure
  writeFiles(COMMIT_1_FILES, repoPath);
  runGit('add .', repoPath);
  runGit('commit -m "Initial: TS math, JS utils, PHP User class"', repoPath);
  commits.push(runGit('rev-parse HEAD', repoPath).trim());

  // Commit 2: Add components
  writeFiles(COMMIT_2_FILES, repoPath);
  runGit('add .', repoPath);
  runGit('commit -m "Add: Calculator, Logger, UserService"', repoPath);
  commits.push(runGit('rev-parse HEAD', repoPath).trim());

  // Commit 3: Modify signatures
  writeFiles(COMMIT_3_CHANGES, repoPath);
  runGit('add .', repoPath);
  runGit('commit -m "Modify: Add precision to math, lastLogin to User"', repoPath);
  commits.push(runGit('rev-parse HEAD', repoPath).trim());

  // Commit 4: Rename functions
  writeFiles(COMMIT_4_CHANGES, repoPath);
  runGit('add .', repoPath);
  runGit('commit -m "Rename: formatNumber -> formatCurrency, add throttle"', repoPath);
  commits.push(runGit('rev-parse HEAD', repoPath).trim());

  // Commit 5: Delete deprecated
  writeFiles(COMMIT_5_CHANGES, repoPath);
  runGit('add .', repoPath);
  runGit('commit -m "Remove: divide(), add safeDivide()"', repoPath);
  commits.push(runGit('rev-parse HEAD', repoPath).trim());

  // Commit 6: Cross-file dependencies
  writeFiles(COMMIT_6_FILES, repoPath);
  runGit('add .', repoPath);
  runGit('commit -m "Add: index.ts, api.js, UserController with cross-file deps"', repoPath);
  commits.push(runGit('rev-parse HEAD', repoPath).trim());

  console.log('Sandbox repo created at:', repoPath);
  console.log('Commits:', commits);

  return { repoPath, commits };
}

export function getSandboxPath(): string {
  return SANDBOX_DIR;
}

// Run if called directly
if (require.main === module) {
  setupSandboxRepo();
}
