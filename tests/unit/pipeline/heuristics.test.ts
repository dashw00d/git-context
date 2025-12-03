import { describe, expect, it } from 'vitest';
import { RiskDetector } from '../../../src/analysis/heuristics';
import { FileChange, SymbolDelta } from '../../../src/types';

describe('RiskDetector', () => {
  const detector = new RiskDetector();

  describe('detectRisks', () => {
    it('should detect breaking API changes', () => {
      const files: FileChange[] = [];
      const symbols = {
        added: [],
        removed: [],
        modified: [
          {
            changeType: 'signature_changed',
            symbol: {
              id: 'func_A',
              name: 'publicFunc',
              kind: 'function',
              signature: '(a: string, b: number)',
              location: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
            },
            previousSymbol: {
              id: 'func_A',
              name: 'publicFunc',
              kind: 'function',
              signature: '(a: string)',
              location: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
            },
          } as SymbolDelta,
        ],
      };

      const risks = detector.detectRisks(files, symbols, { added: [], removed: [] });
      expect(risks).toContain('breaking-api');
    });

    it('should detect schema migrations', () => {
      const files: FileChange[] = [
        {
          path: 'src/db/migrations/001_init.sql',
          status: 'A',
        },
      ];
      const symbols = { added: [], removed: [], modified: [] };

      const risks = detector.detectRisks(files, symbols, { added: [], removed: [] });
      expect(risks).toContain('schema-migration');
    });

    it('should detect security changes', () => {
      const files: FileChange[] = [];
      const symbols = {
        added: [
          {
            id: 'auth',
            name: 'validatePassword',
            kind: 'function',
            location: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
            signature: '',
          },
        ],
        removed: [],
        modified: [],
      };

      const risks = detector.detectRisks(files, symbols, { added: [], removed: [] });
      expect(risks).toContain('security');
    });

    it('should detect large refactors', () => {
      const files: FileChange[] = Array.from({ length: 11 }, (_, i) => ({
        path: `file${i}.ts`,
        status: 'M',
      }));
      const symbols = { added: [], removed: [], modified: [] };

      const risks = detector.detectRisks(files, symbols, { added: [], removed: [] });
      expect(risks).toContain('refactor');
    });
  });
});
