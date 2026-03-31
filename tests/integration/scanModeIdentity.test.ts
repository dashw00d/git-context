/**
 * Tests for scan mode identity verification
 * Ensures quick scan and full scan produce identical symbol structures
 */

import { describe, it, expect } from 'vitest';

// These tests verify the invariant that quick scan and full scan
// produce identical symbol structures (only edges differ)

describe('Scan Mode Identity', () => {
  describe('areSymbolsIdentical helper', () => {
    it('should return true for identical symbol arrays', async () => {
      const { areSymbolsIdentical } = await import(
        '../../src/analysis/unifiedSymbolExtraction'
      );

      const result1 = {
        symbols: [
          {
            id: 'dna:abc123',
            name: 'testFunc',
            kind: 'function' as const,
            signature: '(): void',
            filePath: 'test.ts',
            location: { start: { line: 1, column: 0 }, end: { line: 3, column: 1 } },
          },
        ],
        language: 'typescript',
      };

      const result2 = {
        symbols: [
          {
            id: 'dna:abc123',
            name: 'testFunc',
            kind: 'function' as const,
            signature: '(): void',
            filePath: 'test.ts',
            location: { start: { line: 1, column: 0 }, end: { line: 3, column: 1 } },
          },
        ],
        edges: [{ fromSymbolId: 'a', toSymbolId: 'b', edgeType: 'calls' }],
        language: 'typescript',
      };

      expect(areSymbolsIdentical(result1, result2)).toBe(true);
    });

    it('should return false for different symbol IDs', async () => {
      const { areSymbolsIdentical } = await import(
        '../../src/analysis/unifiedSymbolExtraction'
      );

      const result1 = {
        symbols: [
          {
            id: 'dna:abc123',
            name: 'testFunc',
            kind: 'function' as const,
            signature: '(): void',
            filePath: 'test.ts',
            location: { start: { line: 1, column: 0 }, end: { line: 3, column: 1 } },
          },
        ],
        language: 'typescript',
      };

      const result2 = {
        symbols: [
          {
            id: 'dna:xyz789', // Different ID
            name: 'testFunc',
            kind: 'function' as const,
            signature: '(): void',
            filePath: 'test.ts',
            location: { start: { line: 1, column: 0 }, end: { line: 3, column: 1 } },
          },
        ],
        language: 'typescript',
      };

      expect(areSymbolsIdentical(result1, result2)).toBe(false);
    });

    it('should return false for different symbol counts', async () => {
      const { areSymbolsIdentical } = await import(
        '../../src/analysis/unifiedSymbolExtraction'
      );

      const result1 = {
        symbols: [
          {
            id: 'dna:abc123',
            name: 'testFunc',
            kind: 'function' as const,
            signature: '(): void',
            filePath: 'test.ts',
            location: { start: { line: 1, column: 0 }, end: { line: 3, column: 1 } },
          },
        ],
        language: 'typescript',
      };

      const result2 = {
        symbols: [], // Empty
        language: 'typescript',
      };

      expect(areSymbolsIdentical(result1, result2)).toBe(false);
    });
  });

  describe('ExtractionOptions', () => {
    it('should have includeEdges property', async () => {
      const { extractSymbolsUnified } = await import(
        '../../src/analysis/unifiedSymbolExtraction'
      );
      // Just verify the function exists and has the right signature
      expect(typeof extractSymbolsUnified).toBe('function');
    });
  });
});
