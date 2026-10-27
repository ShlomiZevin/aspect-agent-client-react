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

// ─── Live Brain (customer surface + builder preview) ──────────────

/** One resolved Live Brain panel from
 *  `GET /api/agents/:slug/conversations/:convId/live-brain`. Only panels
 *  that currently hold a valid value + pass their filter are returned. */
export interface LiveBrainPanelData {
  id: string;
  title: string;
  render: 'text' | 'html' | 'tags' | 'fields' | 'bars' | 'cards' | 'journey';
  /** Present for `text` (Markdown) and `html` (sanitized HTML) renders. */
  text?: string;
  /** Present for structured renders — shape matches the render type. */
  values?: {
    tags?: string[];                                             // tags
    active?: string[];                                           // tags
    pairs?: { k: string; v: string; tag?: boolean }[];           // fields
    bars?: { label: string; value: number; color?: string }[];   // bars
    cards?: { title: string; body: string }[];                   // cards
    journey?: {                                                  // journey / status
      rows?: { k: string; v: string; pill?: boolean }[];
      readiness?: { label?: string; value: number };
      next?: string;
    };
  };
  ranAt?: number;
}

/** Presentation frame for the Live Brain surface (arrangement / open mode). */
export interface LiveBrainFrame {
  arrangement?: 'stack' | 'grid';
  openMode?: 'half' | 'full';
}

export async function fetchLiveBrain(args: {
  agentSlug: string;
  conversationId: number;
  ownerUserId: string;
  version?: string;
}): Promise<{ panels: LiveBrainPanelData[]; frame?: LiveBrainFrame | null }> {
  const q = new URLSearchParams({
    ownerUserId: args.ownerUserId,
    version: args.version || 'active',
  });
  return http(
    `/api/agents/${args.agentSlug}/conversations/${args.conversationId}/live-brain?${q.toString()}`,
  );
}

/** One stored panel value (raw, keyed by panel id) from the conversation
 *  brain — used by the builder preview to show real values while authoring. */
export interface LiveBrainPanelEntry {
  render: string;
  text?: string;
  values?: LiveBrainPanelData['values'];
  ranAt?: number;
}

/** Raw panel values for a conversation, keyed by panel id. Pulled from the
 *  memory endpoint; the builder joins them with its working-copy config. */
export async function fetchLiveBrainValues(args: {
  agentSlug: string;
  conversationId: number;
  ownerUserId: string;
}): Promise<Record<string, LiveBrainPanelEntry>> {
  const q = new URLSearchParams({ ownerUserId: args.ownerUserId });
  const res = await http<{ panels?: Record<string, LiveBrainPanelEntry> }>(
    `/api/agents/${args.agentSlug}/conversations/${args.conversationId}/memory?${q.toString()}`,
  );
  return res.panels || {};
}

export interface LiveBrainRun {
  id: string;
  instanceId: string;
  status: string;
  durationMs: number | null;
  runData: {
    label?: string;
    /** 'text' for a token-resolved text panel; absent for an AI panel. */
    kind?: string;
    modelLabel?: { providerName: string; modelName: string } | null;
    prompt?: string;
    rawOutput?: string;
    parsedOutput?: unknown;
    parseError?: string;
    hidden?: boolean;
  } | null;
  startedAt?: string;
  endedAt?: string;
}

/** Recent Live Brain panel runs for a conversation (newest first). */
export async function fetchLiveBrainRuns(args: {
  agentSlug: string;
  conversationId: number;
}): Promise<{ runs: LiveBrainRun[] }> {
  return http(
    `/api/agents/${args.agentSlug}/conversations/${args.conversationId}/live-brain/runs`,
  );
}

// ─── Profiler (second customer surface) ───────────────────────────

/** One resolved Profiler panel. Same shape as a Live Brain panel plus
 *  `placement` — `header` panels render in the compact indicators strip,
 *  `body` panels as section cards. */
export interface ProfilerPanelData extends LiveBrainPanelData {
  placement?: 'header' | 'body';
}

/** Presentation frame for the Profiler surface (opens ~1/3 screen). */
export interface ProfilerFrame {
  openMode?: 'third' | 'half' | 'full';
}

/** Ask-Profiler surface config returned to the client (the prompt/model
 *  stay server-side; the client only needs whether it's on + the chips). */
export interface ProfilerAskConfig {
  enabled: boolean;
  chips: string[];
}

export async function fetchProfiler(args: {
  agentSlug: string;
  conversationId: number;
  ownerUserId: string;
  version?: string;
}): Promise<{ panels: ProfilerPanelData[]; frame?: ProfilerFrame | null; ask?: ProfilerAskConfig | null }> {
  const q = new URLSearchParams({
    ownerUserId: args.ownerUserId,
    version: args.version || 'active',
  });
  return http(
    `/api/agents/${args.agentSlug}/conversations/${args.conversationId}/profiler?${q.toString()}`,
  );
}

