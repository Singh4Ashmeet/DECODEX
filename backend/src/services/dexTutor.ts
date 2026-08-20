import OpenAI from 'openai';
import CircuitBreaker from 'opossum';
import dotenv from 'dotenv';

dotenv.config();

// ---------------------------------------------------------------------------
// Dex Tutor — Spoken Answer Grading Service
// Uses Groq LLM (same pattern as classifier.ts) to grade a student's spoken
// answer against an expected answer, producing short, encouraging feedback
// suitable for speaking aloud to a child via TTS.
//
// Non-AI fallback: case-insensitive substring match — clearly worse than
// the AI grading but never leaves the student stuck with an error.
// ---------------------------------------------------------------------------

export interface GradingResult {
  correct: boolean;
  feedback: string;
}

// Supported languages for Dex's conversational responses
export type DexLanguage = 'en' | 'hi' | string;

// Base grading prompt (English) — the O-G diagnostic logic stays English-only
const gradingPromptBase = `
You are a warm, encouraging reading tutor for children with dyslexia.
A student was asked a question and gave a spoken answer. Decide if the answer is correct.
Respond ONLY with a JSON object: {"correct": true/false, "feedback": "..."}
The feedback MUST be:
- One sentence, under 20 words
- Encouraging even when incorrect (e.g. "Not quite — let's try that one again!")
- Safe to speak aloud to a child via text-to-speech
- Never harsh, sarcastic, or discouraging
Examples of good feedback:
- Correct: "That's exactly right, great job!"
- Incorrect: "Close, but not quite — give it another try!"
`;

/**
 * Build the system prompt with language directive for Dex's conversational response.
 * The O-G classification logic remains English-only; this only affects the feedback language.
 */
function buildGradingPrompt(language: DexLanguage = 'en'): string {
  const languageDirectives: Record<string, string> = {
    en: '',
    hi: '\nIMPORTANT: Respond with feedback in Hindi (Devanagari script). Keep the JSON structure but translate the feedback sentence to Hindi. For example: "बहुत बढ़िया, बिल्कुल सही!" or "नहीं, चलो फिर से कोशिश करते हैं!"',
  };

  const directive = languageDirectives[language] ?? languageDirectives.en;
  return gradingPromptBase + directive;
}

/**
 * Non-AI fallback grading — simple case-insensitive substring match.
 * Less accurate than AI grading but ensures the student is never stuck.
 */
function editDistance(s1: string, s2: string): number {
  const m = s1.length, n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function fallbackGrade(expectedAnswer: string, studentTranscript: string): GradingResult {
  const expected = expectedAnswer.toLowerCase().trim().replace(/[.,!?;:'"]/g, '');
  const spoken = studentTranscript.toLowerCase().trim().replace(/[.,!?;:'"]/g, '');

  if (!spoken) {
    return {
      correct: false,
      feedback: 'I didn\'t catch that. Please click the microphone and speak your answer clearly!',
    };
  }

  const expectedWords = expected.split(/\s+/).filter(w => w.length > 0);
  const spokenWords = spoken.split(/\s+/).filter(w => w.length > 0);

  let matchCount = 0;
  for (const ew of expectedWords) {
    if (spokenWords.some(sw => sw === ew || sw.includes(ew) || ew.includes(sw) || (ew.length >= 4 && editDistance(sw, ew) <= 1))) {
      matchCount++;
    }
  }

  const matchRatio = expectedWords.length > 0 ? matchCount / expectedWords.length : 0;
  const correct = spoken === expected ||
    spoken.includes(expected) ||
    expected.includes(spoken) ||
    matchRatio >= 0.6;

  return {
    correct,
    feedback: correct
      ? 'Great job, that\'s right!'
      : 'Not quite — let\'s try that one again!',
  };
}

const getGroqClient = () => {
  const apiKey = process.env.GROQ_API_KEY || 'dummy_groq_key';
  return {
    client: new OpenAI({ apiKey, baseURL: 'https://api.groq.com/openai/v1' }),
    model: 'llama-3.3-70b-versatile',
  };
};

const _gradeSpokenAnswer = async ({
  question,
  expectedAnswer,
  studentTranscript,
  language = 'en'
}: {
  question: string;
  expectedAnswer: string;
  studentTranscript: string;
  language?: DexLanguage;
}): Promise<GradingResult> => {
  const hasGroq = Boolean(process.env.GROQ_API_KEY);

  if (!hasGroq) {
    return fallbackGrade(expectedAnswer, studentTranscript);
  }

  const { client, model } = getGroqClient();

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: buildGradingPrompt(language) },
        {
          role: 'user',
          content: JSON.stringify({ question, expectedAnswer, studentTranscript }),
        },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content || '{}';

    try {
      const parsed = JSON.parse(content);
      return {
        correct: Boolean(parsed.correct),
        feedback: typeof parsed.feedback === 'string' && parsed.feedback.length > 0
          ? parsed.feedback
          : (parsed.correct ? 'Great job!' : 'Not quite — let\'s try again!'),
      };
    } catch {
      console.error('Failed to parse Groq grading response:', content);
      return fallbackGrade(expectedAnswer, studentTranscript);
    }
  } catch (err: any) {
    console.warn(`Groq grading API call (${model}) failed. Using fallback:`, err.message);
    return fallbackGrade(expectedAnswer, studentTranscript);
  }
};

// Circuit breaker — same pattern as classifier.ts
const breakerOptions = {
  timeout: 10000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
};

const gradingBreaker = new CircuitBreaker(_gradeSpokenAnswer, breakerOptions);

gradingBreaker.fallback(({ expectedAnswer, studentTranscript, language }: {
  question: string;
  expectedAnswer: string;
  studentTranscript: string;
  language?: DexLanguage;
}) => {
  console.warn('Grading circuit breaker OPEN or timeout. Using substring-match fallback.');
  return fallbackGrade(expectedAnswer, studentTranscript);
});

/**
 * Grade a student's spoken answer against an expected answer.
 * Returns { correct, feedback } — feedback is always short, encouraging,
 * and safe to speak via TTS. Never throws.
 * The feedback language is determined by the student's preferred_language (en/hi).
 */
export const gradeSpokenAnswer = async (
  question: string,
  expectedAnswer: string,
  studentTranscript: string,
  language: DexLanguage = 'en'
): Promise<GradingResult> => {
  return await gradingBreaker.fire({ question, expectedAnswer, studentTranscript, language });
};
