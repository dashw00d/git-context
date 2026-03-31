/**
 * Tests for invalidation service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database manager and prepare function
vi.mock('../../../src/storage/database', () => ({
  getDatabaseManager: vi.fn(() => ({
    getDatabase: vi.fn(() => ({})),
  })),
}));

vi.mock('../../../src/storage/statement-wrapper', () => ({
  prepare: vi.fn(() => ({
    run: vi.fn(() => ({ changes: 0 })),
    get: vi.fn(),
    all: vi.fn(() => []),
    free: vi.fn(),
  })),
}));

vi.mock('../../../src/utils/logger', () => ({
  logInfo: vi.fn(),
  logDebug: vi.fn(),
  logWarn: vi.fn(),
}));

describe('InvalidationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('InvalidationOptions interface', () => {
    it('should support invalidateEmbeddings option', async () => {
      const { invalidateFileSymbols } = await import(
        '../../../src/analysis/invalidation/invalidationService'
      );

      const result = await invalidateFileSymbols('abc123def456'.repeat(4).slice(0, 40), 'test.ts', {
        invalidateEmbeddings: true,
        markStale: true,
      });

      expect(result).toBeDefined();
      expect(typeof result.symbolsInvalidated).toBe('number');
    });

    it('should support markStale option', async () => {
      const { invalidateFileSymbols } = await import(
        '../../../src/analysis/invalidation/invalidationService'
      );

      const result = await invalidateFileSymbols('abc123def456'.repeat(4).slice(0, 40), 'test.ts', {
        markStale: true,
      });

      expect(result).toBeDefined();
      expect(typeof result.symbolsInvalidated).toBe('number');
    });

    it('should support cascade option', async () => {
      const { invalidateFileSymbols } = await import(
        '../../../src/analysis/invalidation/invalidationService'
      );

      const result = await invalidateFileSymbols('abc123def456'.repeat(4).slice(0, 40), 'test.ts', {
        cascade: true,
      });

      expect(result).toBeDefined();
      expect(typeof result.dependentsMarkedStale).toBe('number');
    });
  });

  describe('InvalidationResult interface', () => {
    it('should return proper result structure', async () => {
      const { invalidateFileSymbols } = await import(
        '../../../src/analysis/invalidation/invalidationService'
      );

      const result = await invalidateFileSymbols('abc123def456'.repeat(4).slice(0, 40), 'test.ts');

      expect(result).toHaveProperty('symbolsInvalidated');
      expect(result).toHaveProperty('edgesInvalidated');
      expect(result).toHaveProperty('dependentsMarkedStale');
    });
  });

  describe('isFileStale', () => {
    it('should return true for non-existent files', async () => {
      const { isFileStale } = await import(
        '../../../src/analysis/invalidation/invalidationService'
      );

      // With mocked database returning nothing, file should be considered stale
      const isStale = isFileStale('abc123def456'.repeat(4).slice(0, 40), 'nonexistent.ts');
      expect(isStale).toBe(true);
    });
  });

  describe('invalidateCommit', () => {
    it('should return proper result structure', async () => {
      const { invalidateCommit } = await import(
        '../../../src/analysis/invalidation/invalidationService'
      );

      const result = await invalidateCommit('abc123def456'.repeat(4).slice(0, 40), {
        markStale: true,
      });

      expect(result).toHaveProperty('symbolsInvalidated');
      expect(result).toHaveProperty('edgesInvalidated');
      expect(result).toHaveProperty('dependentsMarkedStale');
    });
  });
});
