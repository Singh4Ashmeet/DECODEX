import { useState, useRef, useCallback } from 'react';
import { getApiBaseUrl } from '../lib/api';

// ---------------------------------------------------------------------------
// useDex — Voice-First Tutor Hook
// Provides speak(), listen(), ask(), and reactive state for the Dex avatar.
// ---------------------------------------------------------------------------

export type DexState = 'idle' | 'speaking' | 'listening' | 'thinking' | 'celebrating' | 'concerned';

export interface DexHook {
  state: DexState;
  caption: string;
  speak: (text: string) => Promise<void>;
  listen: (mode: 'short' | 'sentence' | 'long') => Promise<string>;
  ask: (question: string, expectedAnswer: string) => Promise<{ correct: boolean; feedback: string }>;
}

export function useDex(): DexHook {
  const [state, setState] = useState<DexState>('idle');
  const [caption, setCaption] = useState<string>('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ------- speak() -------
  // Calls POST /api/v1/tts. If audio returned, plays via HTMLAudioElement.
  // If { useBrowserTts: true }, falls back to window.speechSynthesis silently.
  const speak = useCallback(async (text: string): Promise<void> => {
    setState('speaking');
    setCaption(text);

    // -----------------------------------------------------------------------
    // TTS Strategy:
    // Default: Use free browser SpeechSynthesis (zero cost, zero latency).
    // If VITE_USE_API_TTS=true is set, call the backend TTS endpoint instead
    // (requires OPENAI_API_KEY on the backend — paid).
    // -----------------------------------------------------------------------
    const useApiTts = import.meta.env.VITE_USE_API_TTS === 'true';

    if (useApiTts) {
      try {
        const baseUrl = getApiBaseUrl();
        const targetUrl = baseUrl
          ? `${baseUrl}/api/v1/tts`
          : '/api/v1/tts';

        const response = await fetch(targetUrl, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });

        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('audio/mpeg')) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);

          await new Promise<void>((resolve) => {
            const audio = new Audio(url);
            audioRef.current = audio;
            audio.onended = () => {
              URL.revokeObjectURL(url);
              audioRef.current = null;
              resolve();
            };
            audio.onerror = () => {
              URL.revokeObjectURL(url);
              audioRef.current = null;
              speakViaBrowser(text).then(resolve);
            };
            audio.play().catch(() => {
              URL.revokeObjectURL(url);
              speakViaBrowser(text).then(resolve);
            });
          });
        } else {
          await speakViaBrowser(text);
        }
      } catch {
        await speakViaBrowser(text);
      }
    } else {
      // Free path — browser TTS directly, no API call
      await speakViaBrowser(text);
    }

    setState('idle');
  }, []);

  // ------- listen('long') -------
  // Records audio via MediaRecorder, POSTs to /api/v1/dex/transcribe,
  // returns the Whisper transcript.
  const listenLong = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      setState('listening');

      const startRecording = async () => {
        try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        const chunks: Blob[] = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach(t => t.stop());
          const blob = new Blob(chunks, { type: 'audio/webm' });

          setState('thinking');

          try {
            const baseUrl = getApiBaseUrl();
            const targetUrl = baseUrl
              ? `${baseUrl}/api/v1/dex/transcribe`
              : '/api/v1/dex/transcribe';

            const formData = new FormData();
            formData.append('audio', blob, 'answer.webm');

            const res = await fetch(targetUrl, {
              method: 'POST',
              credentials: 'include',
              body: formData,
            });

            if (res.ok) {
              const data = await res.json();
              setState('idle');
              resolve(data.transcript || '');
            } else {
              setState('idle');
              resolve('');
            }
          } catch {
            setState('idle');
            resolve('');
          }
        };

        mediaRecorder.onerror = () => {
          stream.getTracks().forEach(t => t.stop());
          setState('idle');
          resolve('');
        };

        mediaRecorder.start();

        setTimeout(() => {
          if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
        }, 10000);
        } catch {
          setState('idle');
          resolve('');
        }
      };

      void startRecording();
    });
  }, []);

  // ------- listenShort -------
  // Single-word / short phrase speech recognition mode.
  const listenShort = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      setState('listening');

      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SpeechRec) {
        listenLong().then(resolve);
        return;
      }

      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let startDelayId: ReturnType<typeof setTimeout> | null = null;
      let isResolved = false;

      const finish = (resultText: string) => {
        if (isResolved) return;
        isResolved = true;
        if (timeoutId) clearTimeout(timeoutId);
        if (startDelayId) clearTimeout(startDelayId);
        setState('idle');
        resolve(resultText.trim());
      };

      let fullTranscript = '';

      try {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }

        startDelayId = setTimeout(() => {
          try {
            const recognition = new SpeechRec();
            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            timeoutId = setTimeout(() => {
              try { recognition.abort(); } catch { /* ignore */ }
              finish(fullTranscript);
            }, 6000);

            recognition.onresult = (event: any) => {
              for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i]?.[0]?.transcript) {
                  fullTranscript = event.results[i][0].transcript;
                }
              }
              if (event.results[0]?.isFinal) {
                finish(fullTranscript);
              }
            };

            recognition.onerror = (event: any) => {
              console.warn('listenShort recognition error:', event?.error);
              finish(fullTranscript);
            };

            recognition.onend = () => {
              finish(fullTranscript);
            };

            recognition.start();
          } catch {
            listenLong().then(resolve);
          }
        }, 150);
      } catch {
        listenLong().then(resolve);
      }
    });
  }, [listenLong]);

  // ------- listenSentence -------
  // Continuous speech recognition mode for short 3-4 word phrases / sentence lines.
  // Uses 1.2s post-speech silence detection and 150ms audio buffer to avoid mic lockups.
  const listenSentence = useCallback((durationMs = 5000): Promise<string> => {
    return new Promise((resolve) => {
      setState('listening');

      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SpeechRec) {
        listenLong().then(resolve);
        return;
      }

      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let silenceTimerId: ReturnType<typeof setTimeout> | null = null;
      let startDelayId: ReturnType<typeof setTimeout> | null = null;
      let fullTranscript = '';
      let isResolved = false;

      const finish = (resultText: string) => {
        if (isResolved) return;
        isResolved = true;
        if (timeoutId) clearTimeout(timeoutId);
        if (silenceTimerId) clearTimeout(silenceTimerId);
        if (startDelayId) clearTimeout(startDelayId);
        setState('idle');
        resolve(resultText.trim());
      };

      try {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }

        startDelayId = setTimeout(() => {
          try {
            const recognition = new SpeechRec();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onresult = (event: any) => {
              let text = '';
              for (let i = 0; i < event.results.length; i++) {
                text += event.results[i][0].transcript + ' ';
              }
              fullTranscript = text.trim();

              // Reset silence timer on speech detection — resolve 1.2s after speech finishes
              if (silenceTimerId) clearTimeout(silenceTimerId);
              silenceTimerId = setTimeout(() => {
                try { recognition.stop(); } catch { /* ignore */ }
                finish(fullTranscript);
              }, 1200);
            };

            recognition.onerror = () => {
              if (fullTranscript.length > 0) {
                finish(fullTranscript);
              }
            };

            recognition.onend = () => {
              finish(fullTranscript);
            };

            // Safety maximum duration timeout
            timeoutId = setTimeout(() => {
              try { recognition.stop(); } catch { /* ignore */ }
              finish(fullTranscript);
            }, durationMs);

            recognition.start();
          } catch {
            listenLong().then(resolve);
          }
        }, 150);
      } catch {
        listenLong().then(resolve);
      }
    });
  }, [listenLong]);

  // ------- listen() dispatcher -------
  const listen = useCallback(async (mode: 'short' | 'sentence' | 'long'): Promise<string> => {
    if (mode === 'sentence') return listenSentence();
    return mode === 'short' ? listenShort() : listenLong();
  }, [listenShort, listenSentence, listenLong]);

  // ------- ask() -------
  // Full cycle: speak question → listen for answer → grade → speak feedback.
  const ask = useCallback(async (
    question: string,
    expectedAnswer: string,
  ): Promise<{ correct: boolean; feedback: string }> => {
    await speak(question);
    const transcript = await listen('long');

    setState('thinking');

    let result: { correct: boolean; feedback: string };

    try {
      const baseUrl = getApiBaseUrl();
      const targetUrl = baseUrl
        ? `${baseUrl}/api/v1/dex/grade-answer`
        : '/api/v1/dex/grade-answer';

      const res = await fetch(targetUrl, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, expectedAnswer, studentTranscript: transcript }),
      });

      if (res.ok) {
        result = await res.json();
      } else {
        result = {
          correct: transcript.toLowerCase().includes(expectedAnswer.toLowerCase()),
          feedback: transcript.toLowerCase().includes(expectedAnswer.toLowerCase())
            ? 'Great job!'
            : 'Let\'s try that one more time!',
        };
      }
    } catch {
      result = {
        correct: transcript.toLowerCase().includes(expectedAnswer.toLowerCase()),
        feedback: transcript.toLowerCase().includes(expectedAnswer.toLowerCase())
          ? 'Great job!'
          : 'Let\'s try that one more time!',
      };
    }

    setState(result.correct ? 'celebrating' : 'concerned');
    await speak(result.feedback);
    setState('idle');

    return result;
  }, [speak, listen]);

  return { state, caption, speak, listen, ask };
}

