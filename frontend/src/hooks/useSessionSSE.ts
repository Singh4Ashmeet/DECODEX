import { useState, useEffect, useRef } from 'react';
import { getApiBaseUrl, apiFetch } from '../lib/api';

export interface ProcessingStatus {
  step: 'idle' | 'uploading' | 'queued' | 'transcribing' | 'aligning' | 'classifying' | 'saving' | 'generating' | 'scoring' | 'processing' | 'complete' | 'error';
  message: string;
}

export function useSessionSSE(sessionId: string | null) {
  const [status, setStatus] = useState<ProcessingStatus>({ step: 'idle', message: 'Waiting to record...' });
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef(false);

  // Clear polling helper
  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  useEffect(() => {
    if (!sessionId) return;
    completedRef.current = false;

    const baseUrl = getApiBaseUrl();
    // SSE uses withCredentials for cookie auth; no localStorage token needed
    const sseUrl = `${baseUrl}/api/v1/sessions/${sessionId}/status/stream`;

    let eventSource: EventSource | null = null;
    let sseConnected = false;

    // ---------------------------------------------------------------
    // 1. Try SSE first
    // ---------------------------------------------------------------
    try {
      eventSource = new EventSource(sseUrl, { withCredentials: true });

      eventSource.addEventListener('connected', () => {
        sseConnected = true;
        console.log('SSE Connected for session', sessionId);
      });

      eventSource.addEventListener('status', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        setStatus({ step: data.step, message: data.message });

        if (data.step === 'complete') {
          completedRef.current = true;
          eventSource?.close();
          stopPolling();
        }
      });

      eventSource.addEventListener('error', (e: any) => {
        if (e.data) {
          const data = JSON.parse(e.data);
          setStatus({ step: 'error', message: data.message || 'Processing failed.' });
          completedRef.current = true;
          eventSource?.close();
          stopPolling();
        }
        // If it's just a network disconnect, don't close — EventSource auto-reconnects.
        // But we rely on polling below as the safety net.
      });
    } catch (sseErr) {
      console.warn('SSE connection failed, relying on polling fallback:', sseErr);
    }

    // ---------------------------------------------------------------
    // 2. Polling fallback — runs alongside SSE as a safety net.
    //    Checks session status every 2 seconds via the REST endpoint.
    //    Guarantees redirection even if SSE drops on serverless proxies.
    // ---------------------------------------------------------------
    pollingRef.current = setInterval(async () => {
      if (completedRef.current) {
        stopPolling();
        return;
      }

      try {
        const data = await apiFetch<{ step: string; message: string; status: string }>(`/sessions/${sessionId}/status`);

        if (data.step === 'complete') {
          completedRef.current = true;
          setStatus({ step: 'complete', message: data.message || 'Processing complete!' });
          eventSource?.close();
          stopPolling();
        } else if (data.step === 'error') {
          completedRef.current = true;
          setStatus({ step: 'error', message: data.message || 'Processing failed.' });
          eventSource?.close();
          stopPolling();
        } else if (!sseConnected) {
          // Only update UI from polling if SSE hasn't connected (avoid flickering)
          setStatus({ step: data.step as ProcessingStatus['step'], message: data.message });
        }
      } catch {
        // Polling error is non-fatal; SSE may still be working
      }
    }, 2000);

    return () => {
      eventSource?.close();
      stopPolling();
    };
  }, [sessionId]);

  return { status, setStatus };
}
