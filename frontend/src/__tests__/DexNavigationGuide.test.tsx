/**
 * DexNavigationGuide tests
 *
 * Verifies:
 *  1. Auto-narration is DISABLED — speak() must never be called on mount /
 *     first-visit, regardless of whether the route was previously visited.
 *  2. The replay button renders for student users on known routes.
 *  3. speak() IS called when the user explicitly clicks the replay button.
 *  4. No button renders for unknown routes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock useDex hook — capture the speak function spy.
const mockSpeak = vi.fn();
vi.mock('../hooks/useDex', () => ({
  useDex: () => ({ speak: mockSpeak }),
}));

// Mock AuthContext — always return a logged-in student.
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'student-123',
      email: 'student@decodex.com',
      role: 'student' as const,
      display_name: 'Test Student',
    },
    isAuthenticated: true,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

// Mock localStorage so tests are hermetic.
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock speechSynthesis (the browser API) so tests don't fail in JSDOM.
const mockSpeechSynthesisSpeak = vi.fn();
const mockSpeechSynthesisCancel = vi.fn();
vi.stubGlobal('speechSynthesis', {
  speak: mockSpeechSynthesisSpeak,
  cancel: mockSpeechSynthesisCancel,
});

// ---------------------------------------------------------------------------
// Import component AFTER mocks are registered
// ---------------------------------------------------------------------------
import DexNavigationGuide from '../components/DexNavigationGuide';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Renders DexNavigationGuide inside a MemoryRouter so that useLocation()
 * receives the correct pathname.  BrowserRouter does not support
 * `initialEntries`, which is why MemoryRouter is used here.
 */
const renderComponent = (pathname = '/dashboard') =>
  render(
    <MemoryRouter initialEntries={[pathname]}>
      <DexNavigationGuide />
    </MemoryRouter>
  );

/**
 * aria-label on the replay button:
 * `"${TUTOR_NAME} will read this page to you"` → "Dex will read this page to you"
 */
const REPLAY_ARIA_LABEL = /dex will read this page to you/i;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DexNavigationGuide', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // First-visit scenario: route not yet in localStorage.
    localStorageMock.getItem.mockReturnValue(null);
    localStorageMock.setItem.mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Rendering ────────────────────────────────────────────────────────────

  it('renders the replay button for a student on a known route', async () => {
    renderComponent('/dashboard');
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: REPLAY_ARIA_LABEL })
      ).toBeInTheDocument();
    });
  });

  it('does not render for routes that have no script', () => {
    renderComponent('/unknown-route');
    expect(screen.queryByRole('button', { name: REPLAY_ARIA_LABEL })).not.toBeInTheDocument();
  });

  // ── Auto-speak disabled ──────────────────────────────────────────────────

  it('does NOT auto-speak on first visit to a known route', async () => {
    // Route has never been visited — localStorage returns null.
    localStorageMock.getItem.mockReturnValue(null);

    renderComponent('/dashboard');

    // Wait until the button is visible (effect has run).
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: REPLAY_ARIA_LABEL })
      ).toBeInTheDocument();
    });

    // speak() must NOT have been called automatically.
    expect(mockSpeak).not.toHaveBeenCalled();
    expect(mockSpeechSynthesisSpeak).not.toHaveBeenCalled();
  });

  it('does NOT auto-speak on a route that was already visited', async () => {
    // Simulate a previously visited route stored in localStorage.
    localStorageMock.getItem.mockReturnValue(JSON.stringify(['/dashboard']));

    renderComponent('/dashboard');

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: REPLAY_ARIA_LABEL })
      ).toBeInTheDocument();
    });

    expect(mockSpeak).not.toHaveBeenCalled();
    expect(mockSpeechSynthesisSpeak).not.toHaveBeenCalled();
  });

  // ── Manual replay ────────────────────────────────────────────────────────

  it('calls speak() with the dashboard script when the user clicks the replay button', async () => {
    renderComponent('/dashboard');

    const button = await screen.findByRole('button', { name: REPLAY_ARIA_LABEL });
    fireEvent.click(button);

    expect(mockSpeak).toHaveBeenCalledTimes(1);
    expect(mockSpeak).toHaveBeenCalledWith(
      expect.stringContaining('Welcome to your dashboard')
    );
  });

  it('calls speak() with the learning-path script when on /learning-path', async () => {
    renderComponent('/learning-path');

    const button = await screen.findByRole('button', { name: REPLAY_ARIA_LABEL });
    fireEvent.click(button);

    expect(mockSpeak).toHaveBeenCalledTimes(1);
    expect(mockSpeak).toHaveBeenCalledWith(
      expect.stringContaining('learning path shows personalized practice')
    );
  });

  it('calls speak() with the passages script when on /passages', async () => {
    renderComponent('/passages');

    const button = await screen.findByRole('button', { name: REPLAY_ARIA_LABEL });
    fireEvent.click(button);

    expect(mockSpeak).toHaveBeenCalledTimes(1);
    expect(mockSpeak).toHaveBeenCalledWith(
      expect.stringContaining('Choose a passage to read aloud')
    );
  });
});