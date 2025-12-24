import { describe, it, expect } from 'vitest';
import { computeSymbolRefCounts } from '../../../../src/webview/cockpit/hooks/useSymbolRefCounts';

describe('computeSymbolRefCounts', () => {
  it('counts incoming and outgoing refs for DNA edge IDs', () => {
    const bundleFacts = {
      evidence: {
        'working.symbols': [
          {
            id: 'dna:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            name: 'funcA',
            kind: 'function',
            signature: 'funcA()',
            filePath: 'src/test.ts',
          },
        ],
        'working.edges': [
          'src/test.ts:dna:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa -> src/other.ts:dna:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb (calls)',
          'src/caller.ts:dna:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc -> src/test.ts:dna:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa (calls)',
        ],
      },
    } as any;

    const result = computeSymbolRefCounts(bundleFacts, 'src/test.ts');

    expect(
      result.outgoing.get('dna:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    ).toBe(1);
    expect(
      result.incoming.get('dna:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    ).toBe(1);
  });
});
