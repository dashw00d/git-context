/**
 * Tests for pipeline type guards
 */

import { describe, it, expect } from 'vitest';
import {
  hasIntended,
  hasWorking,
  hasScope,
  hasDrift,
  hasLegacy,
  hasCommitFacts,
  hasPlan,
  canRunDrift,
} from '../../../src/analysis/runner/pipelineTypeGuards';
import type { PipelineState } from '../../../src/analysis/runner/pipelineTypes';

// Helper to create minimal pipeline state
function createMinimalState(overrides: Partial<PipelineState> = {}): PipelineState {
  return {
    selectedCommitShas: [],
    includeWorkspace: false,
    completedSteps: new Set(),
    errors: [],
    ...overrides,
  };
}

describe('pipelineTypeGuards', () => {
  describe('hasIntended', () => {
    it('should return true when intended is a valid Map', () => {
      const state = createMinimalState({ intended: new Map() });
      expect(hasIntended(state)).toBe(true);
    });

    it('should return false when intended is undefined', () => {
      const state = createMinimalState();
      expect(hasIntended(state)).toBe(false);
    });
  });

  describe('hasWorking', () => {
    it('should return true when working has required properties', () => {
      const state = createMinimalState({
        working: {
          symbolsById: new Map(),
          symbolsByFile: new Map(),
          edges: [],
          analyzedPaths: new Set(),
        } as any,
      });
      expect(hasWorking(state)).toBe(true);
    });

    it('should return false when working is undefined', () => {
      const state = createMinimalState();
      expect(hasWorking(state)).toBe(false);
    });

    it('should return false when working is missing required properties', () => {
      const state = createMinimalState({
        working: { symbolsById: new Map() } as any,
      });
      expect(hasWorking(state)).toBe(false);
    });
  });

  describe('hasScope', () => {
    it('should return true when scope has allPaths Set', () => {
      const state = createMinimalState({
        scope: {
          allPaths: new Set(),
          commitFiles: new Set(),
          workingChanged: new Set(),
          stagedFiles: new Set(),
          unstagedFiles: new Set(),
          blastRadius: new Set(),
        } as any,
      });
      expect(hasScope(state)).toBe(true);
    });

    it('should return false when scope is undefined', () => {
      const state = createMinimalState();
      expect(hasScope(state)).toBe(false);
    });
  });

  describe('hasDrift', () => {
    it('should return true when drift has required properties', () => {
      const state = createMinimalState({
        drift: {
          missing_symbols: [],
          zombie_symbols: [],
          divergent_symbols: [],
        } as any,
      });
      expect(hasDrift(state)).toBe(true);
    });

    it('should return false when drift is undefined', () => {
      const state = createMinimalState();
      expect(hasDrift(state)).toBe(false);
    });
  });

  describe('hasLegacy', () => {
    it('should return true when legacy has required properties', () => {
      const state = createMinimalState({
        legacy: {
          dead: [],
          legacyUsed: [],
          replacedLeftovers: [],
        } as any,
      });
      expect(hasLegacy(state)).toBe(true);
    });

    it('should return false when legacy is undefined', () => {
      const state = createMinimalState();
      expect(hasLegacy(state)).toBe(false);
    });
  });

  describe('hasCommitFacts', () => {
    it('should return true when commitFacts is an array', () => {
      const state = createMinimalState({ commitFacts: [] });
      expect(hasCommitFacts(state)).toBe(true);
    });

    it('should return false when commitFacts is undefined', () => {
      const state = createMinimalState();
      expect(hasCommitFacts(state)).toBe(false);
    });
  });

  describe('hasPlan', () => {
    it('should return true when plan has required properties', () => {
      const state = createMinimalState({
        plan: {
          fileChanges: new Map(),
          content: new Map(),
          trees: new Map(),
          sizes: new Map(),
          ignoredPaths: new Set(),
        },
      });
      expect(hasPlan(state)).toBe(true);
    });

    it('should return false when plan is undefined', () => {
      const state = createMinimalState();
      expect(hasPlan(state)).toBe(false);
    });
  });

  describe('canRunDrift', () => {
    it('should return true when all required states are present', () => {
      const state = createMinimalState({
        intended: new Map(),
        working: {
          symbolsById: new Map(),
          symbolsByFile: new Map(),
          edges: [],
          analyzedPaths: new Set(),
        } as any,
        scope: {
          allPaths: new Set(),
          commitFiles: new Set(),
          workingChanged: new Set(),
          stagedFiles: new Set(),
          unstagedFiles: new Set(),
          blastRadius: new Set(),
        } as any,
      });
      expect(canRunDrift(state)).toBe(true);
    });

    it('should return false when any required state is missing', () => {
      const state = createMinimalState({
        intended: new Map(),
        // missing working and scope
      });
      expect(canRunDrift(state)).toBe(false);
    });
  });
});
