export const STORAGE_KEY = 'dex_voice_commands_log';

export interface VoiceIntent {
  path: string;
  keywords: string[];
  description: string;
}

// Type declaration for SpeechRecognition (not in default lib.dom.d.ts)
export interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
}

export interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

export interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

export interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

export interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

export interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

export const VOICE_INTENTS: VoiceIntent[] = [
  {
    path: '/dashboard',
    keywords: [
      'dashboard', 'home', 'main page', 'go home',
      'dashboard dikhao', 'dashboard kholo', 'ghar pe jao', 'main page dikhao',
      'dashboard show', 'go to dashboard',
    ],
    description: 'Navigate to dashboard',
  },
  {
    path: '/passages',
    keywords: [
      'passage', 'passages', 'reading passage', 'select passage', 'choose passage',
      'passage dikhao', 'passage kholo', 'padhne ke liye passage', 'passage chuno',
      'show passages', 'open passages',
    ],
    description: 'Navigate to passage selection',
  },
  {
    path: '/practice',
    keywords: [
      'practice', 'start practice', 'begin practice', 'practice mode',
      'practice start karo', 'practice shuru karo', 'abhyas karo', 'practice chalu karo',
      'start practicing', 'begin practice',
    ],
    description: 'Navigate to practice page',
  },
  {
    path: '/stories',
    keywords: [
      'story', 'stories', 'read story', 'ai story', 'new story',
      'story padhna hai', 'story dikhao', 'kahani padhna hai', 'kahani dikhao', 'story kholo',
      'show story', 'open stories', 'read a story',
    ],
    description: 'Navigate to AI stories',
  },
  {
    path: '/learning-path',
    keywords: [
      'learning path', 'path', 'my path', 'learning',
      'learning path dikhao', 'mera path', 'sikhne ka rasta', 'path kholo',
      'show learning path', 'open learning path',
    ],
    description: 'Navigate to learning path',
  },
  {
    path: '/session',
    keywords: [
      'session', 'start session', 'reading session', 'record session',
      'session shuru karo', 'session start karo', 'padhne ka session', 'session chalu karo',
      'start reading session', 'begin session',
    ],
    description: 'Navigate to active session (requires session ID)',
  },
];

export function matchIntent(transcript: string): VoiceIntent | null {
  const lower = transcript.toLowerCase().trim();
  
  for (const intent of VOICE_INTENTS) {
    for (const keyword of intent.keywords) {
      if (lower.includes(keyword.toLowerCase())) {
        return intent;
      }
    }
  }
  return null;
}

export function logUnmatchedCommand(transcript: string): void {
  if (typeof window === 'undefined') return;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const logs = stored ? JSON.parse(stored) : [];
    logs.push({
      transcript,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    });
    if (logs.length > 100) logs.shift();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  } catch {
    // Ignore localStorage errors
  }
}

export function getLoggedCommands(): Array<{ transcript: string; timestamp: string; userAgent: string }> {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function clearCommandLogs(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}