/** Ask the profile a natural-language question about itself. */
export async function askProfiler(args: {
  agentSlug: string;
  conversationId: number;
  ownerUserId: string;
  question: string;
  version?: string;
}): Promise<{ answer: string }> {
  return http(
    `/api/agents/${args.agentSlug}/conversations/${args.conversationId}/profiler/ask`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ownerUserId: args.ownerUserId,
        question: args.question,
        version: args.version || 'active',
      }),
    },
  );
}

/** Hard-refresh the whole Profiler now (recompute every panel). Returns
 *  the fresh render-ready panels. */
export async function refreshProfiler(args: {
  agentSlug: string;
  conversationId: number;
  ownerUserId: string;
  version?: string;
}): Promise<{ panels: ProfilerPanelData[] }> {
  return http(
    `/api/agents/${args.agentSlug}/conversations/${args.conversationId}/profiler/refresh`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerUserId: args.ownerUserId, version: args.version || 'active' }),
    },
  );
}

/** Recent Profiler panel runs for a conversation (newest first). */
export async function fetchProfilerRuns(args: {
  agentSlug: string;
  conversationId: number;
}): Promise<{ runs: LiveBrainRun[] }> {
  return http(
    `/api/agents/${args.agentSlug}/conversations/${args.conversationId}/profiler/runs`,
  );
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

export type WorkspaceKind = 'domain' | 'project' | 'folder';

export interface WorkspaceItem {
  id: string;
  name: string;
  /** Parent folder; null = top level. */
  parentId: string | null;
  /** 'domain' (top, holds projects) · 'project' (holds agents) ·
   *  'folder' (generic, free-form below a project). */
  kind: WorkspaceKind;
  createdAt: string;
}

export async function listWorkspaces(): Promise<WorkspaceItem[]> {
  const res = await http<{ workspaces: WorkspaceItem[] }>(`/api/builder/workspaces`);
  return res.workspaces;
}

export async function createWorkspace(args: {
  ownerUserId: string;
  name: string;
  parentId: string | null;
  kind: WorkspaceKind;
}): Promise<WorkspaceItem> {
  const id = `ws_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
  const res = await http<{ workspace: WorkspaceItem }>(`/api/builder/workspaces`, {
    method: 'POST',
    body: JSON.stringify({ id, ownerUserId: args.ownerUserId, name: args.name, parentId: args.parentId, kind: args.kind }),
  });
  return res.workspace;
}

export async function renameWorkspace(args: { id: string; name: string }): Promise<void> {
  await http(`/api/builder/workspaces/${args.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: args.name }),
  });
}

/** Move a folder under another folder, or to top level (parentId = null).
 *  Server rejects moving a folder into its own descendant (400). */
