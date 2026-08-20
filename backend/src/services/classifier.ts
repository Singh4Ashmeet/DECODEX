import CircuitBreaker from 'opossum';
import dotenv from 'dotenv';
import { AlignmentResult } from './alignment';
import { getCache, setCache } from './cache';
import { 
  getLLMProvider, 
  ClassificationRequest, 
  ClassificationResponse,
  LLMProvider 
} from './llmProviders';

dotenv.config();

// Define the classification taxonomy
export type ErrorCategory = 'REV' | 'SUB' | 'OMI' | 'INS' | 'BLD' | 'PAC' | 'UNC';

export interface ClassificationResult {
  index: number;
  sourceWord: string | null;
  spokenWord: string | null;
  category: ErrorCategory;
  rationale: string;
}

/**
 * Generate a normalized cache key for a single error classification.
 * Key is based on (target word, detected phonetic error pattern) - lowercase, trimmed.
 * For omissions/insertions, uses the word type as the pattern.
 */
function getClassificationCacheKey(sourceWord: string | null, spokenWord: string | null): string {
  const src = (sourceWord || '').toLowerCase().trim();
  const spk = (spokenWord || '').toLowerCase().trim();

  // For omissions: sourceWord exists, spokenWord is null/empty
  // For insertions: sourceWord is null/empty, spokenWord exists
  // For substitutions: both exist
  if (!src && spk) {
    return `classify:ins:${spk}`;
  }
  if (src && !spk) {
    return `classify:omi:${src}`;
  }
  return `classify:sub:${src}:${spk}`;
}

function isReversal(src: string, spk: string): boolean {
  if (!src || !spk) return false;
  const s1 = src.toLowerCase().trim();
  const s2 = spk.toLowerCase().trim();

  // 1. Direct string reversal: "was" <-> "saw", "no" <-> "on", "top" <-> "pot"
  if (s1.length > 1 && s1.split('').reverse().join('') === s2) return true;

  // 2. Letter transposition / anagram: "from" <-> "form", "barn" <-> "bran", "felt" <-> "flet"
  if (s1.length >= 3 && s2.length >= 3 && Math.abs(s1.length - s2.length) <= 1) {
    const sorted1 = s1.split('').sort().join('');
    const sorted2 = s2.split('').sort().join('');
    if (sorted1 === sorted2) return true;
  }

  // 3. Directional letter swap anywhere in the word (b/d, p/q, m/w, n/u):
  // e.g. "big" <-> "dig", "bad" <-> "dad", "pat" <-> "qat", "mom" <-> "wow"
  const hasDirectionalChar = /[bdpqmwnu]/.test(s1) || /[bdpqmwnu]/.test(s2);
  if (hasDirectionalChar) {
    const norm1 = s1.replace(/[bdpqmwnu]/g, '_');
    const norm2 = s2.replace(/[bdpqmwnu]/g, '_');
    if (norm1 === norm2) return true;
  }

  return false;
}

function applyRuleBasedOGClassification(errors: AlignmentResult[]): ClassificationResult[] {
  return errors.map(e => {
    let category: ErrorCategory = 'SUB';
    let rationale = 'Word substitution error.';

    if (e.type === 'omission') {
      category = 'OMI';
      rationale = `Word "${e.sourceWord}" was omitted during reading.`;
    } else if (e.type === 'insertion') {
      category = 'INS';
      rationale = `Inserted word "${e.spokenWord}" not present in source.`;
    } else if (e.sourceWord && e.spokenWord) {
      const src = e.sourceWord.toLowerCase().trim();
      const spk = e.spokenWord.toLowerCase().trim();

      if (isReversal(src, spk)) {
        category = 'REV';
        rationale = `Directional/letter reversal: read "${e.spokenWord}" for "${e.sourceWord}".`;
      } else {
        category = 'SUB';
        rationale = `Substituted "${e.spokenWord}" for "${e.sourceWord}".`;
      }
    }

    return {
      index: e.index,
      sourceWord: e.sourceWord,
      spokenWord: e.spokenWord,
      category,
      rationale,
    };
  });
};

/**
 * Classify errors using the configured LLM provider with per-error caching.
 * Each error is cached individually using a normalized key: (sourceWord, spokenWord) - lowercase, trimmed.
 * On cache hit, returns cached classification. On miss, calls LLM provider and caches result with 30-day TTL.
 * Logs cache hit vs miss for hit-rate tracking.
 */
export const classifyErrors = async (alignment: AlignmentResult[]): Promise<ClassificationResult[]> => {
  const errorsOnly = alignment.filter(a => a.type !== 'match');
  if (errorsOnly.length === 0) return [];

  const results: ClassificationResult[] = [];
  const errorsToClassify: AlignmentResult[] = [];
  const errorIndices: number[] = [];

  // Check cache for each error individually
  for (const error of errorsOnly) {
    const cacheKey = getClassificationCacheKey(error.sourceWord, error.spokenWord);
    const cached = await getCache(cacheKey);

    if (cached) {
      console.log(`[Classifier Cache] HIT: ${cacheKey}`);
      results.push(JSON.parse(cached));
    } else {
      console.log(`[Classifier Cache] MISS: ${cacheKey}`);
      errorsToClassify.push(error);
      errorIndices.push(results.length);
      results.push(null as any); // placeholder
    }
  }

  // If there are cache misses, call the LLM provider for those errors
  if (errorsToClassify.length > 0) {
    console.log(`[Classifier] Calling LLM provider for ${errorsToClassify.length} uncached error(s)...`);
    
    const provider = getLLMProvider();
    
    const request: ClassificationRequest = {
      errors: errorsToClassify.map(e => ({
        index: e.index,
        sourceWord: e.sourceWord,
        spokenWord: e.spokenWord,
        type: e.type,
      })),
    };

    let classifiedResults: ClassificationResponse[];
    
    try {
      classifiedResults = await provider.classifyErrors(request);
    } catch (err: any) {
      console.warn(`LLM provider failed. Using Orton-Gillingham rule engine fallback:`, err.message);
      classifiedResults = applyRuleBasedOGClassification(errorsToClassify);
    }

    // Store each result in cache and fill in the results array
    for (let i = 0; i < classifiedResults.length; i++) {
      const result = classifiedResults[i];
      const error = errorsToClassify[i];
      const resultIndex = errorIndices[i];

      const cacheKey = getClassificationCacheKey(error.sourceWord, error.spokenWord);

      // Only cache if not a fallback result
      const isFallback = result.rationale === 'Fallback applied due to service timeout/error.';
      if (!isFallback) {
        await setCache(cacheKey, JSON.stringify(result), 2592000); // 30 days TTL
      }

      results[resultIndex] = {
        index: result.index,
        sourceWord: result.sourceWord,
        spokenWord: result.spokenWord,
        category: result.category,
        rationale: result.rationale,
      };
    }
  }

  return results;
};

export { applyRuleBasedOGClassification, getClassificationCacheKey };