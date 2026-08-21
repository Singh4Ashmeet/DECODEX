import CircuitBreaker from 'opossum';
import dotenv from 'dotenv';
import { getCache, setCache } from './cache';
import { getLLMProvider } from './llmProviders';

dotenv.config();

// ---------------------------------------------------------------------------
// Decodex TTS Service — Synthesizes speech from transcript text on-demand.
// Supports multiple providers: OpenAI (default), self-hosted via provider abstraction.
// On failure/breaker-open, returns { useBrowserTts: true } so callers can
// fall back silently to the browser's SpeechSynthesis API — never throws.
// ---------------------------------------------------------------------------

export interface TtsResult {
  audioBuffer: Buffer | null;
  useBrowserTts: boolean;
}

// ---------------------------------------------------------------------------
// Stock Phrase Bank — Fixed list of Dex's repeated encouragement/instruction phrases.
// Each phrase has a stable ID and supports multiple languages.
// 'en' (English) is the required fallback. Other languages can be added over time.
// If a requested language is missing for a phrase, falls back to 'en'.
// ---------------------------------------------------------------------------

export type SupportedLanguage = 'en' | 'hi' | string; // 'en' required, 'hi' for Hindi PoC, extensible

export type PhraseId =
  | 'good_job'
  | 'try_again'
  | 'lets_start'
  | 'keep_going'
  | 'almost_there'
  | 'well_done'
  | 'good_effort'
  | 'take_your_time'
  | 'nice_work'
  | 'lets_practice';

export const PHRASE_BANK: Record<PhraseId, Record<string, string>> = {
  good_job: {
    en: "Great job! You're doing really well.",
    hi: "शाबाश! आप बहुत अच्छा कर रहे हैं।"
  },
  try_again: {
    en: "Let's try that again. You can do it!",
    hi: "चलिए फिर से कोशिश करते हैं। आप कर सकते हैं!"
  },
  lets_start: {
    en: "Let's start reading. Take your time.",
    hi: "चलिए पढ़ना शुरू करते हैं। अपना समय लें।"
  },
  keep_going: {
    en: "Keep going, you're doing great!",
    hi: "चलते रहें, आप बहुत अच्छा कर रहे हैं!"
  },
  almost_there: {
    en: "Almost there! Just a little more.",
    hi: "बस थोड़ा सा और! लगभग पूरा हो गया।"
  },
  well_done: {
    en: "Well done! That was excellent reading.",
    hi: "बहुत बढ़िया! वह बहुत बढ़िया पढ़ाई थी।"
  },
  good_effort: {
    en: "Good effort! Keep practicing.",
    hi: "अच्छी कोशिश! अभ्यास करते रहें।"
  },
  take_your_time: {
    en: "Take your time. There's no rush.",
    hi: "अपना समय लें। कोई जल्दी नहीं है।"
  },
  nice_work: {
    en: "Nice work! You're improving every day.",
    hi: "अच्छा काम! आप हर दिन बेहतर हो रहे हैं।"
  },
  lets_practice: {
    en: "Let's practice this word together.",
    hi: "चलिए इस शब्द का एक साथ अभ्यास करते हैं।"
  },
} as const;

/**
 * Check if a phraseId is valid (exists in the phrase bank).
 */
export function isValidPhraseId(phraseId: string): phraseId is PhraseId {
  return phraseId in PHRASE_BANK;
}

/**
 * Get the phrase text for a given phraseId and language.
 * Falls back to 'en' if the requested language is not available for that phrase.
 */
export function getPhraseText(phraseId: PhraseId, language: SupportedLanguage = 'en'): string {
  const phraseTranslations = PHRASE_BANK[phraseId];
  // Try requested language, fall back to English
  return phraseTranslations[language] ?? phraseTranslations.en;
}

/**
 * Generate cache key for a phrase bank entry, scoped by language.
 */
function getPhraseCacheKey(phraseId: PhraseId, language: SupportedLanguage = 'en'): string {
  return `tts:phrase:${phraseId}:${language}`;
}

let openAIClient: any = null;

