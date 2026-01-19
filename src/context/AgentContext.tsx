import { createContext, useContext, useEffect, type ReactNode } from 'react';
import type { AgentConfig } from '../types';

interface AgentContextValue {
  config: AgentConfig;
  storageKey: (key: string) => string;
}

const AgentContext = createContext<AgentContextValue | null>(null);

interface AgentProviderProps {
  children: ReactNode;
  config: AgentConfig;
}

export function AgentProvider({ children, config }: AgentProviderProps) {
  // Apply agent theme class to document
  useEffect(() => {
    document.documentElement.classList.add(config.themeClass);
    return () => {
      document.documentElement.classList.remove(config.themeClass);
    };
  }, [config.themeClass]);

  const storageKey = (key: string) => `${config.storagePrefix}${key}`;

  return (
    <AgentContext.Provider value={{ config, storageKey }}>
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
