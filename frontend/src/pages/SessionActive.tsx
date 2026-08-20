import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch, useApiQuery, getApiBaseUrl } from '../lib/api';
import { useSessionSSE } from '../hooks/useSessionSSE';
import { useReadingPreferences } from '../hooks/useReadingPreferences';
import AudioRecorder from '../components/AudioRecorder';
import ReadingPreferencesPanel from '../components/ReadingPreferencesPanel';
import { Type } from 'lucide-react';
import DexAvatar from '../components/DexAvatar';

export default function SessionActive() {
  const { id: passageId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const existingSessionId = searchParams.get('sessionId');
  const { data: passageData, loading: passageLoading } = useApiQuery<{ passage: any }>(`/passages/${passageId}`);
  const { data: consentStatus, loading: consentLoading } = useApiQuery<{ consent_granted: boolean }>('/students/me/consent-status');
  const { preferences } = useReadingPreferences();
  const [prefsPanelOpen, setPrefsPanelOpen] = useState(false);
  const [encouragementIndex, setEncouragementIndex] = useState(0);

  const [sessionId, setSessionId] = useState<string | null>(existingSessionId);
  const { status, setStatus } = useSessionSSE(sessionId);

  const encouragements = [
    "You're doing great! 🌟",
    "Keep going, you've got this!",
    "Nice reading!",
    "Every word counts!",
    "You're improving with each session!",
  ];

  useEffect(() => {
    if (status.step === 'queued' || status.step === 'uploading') {
      const interval = setInterval(() => {
        setEncouragementIndex(prev => (prev + 1) % encouragements.length);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [status.step, encouragements.length]);

  useEffect(() => {
    if (existingSessionId) {
      setSessionId(existingSessionId);
      return;
    }

    if (passageId && !sessionId) {
      apiFetch<{ session: any }>('/sessions', {
        method: 'POST',
        body: JSON.stringify({ passage_id: passageId })
      }).then(res => setSessionId(res.session.id))
        .catch(err => console.error("Failed to create session", err));
    }
  }, [existingSessionId, passageId, sessionId]);

  const handleRecordingComplete = async (blob: Blob) => {
    if (!sessionId) return;
    
    try {
      const tempUrl = URL.createObjectURL(blob);
      sessionStorage.setItem(`temp_audio_${sessionId}`, tempUrl);
    } catch (e) {
      console.warn('Could not store temporary audio blob URL:', e);
    }

    setStatus({ step: 'uploading', message: 'Uploading audio...' });
    
    const formData = new FormData();
    formData.append('audio', blob, 'recording.webm');
    
    try {
      const baseUrl = getApiBaseUrl();
      const uploadUrl = `${baseUrl}/api/v1/sessions/${sessionId}/audio`;

      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Upload failed');
      
      setStatus({ step: 'queued', message: 'Audio queued for processing...' });
    } catch {
      setStatus({ step: 'error', message: 'Failed to upload audio' });
    }
  };

  useEffect(() => {
    if (status.step === 'complete') {
      setTimeout(() => navigate(`/sessions/${sessionId}/results`), 2000);
    }
  }, [status.step, sessionId, navigate]);

  if (passageLoading) return <div className="p-8 text-center student-text">Loading passage...</div>;

  return (
    <main className="flex-1 w-full max-w-[1024px] mx-auto px-container-padding flex flex-col items-center justify-center gap-card-gap pb-12 mt-4 md:mt-12">
      {/* Passage Card with Dex Companion */}
      <article className="stat-card stat-card-hover w-full rounded-[24px] p-8 md:p-12 flex flex-col gap-6 max-w-3xl border-2 border-primary/10">
        {/* Dex Avatar + Title */}
        <div className="flex flex-col items-center gap-4 mb-4">
          <DexAvatar state="idle" size="md" showCaptionBubble={true} caption="Let's read together! I'll be listening." />
          <h1 className="font-display text-[32px] leading-[1.3] font-bold text-primary text-center mb-2">{passageData?.passage.title || 'Reading Exercise'}</h1>
        </div>
        <button
          onClick={() => setPrefsPanelOpen(true)}
          className="absolute top-6 right-6 p-2 rounded-xl text-on-surface-variant hover:bg-surface-container-high transition-colors"
          aria-label="Reading preferences"
        >
          <Type className="w-5 h-5" />
        </button>
        <div className="font-body text-[20px] leading-[1.6] text-on-surface flex flex-col gap-6 tracking-[0.05em] student-text">
          <p
            className="transition-all duration-300"
            style={{
              fontSize: `${20 * preferences.fontScale}px`,
              lineHeight: preferences.lineSpacing,
              letterSpacing: `${preferences.letterSpacing}em`,
            }}
          >
            {passageData?.passage.content}
          </p>
        </div>
      </article>

      {/* Recording / Processing Area */}
      <div className="flex flex-col items-center gap-4 mt-8 relative w-full max-w-md">
        {status.step === 'idle' ? (
          <div className="w-full max-w-md flex flex-col items-center gap-4">
            <AudioRecorder
              onRecordingComplete={handleRecordingComplete}
              disabled={consentLoading || !consentStatus?.consent_granted}
              disabledMessage={consentLoading ? 'Checking parent consent before recording can begin.' : 'Recording is locked until a parent confirms consent.'}
            />
          </div>
        ) : status.step === 'error' ? (
          <div role="alert" className="w-full max-w-3xl mt-4 mb-8 stat-card stat-card-hover p-6 rounded-[24px] border border-red-300 bg-red-50/50">
            <div className="text-center flex flex-col items-center justify-center py-4">
              <DexAvatar state="concerned" size="md" showCaptionBubble={true} caption="Oops! Something went wrong. Let's try again." />
              <h3 className="text-lg font-bold font-display text-red-800 mt-2">{status.message || 'Something went wrong'}</h3>
              <p className="font-body text-sm text-red-700 mt-2 student-text">You can try recording again.</p>
              <button
                onClick={() => setStatus({ step: 'idle', message: 'Waiting to record...' })}
                className="mt-4 h-12 px-6 rounded-xl bg-red-600 font-body font-bold text-white hover:bg-red-700"
              >
                Try again
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-3xl mt-4 mb-8 stat-card stat-card-hover p-6 rounded-[24px] border border-primary/20 bg-primary/5">
            <div className="text-center flex flex-col items-center justify-center py-4">
              <DexAvatar state="thinking" size="lg" showCaptionBubble={true} caption={encouragements[encouragementIndex]} />
              <h3 className="text-lg font-bold font-display text-primary mt-2">{status.message}</h3>
              <p className="font-body text-sm text-on-surface-variant mt-2 uppercase tracking-[0.08em] student-text">Step: {status.step}</p>
              <div className="w-full max-w-xs h-2 bg-surface-container-high rounded-full overflow-hidden mt-4">
                <div className="bg-primary h-full rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
            </div>
          </div>
        )}
      </div>
      <ReadingPreferencesPanel isOpen={prefsPanelOpen} onClose={() => setPrefsPanelOpen(false)} />
    </main>
  );
}