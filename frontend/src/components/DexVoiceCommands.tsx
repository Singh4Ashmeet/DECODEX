import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  type SpeechRecognition,
  matchIntent,
  logUnmatchedCommand,
} from './DexVoiceCommands.types';

export default function DexVoiceCommands() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isListening, setIsListening] = useState(false);
  const [lastMatched, setLastMatched] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Initialize SpeechRecognition (hooks called unconditionally)
  useEffect(() => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRec) {
      console.warn('[DexVoiceCommands] SpeechRecognition not supported in this browser');
      return;
    }

    const recognition = new SpeechRec() as SpeechRecognition;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';
    
    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        const intent = matchIntent(finalTranscript);
        if (intent) {
          setLastMatched(intent.description);
          navigate(intent.path);
        } else {
          logUnmatchedCommand(finalTranscript);
          setLastMatched(`No match: "${finalTranscript}"`);
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.warn('[DexVoiceCommands] Recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      try { recognition.abort(); } catch {}
    };
  }, [navigate]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      setLastMatched(null);
      setIsListening(true);
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.warn('[DexVoiceCommands] Failed to start recognition:', e);
        setIsListening(false);
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn('[DexVoiceCommands] Failed to stop recognition:', e);
      }
      setIsListening(false);
    }
  }, [isListening]);

  // Role check — only render for students
  if (loading || !user || user.role !== 'student') {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
      {(isListening || lastMatched) && (
        <div
          className={`glass-card px-3 py-1.5 rounded-full text-xs font-display uppercase tracking-[0.08em] transition-all duration-200 flex items-center gap-1.5 ${
            isListening
              ? 'bg-primary/10 text-primary border border-primary/30 animate-pulse'
              : lastMatched?.startsWith('No match')
              ? 'bg-error/10 text-error border border-error/30'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-300'
          }`}
          role="status"
          aria-live="polite"
        >
          {isListening ? (
            <>
              <span className="material-symbols-outlined text-sm">mic</span>
              Listening…
            </>
          ) : lastMatched ? (
            <>
              <span className="material-symbols-outlined text-sm">
                {lastMatched.startsWith('No match') ? 'mic_off' : 'check_circle'}
              </span>
              {lastMatched}
            </>
          ) : null}
        </div>
      )}

      <button
        onClick={isListening ? stopListening : startListening}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg text-on-surface font-body text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
          isListening
            ? 'bg-error text-on-error hover:shadow-xl animate-pulse ring-2 ring-error/50'
            : 'glass-card border border-secondary/30 hover:bg-secondary/10 hover:shadow-xl'
        }`}
        aria-label={isListening ? 'Stop listening' : 'Dex, mujhe help chahiye'}
        title={isListening ? 'Stop listening' : 'Dex, mujhe help chahiye'}
      >
        <span className="material-symbols-outlined text-xl" style={{fontVariationSettings: "'FILL' 1"}}>
          {isListening ? 'mic' : 'assistant'}
        </span>
        <span className="hidden sm:inline font-display text-xs uppercase tracking-[0.08em]">
          {isListening ? 'Stop' : 'Dex, help'}
        </span>
      </button>
    </div>
  );
}