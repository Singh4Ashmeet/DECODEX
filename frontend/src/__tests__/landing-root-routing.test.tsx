import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import LandingPage from '../pages/LandingPage';

const teacherUser = {
  id: '33333333-3333-3333-3333-333333333333',
  email: 'teacher@decodex.com',
  role: 'teacher' as const,
  display_name: 'Teacher Demo',
};

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: teacherUser,
    isAuthenticated: true,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('../assets/decodex-logo.png', () => ({ default: 'mock-logo.png' }));

vi.mock('../components/DexAvatar', () => ({
  default: () => <div data-testid="dex-avatar" />,
}));

vi.mock('../components/DexNavigationGuide', () => ({
  default: () => null,
}));

vi.mock('../components/DexVoiceCommands', () => ({
  default: () => null,
}));

vi.mock('../pages/TeacherDashboard', () => ({
  default: () => <div>Teacher Dashboard View</div>,
}));

describe('root landing routing', () => {
  it('renders the public landing page at / for an already-authenticated teacher', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: /Understand How Every Child Reads/i })).toBeInTheDocument();
    expect(screen.queryByText('Teacher Dashboard View')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Decodex$/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /^Dashboard$/i })).toHaveAttribute('href', '/teacher/dashboard');
  });

  it('does not self-redirect authenticated users away from LandingPage', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <LandingPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /Understand How Every Child Reads/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Go to My Dashboard/i })).toBeInTheDocument();
  });
});