export async function moveWorkspace(args: { id: string; parentId: string | null }): Promise<void> {
  await http(`/api/builder/workspaces/${args.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ parentId: args.parentId }),
  });
}

/** cascade: 'orphan' moves direct contents up one level; 'hard' deletes
 *  the folder + every sub-folder + all their agents. */
export async function deleteWorkspace(args: {
  id: string;
  cascade: 'orphan' | 'hard';
}): Promise<void> {
  await http(`/api/builder/workspaces/${args.id}?cascade=${args.cascade}`, {
    method: 'DELETE',
  });
}

/**
 * Duplicate a project's agent (active versions only) into a fresh copy
 * with a new slug. Returns the new slug. Throws on a slug already taken
 * (server responds 409).
 */
export async function duplicateProject(args: {
  projectId: string;
  newName: string;
  newSlug: string;
  workspaceId: string | null;
}): Promise<{ projectId: string; agentId: string; slug: string; name: string }> {
  return http(`/api/builder/projects/${args.projectId}/duplicate`, {
    method: 'POST',
    body: JSON.stringify({
      newName: args.newName,
      newSlug: args.newSlug,
      workspaceId: args.workspaceId,
    }),
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
/**
 * Delist an agent (leave it off the builder home page — it still exists
 * and opens by its URL) or list it again.
 */
export async function setAgentDelisted(args: {
  agentId: string;
  delisted: boolean;
}): Promise<void> {
  await http(`/api/builder/agents/${args.agentId}`, {
    method: 'PATCH',
    body: JSON.stringify({ delisted: args.delisted }),
  });
}

/** Whether the agent is delisted from the builder home page. */
export async function fetchAgentDelisted(agentId: string): Promise<boolean> {
  const res = await http<{ delisted: boolean }>(`/api/builder/agents/${agentId}/listing`);
  return res.delisted;
}

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

/** Move the agent's customer-facing published pointer. `versionId:
 *  null` unpublishes (runtime falls back to active→viewing). */
export async function setAgentPublishedApi(agentId: ID, versionId: ID | null) {
  await http(`/api/builder/agents/${agentId}/published`, {
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

/** Crew counterpart of `setAgentPublishedApi`. `versionId: null` unpublishes. */
export async function setCrewPublishedApi(crewId: ID, versionId: ID | null) {
  await http(`/api/builder/crews/${crewId}/published`, {
    method: 'PUT',
    body: JSON.stringify({ versionId }),
  });
}

/** Persist the author-chosen crew order (sidebar drag-reorder). */
export async function reorderCrewsApi(agentId: ID, crewIds: ID[]) {
  await http(`/api/builder/agents/${agentId}/crew-order`, {
    method: 'PUT',
    body: JSON.stringify({ crewIds }),
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

export interface SeedMemoryEntry {
  field: string;
  value: unknown;
  domain?: string;
}

export async function createConversation(args: {
  agentSlug: string;
  ownerUserId: string;
  /** Which V2 surface this conversation is born in — 'live' for the
   *  customer-facing chat, 'builder' for builder preview (default). */
  source?: 'builder' | 'live';
  /** Starting field values the conversation is born with — written by
   *  the server as part of creation, so the very first turn already
   *  sees them (builder "enter data before the chat starts", #765). */
  seedMemory?: SeedMemoryEntry[];
}): Promise<{ conversationId: number }> {
  return http<{ conversationId: number }>(
    `/api/agents/${args.agentSlug}/conversations`,
    {
      method: 'POST',
      body: JSON.stringify({
        ownerUserId: args.ownerUserId,
        ...(args.source ? { source: args.source } : {}),
        ...(args.seedMemory && args.seedMemory.length > 0 ? { seedMemory: args.seedMemory } : {}),
      }),
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

// ─── Admin → Conversations: list screen + conversation screen (#922) ──

export type ConversationSource = 'live' | 'builder' | 'simulation';

export interface ConversationPageItem {
  id: number;
  name: string | null;
  source: ConversationSource | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  userId: number | null;
  ownerUserId: string | null;
  ownerName: string | null;
  simulatedBy: string | null;
}

export interface ConversationPage {
  agent: { slug: string; name: string } | null;
  total: number;
  counts: { all: number; live: number; builder: number; simulation: number };
  conversations: ConversationPageItem[];
}

export async function listConversationPage(args: {
  agentSlug: string;
  q?: string;
  from?: string;
  to?: string;
  source?: ConversationSource;
  userId?: number;
  limit?: number;
  offset?: number;
}): Promise<ConversationPage> {
  const p = new URLSearchParams();
  for (const k of ['q', 'from', 'to', 'source', 'userId', 'limit', 'offset'] as const) {
    const v = args[k];
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  }
  return http<ConversationPage>(`/api/agents/${encodeURIComponent(args.agentSlug)}/admin/conversation-list?${p}`);
}

export interface ProfileField {
  name: string;
  domain: string | null;
  type: string;
  value: unknown;
  filled: boolean;
}

export interface ProfilePanel {
  id?: string;
  title: string;
  render?: string;
  text?: string;
  values?: unknown;
}

export interface ConversationRunSummary {
  id: string;
  instanceId: string;
  pluginId: string;
  label: string;
  status: string;
  startedAt: string;
  durationMs: number | null;
  messageId: number | null;
  turn: number | null;
  userLine: string;
  modelLabel: { providerName: string; modelName: string } | null;
  error: { code: string; message: string } | null;
  /** 'main' = before the reply; 'offline' / 'background' = after it. */
  lane: string;
  /** Steps sharing a group number started together (ran in parallel). */
  group: number;
  /** What the step concluded, in one line. */
  summary: string;
  /** The crew it moved the conversation to, if it did. */
  transitionTo: string | null;
  /** The crew this add-on belongs to (null for agent-level cortex add-ons). */
  crewName: string | null;
  writes: { kind: string; domain: string | null; field: string; value: unknown }[];
}

export interface ConversationOverview {
  conversation: {
    id: number;
    name: string | null;
    source: ConversationSource | null;
    agentName: string;
    createdAt: string;
    updatedAt: string;
    messageCount: number;
    ownerUserId: string | null;
    ownerName: string | null;
    simulatedBy: string | null;
    crewName: string | null;
  };
  profile: { fields: ProfileField[]; panels: ProfilePanel[] };
  runs: ConversationRunSummary[];
}

export async function getConversationOverview(args: { agentSlug: string; conversationId: number }): Promise<ConversationOverview> {
  return http<ConversationOverview>(`/api/agents/${encodeURIComponent(args.agentSlug)}/admin/conversations/${args.conversationId}/overview`);
}

export async function getAddonRun(args: { agentSlug: string; runId: string }): Promise<PersistedAddonRun> {
  const res = await http<{ run: PersistedAddonRun }>(`/api/agents/${encodeURIComponent(args.agentSlug)}/admin/runs/${encodeURIComponent(args.runId)}`);
  return res.run;
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

/** How much of each turn a conversation export carries (task #861). */
export type ConversationExportLevel = 'messages' | 'outputs' | 'full';

/**
 * One conversation as self-describing JSON, for handing to another AI.
 * Built server-side (builder/services/conversationExport.js) — the same
 * function the MCP door serves, so both exports are identical. Kept as
 * `unknown`-ish: the client only saves / copies it, never reads into it.
 */
export async function exportConversation(args: {
  agentSlug: string;
  conversationId: number;
  include: ConversationExportLevel;
}): Promise<Record<string, unknown>> {
  const res = await http<Record<string, unknown>>(
    `/api/agents/${args.agentSlug}/conversations/${args.conversationId}/export?include=${args.include}`,
  );
  if (typeof res.error === 'string') throw new Error(res.error);
  return res;
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
  /** Which V2 surface to list for — 'live' or 'builder' (default). */
  source?: 'builder' | 'live';
}): Promise<ConversationListItem[]> {
  const params = new URLSearchParams({ ownerUserId: args.ownerUserId });
  if (args.source) params.set('source', args.source);
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
  /** Where the conversation was born: the outside chat ('live'), the
   *  builder's own test chat ('builder'), or an AI testing the agent
   *  through the MCP link ('simulation'). null = untagged (older rows). */
  source?: 'live' | 'builder' | 'simulation' | null;
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
 * One simulation job (task #897): a single simulated conversation the
 * server runs by itself, released by an outside AI through the MCP link.
 * Shape mirrors `shape()` in builder/services/simulationJobs.js.
 */
export interface SimulationJob {
  id: number;
  agent: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'interrupted';
  label: string | null;
  /** Who released it — a task-board name. */
  by: string | null;
  version: 'active' | 'published';
  /** A fixed list of user lines, or a persona the platform plays. */
  kind: 'script' | 'persona';
  persona: string | null;
  goal: string | null;
  lines: string[] | null;
  /** The model playing the user (persona jobs only). */
  userModel: string | null;
  maxTurns: number | null;
  startCrew: string | null;
  fields: Record<string, unknown> | null;
  conversationId: number | null;
  /** The load test this conversation belongs to, if any (task #902). */
  loadTestId: number | null;
  turns: number;
  /** 'public' = turns went through the server's public address, like a
   *  real user (load tests, task #902); 'direct' = straight to the server. */
  via: 'direct' | 'public';
  /** Every turn's time, in order; a failed turn carries its error kind. */
  timings: SimulationTurnTiming[];
  /** Median / slowest of the turns that answered; null before the first. */
  timing: { turns: number; medianMs: number; p95Ms: number; maxMs: number } | null;
  /** Why it ended, in words. */
  stopped: string | null;
  endedInCrew: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

export interface SimulationTurnTiming {
  turn: number;
  at: string;
  ms: number;
  ok: boolean;
  /** Error-center kind of a failed turn. */
  kind?: ErrorKind;
  /** Add-ons that failed inside a turn that still answered. */
  addonFailures?: number;
}

/** Admin → Simulations: the agent's simulation jobs, newest first. */
export async function listSimulations(args: { agentSlug: string }): Promise<SimulationJob[]> {
  const res = await http<{ simulations: SimulationJob[] }>(
    `/api/simulations?agentSlug=${encodeURIComponent(args.agentSlug)}`,
  );
  return res.simulations;
}

/** What the "New simulation" form sends. Either persona (+goal) or lines. */
export interface NewSimulation {
  version: 'active' | 'published';
  label?: string;
  persona?: string;
  goal?: string;
  lines?: string[];
  maxTurns?: number;
  model?: string;
  via?: 'direct' | 'public';
}

/**
 * Release one simulation from the Admin screen. The server answers at
 * once with the job; the conversation then runs by itself.
 */
export async function releaseSimulation(args: {
  agentSlug: string;
  /** Who is releasing it — shown on the job. */
  by: string;
  simulation: NewSimulation;
}): Promise<SimulationJob> {
  return http<SimulationJob>('/api/simulations', {
    method: 'POST',
    body: JSON.stringify({ slug: args.agentSlug, by: args.by, body: args.simulation }),
  });
}

// ─── Simulation limits (task #926) — one set for the environment ──

export interface SimulationLimits {
  turnsPerDay: number;
  userRepliesPerDay: number;
  maxTurnsPerSimulation: number;
  /** null = no dollar cap */
  usdPerDay: number | null;
}
export interface SimulationLimitsSummary {
  limits: SimulationLimits;
  defaults: SimulationLimits;
  updatedBy: string | null;
  today: { turns: number; userReplies: number; usd: number };
}

export async function getSimulationLimits(): Promise<SimulationLimitsSummary> {
  return http<SimulationLimitsSummary>('/api/simulations/limits');
}

export async function saveSimulationLimits(limits: Partial<SimulationLimits>, by: string): Promise<SimulationLimitsSummary> {
  return http<SimulationLimitsSummary>('/api/simulations/limits', {
    method: 'PUT',
    body: JSON.stringify({ ...limits, by }),
  });
}

// ─── Load tests (task #902) ───────────────────────────────────────
// Shape mirrors shape() in builder/services/loadTests.js.

export interface LoadTestTiming { turns: number; medianMs: number; p95Ms: number; maxMs: number }

/** What a run would cost, before it starts. Unpriced models are counted at the top known rate. */
export interface LoadTestEstimate {
  usd: number;
  capUsd: number;
  overCap: boolean;
  perTurnUsd: number;
  agentTurns: number;
  conversations: number;
  turns: number;
  baseline: boolean;
  basis: string;
  unpriced: string[];
}

/** This server's own vitals, sampled every 2 s while the run went. */
export interface LoadTestSample { t: number; cpuPct: number; rssMb: number; loopLagMs: number; dbInUse: number; dbWaiting: number }

export interface LoadTestRun {
  id: number;
  agent: string;
  status: 'running' | 'completed' | 'failed' | 'interrupted';
  /** baseline = one conversation alone first; load = all of them; done. */
  phase: 'baseline' | 'load' | 'done';
  label: string | null;
  by: string | null;
  version: 'active' | 'published';
  via: 'public';
  start: 'together' | 'ramp';
  kind: 'script' | 'persona';
  lines: string[] | null;
  persona: string | null;
  goal: string | null;
  userModel: string | null;
  turnsEach: number;
  conversations: number;
  counts: { waiting: number; running: number; finished: number; failed: number };
  baseline: { jobId: number; timing: LoadTestTiming | null; errors: number } | null;
  /** Over every answered turn of the load phase. */
  timing: LoadTestTiming | null;
  slowdown: { median: number | null; p95: number | null } | null;
  turnsDone: number;
  turnsPlanned: number;
  turnsPerSecond: number | null;
  errors: number;
  errorsByKind: Partial<Record<ErrorKind | 'other', number>>;
  addonFailures: number;
  /** "10 at once: turns 1.8× slower, no errors" — once finished. */
  verdict: string | null;
  vitals: { samples: number; cpuPctMax: number; rssMbMax: number; loopLagMsMax: number; dbInUseMax: number; dbWaitingMax: number; dbPoolMax: number | null } | null;
  samples: LoadTestSample[];
  estimate: LoadTestEstimate | null;
  costUsd: number | null;
  capUsd: number;
  unpriced: string[];
  stopped: string | null;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
  /** The run before with the same number of conversations — to compare. */
  previous: { id: number; createdAt: string; medianMs: number; p95Ms: number; errors: number; verdict: string | null } | null;
  jobs: SimulationJob[];
}

export interface NewLoadTest {
  conversations: number;
  version: 'active' | 'published';
  start: 'together' | 'ramp';
  lines?: string[];
  persona?: string;
  goal?: string;
  turns?: number;
  model?: string;
  label?: string;
}

export async function listLoadTests(args: { agentSlug: string }): Promise<LoadTestRun[]> {
  const res = await http<{ loadTests: LoadTestRun[] }>(`/api/load-tests?agentSlug=${encodeURIComponent(args.agentSlug)}`);
  return res.loadTests;
}

export async function getLoadTest(id: number): Promise<LoadTestRun> {
  const res = await http<{ loadTest: LoadTestRun }>(`/api/load-tests/${id}`);
  return res.loadTest;
}

export async function estimateLoadTest(args: { agentSlug: string; loadTest: NewLoadTest }): Promise<LoadTestEstimate> {
  const res = await http<{ estimate: LoadTestEstimate }>('/api/load-tests/estimate', {
    method: 'POST',
    body: JSON.stringify({ slug: args.agentSlug, body: args.loadTest }),
  });
  return res.estimate;
}

export async function releaseLoadTest(args: { agentSlug: string; by: string; loadTest: NewLoadTest }): Promise<LoadTestRun> {
  return http<LoadTestRun>('/api/load-tests', {
    method: 'POST',
    body: JSON.stringify({ slug: args.agentSlug, by: args.by, body: args.loadTest }),
  });
}

export async function stopLoadTest(args: { id: number; by: string }): Promise<LoadTestRun> {
  const res = await http<{ loadTest: LoadTestRun }>(`/api/load-tests/${args.id}/stop`, {
    method: 'POST',
    body: JSON.stringify({ by: args.by }),
  });
  return res.loadTest;
}

// ─── Error center (task #903) ─────────────────────────────────────
// Shapes mirror builder/services/errorCenter.js.

export type ErrorArea = 'turn' | 'addon' | 'model' | 'offline' | 'trigger' | 'profiler' | 'live-brain' | 'simulation' | 'server';
export type ErrorKind = 'model_no_credit' | 'model_rate_limit' | 'model_timeout' | 'model_refusal' | 'model_bad_answer' | 'model_other' | 'database' | 'external' | 'server_unavailable' | 'user_input' | 'code';
export type ErrorSource = 'builder' | 'customer' | 'simulation';

/** One kind of problem: every repeat of it counted on one line. */
export interface ErrorGroup {
  fingerprint: string;
  area: ErrorArea;
  kind: ErrorKind;
  code: string | null;
  /** The latest wording of the message. */
  message: string;
  /** The add-on / model / trigger it is about, in words — or null. */
  where: string | null;
  count: number;
  conversations: number;
  sources: Record<ErrorSource, number>;
  firstSeen: string;
  lastSeen: string;
  /** New → Looking at it → Handled, or Ignored. A handled group whose
   *  errors came back reads 'new' with `reopened: true`. */
  status: ErrorStatus;
  reopened: boolean;
  note: string;
  statusBy: string | null;
  statusAt: string | null;
}

export type ErrorStatus = 'new' | 'looking' | 'handled' | 'ignored';

/** One time a group happened. */
export interface ErrorOccurrence {
  id: number;
  conversationId: number | null;
  messageId: number | null;
  addonRunId: string | null;
  source: ErrorSource | null;
  area: ErrorArea;
  kind: ErrorKind;
  code: string | null;
  message: string;
  detail: Record<string, unknown>;
  createdAt: string;
}

/** Admin → Errors: the agent's error groups from the last month. */
export async function listErrorGroups(args: {
  agentSlug: string;
  kind?: ErrorKind | '';
  area?: ErrorArea | '';
  source?: ErrorSource | '';
  status?: ErrorStatus | '';
  sort?: 'recent' | 'frequent';
}): Promise<ErrorGroup[]> {
  const params = new URLSearchParams({ agentSlug: args.agentSlug });
  if (args.kind) params.set('kind', args.kind);
  if (args.area) params.set('area', args.area);
  if (args.source) params.set('source', args.source);
  if (args.status) params.set('status', args.status);
  if (args.sort) params.set('sort', args.sort);
  const res = await http<{ groups: ErrorGroup[] }>(`/api/errors?${params}`);
  return res.groups;
}

/** How many of the agent's error groups are new — the count on the Admin menu. */
export async function countNewErrors(args: { agentSlug: string }): Promise<number> {
  const res = await http<{ new: number }>(`/api/errors/count?agentSlug=${encodeURIComponent(args.agentSlug)}`);
  return res.new ?? 0;
}

/** Decide about an error group: status + a short note on what was done. */
export async function setErrorStatus(args: {
  agentSlug: string; fingerprint: string; status: ErrorStatus; note: string; by: string;
}): Promise<void> {
  await http('/api/errors/status', { method: 'PUT', body: JSON.stringify(args) });
}

/** Write only an error group's note — its status stays as it is. */
export async function setErrorNote(args: { agentSlug: string; fingerprint: string; note: string; by: string }): Promise<void> {
  await http('/api/errors/note', { method: 'PUT', body: JSON.stringify(args) });
}

/** Fired after a status change so the Admin menu count refreshes. */
export const ERRORS_CHANGED_EVENT = 'lybi:errors-changed';

export interface ErrorDay { day: string; count: number }

/** Every occurrence of one error group, newest first, + its count per day (14 days). */
export async function listErrorOccurrences(args: { agentSlug: string; fingerprint: string }): Promise<{ occurrences: ErrorOccurrence[]; perDay: ErrorDay[] }> {
  const params = new URLSearchParams({ agentSlug: args.agentSlug, fingerprint: args.fingerprint });
  const res = await http<{ occurrences: ErrorOccurrence[]; perDay: ErrorDay[] }>(`/api/errors/occurrences?${params}`);
  return { occurrences: res.occurrences ?? [], perDay: res.perDay ?? [] };
}

/** The strip on top of Admin → Errors. */
export interface ErrorSummary {
  byStatus: { new: number; back: number; looking: number; handled: number; ignored: number };
  customerConversations24h: number;
  perDay: ErrorDay[];
}

export async function getErrorSummary(args: { agentSlug: string }): Promise<ErrorSummary> {
  return http<ErrorSummary>(`/api/errors/summary?agentSlug=${encodeURIComponent(args.agentSlug)}`);
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
  version?: 'viewing' | 'active' | 'published';
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
  /** Server-side extras. `kind: 'apply-marker'` rows are the apply
   *  boundary — rendered as a divider chip in BuilderChat; deleting
   *  one (deleteAlfredMarker) re-opens the consolidator's window. */
  metadata?: {
    kind?: string;
    applyGroupId?: string;
    targets?: Array<{ entity: 'agent' | 'crew'; entityName: string }>;
  } | null;
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

/** Task #816: flag the in-flight Alfred turn of this chat to stop. */
export async function stopAlfredChat(chatId: number): Promise<{ ok: boolean; running: boolean }> {
  return http<{ ok: boolean; running: boolean }>(`/api/builder/alfred/chats/${chatId}/stop`, { method: 'POST' });
}

/** Task #816: flag the in-flight preview-chat turn to stop. */
export async function stopRuntimeTurn(args: {
  agentSlug: string;
  conversationId: number;
}): Promise<{ ok: boolean; running: boolean }> {
  return http<{ ok: boolean; running: boolean }>(
    `/api/agents/${args.agentSlug}/conversations/${args.conversationId}/stop`,
    { method: 'POST' },
  );
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

/** Delete an apply-marker row (markers only — the server rejects
 *  regular messages). Re-opens the Apply window back to the previous
 *  marker. */
export async function deleteAlfredMarker(args: {
  chatId: number;
  messageId: number;
}): Promise<void> {
  await http(`/api/builder/alfred/chats/${args.chatId}/messages/${args.messageId}`, {
    method: 'DELETE',
  });
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
  /** The preview conversation currently open in the builder — lets
   *  Alfred's read_conversation tool target "this chat" directly. */
  activeConversationId?: number | null;
  /** The on-screen working copies — Alfred talks about the DRAFT. */
  workingBodies?: ApplyWorkingBodies;
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
        activeConversationId: args.activeConversationId ?? null,
        workingBodies: args.workingBodies,
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
  /** True when the whole conversation sits behind an ✅ Applied marker —
   *  nothing new to collect. Normal outcome, rendered as a friendly
   *  empty state (never an error). */
  alreadyApplied?: boolean;
  /** Pinned chat files and how each reaches the generator:
   *  'document' (native PDF block) · 'text' (extracted) ·
   *  'chat-only' (images — brainstorm sees them, generation doesn't). */
  pinnedFiles?: Array<{ name: string; delivery: 'document' | 'text' | 'chat-only' }>;
}

/** Which model each Alfred step runs — server truth, never a client
 *  constant (those drift). */
export interface AlfredStepModel {
  id: string;
  label: string;
  model: string;
}

export async function fetchAlfredModels(): Promise<AlfredStepModel[]> {
  const res = await http<{ steps: AlfredStepModel[] }>(`/api/builder/alfred/models`);
  return res.steps;
}

/** One pinned Alfred chat file (client-safe — no extracted text). */
export interface AlfredPinnedFile {
  id: string;
  name: string;
  mime: string;
  as: 'document' | 'text' | 'image';
  bytes: number;
  tokenEstimate: number;
  hasText: boolean;
  addedAt: string;
}

export async function uploadAlfredFile(args: {
  chatId: number;
  file: File;
}): Promise<{ file: AlfredPinnedFile; files: AlfredPinnedFile[] }> {
  const form = new FormData();
  form.append('file', args.file);
  const res = await fetch(`${BASE_URL}/api/builder/alfred/chats/${args.chatId}/files`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    try { throw new Error(JSON.parse(text).error || text); }
    catch (e) { throw e instanceof Error ? e : new Error(text); }
  }
  return res.json();
}

// ─── The Spec (task #870) ─────────────────────────────────────────

/** A file attached to an agent's Spec — reference for whoever builds the
 *  agent; never sent to the running agent. */
export interface SpecFile {
  id: number;
  fileName: string;
  mimeType: string | null;
  fileSize: number | null;
  /** Whether text could be read out of it (what Alfred / assistants see). */
  hasText: boolean;
  createdAt: string;
}

/** Persist the PROJECT spec text — it used to live only in the browser. */
export async function saveProjectSpecApi(projectId: string, spec: string): Promise<void> {
  await http(`/api/builder/projects/${encodeURIComponent(projectId)}/spec`, {
    method: 'PUT',
    body: JSON.stringify({ spec }),
  });
}

export async function listSpecFiles(agentId: string): Promise<SpecFile[]> {
  const res = await http<{ files?: SpecFile[] }>(`/api/builder/agents/${encodeURIComponent(agentId)}/spec-files`);
  return res.files ?? [];
}

export async function uploadSpecFile(agentId: string, file: File): Promise<SpecFile> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE_URL}/api/builder/agents/${encodeURIComponent(agentId)}/spec-files`, {
    method: 'POST',
    body: form,
  });
  const text = await res.text();
  let body: { file?: SpecFile; error?: string } = {};
  try { body = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok || !body.file) throw new Error(body.error || text || `Upload failed (${res.status})`);
  return body.file;
}

