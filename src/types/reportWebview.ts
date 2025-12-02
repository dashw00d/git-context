import { z } from 'zod';
import { EvidenceLinkSchema, LlmAnalysisSchema } from '../analysis/llmAnalyst/schemas';
import { BundleFactsSchema } from '../state/schemas';

export type ReportHostMessage =
  | {
      type: 'setData';
      analysis: z.infer<typeof LlmAnalysisSchema>;
      facts: z.infer<typeof BundleFactsSchema>;
    }
  | { type: 'scrollToSection'; sectionId: string };

export type ReportClientMessage =
  | { type: 'ready' }
  | { type: 'evidenceClick'; evidence: z.infer<typeof EvidenceLinkSchema> }
  | { type: 'action'; action: string; data?: any };

export const ReportHostMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('setData'),
    analysis: LlmAnalysisSchema,
    facts: BundleFactsSchema,
  }),
  z.object({ type: z.literal('scrollToSection'), sectionId: z.string() }),
]);

export const ReportClientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ready') }),
  z.object({ type: z.literal('evidenceClick'), evidence: EvidenceLinkSchema }),
  z.object({ type: z.literal('action'), action: z.string(), data: z.any().optional() }),
]);
