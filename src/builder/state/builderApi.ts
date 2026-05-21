/**
 * Thin fetch wrappers for /api/builder/* and /api/agents/:slug/*.
 *
 * Naming mirrors the BuilderContext actions so the hook calling
 * these reads cleanly.
 */

import type {
  AgentBody,
  AgentDoc,
  CrewBody,
  CrewDoc,
  ID,
  ProjectDoc,
} from '../types';

const BASE_URL =
  (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ||
  'https://aspect-agent-server-1018338671074.europe-west1.run.app';

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── Project load + bootstrap ─────────────────────────────────────

export async function fetchProject(args: {
  agentSlug: string;
  ownerUserId: string;
}): Promise<ProjectDoc | null> {
  const params = new URLSearchParams({
    agentSlug: args.agentSlug,
    ownerUserId: args.ownerUserId,
  });
  const res = await fetch(`${BASE_URL}/api/builder/projects?${params}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`fetchProject ${res.status}`);
  return res.json();
}

export async function bootstrapProject(args: {
  ownerUserId: string;
  projectId: string;
  projectName: string;
  agentId: string;
  agentSlug: string;
  agentVersionId: string;
  agentBody: AgentBody;
  crewId: string;
  crewVersionId: string;
  crewBody: CrewBody;
}): Promise<ProjectDoc> {
  return http<ProjectDoc>(`/api/builder/projects`, {
    method: 'POST',
    body: JSON.stringify(args),
  });
}

// ─── Agent version actions ────────────────────────────────────────

export async function saveAgentVersionApi(args: {
  agentId: ID;
  versionId: ID;
  body: AgentBody;
}): Promise<void> {
  await http(`/api/builder/agents/${args.agentId}/versions/${args.versionId}`, {
    method: 'PUT',
    body: JSON.stringify({ body: args.body }),
  });
}

export async function saveAgentVersionAsApi(args: {
  agentId: ID;
  versionId: ID;
  body: AgentBody;
  description?: string;
}): Promise<void> {
  await http(`/api/builder/agents/${args.agentId}/versions`, {
    method: 'POST',
    body: JSON.stringify({
      versionId: args.versionId,
      body: args.body,
      description: args.description,
    }),
  });
}

export async function setAgentActiveApi(agentId: ID, versionId: ID) {
  await http(`/api/builder/agents/${agentId}/active`, {
    method: 'PUT',
    body: JSON.stringify({ versionId }),
  });
}

export async function setAgentViewingApi(agentId: ID, versionId: ID) {
  await http(`/api/builder/agents/${agentId}/viewing`, {
    method: 'PUT',
    body: JSON.stringify({ versionId }),
  });
}

// ─── Crew lifecycle + version actions ─────────────────────────────

export async function createCrewApi(args: {
  agentId: ID;
  crewId: ID;
  versionId: ID;
  body: CrewBody;
}): Promise<void> {
  await http(`/api/builder/agents/${args.agentId}/crews`, {
    method: 'POST',
    body: JSON.stringify({
      crewId: args.crewId,
      versionId: args.versionId,
      body: args.body,
    }),
  });
}

export async function deleteCrewApi(crewId: ID): Promise<void> {
  await http(`/api/builder/crews/${crewId}`, { method: 'DELETE' });
}

export async function saveCrewVersionApi(args: {
  crewId: ID;
  versionId: ID;
  body: CrewBody;
}): Promise<void> {
  await http(`/api/builder/crews/${args.crewId}/versions/${args.versionId}`, {
    method: 'PUT',
    body: JSON.stringify({ body: args.body }),
  });
}

export async function saveCrewVersionAsApi(args: {
  crewId: ID;
  versionId: ID;
  body: CrewBody;
  description?: string;
}): Promise<void> {
  await http(`/api/builder/crews/${args.crewId}/versions`, {
    method: 'POST',
    body: JSON.stringify({
      versionId: args.versionId,
      body: args.body,
      description: args.description,
    }),
  });
}

export async function setCrewActiveApi(crewId: ID, versionId: ID) {
  await http(`/api/builder/crews/${crewId}/active`, {
    method: 'PUT',
    body: JSON.stringify({ versionId }),
  });
}

export async function setCrewViewingApi(crewId: ID, versionId: ID) {
  await http(`/api/builder/crews/${crewId}/viewing`, {
    method: 'PUT',
    body: JSON.stringify({ versionId }),
  });
}

// ─── Runtime conversations ────────────────────────────────────────

export async function createConversation(args: {
  agentSlug: string;
  ownerUserId: string;
}): Promise<{ conversationId: number }> {
  return http<{ conversationId: number }>(
    `/api/agents/${args.agentSlug}/conversations`,
    {
      method: 'POST',
      body: JSON.stringify({ ownerUserId: args.ownerUserId }),
    },
  );
}

export interface ConversationListItem {
  id: number;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface ConversationMessage {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

export async function fetchConversationMessages(args: {
  agentSlug: string;
  conversationId: number;
}): Promise<ConversationMessage[]> {
  const res = await http<{ messages: ConversationMessage[] }>(
    `/api/agents/${args.agentSlug}/conversations/${args.conversationId}/messages`,
  );
  return res.messages;
}

/**
 * Builder memory blob for a conversation. Shape:
 *   { [domain: '_general' | string]: { [fieldName]: value } }
 */
export type ConversationMemory = Record<string, Record<string, unknown>>;

export async function fetchConversationMemory(args: {
  agentSlug: string;
  conversationId: number;
  ownerUserId: string;
}): Promise<ConversationMemory> {
  const params = new URLSearchParams({ ownerUserId: args.ownerUserId });
  const res = await http<{ memory: ConversationMemory }>(
    `/api/agents/${args.agentSlug}/conversations/${args.conversationId}/memory?${params}`,
  );
  return res.memory || {};
}

export async function listConversations(args: {
  agentSlug: string;
  ownerUserId: string;
}): Promise<ConversationListItem[]> {
  const params = new URLSearchParams({ ownerUserId: args.ownerUserId });
  const res = await http<{ conversations: ConversationListItem[] }>(
    `/api/agents/${args.agentSlug}/conversations?${params}`,
  );
  return res.conversations;
}

/**
 * The runtime call. Posts a user message and returns an SSE
 * `Response`; consumer reads the body stream.
 */
export function runtimeMessageStream(args: {
  agentSlug: string;
  conversationId: number;
  ownerUserId: string;
  userMessage: string;
  version?: 'viewing' | 'active';
}): Promise<Response> {
  return fetch(
    `${BASE_URL}/api/agents/${args.agentSlug}/conversations/${args.conversationId}/messages`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({
        ownerUserId: args.ownerUserId,
        userMessage: args.userMessage,
        version: args.version || 'viewing',
      }),
    },
  );
}

// Unused-import sentinel so the AgentDoc / CrewDoc types stay in
// the build graph for editor go-to-def even when nothing imports
// them transitively here. Tree-shaken at build time.
export type { AgentDoc, CrewDoc };