// ---------------------------------------------------------------------------
// Helper: Select a soothing female voice for children's educational narration
// Avoids heavy/deep default male system voices (e.g. Microsoft David)
// ---------------------------------------------------------------------------
function getSoothingFemaleVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  if (typeof window.speechSynthesis.getVoices !== 'function') return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  const femaleVoiceNames = [
    'microsoft aria',
    'microsoft jenny',
    'microsoft zira',
    'google us english',
    'samantha',
    'victoria',
    'karen',
    'fiona',
    'female',
    'woman',
  ];

  for (const name of femaleVoiceNames) {
    const found = voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes(name));
    if (found) return found;
  }

  // Fallback: Pick any English voice that is not a heavy male voice
  const nonMaleVoice = voices.find(v =>
    v.lang.startsWith('en') &&
    !v.name.toLowerCase().includes('david') &&
    !v.name.toLowerCase().includes('mark') &&
    !v.name.toLowerCase().includes('george') &&
    !v.name.toLowerCase().includes('male')
  );

  return nonMaleVoice || voices[0] || null;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    getSoothingFemaleVoice();
  };
}

function speakViaBrowser(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      resolve();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);

    const voice = getSoothingFemaleVoice();
    if (voice) {
      utterance.voice = voice;
    }

    // Friendly, warm, soothing female tone (pitch 1.25, rate 0.88)
    utterance.pitch = 1.25;
    utterance.rate = 0.88;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}
