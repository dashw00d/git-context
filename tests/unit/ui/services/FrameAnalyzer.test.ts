import * as fs from 'fs';
import * as path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FrameAnalyzer } from '../../../../src/webview/cockpit/services/FrameAnalyzer';

// Mock dependencies
vi.mock('fs');
vi.mock('path');
vi.mock('vscode', () => ({
  WebviewView: class {},
}));
vi.mock('../../../../../src/analysis/tree-sitter', () => ({
  getTreeSitterParser: vi.fn(),
}));
vi.mock('../../../../../src/analysis/git', () => ({
  GitOperations: class {
    getHistory = vi.fn().mockResolvedValue([]);
  },
}));
vi.mock('../../../../../src/utils/logger', () => ({
  logDebug: vi.fn(),
  logError: vi.fn(),
  logInfo: vi.fn(),
}));
vi.mock('../../../../../src/utils/supportedLanguages', () => ({
  detectLanguage: vi.fn().mockReturnValue('typescript'),
}));

describe('FrameAnalyzer', () => {
  let analyzer: FrameAnalyzer;
  const mockGitRoot = '/mock/root';

  beforeEach(() => {
    analyzer = new FrameAnalyzer();
    vi.clearAllMocks();

    (path.join as any).mockImplementation((...args: string[]) => args.join('/'));
    (path.extname as any).mockReturnValue('.ts');
  });

  describe('analyzeTier1', () => {
    it('should return file content and metadata when file exists', async () => {
      const mockContent = 'line1\nline2\nline3';
      (fs.readFileSync as any).mockReturnValue(mockContent);

      const result = await analyzer.analyzeTier1('frame1', 'src/test.ts', mockGitRoot);

      expect(result).toEqual({
        content: mockContent,
        lineCount: 3,
        language: 'ts',
        filePath: 'src/test.ts',
        fileExists: true,
      });
      expect(fs.readFileSync).toHaveBeenCalledWith('/mock/root/src/test.ts', 'utf8');
    });

    it('should handle missing files gracefully', async () => {
      (fs.readFileSync as any).mockImplementation(() => {
        throw new Error('File not found');
      });

      const result = await analyzer.analyzeTier1('frame1', 'src/missing.ts', mockGitRoot);

      expect(result).toEqual({
        content: '[File not found on disk]',
        lineCount: 1,
        language: 'ts',
        filePath: 'src/missing.ts',
        fileExists: false,
      });
    });
  });

  describe('analyzeTier2', () => {
    it('should extract hotspot score from facts', async () => {
      const facts = {
        evidence: {
          hotspots: [{ path: 'src/test.ts', score: 10 }],
        },
      } as any;

      const result = await analyzer.analyzeTier2('frame1', 'src/test.ts', facts);

      expect(result.hotspotScore).toBe(10);
    });

    it('should extract drift issues from facts', async () => {
      const facts = {
        findings: {
          patternDrift: {
            conventionDrift: {
              driftSymbols: [{ path: 'src/test.ts', name: 'badName', suggestedName: 'goodName' }],
            },
          },
        },
      } as any;

      const result = await analyzer.analyzeTier2('frame1', 'src/test.ts', facts);

      expect(result.drift).toHaveLength(1);
      expect(result.drift[0]).toEqual({
        issue: 'Naming drift',
        severity: 'warning',
        symbol: 'badName',
        detail: 'Suggested: goodName',
      });
    });

    it('should extract edges for blast radius', async () => {
      const facts = {
        evidence: {
          'working.edges': [
            'src/test.ts: funcA -> src/other.ts: funcB (calls)',
            'src/caller.ts: funcC -> src/test.ts: funcA (calls)',
          ],
        },
      } as any;

      const result = await analyzer.analyzeTier2('frame1', 'src/test.ts', facts);

      expect(result.blastRadius.outgoing).toHaveLength(1);
      expect(result.blastRadius.outgoing[0].to).toBe('src/other.ts: funcB');

      expect(result.blastRadius.incoming).toHaveLength(1);
      expect(result.blastRadius.incoming[0].from).toBe('src/caller.ts: funcC');
    });
  });
});
