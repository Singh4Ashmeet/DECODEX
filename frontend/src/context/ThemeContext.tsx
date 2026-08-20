import React, { createContext, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';

type Theme = 'kid' | 'adult';

interface ThemeContextType {
  theme: Theme;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  // Determine theme based on user role
  const theme: Theme = user?.role === 'student' ? 'kid' : 'adult';

  // Apply theme to document.body for CSS selectors
  useEffect(() => {
    document.body.dataset.theme = theme;
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}