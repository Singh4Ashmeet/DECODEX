import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { classifyErrors, ErrorCategory, ClassificationResult } from '../services/classifier';
import { AlignmentResult } from '../services/alignment';
import * as cacheModule from '../services/cache';

describe('Classifier Service (classifier.ts)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.GROQ_API_KEY;
  });

  it('returns empty array when alignment contains no errors (only matches)', async () => {
    const alignment: AlignmentResult[] = [
      { index: 0, type: 'match', sourceWord: 'cat', spokenWord: 'cat' },
      { index: 1, type: 'match', sourceWord: 'sat', spokenWord: 'sat' },
    ];
    const results = await classifyErrors(alignment);
    expect(results).toEqual([]);
  });

  it('returns cached results on cache hit without calling classification logic', async () => {
    const cachedResult: ClassificationResult = {
      index: 0,
      sourceWord: 'saw',
      spokenWord: 'was',
      category: 'REV',
      rationale: 'Cached reversal rationale',
    };

    vi.spyOn(cacheModule, 'getCache').mockResolvedValue(JSON.stringify(cachedResult));
    const setCacheSpy = vi.spyOn(cacheModule, 'setCache').mockResolvedValue(undefined);

    const alignment: AlignmentResult[] = [
      { index: 0, type: 'substitution', sourceWord: 'saw', spokenWord: 'was' },
    ];

    const results = await classifyErrors(alignment);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(cachedResult);
    expect(setCacheSpy).not.toHaveBeenCalled();
  });

  describe('Rule-Based Orton-Gillingham Classification Fallback (No GROQ_API_KEY)', () => {
    beforeEach(() => {
      delete process.env.GROQ_API_KEY;
      vi.spyOn(cacheModule, 'getCache').mockResolvedValue(null);
      vi.spyOn(cacheModule, 'setCache').mockResolvedValue(undefined);
    });

    it('classifies direct string reversal ("saw" -> "was") as REV', async () => {
      const alignment: AlignmentResult[] = [
        { index: 0, type: 'substitution', sourceWord: 'saw', spokenWord: 'was' },
      ];
      const results = await classifyErrors(alignment);
      expect(results[0].category).toBe('REV');
      expect(results[0].rationale).toContain('Directional/letter reversal');
    });

    it('classifies letter transposition ("from" -> "form") as REV', async () => {
      const alignment: AlignmentResult[] = [
        { index: 0, type: 'substitution', sourceWord: 'from', spokenWord: 'form' },
      ];
      const results = await classifyErrors(alignment);
      expect(results[0].category).toBe('REV');
    });

    it('classifies directional letter swap ("big" -> "dig") as REV', async () => {
      const alignment: AlignmentResult[] = [
        { index: 0, type: 'substitution', sourceWord: 'big', spokenWord: 'dig' },
      ];
      const results = await classifyErrors(alignment);
      expect(results[0].category).toBe('REV');
    });

    it('classifies omissions as OMI', async () => {
      const alignment: AlignmentResult[] = [
        { index: 0, type: 'omission', sourceWord: 'the', spokenWord: null },
      ];
      const results = await classifyErrors(alignment);
      expect(results[0].category).toBe('OMI');
      expect(results[0].rationale).toContain('was omitted');
    });

    it('classifies insertions as INS', async () => {
      const alignment: AlignmentResult[] = [
        { index: 0, type: 'insertion', sourceWord: null, spokenWord: 'extra' },
      ];
      const results = await classifyErrors(alignment);
      expect(results[0].category).toBe('INS');
      expect(results[0].rationale).toContain('Inserted word');
    });

    it('classifies standard word substitutions as SUB', async () => {
      const alignment: AlignmentResult[] = [
        { index: 0, type: 'substitution', sourceWord: 'house', spokenWord: 'building' },
      ];
      const results = await classifyErrors(alignment);
      expect(results[0].category).toBe('SUB');
      expect(results[0].rationale).toContain('Substituted');
    });

    it('caches new classifications in Redis with 30-day TTL', async () => {
      const setCacheSpy = vi.spyOn(cacheModule, 'setCache').mockResolvedValue(undefined);
      const alignment: AlignmentResult[] = [
        { index: 0, type: 'substitution', sourceWord: 'dog', spokenWord: 'cat' },
      ];

      await classifyErrors(alignment);
      expect(setCacheSpy).toHaveBeenCalledWith(
        'classify:sub:dog:cat',
        expect.any(String),
        2592000
      );
    });
  });

  describe('Mixed Cache Hit and Cache Miss Scenario', () => {
    it('resolves cached items from Redis and uncached items from rule engine', async () => {
      const cachedResult: ClassificationResult = {
        index: 0,
        sourceWord: 'saw',
        spokenWord: 'was',
        category: 'REV',
        rationale: 'Cached reversal',
      };

      vi.spyOn(cacheModule, 'getCache').mockImplementation(async (key: string) => {
        if (key.includes('saw:was')) {
          return JSON.stringify(cachedResult);
        }
        return null;
      });

      const setCacheSpy = vi.spyOn(cacheModule, 'setCache').mockResolvedValue(undefined);

      const alignment: AlignmentResult[] = [
        { index: 0, type: 'substitution', sourceWord: 'saw', spokenWord: 'was' },
        { index: 1, type: 'omission', sourceWord: 'jumped', spokenWord: null },
      ];

      const results = await classifyErrors(alignment);
      expect(results).toHaveLength(2);
      expect(results[0].category).toBe('REV');
      expect(results[0].rationale).toBe('Cached reversal');
      expect(results[1].category).toBe('OMI');
      expect(setCacheSpy).toHaveBeenCalledTimes(1);
    });
  });
});
