/**
 * Tests for getApiBaseUrl() — locks in URL handling for different env var states.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to test the module with different env vars, so we use dynamic imports
describe('getApiBaseUrl()', () => {
  beforeEach(() => {
    // Reset module cache to re-evaluate getApiBaseUrl with new env vars
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should return empty string when VITE_API_BASE_URL is not set and not on vercel', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');

    const { getApiBaseUrl } = await import('../lib/api');
    // When not on vercel.app, should return ''
    const result = getApiBaseUrl();
    // On localhost (jsdom default), should return ''
    expect(result).toBe('');
  });

  it('should return the URL as-is when valid https URL is provided', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://decodex-backend.onrender.com');

    const { getApiBaseUrl } = await import('../lib/api');
    const result = getApiBaseUrl();
    expect(result).toBe('https://decodex-backend.onrender.com');
  });

  it('should strip trailing slashes', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://decodex-backend.onrender.com/');

    const { getApiBaseUrl } = await import('../lib/api');
    const result = getApiBaseUrl();
    expect(result).toBe('https://decodex-backend.onrender.com');
  });

  it('should strip surrounding quotes from the value', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '"https://decodex-backend.onrender.com"');

    const { getApiBaseUrl } = await import('../lib/api');
    const result = getApiBaseUrl();
    expect(result).toBe('https://decodex-backend.onrender.com');
  });

  it('should prepend https:// if no protocol is provided', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'decodex-backend.onrender.com');

    const { getApiBaseUrl } = await import('../lib/api');
    const result = getApiBaseUrl();
    expect(result).toBe('https://decodex-backend.onrender.com');
  });

  it('should preserve http:// if explicitly provided', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3000');

    const { getApiBaseUrl } = await import('../lib/api');
    const result = getApiBaseUrl();
    expect(result).toBe('http://localhost:3000');
  });
});
