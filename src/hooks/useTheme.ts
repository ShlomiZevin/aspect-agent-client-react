import { useCallback, useEffect } from 'react';
import { useLocalStorageString } from './useLocalStorage';

export type Theme = 'light' | 'dark';

export interface UseThemeReturn {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

/**
 * Hook for managing theme state with localStorage persistence
 */
export function useTheme(storagePrefix: string = ''): UseThemeReturn {
  const key = `${storagePrefix}theme`;
  const [storedTheme, setStoredTheme] = useLocalStorageString(key, 'light');
  const theme = (storedTheme as Theme) || 'light';

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const setTheme = useCallback(
    (newTheme: Theme) => {
      setStoredTheme(newTheme);
    },
    [setStoredTheme]
  );

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  }, [theme, setTheme]);

  return { theme, toggleTheme, setTheme };
}
