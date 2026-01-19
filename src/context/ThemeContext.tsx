import { createContext, useContext, type ReactNode } from 'react';
import { useTheme, type Theme, type UseThemeReturn } from '../hooks';

const ThemeContext = createContext<UseThemeReturn | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
  storagePrefix?: string;
}

export function ThemeProvider({ children, storagePrefix = '' }: ThemeProviderProps) {
  const themeState = useTheme(storagePrefix);

  return (
    <ThemeContext.Provider value={themeState}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext(): UseThemeReturn {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
}

export type { Theme };
