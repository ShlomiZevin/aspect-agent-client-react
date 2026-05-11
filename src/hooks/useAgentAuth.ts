import { useState, useEffect, useCallback } from 'react';
import { getSession, clearSession, type AgentAuthSession } from '../services/agentAuthService';

export interface UseAgentAuthReturn {
  session: AgentAuthSession | null;
  isAuthenticated: boolean;
  logout: () => void;
}

export function useAgentAuth(agentSlug: string): UseAgentAuthReturn {
  const [session, setSessionState] = useState<AgentAuthSession | null>(() => getSession(agentSlug));

  // Re-read when the agent slug changes.
  useEffect(() => {
    setSessionState(getSession(agentSlug));
  }, [agentSlug]);

  // Cross-tab sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === `${agentSlug}_auth_session`) {
        setSessionState(getSession(agentSlug));
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [agentSlug]);

  const logout = useCallback(() => {
    clearSession(agentSlug);
    setSessionState(null);
  }, [agentSlug]);

  return {
    session,
    isAuthenticated: session !== null,
    logout,
  };
}
