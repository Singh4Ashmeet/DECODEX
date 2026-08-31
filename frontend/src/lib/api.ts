import { useState, useEffect, useMemo, useRef } from 'react';

export interface ApiError extends Error {
  code?: string;
  details?: Record<string, unknown>;
}

// Backend instances — primary first, fallback second.
// If one is down (free-tier hibernate, deploy, etc.) we automatically retry the other.
const RENDER_PRIMARY = 'https://decodex-backend.onrender.com';
const RENDER_FALLBACK = 'https://decodex-n0gq.onrender.com';

export function getApiBaseUrl(): string {
  let raw = (import.meta.env.VITE_API_BASE_URL || '').trim();
  raw = raw.replace(/^["']|["']$/g, '').trim();

  // If deployed on Vercel and VITE_API_BASE_URL wasn't baked into the build, fallback to live Render backend
  if (!raw && typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
    return RENDER_PRIMARY;
  }

  if (!raw) return '';

  if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
    raw = `https://${raw}`;
  }
  return raw.replace(/\/$/, '');
}

/** Check if an error means the server is unreachable / down (not a normal API error). */
function isServerError(err: any): boolean {
  if (err instanceof TypeError && err.message.toLowerCase().includes('failed to fetch')) return true;
  if (err instanceof TypeError && err.message.toLowerCase().includes('network')) return true;
  return false;
}

/** Check if a response status indicates the server is unavailable (503, 502, etc.) */
function isUnavailableStatus(status: number): boolean {
  return status === 503 || status === 502 || status === 504;
}

async function fetchWithBase<T>(url: string, options: RequestInit): Promise<{ data: T; unavailable: boolean }> {
  try {
    const response = await fetch(url, options);

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      window.dispatchEvent(new Event('auth:expired'));
    }

    if (!response.ok) {
      // For 503/502/504, signal unavailability so we can try fallback
      if (isUnavailableStatus(response.status)) {
        return { data: null as T, unavailable: true };
      }
      const errorMsg = data?.error?.message || `Server Error (${response.status})`;
      const error = new Error(errorMsg) as ApiError;
      error.code = data?.error?.code;
      error.details = data?.error?.details;
      throw error;
    }

    return { data: data as T, unavailable: false };
  } catch (err: any) {
    if (isServerError(err)) {
      return { data: null as T, unavailable: true };
    }
    throw err;
  }
}

export async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const primary = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> || {}),
  };
  const fetchOptions: RequestInit = {
    ...options,
    credentials: 'include',
    headers,
  };

  // Try primary URL
  const primaryUrl = primary
    ? `${primary}/api/v1${cleanEndpoint}`
    : `/api/v1${cleanEndpoint}`;

  const primaryResult = await fetchWithBase<T>(primaryUrl, fetchOptions);
  if (!primaryResult.unavailable) return primaryResult.data;

  // Primary is down — try fallback (only if we have a primary that's different from fallback)
  if (primary && primary !== RENDER_FALLBACK) {
    const fallbackUrl = `${RENDER_FALLBACK}/api/v1${cleanEndpoint}`;
    console.warn(`[apiFetch] Primary (${primary}) unavailable, trying fallback (${RENDER_FALLBACK})...`);
    const fallbackResult = await fetchWithBase<T>(fallbackUrl, fetchOptions);
    if (!fallbackResult.unavailable) return fallbackResult.data;
  }

  // Both failed
  throw new Error(`Unable to connect to Decodex backend. Please check your connection and try again.`);
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
