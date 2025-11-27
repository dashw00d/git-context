/**
 * Intended State Adapter
 *
 * Adapter for buildIntendedMap() logic
 * Provides intended state calculation for tests
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

  // Process commits in order (oldest first)
  for (const commit of commits) {
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

  // Count metrics
  let present = 0;
  let absent = 0;
  let renamed = 0;

  for (const state of intended.values()) {
    if (state.expect === 'present') {
      present++;
    } else if (state.expect === 'absent') {
      absent++;
      if (state.isRenamed) {
        renamed++;
      }
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
