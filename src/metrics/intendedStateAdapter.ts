/**
 * Intended State Adapter
 *
 * TEST-ONLY ADAPTER: Simplified intended state calculation for tests
 *
 * IMPORTANT: This is a simplified version for test fixtures that don't have database access.
 * The real pipeline uses buildIntendedMap() from facts/intendedMap.ts (called by intendedStep.ts).
 *
 * Real function: buildIntendedMap(commitShas) in src/facts/intendedMap.ts
 * Runner step: createIntendedStep() in src/analysis/runner/steps/intendedStep.ts
 *
 * This adapter provides test metrics based on commit symbol data without requiring
 * database queries. For production, use buildIntendedMap() directly.
 */

import { IntendedState } from '../facts/intendedMap';

export interface IntendedMetrics {
  present: number;
  absent: number;
  renamed: number;
  totalSymbols: number;
}

/**
 * Build intended state from commit history
 * Simplified version for tests - real buildIntendedMap requires database access.
 * This provides test metrics based on commit symbol data.
 * For production, use buildIntendedMap() from facts/intendedMap.ts
 */
export function buildIntendedStateFromCommits(
  commits: Array<{
    sha: string;
    symbols: Array<{
      id: string;
      name: string;
      status: 'added' | 'modified' | 'removed';
      changeType?: string;
    }>;
    renames?: Array<{
      oldId: string;
      newId: string;
      confidence: number;
    }>;
  }>
): IntendedMetrics {
  const intended = new Map<string, IntendedState>();

  // Sort commits oldest→newest by SHA order (assuming SHA order implies chronological order)
  // In a real git repository, newer commits have higher SHA values lexicographically
  const sortedCommits = commits.sort((a, b) => a.sha.localeCompare(b.sha));

  // Process commits in chronological order (oldest first)
  for (const commit of sortedCommits) {
    // Process renames first
    if (commit.renames) {
      for (const rename of commit.renames) {
        // Mark old symbol as absent (renamed)
        intended.set(rename.oldId, {
          expect: 'absent',
          lastSha: commit.sha,
          isRenamed: true
        });
        // Mark new symbol as present (renamed from old)
        intended.set(rename.newId, {
          expect: 'present',
          lastSha: commit.sha,
          isRenamed: true
        });
      }
    }

    // Process symbols
    for (const symbol of commit.symbols) {
      if (symbol.status === 'added' || symbol.status === 'modified') {
        intended.set(symbol.id, {
          expect: 'present',
          lastSha: commit.sha
        });
      } else if (symbol.status === 'removed') {
        intended.set(symbol.id, {
          expect: 'absent',
          lastSha: commit.sha
        });
      }
    }
  }

  // Count metrics - renames are counted as present symbols
  let present = 0;
  let absent = 0;
  let renamed = 0;

  for (const state of intended.values()) {
    if (state.expect === 'present') {
      present++;
      if (state.isRenamed) {
        renamed++;
      }
    } else if (state.expect === 'absent') {
      absent++;
    }
  }

  return {
    present,
    absent,
    renamed,
    totalSymbols: intended.size
  };
}

/**
 * Create IntendedState map from metrics
 */
export function createIntendedMap(
  symbols: Array<{ id: string; expect: 'present' | 'absent'; lastSha?: string }>
): Map<string, IntendedState> {
  const intended = new Map<string, IntendedState>();

  for (const symbol of symbols) {
    intended.set(symbol.id, {
      expect: symbol.expect,
      lastSha: symbol.lastSha || 'test-sha'
    });
  }

  return intended;
}
