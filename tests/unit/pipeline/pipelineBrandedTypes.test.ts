/**
 * Tests for pipeline branded types
 */

import { describe, it, expect } from 'vitest';
import {
  isValidSymbolId,
  isValidDnaHash,
  isValidCommitSha,
  toSymbolId,
  toDnaHash,
  toCommitSha,
  trySymbolId,
  tryDnaHash,
  tryCommitSha,
} from '../../../src/analysis/runner/pipelineBrandedTypes';

describe('pipelineBrandedTypes', () => {
  describe('isValidDnaHash', () => {
    it('should accept valid DNA hash format', () => {
      const validHash = 'dna:' + 'a'.repeat(64);
      expect(isValidDnaHash(validHash)).toBe(true);
    });

    it('should reject invalid DNA hash format', () => {
      expect(isValidDnaHash('abc123')).toBe(false);
      expect(isValidDnaHash('dna:abc')).toBe(false);
      expect(isValidDnaHash('dna:' + 'g'.repeat(64))).toBe(false); // non-hex
      expect(isValidDnaHash('')).toBe(false);
      expect(isValidDnaHash(null as any)).toBe(false);
      expect(isValidDnaHash(undefined as any)).toBe(false);
    });
  });

  describe('isValidCommitSha', () => {
    it('should accept valid commit SHA format', () => {
      const validSha = 'a'.repeat(40);
      expect(isValidCommitSha(validSha)).toBe(true);
    });

    it('should reject invalid commit SHA format', () => {
      expect(isValidCommitSha('abc123')).toBe(false);
      expect(isValidCommitSha('a'.repeat(39))).toBe(false);
      expect(isValidCommitSha('a'.repeat(41))).toBe(false);
      expect(isValidCommitSha('g'.repeat(40))).toBe(false); // non-hex
      expect(isValidCommitSha('')).toBe(false);
    });
  });

  describe('isValidSymbolId', () => {
    it('should accept DNA hash format', () => {
      const validHash = 'dna:' + 'a'.repeat(64);
      expect(isValidSymbolId(validHash)).toBe(true);
    });

    it('should accept symbol:number format', () => {
      expect(isValidSymbolId('symbol:123')).toBe(true);
      expect(isValidSymbolId('symbol:0')).toBe(true);
    });

    it('should accept path:kind:name format', () => {
      expect(isValidSymbolId('src/file.ts:function:myFunc')).toBe(true);
      expect(isValidSymbolId('path:class:MyClass')).toBe(true);
    });

    it('should reject invalid formats', () => {
      expect(isValidSymbolId('invalid')).toBe(false);
      expect(isValidSymbolId('')).toBe(false);
    });
  });

  describe('toDnaHash', () => {
    it('should convert valid hash', () => {
      const validHash = 'dna:' + 'a'.repeat(64);
      expect(toDnaHash(validHash)).toBe(validHash);
    });

    it('should throw on invalid hash', () => {
      expect(() => toDnaHash('invalid')).toThrow('Invalid DnaHash format');
    });
  });

  describe('toCommitSha', () => {
    it('should convert valid SHA', () => {
      const validSha = 'a'.repeat(40);
      expect(toCommitSha(validSha)).toBe(validSha);
    });

    it('should throw on invalid SHA', () => {
      expect(() => toCommitSha('invalid')).toThrow('Invalid CommitSha format');
    });
  });

  describe('toSymbolId', () => {
    it('should convert valid symbol ID', () => {
      const validId = 'src/file.ts:function:myFunc';
      expect(toSymbolId(validId)).toBe(validId);
    });

    it('should throw on invalid symbol ID', () => {
      expect(() => toSymbolId('invalid')).toThrow('Invalid SymbolId format');
    });
  });

  describe('try* functions', () => {
    it('tryDnaHash should return undefined for invalid', () => {
      expect(tryDnaHash('invalid')).toBeUndefined();
      expect(tryDnaHash('dna:' + 'a'.repeat(64))).toBeDefined();
    });

    it('tryCommitSha should return undefined for invalid', () => {
      expect(tryCommitSha('invalid')).toBeUndefined();
      expect(tryCommitSha('a'.repeat(40))).toBeDefined();
    });

    it('trySymbolId should return undefined for invalid', () => {
      expect(trySymbolId('invalid')).toBeUndefined();
      expect(trySymbolId('src:kind:name')).toBeDefined();
    });
  });
});
