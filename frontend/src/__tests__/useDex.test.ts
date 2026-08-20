/**
 * useDex hook tests — validates speak, listen, and ask behavior with mocked APIs.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDex } from '../hooks/useDex';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock Audio constructor
const mockAudioPlay = vi.fn().mockResolvedValue(undefined);
const audioInstances: any[] = [];
vi.stubGlobal('Audio', class MockAudio {
  src = '';
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  play = mockAudioPlay;
  constructor() {
    audioInstances.push(this);
  }
});

vi.stubGlobal('URL', {
  createObjectURL: vi.fn(() => 'blob:mock-url'),
  revokeObjectURL: vi.fn(),
});

// Mock SpeechSynthesisUtterance as a proper class
vi.stubGlobal('SpeechSynthesisUtterance', class MockUtterance {
  text: string;
  rate = 1;
  pitch = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
});

// Mock SpeechSynthesis
const mockCancel = vi.fn();
const mockSpeak = vi.fn((utterance: any) => {
  if (utterance && typeof utterance.onend === 'function') {
    setTimeout(() => utterance.onend(), 0);
  }
});

vi.stubGlobal('speechSynthesis', {
  speak: mockSpeak,
  cancel: mockCancel,
});

describe('useDex', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    audioInstances.length = 0;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('should start in idle state with empty caption', () => {
    const { result } = renderHook(() => useDex());
    expect(result.current.state).toBe('idle');
    expect(result.current.caption).toBe('');
  });

  describe('speak()', () => {
    it('should use browser TTS directly by default (VITE_USE_API_TTS false)', async () => {
      const { result } = renderHook(() => useDex());

      await act(async () => {
        await result.current.speak('Hello Browser');
      });

      expect(result.current.state).toBe('idle');
      expect(result.current.caption).toBe('Hello Browser');
      expect(mockSpeak).toHaveBeenCalled();
    });

    it('should play audio when backend returns audio/mpeg and VITE_USE_API_TTS=true', async () => {
      vi.stubEnv('VITE_USE_API_TTS', 'true');

      const audioBlob = new Blob(['fake-audio'], { type: 'audio/mpeg' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'audio/mpeg' }),
        blob: vi.fn().mockResolvedValue(audioBlob),
      });

      const { result } = renderHook(() => useDex());

      await act(async () => {
        const promise = result.current.speak('Hello!');
        setTimeout(() => {
          const audioInstance = audioInstances.at(-1);
          if (audioInstance?.onended) audioInstance.onended();
        }, 10);
        await promise;
      });

      expect(result.current.state).toBe('idle');
      expect(result.current.caption).toBe('Hello!');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should fall back to browser TTS when backend returns useBrowserTts', async () => {
      vi.stubEnv('VITE_USE_API_TTS', 'true');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: vi.fn().mockResolvedValue({ useBrowserTts: true }),
      });

      const { result } = renderHook(() => useDex());

      await act(async () => {
        await result.current.speak('Fallback test');
      });

      expect(result.current.state).toBe('idle');
      expect(result.current.caption).toBe('Fallback test');
      expect(mockCancel).toHaveBeenCalled();
      expect(mockSpeak).toHaveBeenCalled();
    });

    it('should fall back to browser TTS on network error', async () => {
      vi.stubEnv('VITE_USE_API_TTS', 'true');

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useDex());

      await act(async () => {
        await result.current.speak('Network fail');
      });

      expect(result.current.state).toBe('idle');
    });
  });

  describe('listen()', () => {
    it('should resolve with transcript in short mode using SpeechRecognition', async () => {
      const MockSpeechRecognition = class {
        continuous = false;
        interimResults = false;
        lang = '';
        onresult: any = null;
        onerror: any = null;
        onend: any = null;
        abort = vi.fn();
        start = vi.fn(() => {
          // Fire onresult with isFinal=true, then fire onend so listenShort resolves
          setTimeout(() => {
            if (this.onresult) {
              this.onresult({
                resultIndex: 0,
                results: Object.assign(
                  [[Object.assign({ transcript: 'hello world' }, { isFinal: true })]],
                  { 0: Object.assign(
                    [{ transcript: 'hello world' }],
                    { isFinal: true }
                  ) }
                ),
              });
            }
            // Give the hook a tick to call finish(), then fire onend
            setTimeout(() => {
              if (this.onend) this.onend();
            }, 5);
          }, 5);
        });
        constructor() {}
      };

      (window as any).SpeechRecognition = MockSpeechRecognition;

      const { result } = renderHook(() => useDex());

      let transcript = '';
      await act(async () => {
        transcript = await result.current.listen('short');
      });

      expect(transcript).toBe('hello world');
      expect(result.current.state).toBe('idle');

      delete (window as any).SpeechRecognition;
    }, 10000);

    it('should return empty string when SpeechRecognition is unavailable', async () => {
      delete (window as any).SpeechRecognition;
      delete (window as any).webkitSpeechRecognition;

      // listenShort falls back to listenLong which calls getUserMedia.
      // Mock it to reject immediately so listenLong resolves with ''.
      const mediaDevicesMock = {
        getUserMedia: vi.fn().mockRejectedValue(new Error('not available')),
      };
      Object.defineProperty(navigator, 'mediaDevices', {
        value: mediaDevicesMock,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useDex());

      let transcript = '';
      await act(async () => {
        transcript = await result.current.listen('short');
      });

      expect(transcript).toBe('');
      expect(result.current.state).toBe('idle');
    });
  });
});
