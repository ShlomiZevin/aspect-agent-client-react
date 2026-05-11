import { getBaseURL } from './api';

export interface AgentAuthSession {
  userId: string;
  name: string;
  phone: string;
}

export function authStoragePrefix(agentSlug: string): string {
  return `${agentSlug}_auth_`;
}

function sessionKey(agentSlug: string): string {
  return `${authStoragePrefix(agentSlug)}session`;
}

function userIdKey(agentSlug: string): string {
  // Mirror userId into the key the chat's `useUser` hook reads (`${prefix}user_id`)
  // so the chat stack doesn't auto-create an anonymous user.
  return `${authStoragePrefix(agentSlug)}user_id`;
}

// Keys that hold transient chat state for the agent's authenticated namespace.
// Cleared on every login/logout so a fresh session never inherits a previous
// user's conversation.
function transientChatKeys(agentSlug: string): string[] {
  const prefix = authStoragePrefix(agentSlug);
  return [
    `${prefix}current_conversation_id`,
    `${prefix}linked_phone`,
  ];
}

export function getSession(agentSlug: string): AgentAuthSession | null {
  try {
    const raw = localStorage.getItem(sessionKey(agentSlug));
    return raw ? JSON.parse(raw) as AgentAuthSession : null;
  } catch {
    return null;
  }
}

export function setSession(agentSlug: string, session: AgentAuthSession): void {
  // Wipe transient chat state so the new session starts on a fresh chat
  // (otherwise leftover conversation IDs from a previous auth session leak in).
  for (const key of transientChatKeys(agentSlug)) {
    localStorage.removeItem(key);
  }
  localStorage.setItem(sessionKey(agentSlug), JSON.stringify(session));
  localStorage.setItem(userIdKey(agentSlug), session.userId);
}

export function clearSession(agentSlug: string): void {
  localStorage.removeItem(sessionKey(agentSlug));
  localStorage.removeItem(userIdKey(agentSlug));
  for (const key of transientChatKeys(agentSlug)) {
    localStorage.removeItem(key);
  }
}

export async function login(
  agentSlug: string,
  name: string,
  phone: string,
  baseURL?: string,
): Promise<AgentAuthSession> {
  const url = `${baseURL || getBaseURL()}/api/auth/login`;
  // The agent URL slug is the tenant — server scopes the lookup to it.
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, phone, tenant: agentSlug }),
  });

  if (response.status === 401) {
    throw new Error('invalid_credentials');
  }
  if (!response.ok) {
    throw new Error(`Login failed: ${response.status}`);
  }

  const data = await response.json() as AgentAuthSession;
  setSession(agentSlug, data);
  return data;
}
