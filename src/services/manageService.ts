/**
 * The management center (task #985) — server: builder/routes/manageRoute.js.
 *
 * Signed in with Google: the server's session token rides on every call as
 * `Authorization: Bearer …` (src/manage/session.ts keeps it). A 401 means
 * the session is gone — the token is dropped and the app shows the sign-in
 * screen again (`onSignedOut`).
 */

import { getBaseURL } from './api';
import { clearToken, getToken } from '../manage/session';
import type {
  CustomerProblemsResponse, ManageConversation, ManageErrorCode, ManageMe, ManageSignIn, ProblemPeriod,
  ManageUser, ManageUserDetail, ManageUsersResponse, ManageConversationsResponse,
} from '../types/manage';

/** ?range=today|week, or ?from=&to= (#1001). */
const periodQuery = (p: ProblemPeriod) => (p.range === 'custom'
  ? `from=${encodeURIComponent(p.from)}&to=${encodeURIComponent(p.to)}`
  : `range=${p.range}`);

const ROOT = () => `${import.meta.env.DEV && !import.meta.env.VITE_API_URL ? 'http://localhost:3000' : getBaseURL()}/api/manage`;

/** A refused call: HTTP status + the server's code (+ the address on no_access). */
export class ManageApiError extends Error {
  readonly status: number;
  readonly code: ManageErrorCode | null;
  readonly email: string | null;

  constructor(message: string, status: number, code: ManageErrorCode | null, email: string | null) {
    super(message);
    this.name = 'ManageApiError';
    this.status = status;
    this.code = code;
    this.email = email;
  }
}

type Listener = () => void;
const signedOutListeners = new Set<Listener>();

/** Called when any call finds the session gone (401). */
export function onSignedOut(fn: Listener): () => void {
  signedOutListeners.add(fn);
  return () => { signedOutListeners.delete(fn); };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${ROOT()}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: string; code?: ManageErrorCode; email?: string } | null;
    const err = new ManageApiError(body?.error || `${res.status} ${res.statusText}`, res.status, body?.code ?? null, body?.email ?? null);
    if (res.status === 401 && token && path !== '/auth/google') {
      clearToken();
      signedOutListeners.forEach(fn => fn());
    }
    throw err;
  }
  return res.json() as Promise<T>;
}

export const manageService = {
  /** The Google OAuth web client id ('' = Google sign-in not configured on this server). */
  getAuthConfig: () => request<{ clientId: string }>('/auth/config'),

  /** Trade a Google ID token for a session. 403 code 'no_access' carries the address. */
  signInWithGoogle: (idToken: string) =>
    request<ManageSignIn>('/auth/google', { method: 'POST', body: JSON.stringify({ idToken }) }),

  /** Who is signed in, and what they may open. */
  getMe: () => request<ManageMe>('/me'),

  /** One agent's customer conversations of the period + their problems. */
  getAgentProblems: (agentSlug: string, period: ProblemPeriod) =>
    request<CustomerProblemsResponse>(`/agents/${encodeURIComponent(agentSlug)}/customer-problems?${periodQuery(period)}`),

  /** Every agent (every-agent grant only). */
  getAllProblems: (period: ProblemPeriod) =>
    request<CustomerProblemsResponse>(`/customer-problems?${periodQuery(period)}`),

  /** One agent's customer conversations of the period (#1001). */
  getAgentConversations: (agentSlug: string, period: ProblemPeriod) =>
    request<ManageConversationsResponse>(`/agents/${encodeURIComponent(agentSlug)}/conversations?${periodQuery(period)}`),

  /** Every agent's customer conversations of the period (every-agent grant only). */
  getAllConversations: (period: ProblemPeriod) =>
    request<ManageConversationsResponse>(`/conversations?${periodQuery(period)}`),

  /** One customer conversation's basic facts — the "צפייה" window. */
  getConversation: (agentSlug: string, conversationId: number) =>
    request<ManageConversation>(`/agents/${encodeURIComponent(agentSlug)}/conversations/${conversationId}`),

  /** One agent's customer-chat users (real + test). */
  getAgentUsers: (agentSlug: string) =>
    request<ManageUsersResponse>(`/agents/${encodeURIComponent(agentSlug)}/users`),

  /** Every agent's users (every-agent grant only). */
  getAllUsers: () => request<ManageUsersResponse>('/users'),

  /** One user + their customer conversations on that agent. */
  getUser: (agentSlug: string, userId: number) =>
    request<ManageUserDetail>(`/agents/${encodeURIComponent(agentSlug)}/users/${userId}`),

  /** Suspend (true) / reactivate (false) — the same operation as Admin → Users. */
  setUserSuspended: (agentSlug: string, userId: number, suspended: boolean) =>
    request<{ user: ManageUser }>(`/agents/${encodeURIComponent(agentSlug)}/users/${userId}/suspend`, { method: 'POST', body: JSON.stringify({ suspended }) }),

  /** Real customer (true) / test user (false) — #968. */
  setUserRealCustomer: (agentSlug: string, userId: number, real: boolean) =>
    request<{ user: ManageUser }>(`/agents/${encodeURIComponent(agentSlug)}/users/${userId}/real-customer`, { method: 'POST', body: JSON.stringify({ real }) }),

  /** Add a user for one agent (#1002) — the same operation as Admin → Users → Add user. */
  createUser: (agentSlug: string, body: { name: string; phone: string; autoSuspendHours: 24 | 48 | null }) =>
    request<{ user: ManageUser }>(`/agents/${encodeURIComponent(agentSlug)}/users`, { method: 'POST', body: JSON.stringify(body) }),

  /** Turn the user's auto-suspend off (#1002). */
  clearAutoSuspend: (agentSlug: string, userId: number) =>
    request<{ user: ManageUser }>(`/agents/${encodeURIComponent(agentSlug)}/users/${userId}/auto-suspend`, { method: 'DELETE' }),

  /** Delete the user and their conversations. */
  deleteUser: (agentSlug: string, userId: number) =>
    request<{ deleted: true; userId: number; conversations: number }>(`/agents/${encodeURIComponent(agentSlug)}/users/${userId}`, { method: 'DELETE' }),
};
