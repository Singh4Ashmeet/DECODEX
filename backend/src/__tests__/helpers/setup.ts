/**
 * Shared test setup — mocks the pg pool and provides test utilities.
 * Loaded automatically by vitest.config.ts setupFiles.
 */
import { vi, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';

// Load test env vars before anything else
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long-for-validation';
process.env.SESSION_SECRET = 'test-session-secret-that-is-at-least-32-characters-long';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.PII_ENCRYPTION_KEY = 'qWKXzURWvVLgjqn9TxLnCUafS5/QZKttnNOsLSi+9Eo=';

// ---- Mock the database module ----
const mockQuery = vi.fn();
const mockPool = {
  query: mockQuery,
  connect: vi.fn().mockResolvedValue({
    query: mockQuery,
    release: vi.fn(),
  }),
  on: vi.fn(),
};

vi.mock('../../db', () => ({
  query: mockQuery,
  pool: mockPool,
}));

// ---- Mock the queue module ----
vi.mock('../../queue', () => ({
  audioQueue: {
    add: vi.fn(),
    process: vi.fn(),
    on: vi.fn(),
  },
  consentErasureQueue: {
    process: vi.fn(),
    on: vi.fn(),
  },
  AudioJobData: {} as any,
}));

// ---- Mock the worker module ----
// Don't mock processAudioJob globally - individual tests will mock dependencies as needed
// vi.mock('../../queue/worker', () => ({
//   processAudioJob: vi.fn(),
// }));

// ---- Mock services that hit external APIs ----
// Don't mock copilot globally - individual tests need the real implementation
// vi.mock('../../services/copilot', () => ({
//   generateStrategy: vi.fn().mockResolvedValue({ summary: 'Test strategy' }),
//   getStrategyHistory: vi.fn().mockResolvedValue([]),
// }));

vi.mock('../../services/healthScore', () => ({
  computeHealthScore: vi.fn(),
  getLatestHealthScore: vi.fn().mockResolvedValue(null),
  getHealthScoreHistory: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../services/riskScreening', () => ({
  runRiskScreening: vi.fn(),
  getLatestScreening: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/email', () => ({
  sendConsentEmail: vi.fn(),
  sendConsentWithdrawalEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendDataDeletionEmail: vi.fn(),
}));

vi.mock('../../queue/consentErasure', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../queue/consentErasure')>();
  return {
    ...actual,
    scheduleConsentErasureJob: vi.fn().mockResolvedValue(undefined),
    eraseExpiredConsentData: vi.fn().mockResolvedValue(undefined),
  };
});

// Create mock functions that can be configured per test
const mockSynthesizeSpeech = vi.fn().mockResolvedValue({ audioBuffer: Buffer.from('fake-audio'), useBrowserTts: false });
const mockSynthesizePhrase = vi.fn().mockResolvedValue({ audioBuffer: Buffer.from('fake-audio'), useBrowserTts: false });

const mockPhraseBank = {
  good_job: { en: "Great job! You're doing really well.", hi: "शाबाश! आप बहुत अच्छा कर रहे हैं।" },
  try_again: { en: "Let's try that again. You can do it!", hi: "चलिए फिर से कोशिश करते हैं। आप कर सकते हैं!" },
  lets_start: { en: "Let's start reading. Take your time.", hi: "चलिए पढ़ना शुरू करते हैं। अपना समय लें।" },
  keep_going: { en: "Keep going, you're doing great!", hi: "चलते रहें, आप बहुत अच्छा कर रहे हैं!" },
  almost_there: { en: "Almost there! Just a little more.", hi: "बस थोड़ा सा और! लगभग पूरा हो गया।" },
  well_done: { en: "Well done! That was excellent reading.", hi: "बहुत बढ़िया! वह बहुत बढ़िया पढ़ाई थी।" },
  good_effort: { en: "Good effort! Keep practicing.", hi: "अच्छी कोशिश! अभ्यास करते रहें।" },
  take_your_time: { en: "Take your time. There's no rush.", hi: "अपना समय लें। कोई जल्दी नहीं है।" },
  nice_work: { en: "Nice work! You're improving every day.", hi: "अच्छा काम! आप हर दिन बेहतर हो रहे हैं।" },
  lets_practice: { en: "Let's practice this word together.", hi: "चलिए इस शब्द का एक साथ अभ्यास करते हैं।" },
};

