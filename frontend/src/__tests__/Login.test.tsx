/**
 * Login page tests — basic render and submit flow.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import Login from '../pages/Login';

// Mock the api module
vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(),
}));

// Mock the logo import
vi.mock('../assets/decodex-logo.png', () => ({ default: 'mock-logo.png' }));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock AuthContext
const mockLogin = vi.fn();
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    user: null,
    isAuthenticated: false,
    loading: false,
    logout: vi.fn(),
  }),
}));

import { apiFetch } from '../lib/api';
const mockApiFetch = vi.mocked(apiFetch);

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );
}

describe('Login Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the login form', () => {
    renderLogin();
    
    expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('should show error on failed login', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('Invalid credentials'));

    renderLogin();
    
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email address/i), 'test@decodex.com');
    await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Invalid credentials');
    });
  });

  it('should call login on successful submission', async () => {
    mockApiFetch.mockResolvedValueOnce({
      user: { id: '123', email: 'test@decodex.com', role: 'student', display_name: 'Test' },
      token: 'fake-jwt',
    });

    renderLogin();
    
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email address/i), 'test@decodex.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'test@decodex.com' })
      );
    });
  });

  it('should have a link to the register page', () => {
    renderLogin();
    
    const registerLink = screen.getByRole('link', { name: /register/i });
    expect(registerLink).toBeInTheDocument();
    expect(registerLink).toHaveAttribute('href', '/register');
  });
});
