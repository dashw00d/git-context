import { beforeEach, describe, expect, it } from 'vitest';
import {
  assignDNAIds,
  computeSymbolDNA,
  configureDNA,
  getDNAConfig,
} from '../../../src/analysis/symbolDna';
import { SymbolInfo } from '../../../src/types';

describe('DNA Integration Tests', () => {
  beforeEach(() => {
    configureDNA({ maxDepth: 5, ngramSizes: [2, 3] });
  });

  describe('Configuration', () => {
    it('should default to standard config', () => {
      const config = getDNAConfig();
      expect(config.ngramSizes).toEqual([2, 3]);
    });

    it('should allow configuration', () => {
      configureDNA({ ngramSizes: [2, 3, 4] });
      const config = getDNAConfig();
      expect(config.ngramSizes).toEqual([2, 3, 4]);
    });
  });

  describe('DNA Computation', () => {
    it('should compute stable DNA for same function', async () => {
      const symbol: SymbolInfo = {
        id: 'test',
        name: 'foo',
        kind: 'function',
        signature: '(x: number)',
        filePath: 'test.ts',
        location: { start: { line: 1, column: 0 }, end: { line: 3, column: 0 } },
      };

      const bodyText = 'function foo(x) { return x + 1; }';
      const dna1 = await computeSymbolDNA(symbol, bodyText);
      const dna2 = await computeSymbolDNA(symbol, bodyText);

      expect(dna1).toBe(dna2);
      expect(dna1).toHaveLength(68); // dna: prefix (4) + sha256 hash (64) = 68
    });

    it('should produce different DNA for different structure', async () => {
      const symbol1: SymbolInfo = {
        id: 'test1',
        name: 'foo',
        kind: 'function',
        signature: '(x: number)',
        filePath: 'test1.ts',
        location: { start: { line: 1, column: 0 }, end: { line: 3, column: 0 } },
      };

      const symbol2: SymbolInfo = {
        id: 'test2',
        name: 'bar',
        kind: 'class',
        signature: '(x: number)',
        filePath: 'test2.ts',
        location: { start: { line: 1, column: 0 }, end: { line: 3, column: 0 } },
      };

      const dna1 = await computeSymbolDNA(symbol1, 'function foo(x) { return x; }');
      const dna2 = await computeSymbolDNA(symbol2, 'class bar { constructor(x) {} }');

      expect(dna1).not.toBe(dna2);
    });

    it('should compute enhanced DNA with AST n-grams', async () => {
      const symbol: SymbolInfo = {
        id: 'test',
        name: 'foo',
        kind: 'function',
        signature: '(x: number)',
        filePath: 'test.ts',
        location: { start: { line: 1, column: 0 }, end: { line: 3, column: 0 } },
      };

      const bodyText = 'function foo(x) { return x + 1; }';
      const dna = await computeSymbolDNA(symbol, bodyText, 'typescript');

      expect(dna).toBeTruthy();
      expect(dna).toHaveLength(68); // dna: prefix (4) + sha256 hash (64) = 68
    });
  });

  describe('DNA Assignment', () => {
    it('should assign DNA IDs to symbols', async () => {
      const symbols: SymbolInfo[] = [
        {
          id: 'func1',
          name: 'foo',
          kind: 'function',
          signature: '()',
          filePath: 'test.ts',
          location: { start: { line: 1, column: 0 }, end: { line: 3, column: 0 } },
        },
      ];

      const bodyTexts = new Map([['test.ts', 'function foo() { return 42; }']]);
      const result = await assignDNAIds(symbols, bodyTexts, 'typescript');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBeTruthy();
      expect(result[0].dnaVersion).toBe(2);
    });

    it('should handle multiple symbols efficiently', async () => {
      const symbols: SymbolInfo[] = [
        {
          id: 'func1',
          name: 'foo',
          kind: 'function',
          signature: '()',
          filePath: 'file1.ts',
          location: { start: { line: 1, column: 0 }, end: { line: 3, column: 0 } },
        },
        {
          id: 'func2',
          name: 'bar',
          kind: 'function',
          signature: '()',
          filePath: 'file2.ts',
          location: { start: { line: 5, column: 0 }, end: { line: 7, column: 0 } },
        },
      ];

      const bodyTexts = new Map([
        ['file1.ts', 'function foo() { return 42; }'],
        ['file2.ts', 'function bar() { return 100; }'],
      ]);

      const result = await assignDNAIds(symbols, bodyTexts, 'typescript');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBeTruthy();
      expect(result[1].id).toBeTruthy();
    });
  });
});
