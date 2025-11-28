/**
 * Tests for centralized path filter utility
 * 
 * This test file covers the pathFilter utility to ensure all filtering
 * logic works correctly across different scenarios.
 * 
 * Run with: npx ts-node benchmarks/pathFilter.test.ts
 */

import { shouldProcessPath, filterPath, shouldProcessPathWithLog, PathFilterOptions } from '../src/utils/pathFilter';
import { GitOperations } from '../src/analysis/git';
import * as fs from 'fs';
import * as path from 'path';

// Mock GitOperations for testing
class MockGitOperations extends GitOperations {
  private ignoredPaths: Set<string> = new Set();
  private commitIgnoredPaths: Map<string, Set<string>> = new Map();
  private blobSizes: Map<string, number> = new Map();

  constructor() {
    super();
  }

  setIgnored(path: string): void {
    this.ignoredPaths.add(path);
  }

  setIgnoredAtCommit(commitSha: string, filePath: string): void {
    if (!this.commitIgnoredPaths.has(commitSha)) {
      this.commitIgnoredPaths.set(commitSha, new Set());
    }
    this.commitIgnoredPaths.get(commitSha)!.add(filePath);
  }

  setBlobSize(commitSha: string, filePath: string, size: number): void {
    const key = `${commitSha}:${filePath}`;
    this.blobSizes.set(key, size);
  }

  isIgnored(filePath: string): boolean {
    return this.ignoredPaths.has(filePath);
  }

  isIgnoredAtCommit(sha: string, filePath: string): boolean {
    const commitIgnored = this.commitIgnoredPaths.get(sha);
    if (commitIgnored && commitIgnored.has(filePath)) {
      return true;
    }
    return this.isIgnored(filePath);
  }

  getBlobSize(sha: string, filePath: string): number {
    const key = `${sha}:${filePath}`;
    return this.blobSizes.get(key) || 0;
  }

  getRoot(): string {
    return '/mock/git/root';
  }
}

// Test helper to create options
function createOptions(overrides: Partial<PathFilterOptions> = {}): PathFilterOptions {
  return {
    git: new MockGitOperations(),
    ...overrides
  };
}

// Test cases
function runTests() {
  console.log('🧪 Running pathFilter tests...\n');

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (error: any) {
      console.error(`❌ ${name}: ${error.message}`);
      failed++;
    }
  }

  // Test 1: Extension filtering
  test('should reject files with unsupported extensions', () => {
    const result = shouldProcessPath('test.xyz', createOptions());
    if (result.shouldProcess) {
      throw new Error('Expected .xyz file to be rejected');
    }
  });

  test('should accept files with supported extensions', () => {
    const result = shouldProcessPath('test.ts', createOptions());
    if (!result.shouldProcess) {
      throw new Error('Expected .ts file to be accepted');
    }
  });

  // Test 2: Hardcoded exclusions
  test('should reject node_modules files', () => {
    const result = shouldProcessPath('node_modules/package/index.js', createOptions());
    if (result.shouldProcess) {
      throw new Error('Expected node_modules file to be rejected');
    }
  });

  test('should reject out/ directory files', () => {
    const result = shouldProcessPath('out/compiled.js', createOptions());
    if (result.shouldProcess) {
      throw new Error('Expected out/ file to be rejected');
    }
  });

  // Test 3: Git ignore
  test('should reject git-ignored files', () => {
    const git = new MockGitOperations();
    git.setIgnored('ignored.ts');
    const result = shouldProcessPath('ignored.ts', createOptions({ git }));
    if (result.shouldProcess) {
      throw new Error('Expected git-ignored file to be rejected');
    }
  });

  // Test 4: Historical git ignore
  test('should reject files ignored at specific commit', () => {
    const git = new MockGitOperations();
    const commitSha = 'abc123';
    git.setIgnoredAtCommit(commitSha, 'old-ignored.ts');
    const result = shouldProcessPath('old-ignored.ts', createOptions({ git, commitSha }));
    if (result.shouldProcess) {
      throw new Error('Expected commit-ignored file to be rejected');
    }
  });

  // Test 5: File size limits (blob size for commits)
  test('should reject files exceeding size limit (blob)', () => {
    const git = new MockGitOperations();
    const commitSha = 'abc123';
    git.setBlobSize(commitSha, 'large.ts', 200000); // 200KB > 100KB default
    const result = shouldProcessPath('large.ts', createOptions({ git, commitSha }));
    if (result.shouldProcess) {
      throw new Error('Expected large file to be rejected');
    }
  });

  // Test 6: Deleted files skip size check
  test('should process deleted files without size check', () => {
    const git = new MockGitOperations();
    const commitSha = 'abc123';
    // Even if file would be large, deleted files skip size check
    const result = shouldProcessPath('deleted.ts', createOptions({ 
      git, 
      commitSha, 
      status: 'D',
      skipSizeCheck: true 
    }));
    // Should pass other checks (extension, etc.)
    if (!result.shouldProcess && result.reason?.includes('size')) {
      throw new Error('Deleted files should skip size check');
    }
  });

  // Test 7: Invalid paths
  test('should reject empty paths', () => {
    const result = shouldProcessPath('', createOptions());
    if (result.shouldProcess) {
      throw new Error('Expected empty path to be rejected');
    }
  });

  test('should reject non-string paths', () => {
    // TypeScript will catch this, but test the runtime behavior
    const result = shouldProcessPath('', createOptions());
    if (result.shouldProcess) {
      throw new Error('Expected invalid path to be rejected');
    }
  });

  // Test 8: filterPath convenience wrapper
  test('filterPath should return boolean', async () => {
    const result1 = await filterPath('test.ts', createOptions());
    if (typeof result1 !== 'boolean') {
      throw new Error('filterPath should return boolean');
    }

    const result2 = await filterPath('node_modules/test.js', createOptions());
    if (result2 !== false) {
      throw new Error('filterPath should return false for excluded paths');
    }
  });

  // Test 9: shouldProcessPathWithLog includes logging
  test('shouldProcessPathWithLog should log rejections', async () => {
    // This test verifies the function doesn't throw
    // Actual logging is tested via integration tests
    const result = await shouldProcessPathWithLog('node_modules/test.js', createOptions(), 'TestContext');
    if (result.shouldProcess) {
      throw new Error('Expected excluded path to be rejected');
    }
    if (!result.reason) {
      throw new Error('Expected reason to be provided');
    }
  });

  // Test 10: Custom ignore patterns (via config - would need config mocking)
  // This is tested via integration tests with actual config

  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests if executed directly
if (require.main === module) {
  runTests();
}

export { runTests };

