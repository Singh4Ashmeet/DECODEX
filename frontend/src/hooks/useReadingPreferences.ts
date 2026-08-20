import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch, useApiQuery } from '../lib/api';

export interface ReadingPreferences {
  fontScale: number;
  lineSpacing: number;
  letterSpacing: number;
}

export const DEFAULT_PREFERENCES: ReadingPreferences = {
  fontScale: 1,
  lineSpacing: 1,
  letterSpacing: 0,
};

const PREFERENCES_ENDPOINT = '/students/me/reading-preferences';

export function useReadingPreferences() {
  const { data, loading, error, refetch } = useApiQuery<{ preferences: ReadingPreferences }>(PREFERENCES_ENDPOINT);
  const [pendingUpdate, setPendingUpdate] = useState<Partial<ReadingPreferences> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const preferences = data?.preferences ?? DEFAULT_PREFERENCES;

  const updatePreferences = useCallback((updates: Partial<ReadingPreferences>) => {
    const merged = { ...preferences, ...updates };
    setPendingUpdate(merged);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      try {
        await apiFetch(PREFERENCES_ENDPOINT, {
          method: 'PUT',
          body: JSON.stringify(merged),
        });
        setPendingUpdate(null);
        refetch();
      } catch (err) {
        console.error('Failed to update reading preferences:', err);
        setPendingUpdate(null);
      }
    }, 400);
  }, [preferences, refetch]);

  const resetToDefaults = useCallback(async () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    try {
      await apiFetch(PREFERENCES_ENDPOINT, {
        method: 'PUT',
        body: JSON.stringify(DEFAULT_PREFERENCES),
      });
      refetch();
    } catch (err) {
      console.error('Failed to reset reading preferences:', err);
    }
  }, [refetch]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    preferences,
    loading,
    error,
    updatePreferences,
    resetToDefaults,
    pendingUpdate,
  };
}