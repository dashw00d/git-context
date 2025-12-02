import { describe, expect, it } from 'vitest';
import { ReportClientMessageSchema, ReportHostMessageSchema } from '../../src/types/reportWebview';

const sampleFacts = {
  version: '1.0',
  generated_at: new Date().toISOString(),
  confidence: 0.9,
  bundle: {
    oldestSha: 'aaa111',
    newestSha: 'bbb222',
    shas: ['aaa111', 'bbb222'],
  },
  scope: { files: 1, blastRadius: 0 },
  intended: { present: 0, absent: 0, renamed: 0 },
  working: { symbols: 0, edges: 0 },
  evidence: {},
  findings: {},
};

const sampleAnalysis = {
  summary: 'Summary',
  blocks: [
    {
      id: 'b1',
      title: 'Block',
      type: 'summary',
      claims: [
        { text: 'Claim', confidence: 0.8, evidence: [], severity: 'medium' },
      ],
      actions: [
        {
          description: 'Do thing',
          priority: 'medium',
          evidence: [],
          effort: 'm',
          risk: 'medium',
        },
      ],
      confidence: 0.9,
      timestamp: new Date().toISOString(),
    },
  ],
  metadata: {
    totalCalls: 1,
    totalTokens: 10,
    model: 'gpt',
    timestamp: new Date().toISOString(),
  },
  markdown: '# Summary',
};

describe('Report webview message schemas', () => {
  it('accepts valid host setData message', () => {
    const parsed = ReportHostMessageSchema.safeParse({
      type: 'setData',
      analysis: sampleAnalysis,
      facts: sampleFacts,
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects host messages missing required fields', () => {
    const parsed = ReportHostMessageSchema.safeParse({ type: 'setData', facts: sampleFacts });
    expect(parsed.success).toBe(false);
  });

  it('accepts valid client evidenceClick', () => {
    const parsed = ReportClientMessageSchema.safeParse({
      type: 'evidenceClick',
      evidence: { path: 'findings.drift[0]', description: 'Test' },
    });

    expect(parsed.success).toBe(true);
  });
});
