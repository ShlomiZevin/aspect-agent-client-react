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

// ─── Project list (BuilderHomePage) ───────────────────────────────

/**
 * One row per agent owned by the user. The UI shows names, not ids —
 * `agentName` comes from the active version body; `agentSlug` is the
 * URL identifier used by `/<slug>/builder`.
 */
export interface ProjectListItem {
  projectId: string;
  projectName: string;
  agentSlug: string;
  agentName: string;
  /** ISO timestamp of the most recent agent-level mutation. */
  updatedAt: string;
}

export async function listProjects(args: {
  ownerUserId: string;
}): Promise<ProjectListItem[]> {
  const params = new URLSearchParams({ ownerUserId: args.ownerUserId });
  const res = await http<{ projects: ProjectListItem[] }>(
    `/api/builder/projects/list?${params}`,
  );
  return res.projects;
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
  /** Custom or auto-derived (first user message). Null until first send. */
  name: string | null;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export async function renameConversation(args: {
  agentSlug: string;
  conversationId: number;
  name: string;
}): Promise<void> {
  await http(`/api/agents/${args.agentSlug}/conversations/${args.conversationId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: args.name }),
  });
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
 * Addon-run snapshot persisted in `addon_runs.run_data`. Mirrors the
 * live SSE `addon.output` payload so the historical view can rehydrate
 * AddonRunCards identically.
 */
export interface PersistedAddonRun {
  id: string;
  instanceId: string;
  pluginId: string;
  status: 'running' | 'success' | 'error';
  durationMs: number | null;
  startedAt: string;
  endedAt: string | null;
  runData: {
    rawOutput?: string;
    parsedOutput?: unknown;
    memoryWrites?: Array<{ domain: string | null; field: string; value: unknown }>;
    parseError?: string;
    prompt?: string;
    label?: string;
    /** Human-readable provider + model display names. Resolved server-
     *  side from the addon's config against services/models.service.js
     *  so the UI doesn't have to look anything up. */
    modelLabel?: { providerName: string; modelName: string } | null;
    tokens?: { input: number; output: number; total: number };
    durationMs?: number;
  };
}

export async function fetchRunsForMessage(args: {
  agentSlug: string;
  messageId: number;
}): Promise<PersistedAddonRun[]> {
  const res = await http<{ runs: PersistedAddonRun[] }>(
    `/api/agents/${args.agentSlug}/messages/${args.messageId}/runs`,
  );
  return res.runs;
}

export async function deleteConversation(args: {
  agentSlug: string;
  conversationId: number;
}): Promise<void> {
  await http(`/api/agents/${args.agentSlug}/conversations/${args.conversationId}`, {
    method: 'DELETE',
  });
}

export async function deleteMessage(args: {
  agentSlug: string;
  conversationId: number;
  messageId: number;
  fromHereDown?: boolean;
}): Promise<void> {
  await http(
    `/api/agents/${args.agentSlug}/conversations/${args.conversationId}/messages/${args.messageId}`,
    {
      method: 'DELETE',
      body: JSON.stringify({ fromHereDown: !!args.fromHereDown }),
    },
  );
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

/**
 * Update one field in the conversation memory.
 *   - clear=true → removes the field from every domain bucket.
 *   - otherwise → sets `field` to `value` in `domain` (or `_general`).
 * Returns the updated blob so callers can refresh local cache.
 */
export async function patchConversationMemory(args: {
  agentSlug: string;
  conversationId: number;
  ownerUserId: string;
  field: string;
  value?: unknown;
  domain?: string | null;
  clear?: boolean;
}): Promise<ConversationMemory> {
  const res = await http<{ memory: ConversationMemory }>(
    `/api/agents/${args.agentSlug}/conversations/${args.conversationId}/memory`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        ownerUserId: args.ownerUserId,
        field: args.field,
        value: args.value,
        domain: args.domain ?? null,
        clear: !!args.clear,
      }),
    },
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

// ─── Alfred (in-builder AI helper) ────────────────────────────────

export interface AlfredChatListItem {
  id: number;
  name: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AlfredMessage {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

export async function createAlfredChat(args: {
  agentSlug: string;
  ownerUserId: string;
}): Promise<{ chatId: number }> {
  return http<{ chatId: number }>(`/api/builder/alfred/chats`, {
    method: 'POST',
    body: JSON.stringify({ agentSlug: args.agentSlug, ownerUserId: args.ownerUserId }),
  });
}

export async function listAlfredChats(args: {
  agentSlug: string;
  ownerUserId: string;
}): Promise<AlfredChatListItem[]> {
  const params = new URLSearchParams({
    agentSlug:   args.agentSlug,
    ownerUserId: args.ownerUserId,
  });
  const res = await http<{ chats: AlfredChatListItem[] }>(
    `/api/builder/alfred/chats?${params}`,
  );
  return res.chats;
}

export async function renameAlfredChat(args: {
  chatId: number;
  name:   string;
}): Promise<void> {
  await http(`/api/builder/alfred/chats/${args.chatId}`, {
    method: 'PATCH',
    body:   JSON.stringify({ name: args.name }),
  });
}

export async function deleteAlfredChat(chatId: number): Promise<void> {
  await http(`/api/builder/alfred/chats/${chatId}`, { method: 'DELETE' });
}

export async function fetchAlfredMessages(chatId: number): Promise<AlfredMessage[]> {
  const res = await http<{ messages: AlfredMessage[] }>(
    `/api/builder/alfred/chats/${chatId}/messages`,
  );
  return res.messages;
}

/**
 * Post a user message and return the raw `Response`; the SSE consumer
 * in `alfredStream.ts` reads the body stream.
 */
export function alfredMessageStream(args: {
  chatId:      number;
  agentSlug:   string;
  ownerUserId: string;
  userMessage: string;
}): Promise<Response> {
  return fetch(
    `${BASE_URL}/api/builder/alfred/chats/${args.chatId}/messages`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body:    JSON.stringify({
        agentSlug:   args.agentSlug,
        ownerUserId: args.ownerUserId,
        userMessage: args.userMessage,
      }),
    },
  );
}

// Unused-import sentinel so the AgentDoc / CrewDoc types stay in
// the build graph for editor go-to-def even when nothing imports
// them transitively here. Tree-shaken at build time.
export type { AgentDoc, CrewDoc };
