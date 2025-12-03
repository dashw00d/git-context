import { describe, expect, it } from 'vitest';
import { GitOperations } from '../../../src/analysis/git';
import {
  filterPath,
  PathFilterOptions,
  shouldProcessPath,
  shouldProcessPathWithLog,
} from '../../../src/utils/pathFilter';

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

  async isIgnored(filePath: string): Promise<boolean> {
    return this.ignoredPaths.has(filePath);
  }

  async isIgnoredAtCommit(sha: string, filePath: string): Promise<boolean> {
    const commitIgnored = this.commitIgnoredPaths.get(sha);
    if (commitIgnored && commitIgnored.has(filePath)) {
      return true;
    }
    return this.isIgnored(filePath);
  }

  async getBlobSize(sha: string, filePath: string): Promise<number> {
    const key = `${sha}:${filePath}`;
    return this.blobSizes.get(key) || 0;
  }

  getRoot(): string {
    return '/mock/git/root';
  }
}

function createOptions(overrides: Partial<PathFilterOptions> = {}): PathFilterOptions {
  return {
    git: new MockGitOperations(),
    ...overrides,
  };
}

describe('pathFilter', () => {
  it('should reject files with unsupported extensions', async () => {
    const result = await shouldProcessPath('test.xyz', createOptions());
    expect(result.shouldProcess).toBe(false);
  });

  it('should accept files with supported extensions', async () => {
    const result = await shouldProcessPath('test.ts', createOptions());
    expect(result.shouldProcess).toBe(true);
  });

  it('should reject node_modules files', async () => {
    const result = await shouldProcessPath('node_modules/package/index.js', createOptions());
    expect(result.shouldProcess).toBe(false);
  });

  it('should reject out/ directory files', async () => {
    const result = await shouldProcessPath('out/compiled.js', createOptions());
    expect(result.shouldProcess).toBe(false);
  });

  it('should reject git-ignored files', async () => {
    const git = new MockGitOperations();
    git.setIgnored('ignored.ts');
    const result = await shouldProcessPath('ignored.ts', createOptions({ git }));
    expect(result.shouldProcess).toBe(false);
  });

  it('should reject files ignored at specific commit', async () => {
    const git = new MockGitOperations();
    const commitSha = 'abc123';
    git.setIgnoredAtCommit(commitSha, 'old-ignored.ts');
    const result = await shouldProcessPath('old-ignored.ts', createOptions({ git, commitSha }));
    expect(result.shouldProcess).toBe(false);
  });

  it('should reject files exceeding size limit (blob)', async () => {
    const git = new MockGitOperations();
    const commitSha = 'abc123';
    git.setBlobSize(commitSha, 'large.ts', 200000);
    const result = await shouldProcessPath('large.ts', createOptions({ git, commitSha }));
    expect(result.shouldProcess).toBe(false);
  });

  it('should process deleted files without size check', async () => {
    const git = new MockGitOperations();
    const commitSha = 'abc123';

    const result = await shouldProcessPath(
      'deleted.ts',
      createOptions({
        git,
        commitSha,
        status: 'D',
        skipSizeCheck: true,
      })
    );

    expect(result.shouldProcess).toBe(true);
  });

  it('should reject empty paths', async () => {
    const result = await shouldProcessPath('', createOptions());
    expect(result.shouldProcess).toBe(false);
  });

  it('filterPath should return boolean', async () => {
    const result1 = await filterPath('test.ts', createOptions());
    expect(typeof result1).toBe('boolean');
    expect(result1).toBe(true);

    const result2 = await filterPath('node_modules/test.js', createOptions());
    expect(result2).toBe(false);
  });

  it('shouldProcessPathWithLog should log rejections', async () => {
    const result = await shouldProcessPathWithLog(
      'node_modules/test.js',
      createOptions(),
      'TestContext'
    );
    expect(result.shouldProcess).toBe(false);
    expect(result.reason).toBeDefined();
  });
});
