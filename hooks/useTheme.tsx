import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (t: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyThemeClass(theme: ThemeMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement; // <html>
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export const ThemeProvider: React.FC<{ userId?: string | number, children: React.ReactNode }> = ({ userId, children }) => {
  const storageKey = useMemo(() => userId != null ? `dienstplaner.theme.${userId}` : 'dienstplaner.theme', [userId]);

  const readInitial = useCallback((): ThemeMode => {
    try {
      const stored = localStorage.getItem(storageKey) as ThemeMode | null;
      if (stored === 'light' || stored === 'dark') return stored;
    } catch (e) {
      // ignore
    }
    return getSystemPrefersDark() ? 'dark' : 'light';
  }, [storageKey]);

  const [theme, setThemeState] = useState<ThemeMode>(readInitial);

  // When the userId/storageKey changes (e.g., before vs after login), load that user's stored theme
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey) as ThemeMode | null;
      if (stored === 'light' || stored === 'dark') {
        setThemeState(stored);
        applyThemeClass(stored);
        return;
      }
    } catch (_e) {}
    // fallback to system pref
    const fallback = getSystemPrefersDark() ? 'dark' : 'light';
    setThemeState(fallback);
    applyThemeClass(fallback);
  }, [storageKey]);

  useEffect(() => {
    applyThemeClass(theme);
    try {
      localStorage.setItem(storageKey, theme);
    } catch (e) {
      // ignore write errors
    }
  }, [theme, storageKey]);

  // Update on system preference change only if user never stored? Simplify: don't override explicit choice.
  useEffect(() => {
    const mm = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    if (!mm) return;
    const handler = () => {
      try {
        const stored = localStorage.getItem(storageKey) as ThemeMode | null;
        if (stored !== 'light' && stored !== 'dark') {
          setThemeState(mm.matches ? 'dark' : 'light');
        }
      } catch (e) {
        // ignore
      }
    };
    mm.addEventListener?.('change', handler);
    return () => mm.removeEventListener?.('change', handler);
  }, [storageKey]);

  const setTheme = useCallback((t: ThemeMode) => setThemeState(t), []);
  const toggleTheme = useCallback(() => setThemeState(prev => prev === 'dark' ? 'light' : 'dark'), []);

  const value = useMemo(() => ({ theme, toggleTheme, setTheme }), [theme, toggleTheme, setTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
};