// ─── Targeted KB notes + files (task #871) ────────────────────────

/** Notes and files on one Targeted KB — the author's knowledge map.
 *  Never sent to the running agent. */
export async function getTkbExtras(agentId: string, enumId: string): Promise<{ notes: string; files: SpecFile[] }> {
  const res = await http<{ notes?: string; files?: SpecFile[] }>(
    `/api/builder/agents/${encodeURIComponent(agentId)}/tkb/${encodeURIComponent(enumId)}`,
  );
  return { notes: res.notes ?? '', files: res.files ?? [] };
}

export async function saveTkbNotes(agentId: string, enumId: string, notes: string): Promise<void> {
  await http(`/api/builder/agents/${encodeURIComponent(agentId)}/tkb/${encodeURIComponent(enumId)}/notes`, {
    method: 'PUT',
    body: JSON.stringify({ notes }),
  });
}

export async function uploadTkbFile(agentId: string, enumId: string, file: File): Promise<SpecFile> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(
    `${BASE_URL}/api/builder/agents/${encodeURIComponent(agentId)}/tkb/${encodeURIComponent(enumId)}/files`,
    { method: 'POST', body: form },
  );
  const text = await res.text();
  let body: { file?: SpecFile; error?: string } = {};
  try { body = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok || !body.file) throw new Error(body.error || text || `Upload failed (${res.status})`);
  return body.file;
}

