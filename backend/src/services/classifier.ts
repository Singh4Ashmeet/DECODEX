import OpenAI from 'openai';
import CircuitBreaker from 'opossum';
import dotenv from 'dotenv';
import { AlignmentResult } from './alignment';
import { getCache, setCache } from './cache';

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

const classificationPrompt = `
You are an expert reading specialist trained in the Orton-Gillingham approach.
Given a list of reading errors (insertions, omissions, substitutions), classify each error into ONE of the following categories:
- REV: Reversal or Transposition (e.g., 'was' for 'saw', 'no' for 'on', 'from' for 'form', 'b' for 'd', 'p' for 'q', 'w' for 'm')
- SUB: Substitution (e.g., 'house' for 'horse' due to visual similarity, or completely different word)
- OMI: Omission (skipped a word)
- INS: Insertion (added a word)
- BLD: Blend breakdown (e.g., 'st-op' instead of 'stop')
- PAC: Pacing/Self-correction (stumbling, repeating, then fixing)
- UNC: Uncertain (cannot determine with confidence)

IMPORTANT RULE FOR REV (Reversals):
If the spoken word is a string reversal (e.g. 'was' for 'saw'), a letter transposition (e.g. 'from' for 'form', 'felt' for 'flet'), or a directional letter swap (e.g. 'big' for 'dig', 'bad' for 'dad'), you MUST classify it as REV.

Respond ONLY with a JSON object containing a single key "classifications" whose value is an array of objects.
Each object must have exactly these keys: "index" (integer), "category" (string, one of the codes above), "rationale" (string, ≤30 words).
Example response format:
{"classifications": [{"index": 0, "category": "REV", "rationale": "Reversed letter order: read 'was' for 'saw'."}]}
`;

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
}

const getGroqClient = () => {
  const apiKey = process.env.GROQ_API_KEY || 'dummy_groq_key';
  return {
    client: new OpenAI({ apiKey, baseURL: 'https://api.groq.com/openai/v1' }),
    model: 'llama-3.3-70b-versatile',
  };
};

const _classifyErrors = async (errors: AlignmentResult[]): Promise<ClassificationResult[]> => {
  const hasGroq = Boolean(process.env.GROQ_API_KEY);

  if (!hasGroq) {
    return applyRuleBasedOGClassification(errors);
  }

  const { client, model } = getGroqClient();

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: classificationPrompt },
        { role: 'user', content: JSON.stringify(errors) }
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content || '{"classifications": []}';
    let parsed: { classifications?: any[] };

    try {
      parsed = JSON.parse(content);
    } catch {
      console.error('Failed to parse Groq LLM JSON response:', content);
      parsed = { classifications: [] };
    }

    return errors.map(e => {
      const classification = parsed.classifications?.find((c: any) => c.index === e.index);
      const fallbackCat = (e.sourceWord && e.spokenWord && isReversal(e.sourceWord, e.spokenWord)) ? 'REV' : 'SUB';
      return {
        index: e.index,
        sourceWord: e.sourceWord,
        spokenWord: e.spokenWord,
        category: (classification?.category as ErrorCategory) || fallbackCat,
        rationale: classification?.rationale || 'Orton-Gillingham classification applied.',
      };
    });
  } catch (err: any) {
    console.warn(`Groq LLM API call (${model}) failed. Using smart Orton-Gillingham rule engine:`, err.message);
    return applyRuleBasedOGClassification(errors);
  }
};

// Circuit Breaker configuration
const breakerOptions = {
  timeout: 10000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
};

const classifierBreaker = new CircuitBreaker(_classifyErrors, breakerOptions);

classifierBreaker.fallback((errors: AlignmentResult[]) => {
  console.warn('Classifier circuit breaker OPEN or timeout. Using Orton-Gillingham rule engine fallback.');
  return applyRuleBasedOGClassification(errors);
});

/**
 * Classify errors with per-error caching.
 * Each error is cached individually using a normalized key: (sourceWord, spokenWord) - lowercase, trimmed.
 * On cache hit, returns cached classification. On miss, calls GPT-4o-mini (via Groq) and caches result with 30-day TTL.
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

  // If there are cache misses, call the LLM for those errors
  if (errorsToClassify.length > 0) {
    console.log(`[Classifier] Calling Groq LLM for ${errorsToClassify.length} uncached error(s)...`);
    const classifiedResults = await classifierBreaker.fire(errorsToClassify);

    // Store each result in cache and fill in the results array
    for (let i = 0; i < classifiedResults.length; i++) {
      const result = classifiedResults[i];
      const error = errorsToClassify[i];
      const resultIndex = errorIndices[i];

      const cacheKey = getClassificationCacheKey(error.sourceWord, error.spokenWord);

      // Only cache if not a fallback result (fallback results have generic rationale)
      const isFallback = result.rationale === 'Fallback applied due to service timeout/error.';
      if (!isFallback) {
        await setCache(cacheKey, JSON.stringify(result), 2592000); // 30 days TTL
      }

      results[resultIndex] = result;
    }
  }

  return results;
};
