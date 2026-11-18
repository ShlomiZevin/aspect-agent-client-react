/**
 * Who is using the management center (task #985): signed out, signed in
 * with an address that has no access, or signed in with their agents.
 * The server decides; this only follows its answers (GET /api/manage/me).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ManageApiError, manageService, onSignedOut } from '../services/manageService';
import { clearToken, getToken, setToken } from './session';
import type { ManageMe } from '../types/manage';

export type ManageAuth =
  | { state: 'loading' }
  | { state: 'signed-out' }
  | { state: 'no-access'; email: string | null }
  | { state: 'ready'; me: ManageMe }
  | { state: 'error'; message: string };

export function useManageMe() {
  const [auth, setAuth] = useState<ManageAuth>(() => (getToken() ? { state: 'loading' } : { state: 'signed-out' }));
  // StrictMode runs effects twice: one /me per token.
  const asked = useRef<string | null>(null);

  const loadMe = useCallback(() => {
    manageService.getMe()
      .then(me => setAuth({ state: 'ready', me }))
      .catch(err => {
        if (err instanceof ManageApiError && err.status === 401) setAuth({ state: 'signed-out' });
        else if (err instanceof ManageApiError && err.code === 'no_access') setAuth({ state: 'no-access', email: err.email });
        else setAuth({ state: 'error', message: err instanceof Error ? err.message : String(err) });
      });
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token || asked.current === token) return;
    asked.current = token;
    loadMe();
  }, [loadMe]);

  // Any call that finds the session gone sends the person back to sign-in.
  useEffect(() => onSignedOut(() => setAuth({ state: 'signed-out' })), []);

  /** A Google ID token from the button → a session, or "no access for <address>". */
  const signIn = useCallback(async (idToken: string) => {
    try {
      const r = await manageService.signInWithGoogle(idToken);
      setToken(r.token);
      asked.current = r.token;
      setAuth({ state: 'ready', me: r.me });
      return null;
    } catch (err) {
      if (err instanceof ManageApiError && err.code === 'no_access') {
        clearToken();
        setAuth({ state: 'no-access', email: err.email });
        return null;
      }
      return err instanceof Error ? err.message : String(err);
    }
  }, []);

  const signOut = useCallback(() => {
    clearToken();
    asked.current = null;
    setAuth({ state: 'signed-out' });
  }, []);

  return { auth, signIn, signOut, retry: loadMe };
}