export async function deleteSpecFile(fileId: number): Promise<void> {
  await http(`/api/builder/spec-files/${fileId}`, { method: 'DELETE' });
}

export function specFileDownloadUrl(fileId: number): string {
  return `${BASE_URL}/api/builder/spec-files/${fileId}/download`;
}

export async function listAlfredFiles(chatId: number): Promise<AlfredPinnedFile[]> {
  const res = await http<{ files: AlfredPinnedFile[] }>(
    `/api/builder/alfred/chats/${chatId}/files`,
  );
  return res.files;
}

export async function deleteAlfredFile(args: { chatId: number; fileId: string }): Promise<void> {
  await http(`/api/builder/alfred/chats/${args.chatId}/files/${args.fileId}`, { method: 'DELETE' });
}

/** Click-to-open URL for a pinned file's content. */
export function alfredFileContentUrl(chatId: number, fileId: string): string {
  return `${BASE_URL}/api/builder/alfred/chats/${chatId}/files/${fileId}/content`;
}

export async function applyPreview(args: {
  chatId:      number;
  agentSlug:   string;
  workingBodies?: ApplyWorkingBodies;
  ownerUserId: string;
}): Promise<ApplyPreviewResponse> {
  return http<ApplyPreviewResponse>(
    `/api/builder/alfred/chats/${args.chatId}/apply/preview`,
    {
      method: 'POST',
      body:   JSON.stringify({
        agentSlug:     args.agentSlug,
        ownerUserId:   args.ownerUserId,
        workingBodies: args.workingBodies,
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
  /** Targets the generator verified as already-done — nothing changed,
   *  shown as "already in place" (a normal outcome, not an error). */
  skipped?: Array<{
    entity:     'agent' | 'crew';
    entityId:   string;
    entityName: string;
    what_to_do: string;
    reasoning?: string;
  }>;
}

/**
 * Runs the patch generator for each target and returns the new bodies.
 * Does NOT save and does NOT write log rows — that's the client's job
 * via `writeApplyLog` after each Save.
 */

/** The client's visible working copies, sent with apply/generate so
 *  Alfred works on exactly what the user sees (chained applies stack;
 *  unsaved edits are respected). Server falls back to the saved
 *  viewing version for any entity not present here. */
export interface ApplyWorkingBodies {
  agent?: { id: string; body: unknown };
  crews?: Array<{ id: string; body: unknown }>;
}

// ─── Platform reference bundle (bring-your-own-AI) ──────────────────

export interface AiBundleFile { path: string; content: string }

export interface AiBundle {
  /** Hash of the contents — changes whenever any file does, so a copy on
   *  disk can be compared against it without anyone maintaining a number. */
  version: string;
  generatedAt: string;
  fileCount: number;
  files: AiBundleFile[];
}

/** Just the hash — for telling the user their local copy has gone stale. */
export const fetchAiBundleVersion = () =>
  http<{ version: string }>('/api/builder/ai-bundle/version');

/** Every platform file an AI assistant needs in order to understand how
 *  agents actually behave. ~80 files, ~1.3MB. */
export const fetchAiBundle = () => http<AiBundle>('/api/builder/ai-bundle');

/** What the poll endpoint reports. While the job runs it carries nothing
 *  but the status — the generated bodies are hundreds of KB and there is
 *  no reason to ship them on every tick. */
interface ApplyJobStatus {
  status:  'running' | 'done' | 'failed' | 'cancelled';
  result?: ApplyGenerateResponse;
  error?:  string;
  errors?: string[];
}

const APPLY_POLL_MS       = 1500;
/** Server marks an abandoned job failed after 15 min; this is the client
 *  side of the same fence, so a lost job can never poll forever. */
const APPLY_POLL_TIMEOUT_MS = 20 * 60 * 1000;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Start an Apply and wait for it.
 *
 * Signature and return type are deliberately unchanged: callers still
 * `await applyGenerate(...)` and get the finished bodies, so nothing
 * downstream had to change. What changed is underneath — Apply used to be
 * one blocking POST held open for 30-90s, which surfaced as "Failed to
 * fetch" whenever the browser dropped the connection, with no way to tell
 * whether the work had actually succeeded. Now the POST returns a job id
 * and we poll a row.
 */
export async function applyGenerate(args: {
  chatId:      number;
  agentSlug:   string;
  ownerUserId: string;
  targets:     ApplyTarget[];
  workingBodies?: ApplyWorkingBodies;
}): Promise<ApplyGenerateResponse> {
  const { jobId } = await http<{ jobId: string }>(
    `/api/builder/alfred/chats/${args.chatId}/apply/generate`,
    {
      method: 'POST',
      body:   JSON.stringify({
        agentSlug:     args.agentSlug,
        ownerUserId:   args.ownerUserId,
        targets:       args.targets,
        workingBodies: args.workingBodies,
      }),
    },
  );

  const deadline = Date.now() + APPLY_POLL_TIMEOUT_MS;
  for (;;) {
    await sleep(APPLY_POLL_MS);

    const job = await http<ApplyJobStatus>(
      `/api/builder/alfred/chats/${args.chatId}/apply/jobs/${jobId}`,
    );

    if (job.status === 'done' && job.result) return job.result;

    if (job.status === 'failed' || job.status === 'cancelled') {
      // ApplyPreviewModal recovers structured validation errors by parsing
      // a trailing {...} out of the message, so failures have to keep that
      // shape or the per-field error list silently disappears.
      const base = job.error || 'Apply failed';
      throw new Error(
        job.errors && job.errors.length > 0
          ? `${base} ${JSON.stringify({ errors: job.errors })}`
          : base,
      );
    }

    if (Date.now() > deadline) {
      throw new Error('Apply is taking longer than expected — check the agent before retrying, the change may already have been generated.');
    }
  }
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
