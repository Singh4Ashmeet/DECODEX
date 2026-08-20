import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import DexNavigationGuide from './components/DexNavigationGuide';
import DexVoiceCommands from './components/DexVoiceCommands';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const PassageSelection = lazy(() => import('./pages/PassageSelection'));
const SessionActive = lazy(() => import('./pages/SessionActive'));
const SessionResults = lazy(() => import('./pages/SessionResults'));
const PracticePage = lazy(() => import('./pages/PracticePage'));
const TeacherDashboard = lazy(() => import('./pages/TeacherDashboard'));
const StudentDetail = lazy(() => import('./pages/StudentDetail'));
const ParentHome = lazy(() => import('./pages/ParentHome'));
const ParentSessionReport = lazy(() => import('./pages/ParentSessionReport'));
const ConsentConfirm = lazy(() => import('./pages/ConsentConfirm'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const LearningPathPage = lazy(() => import('./pages/LearningPathPage'));
const StoryReaderPage = lazy(() => import('./pages/StoryReaderPage'));
const CopilotPanel = lazy(() => import('./pages/CopilotPanel'));

function RouteLoading() {
  return (
    <div className="min-h-[45vh] flex items-center justify-center text-center">
      <div className="flex flex-col items-center gap-3 text-primary">
        <span className="material-symbols-outlined text-4xl animate-spin" aria-hidden="true">progress_activity</span>
        <p className="font-display text-xs font-bold uppercase tracking-[0.12em] text-on-surface-variant">Loading page</p>
      </div>
    </div>
  );
}

function App() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    setMobileMenuOpen(false);
    await logout();
    navigate('/login');
  };

  const getHomeRoute = () => {
    if (!user) return '/about';
    if (user.role === 'parent') return '/parent/home';
    if (user.role === 'teacher' || user.role === 'admin') return '/teacher/dashboard';
    return '/dashboard';
  };

  useEffect(() => {
    if (user?.role === 'student') {
      document.documentElement.setAttribute('data-theme', 'student');
    } else if (user?.role === 'teacher' || user?.role === 'admin') {
      document.documentElement.setAttribute('data-theme', 'teacher');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [user?.role]);


  return (
    <div className="min-h-screen flex flex-col bg-transparent text-on-background font-body text-body selection:bg-primary-container selection:text-on-primary-container overflow-x-hidden">
      <Toaster position="bottom-right" richColors />
      <header className="glass-header text-primary shadow-sm sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-surface-container-highest">
        <div className="flex justify-between items-center w-full px-container-padding h-20 max-w-max-content-width mx-auto">
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="font-display text-[28px] sm:text-[32px] font-bold text-primary flex items-center gap-2"
          >
            Decodex
          </Link>

          {/* Desktop Navigation */}
          <nav className="h-full hidden lg:flex">
            {isAuthenticated ? (
              <div className="flex items-center gap-6 h-full">
                <Link
                  to={getHomeRoute()}
                  className="text-on-surface-variant hover:text-primary transition-colors duration-200 flex items-center font-display text-[14px] font-bold uppercase tracking-[0.08em] h-full border-b-2 border-transparent hover:border-primary"
                >
                  Dashboard
                </Link>
                {user?.role === 'student' && (
                  <>
                    <Link
                      to="/learning-path"
                      className="text-on-surface-variant hover:text-primary transition-colors duration-200 flex items-center font-display text-[14px] font-bold uppercase tracking-[0.08em] h-full border-b-2 border-transparent hover:border-primary"
                    >
                      Learning Path
                    </Link>
                    <Link
                      to="/stories"
                      className="text-on-surface-variant hover:text-primary transition-colors duration-200 flex items-center font-display text-[14px] font-bold uppercase tracking-[0.08em] h-full border-b-2 border-transparent hover:border-primary"
                    >
                      AI Stories
                    </Link>
                  </>
                )}
                {(user?.role === 'teacher' || user?.role === 'admin') && (
                  <Link
                    to="/teacher/dashboard"
                    className="text-on-surface-variant hover:text-primary transition-colors duration-200 flex items-center font-display text-[14px] font-bold uppercase tracking-[0.08em] h-full border-b-2 border-transparent hover:border-primary"
                  >
                    Classroom
                  </Link>
                )}

                <div className="flex items-center gap-4 ml-4 pl-6 border-l border-surface-variant">
                  <span className="font-body text-on-surface-variant">
                    Hi, <span className="font-bold text-on-surface">{user?.display_name}</span>
                  </span>
                  <button
                    onClick={handleLogout}
                    className="font-display text-[14px] font-bold uppercase tracking-[0.08em] text-primary border border-primary px-4 py-2 rounded-full hover:bg-primary-container hover:text-on-primary-container transition-colors duration-200 cursor-pointer"
                  >
                    Logout
                  </button>
                  <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold font-display text-sm border-2 border-surface-variant flex-shrink-0">
                    {user?.display_name?.substring(0, 2).toUpperCase() || 'U'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex gap-4 items-center h-full">
                <Link
                  to="/login"
                  className="font-display text-[14px] font-bold uppercase tracking-[0.08em] text-on-surface-variant hover:text-primary transition"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="font-display text-[14px] font-bold uppercase tracking-[0.08em] bg-primary text-on-primary px-6 py-2 rounded-full hover:bg-primary-container hover:text-on-primary-container transition shadow-sm"
                >
                  Register
                </Link>
              </div>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl text-primary hover:bg-surface-container transition-colors cursor-pointer"
            aria-label="Toggle Navigation Menu"
          >
            <span className="material-symbols-outlined text-3xl">
              {mobileMenuOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-surface border-b border-surface-variant px-container-padding py-4 flex flex-col gap-4 shadow-md animate-in fade-in slide-in-from-top duration-200">
            {isAuthenticated ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 pb-3 border-b border-surface-variant">
                  <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold font-display text-sm border-2 border-surface-variant flex-shrink-0">
                    {user?.display_name?.substring(0, 2).toUpperCase() || 'U'}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-on-surface">{user?.display_name}</span>
                    <span className="text-xs uppercase tracking-[0.08em] text-on-surface-variant">{user?.role}</span>
                  </div>
                </div>
                <Link
                  to={getHomeRoute()}
                  onClick={() => setMobileMenuOpen(false)}
                  className="font-display text-[14px] font-bold uppercase tracking-[0.08em] text-on-surface-variant hover:text-primary py-2"
                >
                  Dashboard
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full text-left font-display text-[14px] font-bold uppercase tracking-[0.08em] text-error py-2 mt-1 border-t border-surface-variant pt-3 cursor-pointer"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="font-display text-[14px] font-bold uppercase tracking-[0.08em] text-on-surface-variant hover:text-primary py-2 text-center border border-surface-variant rounded-full"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="font-display text-[14px] font-bold uppercase tracking-[0.08em] bg-primary text-on-primary py-2 rounded-full text-center shadow-sm"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto py-4 flex-grow w-full">
        <DexNavigationGuide />
        <DexVoiceCommands />
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            {/* Public Front Intro / About Page */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/about" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/consent/:token" element={<ConsentConfirm />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />

            {/* Student Protected Routes */}
            <Route element={<ProtectedRoute allowedRoles={['student', 'admin']} />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/passages" element={<PassageSelection />} />
              <Route path="/session/:id" element={<SessionActive />} />
              <Route path="/sessions/:id/results" element={<SessionResults />} />
              <Route path="/sessions/:id/practice" element={<PracticePage />} />
              <Route path="/learning-path" element={<LearningPathPage />} />
              <Route path="/stories" element={<StoryReaderPage />} />
            </Route>

            {/* Teacher Protected Routes */}
            <Route element={<ProtectedRoute allowedRoles={['teacher', 'admin']} />}>
              <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
              <Route path="/teacher/student/:id" element={<StudentDetail />} />
              <Route path="/copilot/:studentId" element={<CopilotPanel />} />
            </Route>

            {/* Parent Protected Routes */}
            <Route element={<ProtectedRoute allowedRoles={['parent', 'admin']} />}>
              <Route path="/parent/home" element={<ParentHome />} />
              <Route path="/parent/children/:studentId/sessions/:sessionId" element={<ParentSessionReport />} />
            </Route>

            {/* Fallback Route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>

      <footer className="w-full bg-white/70 backdrop-blur-md border-t border-surface-container-highest py-6 px-container-padding text-center text-xs font-body text-on-surface-variant">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} Decodex. Educational screening & practice platform.</p>
          <div className="flex items-center gap-6 font-display font-bold uppercase tracking-[0.08em] text-[12px]">
            <Link to="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
