import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DexAvatar from './DexAvatar';

interface ProtectedRouteProps {
  allowedRoles?: string[];
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="stat-card p-8 text-center"><DexAvatar state="thinking" size="md" showCaptionBubble={true} caption="Loading your workspace…" /><p className="mt-4 font-body text-on-surface-variant student-text">Loading…</p></div></div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    const target = user.role === 'parent' ? '/parent/home' : user.role === 'teacher' ? '/teacher/dashboard' : '/dashboard';
    return <Navigate to={target} replace />;
  }

  return <Outlet />;
}
