/**
 * Runtime schemas for pipeline state validation
 * These complement compile-time TypeScript types with runtime checks
 */

import { z } from 'zod';

// ============================================================================
// Base Schemas
// ============================================================================

export const CommitShaSchema = z
  .string()
  .refine(val => /^[a-f0-9]{40}$/.test(val), { message: 'Invalid commit SHA format' });

export const DnaHashSchema = z
  .string()
  .refine(val => /^dna:[a-f0-9]{64}$/.test(val), { message: 'Invalid DNA hash format' });

export const SymbolIdSchema = z
  .string()
  .refine(
    val => /^dna:[a-f0-9]{64}$/.test(val) || /^symbol:\d+$/.test(val) || /.+:.+:.+/.test(val),
    { message: 'Invalid symbol ID format' }
  );

// ============================================================================
// IntendedState Schema
// ============================================================================

export const IntendedStateSchema = z.object({
  expect: z.enum(['present', 'absent']),
  lastName: z.string().optional(),
  lastPath: z.string().optional(),
  lastSig: z.string().optional(),
  lastSha: z.string(), // Relaxed: can be any string in practice
  isRenamed: z.boolean().optional(),
});

export type IntendedStateFromSchema = z.infer<typeof IntendedStateSchema>;

/**
 * Validate intended map entries
 */
export function validateIntendedMap(map: unknown): boolean {
  if (!(map instanceof Map)) return false;
  for (const [key, value] of map.entries()) {
    if (typeof key !== 'string') return false;
    if (!IntendedStateSchema.safeParse(value).success) return false;
  }
  return true;
}

// ============================================================================
// ScopeSet Schema
// ============================================================================

export const ScopeSetSchema = z.object({
  commitFiles: z.instanceof(Set<string>),
  workingChanged: z.instanceof(Set<string>),
  stagedFiles: z.instanceof(Set<string>),
  unstagedFiles: z.instanceof(Set<string>),
  blastRadius: z.instanceof(Set<string>),
  allPaths: z.instanceof(Set<string>),
  fileVersionMap: z.instanceof(Map<string, string>).optional(),
});

// ============================================================================
// Location Schema
// ============================================================================

export const LocationSchema = z.object({
  start: z.object({ line: z.number(), column: z.number() }),
  end: z.object({ line: z.number(), column: z.number() }),
});

// ============================================================================
// SymbolContext Schema (simplified)
// ============================================================================

export const SymbolContextSchema = z.object({
  id: z.number(),
  symbol_id: z.string(), // DNA hash
  name: z.string(),
  kind: z.string(),
  signature: z.string().optional(),
  dnaId: z.string().optional(), // Legacy field
  filePath: z.string().optional(),
  loc_pre: LocationSchema.optional(),
  loc_post: LocationSchema.optional(),
  mod_reason: z
    .enum([
      'body_changed',
      'signature_changed',
      'doc_changed',
      'visibility_changed',
      'annotation_changed',
    ])
    .optional(),
  diff_snippet_pre: z.string().optional(),
  diff_snippet_post: z.string().optional(),
});

// ============================================================================
// EdgeContext Schema
// ============================================================================

export const EdgeContextSchema = z.object({
  from_symbol_id: z.string(),
  to_symbol_id: z.string(),
  edge_type: z.enum(['calls', 'imports', 'uses', 'extends', 'implements']),
  change_type: z.enum(['added', 'modified', 'signature_changed', 'removed', 'renamed', 'moved']),
  confidence: z.number(),
  is_resolved: z.boolean(),
});

// ============================================================================
// WorkingSnapshot Schema
// ============================================================================

export const WorkingSnapshotSchema = z.object({
  symbolsById: z.custom<Map<string, unknown>>(val => val instanceof Map),
  symbolsByFile: z.custom<Map<string, unknown[]>>(val => val instanceof Map),
  edges: z.array(z.any()), // Relaxed for flexibility
  analyzedPaths: z.instanceof(Set<string>),
});

// ============================================================================
// DriftFindings Schema (simplified)
// ============================================================================

export const DriftFindingsSchema = z.object({
  missing_symbols: z.array(
    z.object({
      symbol_id: z.string(),
      expected: IntendedStateSchema,
      introducedAtVersion: z.string().optional(),
      resolvedAtVersion: z.string().optional(),
      versionDescription: z.string().optional(),
    })
  ),
  zombie_symbols: z.array(
    z.object({
      symbol_id: z.string(),
      expected: IntendedStateSchema,
      found: z.any(), // SymbolContext
      introducedAtVersion: z.string().optional(),
      resolvedAtVersion: z.string().optional(),
      versionDescription: z.string().optional(),
    })
  ),
  divergent_symbols: z.array(z.any()),
  missing_edges: z.array(z.any()).optional(),
  zombie_edges: z.array(z.any()).optional(),
  hotspots: z.array(z.any()).optional(),
  conventionDrift: z.any().optional(),
  mixedConventionFiles: z.array(z.any()).optional(),
  divergentClusters: z.array(z.any()).optional(),
  suggestedConsolidations: z.array(z.any()).optional(),
  unresolved_callers: z.array(z.any()).optional(),
  hybridDrifts: z.array(z.any()).optional(),
});

// ============================================================================
// LegacyAuditResult Schema
// ============================================================================

export const LegacyAuditResultSchema = z.object({
  dead: z.array(z.any()),
  legacyUsed: z.array(z.any()),
  replacedLeftovers: z.array(
    z.object({
      old: z.any(),
      new: z.any(),
      confidence: z.number(),
    })
  ),
});

// ============================================================================
// Schema Registry
// ============================================================================

export const STEP_OUTPUT_SCHEMAS: Record<string, z.ZodSchema> = {
  scope: ScopeSetSchema,
  working: WorkingSnapshotSchema,
  drift: DriftFindingsSchema,
  legacy: LegacyAuditResultSchema,
};

/**
 * Get schema for a step output
 */
export function getStepOutputSchema(outputKey: string): z.ZodSchema | undefined {
  return STEP_OUTPUT_SCHEMAS[outputKey];
}

/**
 * Validate a step output against its schema
 */
export function validateStepOutput(
  outputKey: string,
  output: unknown
): { success: boolean; errors?: string[] } {
  const schema = getStepOutputSchema(outputKey);
  if (!schema) {
    return { success: true }; // No schema means no validation required
  }

  const result = schema.safeParse(output);
  if (result.success) {
    return { success: true };
  }

  const errors = result.error.errors.map(e => {
    const path = e.path.length > 0 ? e.path.join('.') : 'root';
    return `${path}: ${e.message}`;
  });

  return { success: false, errors };
}
