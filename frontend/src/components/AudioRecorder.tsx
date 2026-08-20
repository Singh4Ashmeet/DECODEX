import React, { useState, useRef, useEffect } from 'react';
import DexAvatar from './DexAvatar';

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  disabled?: boolean;
  disabledMessage?: string;
}

export default function AudioRecorder({ onRecordingComplete, disabled = false, disabledMessage }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [clarityStatus, setClarityStatus] = useState('Listening...');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const startRecording = async () => {
    if (disabled) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      // Set up Web Audio API to measure real-time audio volume intensity
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioCtx();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        audioContextRef.current = audioCtx;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const analyzeAudio = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const level = Math.min(100, Math.round((avg / 120) * 100));
          setAudioLevel(level);

          if (level > 25) {
            setClarityStatus('Excellent Clarity • Voice Captured');
          } else if (level > 8) {
            setClarityStatus('Good Clarity • Voice Detected');
          } else {
            setClarityStatus('Listening for speech…');
          }

          animFrameRef.current = requestAnimationFrame(analyzeAudio);
        };
        analyzeAudio();
      } catch (e) {
        console.warn('Web Audio API visualization unavailable:', e);
      }

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        onRecordingComplete(audioBlob);

        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        if (audioContextRef.current) {
          audioContextRef.current.close().catch(() => {});
        }
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError('');
    } catch (err: any) {
      setError('Microphone access denied or not available.');
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 mt-8 relative w-full max-w-md">
      {error && <div className="stat-card p-4 rounded-xl border-l-4 border-red-500 text-red-800 font-body text-sm student-text">{error}</div>}
      
      {disabled ? (
        <div className="stat-card stat-card-hover w-full rounded-2xl p-6 text-center" style={{ borderLeftColor: 'var(--color-secondary)' }}>
          <span className="material-symbols-outlined text-4xl text-secondary mb-2">mic_off</span>
          <h3 className="font-display text-xl font-bold text-on-surface mt-2">Recording is unavailable</h3>
          <p className="mt-2 font-body student-text">{disabledMessage || 'Recording is locked until a parent confirms consent.'}</p>
          <DexAvatar state="concerned" size="sm" showCaptionBubble={true} caption="We'll be ready when you are!" className="mt-4" />
        </div>
      ) : !isRecording ? (
        <button 
          onClick={startRecording}
          className="relative z-10 w-24 h-24 bg-primary text-on-primary rounded-full flex items-center justify-center shadow-xl hover:bg-primary-container transition-all hover:scale-105 active:scale-95 group focus:outline-none focus:ring-4 focus:ring-primary/30 focus:ring-offset-4"
        >
          <span className="material-symbols-outlined text-5xl" style={{fontVariationSettings: "'FILL' 1"}}>mic</span>
          <DexAvatar state="idle" size="sm" showCaptionBubble={true} caption="Ready to record! Press the mic button to start." className="absolute -bottom-6 left-1/2 -translate-x-1/2" />
        </button>
      ) : (
        <>
          <div className="relative w-36 h-36 flex items-center justify-center">
            {/* Dynamic voice intensity ripple rings */}
            <div 
              className="absolute inset-0 rounded-full bg-primary/20 transition-all duration-75"
              style={{ transform: `scale(${1 + (audioLevel / 100) * 0.5})`, opacity: 0.3 + (audioLevel / 100) * 0.6 }}
            ></div>
            <div 
              className="absolute inset-3 rounded-full bg-primary/30 transition-all duration-75"
              style={{ transform: `scale(${1 + (audioLevel / 100) * 0.3})` }}
            ></div>
            
            <button 
              onClick={stopRecording}
              aria-label="Stop recording"
              className="relative z-10 w-24 h-24 bg-primary text-on-primary rounded-full flex items-center justify-center shadow-2xl transition-transform duration-75 group cursor-pointer"
              style={{ transform: `scale(${1 + (audioLevel / 100) * 0.15})` }}
            >
              <span className="material-symbols-outlined text-5xl animate-pulse" style={{fontVariationSettings: "'FILL' 1"}}>mic</span>
            </button>
            <DexAvatar state="speaking" size="sm" showCaptionBubble={true} caption="Great reading! Keep going!" className="absolute -bottom-6 left-1/2 -translate-x-1/2" />
          </div>

          {/* Dynamic Voice Clarity Indicator Meter */}
          <div className="flex flex-col items-center gap-2 mt-2">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface-container-high/80 border border-primary/20 backdrop-blur-md shadow-sm">
              <span className={`w-2.5 h-2.5 rounded-full ${audioLevel > 8 ? 'bg-emerald-500 animate-ping' : 'bg-amber-400'}`}></span>
              <span className="font-display text-xs font-bold uppercase tracking-[0.08em] text-on-surface student-text">
                {clarityStatus}
              </span>
            </div>

            {/* Dynamic Visual Audio Wave Bars */}
            <div className="flex items-center gap-1 h-6 px-2">
              {[0.4, 0.8, 1.2, 0.7, 1.0, 0.5].map((multiplier, idx) => {
                const barHeight = Math.max(4, Math.min(24, Math.round((audioLevel * multiplier * 0.3))));
                return (
                  <div
                    key={idx}
                    className="w-1.5 rounded-full bg-primary transition-all duration-75"
                    style={{ height: `${barHeight}px`, opacity: audioLevel > 5 ? 0.85 : 0.3 }}
                  ></div>
                );
              })}
            </div>
          </div>
          
          <button 
            onClick={stopRecording}
            className="mt-2 px-7 py-3.5 bg-error text-on-error rounded-2xl font-display text-sm font-bold uppercase tracking-[0.08em] flex items-center gap-2 hover:bg-error/90 transition-all shadow-lg active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>stop_circle</span>
            Finish Reading
          </button>
        </>
      )}
    </div>
  );
}