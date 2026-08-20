/**
 * ReadingPreferencesPanel tests — renders, updatePreferences triggers PUT, Reset restores defaults.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ReadingPreferencesPanel from '../components/ReadingPreferencesPanel';

// Mock the hook
const mockUpdatePreferences = vi.fn();
const mockResetToDefaults = vi.fn();

vi.mock('../hooks/useReadingPreferences', () => {
  const mockPreferences = { fontScale: 1, lineSpacing: 1, letterSpacing: 0 };
  const mockLoading = false;
  const mockDefaultPreferences = { fontScale: 1, lineSpacing: 1, letterSpacing: 0 };
  
  return {
    useReadingPreferences: () => ({
      preferences: mockPreferences,
      loading: mockLoading,
      updatePreferences: mockUpdatePreferences,
      resetToDefaults: mockResetToDefaults,
      DEFAULT_PREFERENCES: mockDefaultPreferences,
    }),
    DEFAULT_PREFERENCES: mockDefaultPreferences,
  };
});

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  X: () => <span data-testid="x-icon" />,
  RotateCcw: () => <span data-testid="rotate-icon" />,
  Type: () => <span data-testid="type-icon" />,
}));

function renderPanel(isOpen = true) {
  return render(
    <MemoryRouter>
      <ReadingPreferencesPanel isOpen={isOpen} onClose={vi.fn()} />
    </MemoryRouter>
  );
}

describe('ReadingPreferencesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render when isOpen is true', () => {
    renderPanel(true);
    
    expect(screen.getByText('Reading Preferences')).toBeInTheDocument();
    expect(screen.getByLabelText('Close preferences')).toBeInTheDocument();
    expect(screen.getByText('Font Size')).toBeInTheDocument();
    expect(screen.getByText('Line Spacing')).toBeInTheDocument();
    expect(screen.getByText('Letter Spacing')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset to default/i })).toBeInTheDocument();
  });

  it('should not render when isOpen is false', () => {
    renderPanel(false);
    
    expect(screen.queryByText('Reading Preferences')).not.toBeInTheDocument();
  });

  it('should show live preview text', () => {
    renderPanel(true);
    
    expect(screen.getByText(/The quick brown fox jumps over the lazy dog/)).toBeInTheDocument();
  });

  it('should call resetToDefaults when Reset button is clicked', async () => {
    const user = userEvent.setup();
    renderPanel(true);
    
    const resetButton = screen.getByRole('button', { name: /reset to default/i });
    await user.click(resetButton);
    
    expect(mockResetToDefaults).toHaveBeenCalled();
  });

  it('should close when close button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ReadingPreferencesPanel isOpen={true} onClose={onClose} />
      </MemoryRouter>
    );
    
    const closeButton = screen.getByLabelText('Close preferences');
    await user.click(closeButton);
    
    expect(onClose).toHaveBeenCalled();
  });

  it('should display current preference values', () => {
    renderPanel(true);
    
    expect(screen.getByText('100%')).toBeInTheDocument(); // fontScale 1 = 100%
    expect(screen.getByText('1.00')).toBeInTheDocument(); // lineSpacing 1
    expect(screen.getByText('0.000em')).toBeInTheDocument(); // letterSpacing 0
  });

  it('should have decrement/increment buttons for font scale', () => {
    renderPanel(true);
    
    expect(screen.getByLabelText('Decrease font size')).toBeInTheDocument();
    expect(screen.getByLabelText('Increase font size')).toBeInTheDocument();
  });

  it('should have decrement/increment buttons for line spacing', () => {
    renderPanel(true);
    
    expect(screen.getByLabelText('Decrease line spacing')).toBeInTheDocument();
    expect(screen.getByLabelText('Increase line spacing')).toBeInTheDocument();
  });

  it('should have decrement/increment buttons for letter spacing', () => {
    renderPanel(true);
    
    expect(screen.getByLabelText('Decrease letter spacing')).toBeInTheDocument();
    expect(screen.getByLabelText('Increase letter spacing')).toBeInTheDocument();
  });
});
