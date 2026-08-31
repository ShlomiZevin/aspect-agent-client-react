import { useCallback, useEffect, useState } from 'react';
import { authApi } from './api';
import type { Session, SignInConfig } from './api';

/**
 * Who is signed in, per client.
 *
 * Keyed by tenant so signing in to one agent does not sign you in to another —
 * a grant is per agent on the server, and a session that ignored that would
 * quietly contradict it.
 *
 * There is no token here and nothing expires. The session is the same `userId`
 * every other surface already stores; what this adds is that it was obtained by
 * proving an identity rather than by typing a name. Real expiry needs the
 * server to issue and check something per request, which is the next step and
 * not this one — so it is written down rather than implied.
 */
const key = (tenant: string) => `aspect_session_${tenant}`;

export function useSession(tenant: string) {
  const [session, setSession] = useState<Session | null>(() => read(tenant));
  const [config, setConfig] = useState<SignInConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // The session belongs to a tenant, so switching agent must not carry it over.
  // Adjusted during render rather than in an effect: React documents this for
  // exactly the "state derived from a prop that changed" case, and an effect
  // would render one frame with the previous agent's session still in hand.
  const [loadedFor, setLoadedFor] = useState(tenant);
  if (loadedFor !== tenant) {
    setLoadedFor(tenant);
    setSession(read(tenant));
  }

  useEffect(() => {
    if (!tenant) return;
    let cancelled = false;
    authApi.config(tenant)
      .then(c => { if (!cancelled) setConfig(c); })
      // Unreachable is treated as "not enabled": a sign-in screen nobody can
      // get past is worse than no sign-in screen, and the surfaces behind it
      // are the same ones that were open a moment ago.
      .catch(() => { if (!cancelled) setConfig(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tenant]);

  const signIn = useCallback((next: Session) => {
    try { localStorage.setItem(key(tenant), JSON.stringify(next)); } catch { /* private mode */ }
    setSession(next);
  }, [tenant]);

  const signOut = useCallback(() => {
    try { localStorage.removeItem(key(tenant)); } catch { /* private mode */ }
    setSession(null);
  }, [tenant]);

  return {
    session,
    config,
    loading,
    /** The module is on and nobody has signed in yet. */
    needsSignIn: Boolean(config?.enabled) && !session,
    signIn,
    signOut,
  };
}

function read(tenant: string): Session | null {
  try {
    const raw = localStorage.getItem(key(tenant));
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    // Storage disabled, or a value from an older shape. Either way, ask again.
    return null;
  }
}
