import { useState, useEffect, useMemo, useRef } from 'react';

export interface ApiError extends Error {
  code?: string;
  details?: Record<string, unknown>;
}

const RENDER_URLS = [
  'https://decodex-n0gq.onrender.com',
  'https://decodex-backend.onrender.com',
];

export function getApiBaseUrl(): string {
  let raw = (import.meta.env.VITE_API_BASE_URL || '').trim();
  raw = raw.replace(/^["']|["']$/g, '').trim();

  if (!raw && typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
    return RENDER_URLS[0];
  }
  if (!raw) return '';
  if (!raw.startsWith('http://') && !raw.startsWith('https://')) raw = `https://${raw}`;
  return raw.replace(/\/$/, '');
}

function isUnavailable(err: any, status?: number): boolean {
  if (status === 502 || status === 503 || status === 504) return true;
  if (err instanceof TypeError && /failed to fetch|network/i.test(err.message)) return true;
  return false;
}

export async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const base = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> || {}),
  };
  const fetchOptions: RequestInit = { ...options, credentials: 'include', headers };

  // Build URL list: explicit base first, then any remaining Render URLs as fallbacks
  const urls = base
    ? [base, ...RENDER_URLS.filter(u => u !== base)]
    : RENDER_URLS;

  let lastErr: any;
  for (const url of urls) {
    const target = `${url}/api/v1${cleanEndpoint}`;
    try {
      const response = await fetch(target, fetchOptions);
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) window.dispatchEvent(new Event('auth:expired'));
      if (!response.ok) {
        if (isUnavailable(null, response.status)) { lastErr = null; continue; }
        const error = new Error(data?.error?.message || `Server Error (${response.status})`) as ApiError;
        error.code = data?.error?.code;
        error.details = data?.error?.details;
        throw error;
      }
      return data as T;
    } catch (err: any) {
      if (isUnavailable(err)) { lastErr = err; continue; }
      throw err;
    }
  }
  throw new Error('Unable to connect to Decodex backend. Please check your connection and try again.');
}

export function useApiQuery<T>(endpoint: string, options?: RequestInit) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!endpoint.includes('/skip'));
  const [error, setError] = useState<Error | null>(null);
  const [key, setKey] = useState(0);
  const optionsKey = useMemo(() => JSON.stringify(options ?? {}), [options]);
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    if (!endpoint || endpoint.includes('/skip')) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    
    apiFetch<T>(endpoint, { ...optionsRef.current, signal: controller.signal })
      .then(setData)
      .catch(err => {
        if (err.name !== 'AbortError') {
          setError(err);
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [endpoint, key, optionsKey]);

  return { data, loading, error, refetch: () => setKey(k => k + 1) };
}