const mockPhraseIds = Object.keys(mockPhraseBank);

vi.mock('../../services/tts', () => ({
  synthesizeSpeech: mockSynthesizeSpeech,
  synthesizePhrase: mockSynthesizePhrase,
  PHRASE_BANK: mockPhraseBank,
  isValidPhraseId: vi.fn((id: string) => id in mockPhraseBank),
  getPhraseText: vi.fn((id: string, language = 'en') => {
    const phrase = mockPhraseBank[id as keyof typeof mockPhraseBank];
    return phrase?.[language] ?? phrase?.en ?? '';
  }),
  SupportedLanguage: 'en' as const,
}));

vi.mock('../../services/dexTutor', () => ({
  gradeSpokenAnswer: vi.fn().mockResolvedValue({ correct: true, feedback: 'Great job!' }),
}));

vi.mock('../../services/openai', () => ({
  transcribeAudio: vi.fn().mockResolvedValue('hello world'),
}));

vi.mock('../../services/cache', () => ({
  getCache: vi.fn().mockResolvedValue(null),
  setCache: vi.fn().mockResolvedValue(undefined),
  deleteCache: vi.fn().mockResolvedValue(undefined),
  generateHashKey: vi.fn().mockReturnValue('mock-hash'),
}));

// Mock audioStorage service
const mockAudioStorage = {
  upload: vi.fn().mockResolvedValue({
    storageKey: 'test-student/test-session.webm',
    mimeType: 'audio/webm',
    sizeBytes: 1024,
    provider: 'local',
  }),
  getBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-audio')),
  getStream: vi.fn().mockResolvedValue(null),
  exists: vi.fn().mockResolvedValue(true),
  delete: vi.fn().mockResolvedValue(undefined),
  deleteByStudentId: vi.fn().mockResolvedValue(0),
  getMimeType: vi.fn().mockReturnValue('audio/webm'),
};

vi.mock('../../services/audioStorage', () => ({
  getAudioStorage: vi.fn().mockResolvedValue(mockAudioStorage),
  generateStorageKey: vi.fn((studentId: string, sessionId: string, mimeType: string) => {
    const ext = mimeType.includes('wav') ? 'wav' : mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mpeg') ? 'mp3' : 'webm';
    return `${studentId}/${sessionId}.${ext}`;
  }),
  isBase64DataUri: vi.fn((str: string | null | undefined) => {
    if (!str) return false;
    return str.startsWith('data:audio/') && str.includes(';base64,');
  }),
  resetAudioStorage: vi.fn(),
  // Export the mock for tests to configure
  __mockAudioStorage: mockAudioStorage,
}));

delete process.env.GROQ_API_KEY;

vi.mock('../../db/init', () => ({
  initDB: vi.fn().mockResolvedValue(undefined),
  initDBWithRetry: vi.fn().mockResolvedValue(undefined),
}));

// ---- Reset mocks before each test ----
beforeEach(() => {
  mockQuery.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---- Test utilities ----
export { mockQuery, mockPool };

const JWT_SECRET = process.env.JWT_SECRET!;

export function generateTestToken(payload: { id: string; role: string }, expiresIn = '7d'): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn as any });
}

export const TEST_USERS = {
  studentA: { id: '11111111-1111-1111-1111-111111111111', role: 'student' },
  studentB: { id: '22222222-2222-2222-2222-222222222222', role: 'student' },
  teacher: { id: '33333333-3333-3333-3333-333333333333', role: 'teacher' },
  teacherNoSchool: { id: '44444444-4444-4444-4444-444444444444', role: 'teacher' },
  admin: { id: '55555555-5555-5555-5555-555555555555', role: 'admin' },
  parent: { id: '66666666-6666-6666-6666-666666666666', role: 'parent' },
  parentUnlinked: { id: '77777777-7777-7777-7777-777777777777', role: 'parent' },
};
