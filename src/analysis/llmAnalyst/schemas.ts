import { z } from 'zod';

export const EvidenceLinkSchema = z
  .object({
    path: z.string(),
    description: z.string(),
    symbolId: z.string().optional(),
    filePath: z.string().optional(),
    lineNumber: z.number().optional(),
    origin: z.string().optional(),
  })
  .passthrough();

export const ClaimSchema = z
  .object({
    text: z.string(),
    confidence: z.number(),
    evidence: z.array(EvidenceLinkSchema),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
  })
  .passthrough();

export const ActionSchema = z
  .object({
    description: z.string(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']),
    evidence: z.array(EvidenceLinkSchema),
    effort: z.enum(['xs', 's', 'm', 'l', 'xl']),
    risk: z.enum(['low', 'medium', 'high']),
    dependsOn: z.array(z.string()).optional(),
  })
  .passthrough();

export const AnalysisBlockSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    type: z.enum(['intent', 'drift', 'cleanup', 'summary', 'discovery']),
    claims: z.array(ClaimSchema),
    actions: z.array(ActionSchema),
    confidence: z.number(),
    timestamp: z.string(),
  })
  .passthrough();

export const LlmAnalysisSchema = z
  .object({
    summary: z.string(),
    blocks: z.array(AnalysisBlockSchema),
    metadata: z
      .object({
        totalCalls: z.number(),
        totalTokens: z.number(),
        durationMs: z.number().optional(),
        model: z.string(),
        timestamp: z.string(),
        healthScore: z.number().optional(),
        validatedEvidenceCount: z.number().optional(),
        skipped: z.boolean().optional(),
        reason: z.string().optional(),
      })
      .passthrough(),
    markdown: z.string(),
  })
  .passthrough();
