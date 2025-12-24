/**
 * Facts Merger Integration Tests
 *
 * Tests that verify:
 * - Merge priority rules (complete > incomplete, priority_click > added > modified > quick_scan)
 * - path:sha:id key structure works correctly
 * - Database overwrite behavior
 * - Merging quick scan → full scan data
 */

import { describe, it, expect } from 'vitest';
import { mergeFacts } from '../../src/facts/factsMerger';
import type { RefactorBundleFacts } from '../../src/facts/types';

describe('Facts Merger', () => {
  describe('Merge Priority Rules', () => {
    it('should prefer complete symbols over incomplete', () => {
      const globalFacts: RefactorBundleFacts = {
        version: '1.0',
        generated_at: new Date().toISOString(),
        bundle: {
          totalCommits: 1,
          totalFiles: 1,
        },
        evidence: {
          'working.symbols': [
            {
              id: 'dna:abc123',
              name: 'testFunc',
              kind: 'function',
              signature: '(): void',
              filePath: 'test.ts',
              sha: 'HEAD',
              complete: false,
              changeType: 'quick_scan',
            },
          ],
        },
        findings: {},
      };

      const newFacts: RefactorBundleFacts = {
        version: '1.0',
        generated_at: new Date().toISOString(),
        bundle: {
          totalCommits: 1,
          totalFiles: 1,
        },
        evidence: {
          'working.symbols': [
            {
              id: 'dna:abc123',
              name: 'testFunc',
              kind: 'function',
              signature: '(): void',
              filePath: 'test.ts',
              sha: 'HEAD',
              complete: true,
              changeType: 'added',
            },
          ],
        },
        findings: {},
      };

      const merged = mergeFacts(globalFacts, newFacts);
      const mergedSymbols = merged.evidence!['working.symbols'] as any[];

      expect(mergedSymbols.length).toBe(1);
      expect(mergedSymbols[0].complete).toBe(true);
      expect(mergedSymbols[0].changeType).toBe('added');
    });

    it('should prefer incomplete over complete if existing is complete and new is incomplete', () => {
      const globalFacts: RefactorBundleFacts = {
        version: '1.0',
        generated_at: new Date().toISOString(),
        bundle: {
          totalCommits: 1,
          totalFiles: 1,
        },
        evidence: {
          'working.symbols': [
            {
              id: 'dna:abc123',
              name: 'testFunc',
              kind: 'function',
              signature: '(): void',
              filePath: 'test.ts',
              sha: 'HEAD',
              complete: true,
              changeType: 'added',
            },
          ],
        },
        findings: {},
      };

      const newFacts: RefactorBundleFacts = {
        version: '1.0',
        generated_at: new Date().toISOString(),
        bundle: {
          totalCommits: 1,
          totalFiles: 1,
        },
        evidence: {
          'working.symbols': [
            {
              id: 'dna:abc123',
              name: 'testFunc',
              kind: 'function',
              signature: '(): void',
              filePath: 'test.ts',
              sha: 'HEAD',
              complete: false,
              changeType: 'quick_scan',
            },
          ],
        },
        findings: {},
      };

      const merged = mergeFacts(globalFacts, newFacts);
      const mergedSymbols = merged.evidence!['working.symbols'] as any[];

      expect(mergedSymbols.length).toBe(1);
      // Should keep existing complete symbol
      expect(mergedSymbols[0].complete).toBe(true);
      expect(mergedSymbols[0].changeType).toBe('added');
    });

    it('should use changeType priority when completeness is equal', () => {
      const globalFacts: RefactorBundleFacts = {
        version: '1.0',
        generated_at: new Date().toISOString(),
        bundle: {
          totalCommits: 1,
          totalFiles: 1,
        },
        evidence: {
          'working.symbols': [
            {
              id: 'dna:abc123',
              name: 'testFunc',
              kind: 'function',
              signature: '(): void',
              filePath: 'test.ts',
              sha: 'HEAD',
              complete: true,
              changeType: 'quick_scan',
            },
          ],
        },
        findings: {},
      };

      const newFacts: RefactorBundleFacts = {
        version: '1.0',
        generated_at: new Date().toISOString(),
        bundle: {
          totalCommits: 1,
          totalFiles: 1,
        },
        evidence: {
          'working.symbols': [
            {
              id: 'dna:abc123',
              name: 'testFunc',
              kind: 'function',
              signature: '(): void',
              filePath: 'test.ts',
              sha: 'HEAD',
              complete: true,
              changeType: 'priority_click',
            },
          ],
        },
        findings: {},
      };

      const merged = mergeFacts(globalFacts, newFacts);
      const mergedSymbols = merged.evidence!['working.symbols'] as any[];

      expect(mergedSymbols.length).toBe(1);
      expect(mergedSymbols[0].changeType).toBe('priority_click');
    });

    it('should respect priority order: priority_click > added > modified > quick_scan', () => {
      const testCases = [
        { existing: 'quick_scan', new: 'modified', expected: 'modified' },
        { existing: 'modified', new: 'added', expected: 'added' },
        { existing: 'added', new: 'priority_click', expected: 'priority_click' },
        { existing: 'priority_click', new: 'added', expected: 'priority_click' },
        { existing: 'quick_scan', new: 'added', expected: 'added' },
      ];

      for (const testCase of testCases) {
        const globalFacts: RefactorBundleFacts = {
          version: '1.0',
          generated_at: new Date().toISOString(),
          bundle: {
            totalCommits: 1,
            totalFiles: 1,
          },
          evidence: {
            'working.symbols': [
              {
                id: 'dna:abc123',
                name: 'testFunc',
                kind: 'function',
                signature: '(): void',
                filePath: 'test.ts',
                sha: 'HEAD',
                complete: true,
                changeType: testCase.existing,
              },
            ],
          },
          findings: {},
        };

        const newFacts: RefactorBundleFacts = {
          version: '1.0',
          generated_at: new Date().toISOString(),
          bundle: {
            totalCommits: 1,
            totalFiles: 1,
          },
          evidence: {
            'working.symbols': [
              {
                id: 'dna:abc123',
                name: 'testFunc',
                kind: 'function',
                signature: '(): void',
                filePath: 'test.ts',
                sha: 'HEAD',
                complete: true,
                changeType: testCase.new,
              },
            ],
          },
          findings: {},
        };

        const merged = mergeFacts(globalFacts, newFacts);
        const mergedSymbols = merged.evidence!['working.symbols'] as any[];

        expect(mergedSymbols[0].changeType).toBe(
          testCase.expected,
          `Failed for existing: ${testCase.existing}, new: ${testCase.new}`
        );
      }
    });
  });

  describe('path:sha:id Key Structure', () => {
    it('should merge symbols correctly using path:sha:id key', () => {
      const globalFacts: RefactorBundleFacts = {
        version: '1.0',
        generated_at: new Date().toISOString(),
        bundle: {
          totalCommits: 1,
          totalFiles: 2,
        },
        evidence: {
          'working.symbols': [
            {
              id: 'dna:abc123',
              name: 'func1',
              kind: 'function',
              signature: '(): void',
              filePath: 'file1.ts',
              sha: 'HEAD',
              complete: false,
              changeType: 'quick_scan',
            },
            {
              id: 'dna:abc123', // Same ID, different file
              name: 'func2',
              kind: 'function',
              signature: '(): void',
              filePath: 'file2.ts',
              sha: 'HEAD',
              complete: false,
              changeType: 'quick_scan',
            },
          ],
        },
        findings: {},
      };

      const newFacts: RefactorBundleFacts = {
        version: '1.0',
        generated_at: new Date().toISOString(),
        bundle: {
          totalCommits: 1,
          totalFiles: 1,
        },
        evidence: {
          'working.symbols': [
            {
              id: 'dna:abc123',
              name: 'func1',
              kind: 'function',
              signature: '(): void',
              filePath: 'file1.ts',
              sha: 'HEAD',
              complete: true,
              changeType: 'added',
            },
          ],
        },
        findings: {},
      };

      const merged = mergeFacts(globalFacts, newFacts);
      const mergedSymbols = merged.evidence!['working.symbols'] as any[];

      // Should have 2 symbols (file1.ts updated, file2.ts preserved)
      expect(mergedSymbols.length).toBe(2);

      const file1Symbol = mergedSymbols.find(s => s.filePath === 'file1.ts');
      const file2Symbol = mergedSymbols.find(s => s.filePath === 'file2.ts');

      expect(file1Symbol).toBeDefined();
      expect(file1Symbol!.complete).toBe(true);
      expect(file1Symbol!.changeType).toBe('added');

      expect(file2Symbol).toBeDefined();
      expect(file2Symbol!.complete).toBe(false);
      expect(file2Symbol!.changeType).toBe('quick_scan');
    });

    it('should handle different SHAs correctly', () => {
      const globalFacts: RefactorBundleFacts = {
        version: '1.0',
        generated_at: new Date().toISOString(),
        bundle: {
          totalCommits: 1,
          totalFiles: 1,
        },
        evidence: {
          'working.symbols': [
            {
              id: 'dna:abc123',
              name: 'testFunc',
              kind: 'function',
              signature: '(): void',
              filePath: 'test.ts',
              sha: 'commit1',
              complete: false,
              changeType: 'quick_scan',
            },
          ],
        },
        findings: {},
      };

      const newFacts: RefactorBundleFacts = {
        version: '1.0',
        generated_at: new Date().toISOString(),
        bundle: {
          totalCommits: 1,
          totalFiles: 1,
        },
        evidence: {
          'working.symbols': [
            {
              id: 'dna:abc123',
              name: 'testFunc',
              kind: 'function',
              signature: '(): void',
              filePath: 'test.ts',
              sha: 'commit2', // Different SHA
              complete: true,
              changeType: 'added',
            },
          ],
        },
        findings: {},
      };

      const merged = mergeFacts(globalFacts, newFacts);
      const mergedSymbols = merged.evidence!['working.symbols'] as any[];

      // Should have 2 symbols (different SHAs = different keys)
      expect(mergedSymbols.length).toBe(2);

      const commit1Symbol = mergedSymbols.find(s => s.sha === 'commit1');
      const commit2Symbol = mergedSymbols.find(s => s.sha === 'commit2');

      expect(commit1Symbol).toBeDefined();
      expect(commit2Symbol).toBeDefined();
    });
  });

  describe('Edge Merging', () => {
    it('should merge edges correctly', () => {
      const globalFacts: RefactorBundleFacts = {
        version: '1.0',
        generated_at: new Date().toISOString(),
        bundle: {
          totalCommits: 1,
          totalFiles: 1,
        },
        evidence: {
          'working.edges': [
            { from: 'dna:abc', to: 'dna:def', type: 'calls' },
            { from: 'dna:def', to: 'dna:ghi', type: 'calls' },
          ],
        },
        findings: {},
      };

      const newFacts: RefactorBundleFacts = {
        version: '1.0',
        generated_at: new Date().toISOString(),
        bundle: {
          totalCommits: 1,
          totalFiles: 1,
        },
        evidence: {
          'working.edges': [
            { from: 'dna:abc', to: 'dna:def', type: 'calls' }, // Duplicate
            { from: 'dna:xyz', to: 'dna:abc', type: 'imports' }, // New
          ],
        },
        findings: {},
      };

      const merged = mergeFacts(globalFacts, newFacts);
      const mergedEdges = merged.evidence!['working.edges'] as any[];

      // Should have 3 unique edges
      expect(mergedEdges.length).toBe(3);
    });
  });

  describe('Hotspot Merging', () => {
    it('should prefer higher-scored hotspots', () => {
      const globalFacts: RefactorBundleFacts = {
        version: '1.0',
        generated_at: new Date().toISOString(),
        bundle: {
          totalCommits: 1,
          totalFiles: 1,
        },
        evidence: {
          hotspots: [
            { path: 'file1.ts', score: 10 },
            { path: 'file2.ts', score: 5 },
          ],
        },
        findings: {},
      };

      const newFacts: RefactorBundleFacts = {
        version: '1.0',
        generated_at: new Date().toISOString(),
        bundle: {
          totalCommits: 1,
          totalFiles: 1,
        },
        evidence: {
          hotspots: [
            { path: 'file1.ts', score: 15 }, // Higher score
            { path: 'file3.ts', score: 8 },
          ],
        },
        findings: {},
      };

      const merged = mergeFacts(globalFacts, newFacts);
      const mergedHotspots = merged.evidence!.hotspots as any[];

      expect(mergedHotspots.length).toBe(3);

      const file1Hotspot = mergedHotspots.find(h => h.path === 'file1.ts');
      expect(file1Hotspot).toBeDefined();
      expect(file1Hotspot!.score).toBe(15); // Should use higher score
    });
  });

  describe('Findings Merging', () => {
    it('should merge findings correctly', () => {
      const globalFacts: RefactorBundleFacts = {
        version: '1.0',
        generated_at: new Date().toISOString(),
        bundle: {
          totalCommits: 1,
          totalFiles: 1,
        },
        evidence: {},
        findings: {
          incompleteness: {
            missing: [{ symbol_id: 'dna:abc', name: 'missing1' }],
          },
        },
      };

      const newFacts: RefactorBundleFacts = {
        version: '1.0',
        generated_at: new Date().toISOString(),
        bundle: {
          totalCommits: 1,
          totalFiles: 1,
        },
        evidence: {},
        findings: {
          incompleteness: {
            missing: [{ symbol_id: 'dna:def', name: 'missing2' }],
          },
          patternDrift: {
            dominantConvention: 'camelCase',
            driftPercent: 10,
          },
        },
      };

      const merged = mergeFacts(globalFacts, newFacts);

      expect(merged.findings!.incompleteness).toBeDefined();
      expect(merged.findings!.patternDrift).toBeDefined();
      expect(merged.findings!.patternDrift!.dominantConvention).toBe('camelCase');
    });
  });
});

