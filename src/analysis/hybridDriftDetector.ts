import { IntendedState } from '../facts/intendedMap';
import { HybridFact, isCstFact } from '../types/cstFacts';
import { logDebug } from '../utils/logger';
import { getCstTimelineManager, getPriorVersionInChain } from './cstTimeline';
import type { ScopeSet } from '../facts/scope';

export interface HybridDrift {
  fact: HybridFact;
  type: 'missing' | 'zombie' | 'divergent' | 'modified';
  expected?: IntendedState;
  timelineDelta?: Array<{ version: string; delta: any }>;
}

/**
 * Detect hybrid drifts (CST facts + semantic symbols)
 * For CST-only languages and hybrid augmentation
 * Validates version is in expected timeline chain (fail-fast behavior)
 */
export async function detectHybridDrift(
  filePath: string,
  currentFacts: HybridFact[],
  intended: Map<string, IntendedState>,
  currentVersion: string,
  scope: ScopeSet,
  commitShas: string[]
): Promise<HybridDrift[]> {
  const drifts: HybridDrift[] = [];
  const timelineManager = getCstTimelineManager();

  const validVersions = new Set(['workspace-unstaged', 'workspace-staged', 'HEAD', ...commitShas]);

  if (!validVersions.has(currentVersion)) {
    throw new Error(
      `[HybridDrift] Invalid version '${currentVersion}' for timeline chain. ` +
        `File: ${filePath}, Expected one of: [${Array.from(validVersions)
          .map(v => v.substring(0, 12))
          .join(', ')}]`
    );
  }

  const priorVersion = getPriorVersionInChain(currentVersion, scope, filePath, commitShas);
  const priorFacts = priorVersion
    ? await timelineManager.getPriorFacts(filePath, priorVersion)
    : null;

  for (const [factKey, expected] of intended) {
    if (!factKey.startsWith(filePath + ':')) continue;

    if (expected.expect === 'present') {
      const found = currentFacts.find(f => f.id === factKey);
      if (!found) {
        const priorSha = priorVersion || expected.lastSha;
        if (priorSha) {
          try {
            const priorFactsForFile = await timelineManager.getPriorFacts(filePath, priorSha);
            if (priorFactsForFile && priorFactsForFile.length > 0) {
              const missingFact = priorFactsForFile.find(f => f.id === factKey);
              if (missingFact) {
                drifts.push({
                  fact: missingFact,
                  type: 'missing',
                  expected,
                });
              }
            }
          } catch (error) {
            logDebug(
              `[HybridDrift] Error retrieving missing fact ${factKey} from ${priorSha}: ${error}`
            );
          }
        }
      }
    }
  }

  for (const fact of currentFacts) {
    const factKey = fact.id;
    const expected = intended.get(factKey);

    if (expected?.expect === 'absent') {
      drifts.push({
        fact,
        type: 'zombie',
        expected,
      });
      continue;
    }

    if (expected && expected.expect === 'present') {
      if (expected.lastName && fact.name !== expected.lastName) {
        drifts.push({
          fact,
          type: 'divergent',
          expected,
        });
        continue;
      }
    }

    let isModified = false;
    let timelineDelta: Array<{ version: string; delta: any }> | undefined;

    if (isCstFact(fact) && fact.timeline.length > 0) {
      const recentDeltas = fact.timeline.slice(-3);
      const hasModifications = recentDeltas.some(
        entry => entry.delta.type === 'modified' || entry.delta.type === 'added'
      );

      if (hasModifications) {
        isModified = true;
        timelineDelta = recentDeltas.map(e => ({
          version: e.version,
          delta: e.delta,
        }));
      }
    }

    if (!isModified && priorFacts) {
      const priorFact = priorFacts.find(p => p.id === fact.id || p.id === fact.id);
      if (priorFact) {
        if (
          priorFact.id !== fact.id ||
          priorFact.location.start.line !== fact.location.start.line
        ) {
          isModified = true;
          timelineDelta = isCstFact(fact)
            ? fact.timeline.map(e => ({
                version: e.version,
                delta: e.delta,
              }))
            : undefined;
        }
      }
    }

    if (isModified) {
      drifts.push({
        fact,
        type: 'modified',
        timelineDelta,
      });
    }
  }

  return drifts;
}

export async function getHybridFactsForFile(
  filePath: string,
  version: string
): Promise<HybridFact[]> {
  const timelineManager = getCstTimelineManager();
  return (await timelineManager.getPriorFacts(filePath, version)) || [];
}
