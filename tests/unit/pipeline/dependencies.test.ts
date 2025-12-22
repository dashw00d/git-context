import { describe, expect, it } from 'vitest';
import { DependencyExtractor } from '../../../src/analysis/dependencies';
import { EdgeInfo, SymbolInfo } from '../../../src/types';

describe('DependencyExtractor', () => {
  const extractor = new DependencyExtractor();

  describe('extractDependencies (TypeScript)', () => {
    it('should extract imports', () => {
      const content = `
        import { foo } from './utils';
        import * as bar from './bar';
      `;
      const filePath = 'src/test.ts';
      const symbols: SymbolInfo[] = [];

      const edges = extractor.extractDependencies(content, filePath, symbols);

      expect(edges).toHaveLength(2);
      expect(edges).toContainEqual(
        expect.objectContaining({
          from: 'src/test.ts: file',
          to: './utils: module',
          type: 'imports',
        })
      );
      expect(edges).toContainEqual(
        expect.objectContaining({
          from: 'src/test.ts: file',
          to: './bar: module',
          type: 'imports',
        })
      );
    });

    it('should extract function calls', () => {
      const content = `
        function main() {
          helper();
          const x = calculate(10);
        }
      `;
      const filePath = 'src/test.ts';
      const symbols: SymbolInfo[] = [
        {
          id: 'src/test.ts: main',
          dnaId: '',
          name: 'main',
          kind: 'function',
          signature: '()',
          location: { start: { line: 2, column: 0 }, end: { line: 5, column: 0 } },
        },
      ];

      const edges = extractor.extractDependencies(content, filePath, symbols);

      expect(edges).toContainEqual(
        expect.objectContaining({
          from: 'src/test.ts: main',
          to: 'function_helper',
          type: 'calls',
        })
      );
      expect(edges).toContainEqual(
        expect.objectContaining({
          from: 'src/test.ts: main',
          to: 'function_calculate',
          type: 'calls',
        })
      );
    });
  });

  describe('calculateBlastRadius', () => {
    it('should calculate downstream callers', () => {
      const changedSymbols: SymbolInfo[] = [
        {
          id: 'func_A',
          dnaId: '',
          name: 'A',
          kind: 'function',
          location: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
          signature: '',
        },
      ];

      const allEdges: EdgeInfo[] = [
        { from: 'func_B', to: 'func_A', type: 'calls' },
        { from: 'func_C', to: 'func_A', type: 'calls' },
        { from: 'func_A', to: 'func_D', type: 'calls' },
      ];

      const result = extractor.calculateBlastRadius(changedSymbols, allEdges);

      const callers = result.downstreamCallers.get('func_A');
      expect(callers).toHaveLength(2);
      expect(callers?.map(c => c.id).sort()).toEqual(['func_B', 'func_C']);
    });

    it('should calculate upstream dependencies', () => {
      const changedSymbols: SymbolInfo[] = [
        {
          id: 'func_A',
          dnaId: '',
          name: 'A',
          kind: 'function',
          location: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
          signature: '',
        },
      ];

      const allEdges: EdgeInfo[] = [
        { from: 'func_B', to: 'func_A', type: 'calls' },
        { from: 'func_A', to: 'func_D', type: 'calls' },
      ];

      const result = extractor.calculateBlastRadius(changedSymbols, allEdges);

      const dependencies = result.upstreamDependencies.get('func_A');
      expect(dependencies).toHaveLength(1);
      expect(dependencies?.[0].id).toBe('func_D');
    });
  });
});
