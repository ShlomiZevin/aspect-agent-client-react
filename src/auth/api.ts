import { getBaseURL } from '../services/api';

/**
 * The sign-in API.
 *
 * Separate from the agent login in services/agentAuthService: that one matches a
 * name and a phone number for chat customers, and this is the Sign-In module —
 * different question, different table, different clients.
 */
const ROOT = () => `${import.meta.env.DEV ? 'http://localhost:3000' : getBaseURL()}/api/auth/signin`;

export class AuthError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${ROOT()}${path}`, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new AuthError(body?.error || `${res.status} ${res.statusText}`, res.status);
  }
  return res.json();
}

/** What the sign-in screen needs to know before it draws anything. */
export interface SignInConfig {
  /** The module is switched on for this client. */
  enabled: boolean;
  /**
   * What signing in is for:
   *  - 'gate' the surface is closed until an invited person signs in
   *  - 'sync' the surface stays open; signing in only saves history to an account
   */
  purpose: 'gate' | 'sync';
  /** This client offers Google sign-in. The button shows even without a
   *  configured `clientId` (disabled), so the option is never silently missing. */
  google: boolean;
  /** Offer the email and password form. */
  password: boolean;
  /** The OAuth web client id, or '' when Google sign-in is not configured yet. */
  clientId: string;
}

export interface Session {
  userId: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  via: 'google' | 'password';
  /**
   * The account's conversations for this agent, newest first. Present on a
   * fresh sign-in so the caller can jump straight to the latest chat; absent
   * from a session rehydrated out of localStorage.
   */
  conversations?: Array<{ id: string | number; externalId: string; updatedAt: string }>;
}

/** Extra context a sign-in can carry so history is not lost or siloed. */
export interface SignInContext {
  /** The anon user the browser was chatting as — its chats move to the account. */
  anonUserId?: string | null;
  /** Restrict the history merge and read-back to this agent. */
  agentName?: string | null;
}

export interface Invitation {
  id: number;
  email: string;
  tenant: string | null;
  role: 'user' | 'admin';
  invitedBy: string | null;
  note: string | null;
  revokedAt: string | null;
  createdAt: string;
  /** The server never sends the hash — only whether one is set. */
  hasPassword: boolean;
  passwordSetAt: string | null;
}

export const authApi = {
  config: (tenant: string) =>
    request<SignInConfig>(`/config?tenant=${encodeURIComponent(tenant)}`),

  withGoogle: (idToken: string, tenant: string, ctx: SignInContext = {}) =>
    request<Session>('/google', {
      method: 'POST',
      body: JSON.stringify({ idToken, tenant, ...ctx }),
    }),

  withPassword: (email: string, password: string, tenant: string, ctx: SignInContext = {}) =>
    request<Session>('/password', {
      method: 'POST',
      body: JSON.stringify({ email, password, tenant, ...ctx }),
    }),

  // --- invitations, super-admin only ----------------------------------------
  listInvitations: (tenant: string) =>
    request<{ allowed: Invitation[] }>(`/allowed?tenant=${encodeURIComponent(tenant)}`)
      .then(r => r.allowed),

  invite: (body: {
    email: string;
    tenant: string | null;
    role?: 'user' | 'admin';
    note?: string;
    password?: string;
    generatePassword?: boolean;
    invitedBy?: string;
  }) =>
    request<{ allowed: Invitation; password: string | null }>('/allowed', {
      method: 'POST', body: JSON.stringify(body),
    }),

  setPassword: (id: number, body: { password?: string; clear?: boolean }) =>
    request<{ allowed: Invitation; password: string | null }>(`/allowed/${id}/password`, {
      method: 'PUT', body: JSON.stringify(body),
    }),

  revoke: (id: number) =>
    request<{ allowed: Invitation }>(`/allowed/${id}`, { method: 'DELETE' }),
};