function getOpenAIClient() {
  if (openAIClient) return openAIClient;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const OpenAI = require('openai').default;
  openAIClient = new OpenAI({ apiKey });
  return openAIClient;
}

/**
 * Inner function wrapped by the circuit breaker.
 * Calls OpenAI TTS API and returns the audio as a Buffer.
 */
const _synthesizeSpeech = async (text: string): Promise<TtsResult> => {
  const client = getOpenAIClient();

  if (!client) {
    console.log('[TTS] OPENAI_API_KEY not configured. Signalling browser TTS fallback.');
    return { audioBuffer: null, useBrowserTts: true };
  }

  try {
    const response = await client.audio.speech.create({
      model: 'tts-1',
      voice: 'shimmer',
      input: text,
      response_format: 'mp3',
    });

    const arrayBuffer = await response.arrayBuffer();
    return { audioBuffer: Buffer.from(arrayBuffer), useBrowserTts: false };
  } catch (err: any) {
    console.warn('OpenAI TTS API call failed. Signalling browser TTS fallback:', err.message);
    return { audioBuffer: null, useBrowserTts: true };
  }
};

const breakerOptions = {
  timeout: 15000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
};

const ttsBreaker = new CircuitBreaker(_synthesizeSpeech, breakerOptions);

ttsBreaker.fallback(() => {
  console.warn('TTS circuit breaker OPEN or timeout. Signalling browser TTS fallback.');
  return { audioBuffer: null, useBrowserTts: true } as TtsResult;
});

/**
 * Synthesize speech from text using the configured TTS provider.
 * Currently uses OpenAI TTS as default; self-hosted TTS can be added via provider abstraction.
 *
 * Returns an audio buffer (mp3) or a signal to use browser TTS as fallback.
 * Never throws — all errors result in the browser fallback.
 * Audio is NEVER persisted — generated fresh per request.
 * This is used for dynamic/transcript content (e.g., student recording playback) and MUST NOT be cached.
 */
export const synthesizeSpeech = async (text: string): Promise<TtsResult> => {
  // Try provider TTS first (self-hosted if configured)
  const provider = getLLMProvider();
  try {
    const result = await provider.synthesizeSpeech({ text, language: 'en' });
    if (!result.useBrowserTts && result.audioBuffer) {
      return result;
    }
  } catch (err) {
    console.warn('Provider TTS failed, falling back to OpenAI:', (err as Error).message);
  }

  // Fallback to OpenAI TTS with circuit breaker
  return await ttsBreaker.fire(text);
};


/**
 * Synthesize speech for a stock phrase from the phrase bank.
 * Checks Redis cache first (keyed by phraseId + language), returns cached audio if present.
 * On miss, synthesizes once and caches with a long TTL (30 days) — these phrases never change.
 * Returns the same TtsResult interface as synthesizeSpeech.
 */
export const synthesizePhrase = async (phraseId: PhraseId, language: SupportedLanguage = 'en'): Promise<TtsResult> => {
  const cacheKey = getPhraseCacheKey(phraseId, language);
  const cached = await getCache(cacheKey);

  if (cached) {
    console.log(`[TTS Phrase Cache] HIT: ${phraseId}:${language}`);
    const audioBuffer = Buffer.from(cached, 'base64');
    return { audioBuffer, useBrowserTts: false };
  }

  console.log(`[TTS Phrase Cache] MISS: ${phraseId}:${language}`);
  const text = getPhraseText(phraseId, language);
  
  // Try provider TTS first
  let result: TtsResult;
  const provider = getLLMProvider();
  try {
    result = await provider.synthesizeSpeech({ text, language });
  } catch {
    result = await ttsBreaker.fire(text);
  }

  if (!result.useBrowserTts && result.audioBuffer) {
    // Cache the audio buffer as base64 string with 30-day TTL
    await setCache(cacheKey, result.audioBuffer.toString('base64'), 2592000);
  }

  return result;
};


// ---------------------------------------------------------------------------
// Exported types and utilities
// ---------------------------------------------------------------------------