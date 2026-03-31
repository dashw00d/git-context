/**
 * Tests for completeness flags migration and tracking
 */

import { describe, it, expect } from 'vitest';
import {
  parseCompletenessFlags,
  serializeCompletenessFlags,
  defaultCompletenessFlags,
} from '../../../src/storage/migrations/add_completeness_flags';

describe('add_completeness_flags migration', () => {
  describe('defaultCompletenessFlags', () => {
    it('should return all false flags', () => {
      const flags = defaultCompletenessFlags();
      expect(flags.symbols).toBe(false);
      expect(flags.edges).toBe(false);
      expect(flags.hotspots).toBe(false);
      expect(flags.drift).toBe(false);
      expect(flags.legacy).toBe(false);
      expect(flags.embeddings).toBe(false);
      expect(flags.llm).toBe(false);
    });
  });

  describe('parseCompletenessFlags', () => {
    it('should return default flags for null input', () => {
      const flags = parseCompletenessFlags(null);
      expect(flags).toEqual(defaultCompletenessFlags());
    });

    it('should return default flags for empty string', () => {
      const flags = parseCompletenessFlags('');
      expect(flags).toEqual(defaultCompletenessFlags());
    });

    it('should parse valid JSON flags', () => {
      const json = JSON.stringify({ symbols: true, edges: true });
      const flags = parseCompletenessFlags(json);
      expect(flags.symbols).toBe(true);
      expect(flags.edges).toBe(true);
      expect(flags.hotspots).toBe(false);
    });

    it('should handle invalid JSON gracefully', () => {
      const flags = parseCompletenessFlags('not valid json');
      expect(flags).toEqual(defaultCompletenessFlags());
    });

    it('should handle partial flags', () => {
      const json = JSON.stringify({ symbols: true });
      const flags = parseCompletenessFlags(json);
      expect(flags.symbols).toBe(true);
      expect(flags.edges).toBe(false);
      expect(flags.hotspots).toBe(false);
    });
  });

  describe('serializeCompletenessFlags', () => {
    it('should serialize partial flags with defaults', () => {
      const json = serializeCompletenessFlags({ symbols: true });
      const parsed = JSON.parse(json);
      expect(parsed.symbols).toBe(true);
      expect(parsed.edges).toBe(false);
      expect(parsed.hotspots).toBe(false);
    });

    it('should serialize full flags', () => {
      const flags = {
        symbols: true,
        edges: true,
        hotspots: true,
        drift: false,
        legacy: true,
        embeddings: false,
        llm: true,
      };
      const json = serializeCompletenessFlags(flags);
      const parsed = JSON.parse(json);
      expect(parsed).toEqual(flags);
    });

    it('should serialize empty object with all false', () => {
      const json = serializeCompletenessFlags({});
      const parsed = JSON.parse(json);
      expect(parsed).toEqual(defaultCompletenessFlags());
    });
  });
});
