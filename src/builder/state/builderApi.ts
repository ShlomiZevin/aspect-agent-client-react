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
  agentId: string;
  agentSlug: string;
  agentName: string;
  /** Workspace folder this agent lives in; null = top level. */
  workspaceId: string | null;
  /** ISO timestamp when archived; null = live. */
  archivedAt: string | null;
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

// ─── Workspaces (folders on the builder home page) ────────────────

export interface WorkspaceItem {
  id: string;
  name: string;
  createdAt: string;
}

export async function listWorkspaces(): Promise<WorkspaceItem[]> {
  const res = await http<{ workspaces: WorkspaceItem[] }>(`/api/builder/workspaces`);
  return res.workspaces;
}

export async function createWorkspace(args: {
  ownerUserId: string;
  name: string;
}): Promise<WorkspaceItem> {
  const id = `ws_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
  const res = await http<{ workspace: WorkspaceItem }>(`/api/builder/workspaces`, {
    method: 'POST',
    body: JSON.stringify({ id, ownerUserId: args.ownerUserId, name: args.name }),
  });
  return res.workspace;
}

export async function renameWorkspace(args: { id: string; name: string }): Promise<void> {
  await http(`/api/builder/workspaces/${args.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: args.name }),
  });
}

/** cascade: 'orphan' moves the agents to top level; 'agents' deletes them. */
export async function deleteWorkspace(args: {
  id: string;
  cascade: 'orphan' | 'agents';
}): Promise<void> {
  await http(`/api/builder/workspaces/${args.id}?cascade=${args.cascade}`, {
    method: 'DELETE',
  });
}

// ─── Agent shell mutations (rename / move / archive) ──────────────

/**
 * Rename an agent — display name AND slug (URL). Returns the new slug
 * so the caller can update any links. Throws on a slug already taken
 * by another agent (server responds 409).
 */
