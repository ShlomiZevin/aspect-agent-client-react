import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { AgentConfig, AgentTheme } from '../types';

interface AgentContextValue {
  config: AgentConfig;
  storageKey: (key: string) => string;
  selectedTheme: AgentTheme | null;
  setSelectedTheme: (themeId: string | null) => void;
}

const AgentContext = createContext<AgentContextValue | null>(null);

interface AgentProviderProps {
  children: ReactNode;
  config: AgentConfig;
}

/** Darken a hex color by a percentage (0-100) */
function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xff) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** Convert hex to rgba */
function hexToRgba(hex: string, alpha: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function AgentProvider({ children, config }: AgentProviderProps) {
  // Apply agent theme class to document
  useEffect(() => {
    document.documentElement.classList.add(config.themeClass);
    return () => {
      document.documentElement.classList.remove(config.themeClass);
    };
  }, [config.themeClass]);

  // Agent theme (brand theme) selection — session-level
  const defaultTheme = config.themes?.find(t => t.id === config.defaultTheme) ?? null;
  const [selectedTheme, setSelectedThemeState] = useState<AgentTheme | null>(defaultTheme);

  const setSelectedTheme = useCallback((themeId: string | null) => {
    if (!themeId || !config.themes) {
      setSelectedThemeState(defaultTheme);
      return;
    }
    const theme = config.themes.find(t => t.id === themeId);
    setSelectedThemeState(theme ?? defaultTheme);
  }, [config.themes, defaultTheme]);

  // Apply CSS variable overrides when brand theme changes
  useEffect(() => {
    if (!selectedTheme) return;

    const root = document.documentElement;
    const { primary, secondary } = selectedTheme.colors;

    root.style.setProperty('--primary-color', primary);
    root.style.setProperty('--primary', primary);
    root.style.setProperty('--primary-hover', adjustColor(primary, -25));
    root.style.setProperty('--primary-light', hexToRgba(primary, 0.1));
    root.style.setProperty('--secondary-color', secondary);

    return () => {
      // Clean up inline overrides so the CSS class takes over again
      root.style.removeProperty('--primary-color');
      root.style.removeProperty('--primary');
      root.style.removeProperty('--primary-hover');
      root.style.removeProperty('--primary-light');
      root.style.removeProperty('--secondary-color');
    };
  }, [selectedTheme]);

  const storageKey = (key: string) => `${config.storagePrefix}${key}`;

  return (
    <AgentContext.Provider value={{ config, storageKey, selectedTheme, setSelectedTheme }}>
      {children}
    </AgentContext.Provider>
  );
}

export function useAgentContext(): AgentContextValue {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error('useAgentContext must be used within an AgentProvider');
  }
  return context;
}

export function useAgentConfig(): AgentConfig {
  return useAgentContext().config;
}
