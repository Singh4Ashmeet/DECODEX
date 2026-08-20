import React, { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDex } from '../hooks/useDex';
import { TUTOR_NAME } from '../lib/constants';

const STORAGE_KEY = 'dex_navigation_guide_visited';

interface RouteScript {
  path: string;
  script: string;
}

const ROUTE_SCRIPTS: RouteScript[] = [
  {
    path: '/dashboard',
    script: `Welcome to your dashboard! Here you can see your reading progress, start a new session, or continue where you left off. Let's make today a great reading day!`,
  },
  {
    path: '/passages',
    script: `Choose a passage to read aloud. Pick something that interests you — stories, articles, or practice texts. When you're ready, press record and read at your own pace.`,
  },
  {
    path: '/session',
    script: `You're in an active reading session. Read the passage aloud clearly. I'm listening and will help you with any tricky words. Take your time — there's no rush!`,
  },
  {
    path: '/learning-path',
    script: `Your learning path shows personalized practice recommendations based on your reading. Each activity targets a specific skill to help you improve. Let's tackle them one at a time!`,
  },
  {
    path: '/stories',
    script: `Welcome to AI Stories! Here you can read brand new stories created just for you. Choose a story, read it aloud, and watch your reading skills grow with every adventure.`,
  },
];

function getScriptForPath(pathname: string): string | null {
  for (const route of ROUTE_SCRIPTS) {
    if (pathname.startsWith(route.path)) {
      return route.script;
    }
  }
  return null;
}

function getVisitedRoutes(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function markRouteVisited(path: string): void {
  if (typeof window === 'undefined') return;
  try {
    const visited = getVisitedRoutes();
    visited.add(path);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...visited]));
  } catch {
    // Ignore localStorage errors (e.g., private browsing)
  }
}

function hasVisitedRoute(path: string): boolean {
  return getVisitedRoutes().has(path);
}

export default function DexNavigationGuide() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { speak } = useDex();
  const [showButton, setShowButton] = useState(false);
  const [currentScript, setCurrentScript] = useState<string | null>(null);

  const script = getScriptForPath(location.pathname);
  const visited = hasVisitedRoute(location.pathname);

  useEffect(() => {
    if (script) {
      setCurrentScript(script);
      setShowButton(true);

      if (!visited) {
        markRouteVisited(location.pathname);
      }
    } else {
      setShowButton(false);
      setCurrentScript(null);
    }
  }, [location.pathname, script, visited]);

  const handleSpeak = useCallback(() => {
    if (currentScript) {
      speak(currentScript);
    }
  }, [currentScript, speak]);

  // Role check — only render for students (matching ProtectedRoute pattern)
  if (loading || !user || user.role !== 'student') {
    return null;
  }

  if (!showButton || !currentScript) {
    return null;
  }

  return (
    <button
      onClick={handleSpeak}
      className="fixed bottom-6 left-6 z-40 flex items-center gap-2 px-4 py-2.5 glass-card rounded-full shadow-lg text-on-surface font-body text-sm font-medium hover:bg-secondary/10 hover:shadow-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 border border-secondary/30"
      aria-label={`${TUTOR_NAME} will read this page to you`}
      title={`${TUTOR_NAME} will read this page to you`}
    >
      <span className="material-symbols-outlined text-xl text-primary" style={{fontVariationSettings: "'FILL' 1"}}>record_voice_over</span>
      <span className="hidden sm:inline font-display text-xs uppercase tracking-[0.08em]">Read this to me</span>
    </button>
  );
}