import { useState, useEffect, useMemo, useRef } from 'react';

export interface ApiError extends Error {
  code?: string;
  details?: Record<string, unknown>;
}

export function getApiBaseUrl(): string {
  let raw = (import.meta.env.VITE_API_BASE_URL || '').trim();
  raw = raw.replace(/^["']|["']$/g, '').trim();

  // If deployed on Vercel and VITE_API_BASE_URL wasn't baked into the build, fallback to live Render backend
  if (!raw && typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
    return 'https://decodex-n0gq.onrender.com';
  }

  if (!raw) return '';

  if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
    raw = `https://${raw}`;
  }
  return raw.replace(/\/$/, '');
}

export async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  const targetUrl = baseUrl 
    ? `${baseUrl}/api/v1${cleanEndpoint}` 
    : `/api/v1${cleanEndpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> || {}),
  };

  try {
    const response = await fetch(targetUrl, {
      ...options,
      credentials: 'include',
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      window.dispatchEvent(new Event('auth:expired'));
    }

    if (!response.ok) {
      const errorMsg = data?.error?.message || `Server Error (${response.status})`;
      const error = new Error(errorMsg) as ApiError;
      error.code = data?.error?.code;
      error.details = data?.error?.details;
      throw error;
    }

    return data as T;
  } catch (err: any) {
    if (err instanceof TypeError && err.message.toLowerCase().includes('failed to fetch')) {
      throw new Error(`Unable to connect to Decodex backend (${targetUrl}). Please check your connection.`);
    }
    throw err;
  }
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