export async function renameAgent(args: {
  agentId: string;
  name: string;
  slug: string;
}): Promise<{ slug: string; name: string }> {
  return http<{ slug: string; name: string }>(`/api/builder/agents/${args.agentId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: args.name, slug: args.slug }),
  });
}

/** Move an agent into a workspace, or to top level (workspaceId = null). */
export async function moveAgent(args: {
  agentId: string;
  workspaceId: string | null;
}): Promise<void> {
  await http(`/api/builder/agents/${args.agentId}`, {
    method: 'PATCH',
    body: JSON.stringify({ workspaceId: args.workspaceId }),
  });
}

/** Archive (true) or restore (false) an agent. */
export async function setAgentArchived(args: {
  agentId: string;
  archived: boolean;
}): Promise<void> {
  await http(`/api/builder/agents/${args.agentId}`, {
    method: 'PATCH',
    body: JSON.stringify({ archived: args.archived }),
  });
}

/**
 * Delete an entire project tree (project + agents + crews + every
 * version under them). Used by the BuilderHomePage row-level delete.
 * Server is shared-workspace so no ownerUserId guard — anyone with the
 * id can delete. That matches read access today.
 */
export async function deleteProject(args: {
  projectId: string;
}): Promise<void> {
  await http<{ ok: true }>(`/api/builder/projects/${args.projectId}`, {
    method: 'DELETE',
  });
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

/**
 * Delete an agent version. The server refuses to delete the last,
 * active, or currently-viewed version → 409 with a `code` of
 * 'is_active' | 'is_viewing' | 'last_version'. Caller is expected
 * to surface the message to the user.
 */
export async function deleteAgentVersionApi(agentId: ID, versionId: ID): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/builder/agents/${agentId}/versions/${versionId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText, code: 'unknown' }));
    const err = new Error(body.error || `delete failed: ${res.status}`) as Error & { code?: string };
    err.code = body.code;
    throw err;
  }
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

/**
 * Delete a crew version. Same 409+code semantics as the agent variant.
 */
export async function deleteCrewVersionApi(crewId: ID, versionId: ID): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/builder/crews/${crewId}/versions/${versionId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText, code: 'unknown' }));
    const err = new Error(body.error || `delete failed: ${res.status}`) as Error & { code?: string };
    err.code = body.code;
    throw err;
  }
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
    /** Memory writes the addon produced this turn. `kind` routes the
     *  write between the brain's `memory` and `thinking` sections;
     *  omitted = defaults to `'memory'`. */
    memoryWrites?: Array<{
      kind?: 'memory' | 'thinking';
      domain: string | null;
      field: string;
      value: unknown;
    }>;
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
 * One section of the brain blob — same shape for memory and thinking.
 * Keys are domain names (or `_general` for the no-domain bucket).
 */
export type BrainSection = Record<string, Record<string, unknown>>;

/**
 * The conversation's full brain state, returned by the server. Two
 * parallel sections — facts the brain remembers + the current strategic
 * plan. Dynamic Context resolves at prompt-assembly time and doesn't
 * write to the brain.
 */
export interface SummarySection {
  [name: string]: { text: string; watermark: number; ranAt: number };
}

export interface ConversationMemory {
  memory:   BrainSection;
  thinking: BrainSection;
  /** Optional on the wire — older servers / fresh conversations may
   *  not return the section. Treated as `{}` by every consumer. */
  summary?: SummarySection;
  /** Ephemeral KB Retriever slots — flat `{ [name]: injectionText }`.
   *  Optional on the wire (older servers omit it). */
  retrieval?: Record<string, string>;
}

const EMPTY_BRAIN: ConversationMemory = { memory: {}, thinking: {}, summary: {}, retrieval: {} };

function normalizeBrainResponse(res: {
  memory?: BrainSection;
  thinking?: BrainSection;
  summary?: SummarySection;
  retrieval?: Record<string, string>;
}): ConversationMemory {
  return {
    memory:    res.memory    || {},
    thinking:  res.thinking  || {},
    summary:   res.summary   || {},
    retrieval: res.retrieval || {},
  };
}

export async function fetchConversationMemory(args: {
  agentSlug: string;
  conversationId: number;
  ownerUserId: string;
}): Promise<ConversationMemory> {
  const params = new URLSearchParams({ ownerUserId: args.ownerUserId });
  const res = await http<{
    memory: BrainSection;
    thinking: BrainSection;
    summary?: SummarySection;
    retrieval?: Record<string, string>;
  }>(
    `/api/agents/${args.agentSlug}/conversations/${args.conversationId}/memory?${params}`,
  );
  return normalizeBrainResponse(res) || EMPTY_BRAIN;
}

/**
 * Update one field in the conversation brain.
 *   - clear=true → removes the field from every domain bucket of the section.
 *   - otherwise → sets `field` to `value` in `domain` (or `_general`)
 *     inside the requested section. Defaults to `kind: 'memory'`.
 * Returns the full brain blob so callers can refresh local cache.
 */
export async function patchConversationMemory(args: {
  agentSlug: string;
  conversationId: number;
  ownerUserId: string;
  field: string;
  value?: unknown;
  domain?: string | null;
  /** Which brain section to write to. Default `'memory'`. */
  kind?: 'memory' | 'thinking';
  clear?: boolean;
}): Promise<ConversationMemory> {
  const res = await http<{
    memory: BrainSection;
    thinking: BrainSection;
  }>(
    `/api/agents/${args.agentSlug}/conversations/${args.conversationId}/memory`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        ownerUserId: args.ownerUserId,
        field: args.field,
        value: args.value,
        domain: args.domain ?? null,
        kind: args.kind ?? 'memory',
        clear: !!args.clear,
      }),
    },
  );
  return normalizeBrainResponse(res);
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
 * One row in the ADMIN conversations list — every conversation for the
 * agent regardless of owner (the dashboard view). Extends the basic
 * list item with owner identity + a message count.
 */
export interface AdminConversationListItem extends ConversationListItem {
  messageCount: number;
  currentCrewId: string | null;
  userId: number | null;
  ownerUserId: string | null;
  ownerName: string | null;
}

/**
 * Admin: list ALL conversations for an agent (no owner filter), keyed
 * only by the runtime agent resolved from the slug. Powers the Admin
 * dashboard Conversations tab.
 */
export async function listAdminConversations(args: {
  agentSlug: string;
  limit?: number;
  /** Internal users.id — scope to a single owner (Users drill-down). */
  userId?: number;
}): Promise<AdminConversationListItem[]> {
  const params = new URLSearchParams();
  if (args.limit) params.set('limit', String(args.limit));
  if (args.userId) params.set('userId', String(args.userId));
  const qs = params.toString();
  const res = await http<{ conversations: AdminConversationListItem[] }>(
    `/api/agents/${args.agentSlug}/admin/conversations${qs ? `?${qs}` : ''}`,
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
  /** Optional explicit crew to route this turn to. When set, takes
   *  precedence over the conversation's saved currentCrewId and is
   *  persisted as the new pointer for subsequent turns. */
  overrideCrewId?: string | null;
  /**
   * Optional working-copy agent body. When sent, the server runs the
   * turn against this body instead of the saved viewing version —
   * lets the builder preview chat reflect unsaved edits.
   */
  overrideAgentBody?: unknown;
  /**
   * Optional working-copy crew body. Paired with overrideAgentBody so
   * the in-builder chat can run dirty addon configs / prompts without
   * the user having to save first. Covers the CURRENT crew only;
   * Transition Router cascades into other crews need `overrideCrewBodies`.
   */
  overrideCrewBody?: unknown;
  /**
   * Optional working-copy crew bodies keyed by crewId — sent so a
   * Transition Router that cascades into a different crew runs the
   * cascade target against UNSAVED edits, not the saved DB body.
   */
  overrideCrewBodies?: Record<string, unknown>;
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
        ...(args.overrideCrewId   ? { overrideCrewId:   args.overrideCrewId   } : {}),
        ...(args.overrideAgentBody ? { overrideAgentBody: args.overrideAgentBody } : {}),
        ...(args.overrideCrewBody  ? { overrideCrewBody:  args.overrideCrewBody  } : {}),
        ...(args.overrideCrewBodies ? { overrideCrewBodies: args.overrideCrewBodies } : {}),
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

// ─── Apply flow (Alfred slice 3) ─────────────────────────────────

export interface ApplyTarget {
  entity:     'agent' | 'crew';
  entityId:   string;
  entityName: string;
  what_to_do: string;
}

export interface ApplyPreviewResponse {
  summary:     string;
  description: string;
  targets:     ApplyTarget[];
}

export async function applyPreview(args: {
  chatId:      number;
  agentSlug:   string;
  ownerUserId: string;
}): Promise<ApplyPreviewResponse> {
  return http<ApplyPreviewResponse>(
    `/api/builder/alfred/chats/${args.chatId}/apply/preview`,
    {
      method: 'POST',
      body:   JSON.stringify({
        agentSlug:   args.agentSlug,
        ownerUserId: args.ownerUserId,
      }),
    },
  );
}

export interface GeneratedBody {
  entity:     'agent' | 'crew';
  entityId:   string;
  entityName: string;
  what_to_do: string;
  /** Pre-apply body — kept around so the log row's body_before is accurate. */
  bodyBefore: unknown;
  /** Patch-generator output — what the client puts into the working copy. */
  newBody:    Record<string, unknown>;
}

export interface ApplyGenerateResponse {
  ok:           true;
  applyGroupId: string;
  generated:    GeneratedBody[];
}

/**
 * Runs the patch generator for each target and returns the new bodies.
 * Does NOT save and does NOT write log rows — that's the client's job
 * via `writeApplyLog` after each Save.
 */
export async function applyGenerate(args: {
  chatId:      number;
  agentSlug:   string;
  ownerUserId: string;
  targets:     ApplyTarget[];
}): Promise<ApplyGenerateResponse> {
  return http<ApplyGenerateResponse>(
    `/api/builder/alfred/chats/${args.chatId}/apply/generate`,
    {
      method: 'POST',
      body:   JSON.stringify({
        agentSlug:   args.agentSlug,
        ownerUserId: args.ownerUserId,
        targets:     args.targets,
      }),
    },
  );
}

/**
 * Write one Alfred-attributed log row. Called after Save commits a
 * generated body. Rows from one multi-target Apply share applyGroupId.
 */
export async function writeApplyLog(args: {
  agentId:      string;
  entity:       'agent' | 'crew';
  entityId:     string;
  entityName:   string;
  applyGroupId: string;
  description:  string;
  reason:       string;
  whatChanged:  string;
  bodyBefore:   unknown;
  bodyAfter:    unknown;
  sourceChatId?: number;
  /**
   * 'alfred' — credit Alfred for the change (default).
   * 'manual' — user edited Alfred's apply substantially and wants it
   *            attributed to themselves.
   */
  actor?:       'alfred' | 'manual';
  ownerUserId:  string;
}): Promise<{ ok: true; logId: number }> {
  return http<{ ok: true; logId: number }>(
    `/api/builder/alfred/agents/${args.agentId}/log/apply`,
    {
      method: 'POST',
      body:   JSON.stringify({
        entity:       args.entity,
        entityId:     args.entityId,
        entityName:   args.entityName,
        applyGroupId: args.applyGroupId,
        description:  args.description,
        reason:       args.reason,
        whatChanged:  args.whatChanged,
        bodyBefore:   args.bodyBefore,
        bodyAfter:    args.bodyAfter,
        sourceChatId: args.sourceChatId,
        actor:        args.actor ?? 'alfred',
        ownerUserId:  args.ownerUserId,
      }),
    },
  );
}

// ─── Validate & Log (manual change logging) ──────────────────────

export interface ValidateClaimResponse {
  matches:     'yes' | 'partial' | 'no';
  note:        string;
  entityName:  string;
  bodyBefore:  unknown;
  bodyAfter:   unknown;
  priorSource: 'last-log' | 'v1' | 'empty';
}

export async function validateClaim(args: {
  agentId:     string;
  entity:      'agent' | 'crew';
  entityId:    string;
  claim:       string;
  agentSlug:   string;
  ownerUserId: string;
}): Promise<ValidateClaimResponse> {
  return http<ValidateClaimResponse>(
    `/api/builder/alfred/agents/${args.agentId}/log/validate`,
    {
      method: 'POST',
      body:   JSON.stringify({
        entity:      args.entity,
        entityId:    args.entityId,
        claim:       args.claim,
        agentSlug:   args.agentSlug,
        ownerUserId: args.ownerUserId,
      }),
    },
  );
}

/**
 * One row in the agent change log. Stored as we wrote it server-side:
 * the human-readable fields are what the UI shows; the JSON snapshots
 * stay around for audit/future use but aren't surfaced.
 */
export interface AgentLogEntry {
  id:           number;
  agentId:      string;
  agentName:    string;
  actor:        'alfred' | 'manual';
  reason:       string;
  whatChanged:  string;
  entity:       'agent' | 'crew';
  entityId:     string;
  entityName:   string;
  sourceChatId: number | null;
  sourceMsgId:  number | null;
  applyGroupId: string | null;
  appliedAt:    string;
  appliedBy:    string;
}

export async function listAgentLog(agentId: string): Promise<AgentLogEntry[]> {
  const res = await http<{ entries: AgentLogEntry[] }>(
    `/api/builder/alfred/agents/${agentId}/log`,
  );
  return res.entries;
}

export async function writeManualLog(args: {
  agentId:     string;
  entity:      'agent' | 'crew';
  entityId:    string;
  entityName:  string;
  reason:      string;
  whatChanged: string;
  bodyBefore:  unknown;
  bodyAfter:   unknown;
  ownerUserId: string;
}): Promise<{ ok: true; logId: number }> {
  return http<{ ok: true; logId: number }>(
    `/api/builder/alfred/agents/${args.agentId}/log`,
    {
      method: 'POST',
      body:   JSON.stringify({
        entity:      args.entity,
        entityId:    args.entityId,
        entityName:  args.entityName,
        reason:      args.reason,
        whatChanged: args.whatChanged,
        bodyBefore:  args.bodyBefore,
        bodyAfter:   args.bodyAfter,
        ownerUserId: args.ownerUserId,
      }),
    },
  );
}

// Unused-import sentinel so the AgentDoc / CrewDoc types stay in
// the build graph for editor go-to-def even when nothing imports
// them transitively here. Tree-shaken at build time.
export type { AgentDoc, CrewDoc };
