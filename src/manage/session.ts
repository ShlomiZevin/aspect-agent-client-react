/**
 * The management center's session token (task #985) — what the server
 * handed back after Google sign-in (builder/services/manageSession.js).
 * It proves who the person is for 30 days; what they may open is checked
 * by the server on every call, so nothing here decides access.
 */

const KEY = 'lybi_manage_token';

export function getToken(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function setToken(token: string): void {
  try { localStorage.setItem(KEY, token); } catch { /* private mode: this tab only */ }
}

export function clearToken(): void {
  try { localStorage.removeItem(KEY); } catch { /* nothing stored */ }
}
