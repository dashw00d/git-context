import { RefactorBundleFacts } from '../facts/types';

/**
 * Extract standardized stats from RefactorBundleFacts
 * Used consistently across UI components
 */
export function formatStats(facts: RefactorBundleFacts): {
  missing: number;
  zombies: number;
  dead: number;
  replaced: number;
} {
  return {
    missing: facts.findings.incompleteness.missing,
    zombies: facts.findings.incompleteness.zombies,
    dead: facts.findings.legacyAudit.dead,
    replaced: facts.findings.legacyAudit.replacedLeftovers.length,
  };
}
