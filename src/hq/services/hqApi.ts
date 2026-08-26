/** Lybi HQ — API client. */

import type { Atom, Source, AskResult, HQStatus, DropInspection } from '../types';

const getBaseURL = (): string =>
  import.meta.env.DEV
    ? 'http://localhost:3000'
    : (import.meta.env.VITE_API_URL || 'https://aspect-agent-server-1018338671074.europe-west1.run.app');

async function api<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${getBaseURL()}/api/hq${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try { message = (await res.json()).error || message; } catch { /* keep default */ }
    throw new Error(message);
  }
  return res.json();
}

export const getStatus = () => api<HQStatus>('/status');

export const inspectDrop = (input: string) =>
  api<DropInspection>('/drop/inspect', { method: 'POST', body: JSON.stringify({ input }) });

export interface DropProgress { done: number; total: number; title: string }
export interface DropDone {
  ok: boolean;
  type: string;
  label?: string;
  notionType?: string;
  total?: number;
  ingested?: number;
  failures?: { title: string; error: string }[];
  atom?: Atom;
}

/**
 * One drop call for everything.
 *
 * The SERVER decides what a pasted string is and answers accordingly: a Notion
 * import streams SSE (it can be hundreds of pages), text and URLs come back as
 * plain JSON. So the client must not second-guess the type — it dispatches on
 * the response's Content-Type instead.
 *
 * This replaced a client-side `notion.so` regex that disagreed with the server:
 * an `app.notion.com` link was treated as text here and as Notion there, so the
 * client tried to JSON.parse an event stream ("Unexpected token 'e'").
 */
export async function drop(
  input: string,
  kind = 'auto',
  onProgress?: (p: DropProgress) => void,
  title?: string,
): Promise<DropDone> {
  const res = await fetch(`${getBaseURL()}/api/hq/drop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, kind, title }),
  });

  if (!res.ok) {
    let message = `Import failed (${res.status})`;
    try { message = (await res.json()).error || message; } catch { /* keep default */ }
    throw new Error(message);
  }

  const isStream = (res.headers.get('content-type') || '').includes('text/event-stream');
  if (!isStream) return res.json();
  if (!res.body) throw new Error('Import returned no body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: DropDone | null = null;
  let failure: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line; keep any partial tail.
    const frames = buffer.split('\n\n');
    buffer = frames.pop() || '';

    for (const frame of frames) {
      const lines = frame.split('\n');
      const eventLine = lines.find(l => l.startsWith('event: '));
      const dataLine = lines.find(l => l.startsWith('data: '));
      if (!eventLine || !dataLine) continue;

      const event = eventLine.slice(7).trim();
      let payload: unknown;
      try { payload = JSON.parse(dataLine.slice(6)); } catch { continue; }

      if (event === 'progress') onProgress?.(payload as DropProgress);
      else if (event === 'done') result = payload as DropDone;
      else if (event === 'error') failure = (payload as { error: string }).error;
    }
  }

  if (failure) throw new Error(failure);
  if (!result) throw new Error('Import ended without a result');
  return result;
}

export const listAtoms = (params: { kind?: string; search?: string; limit?: number } = {}) => {
  const qs = new URLSearchParams();
  if (params.kind) qs.set('kind', params.kind);
  if (params.search) qs.set('search', params.search);
  if (params.limit) qs.set('limit', String(params.limit));
  const suffix = qs.toString();
  return api<{ atoms: Atom[] }>(`/atoms${suffix ? `?${suffix}` : ''}`).then(r => r.atoms);
};

export const getAtom = (id: number) => api<{ atom: Atom }>(`/atoms/${id}`).then(r => r.atom);

export const patchAtom = (id: number, patch: Partial<Atom>) =>
  api<{ atom: Atom }>(`/atoms/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }).then(r => r.atom);

export const deleteAtom = (id: number) =>
  api<{ ok: boolean }>(`/atoms/${id}`, { method: 'DELETE' });

export const rerunScribe = (id: number) =>
  api<{ ok: boolean }>(`/atoms/${id}/scribe`, { method: 'POST' });

export const reindexAtom = (id: number) =>
  api<{ ok: boolean; chunkCount: number }>(`/atoms/${id}/reindex`, { method: 'POST' });

export const listSources = () => api<{ sources: Source[] }>('/sources').then(r => r.sources);

export const resyncSource = (id: number) =>
  api<{ ok: boolean; ingested: number; total: number }>(`/sources/${id}/resync`, { method: 'POST' });

export const deleteSource = (id: number) =>
  api<{ ok: boolean }>(`/sources/${id}`, { method: 'DELETE' });

/** Forget everything HQ has read. Connections and their page lists survive. */
export const resetHQ = () =>
  api<{ ok: boolean; removed: number }>('/reset', {
    method: 'POST', body: JSON.stringify({ confirm: 'DELETE' }),
  });

export const ask = (question: string) =>
  api<AskResult>('/ask', { method: 'POST', body: JSON.stringify({ question }) });

// ─── Integrations ────────────────────────────────────────────────────────────

import type { Provider, SyncItem, SyncStats, SyncRun, SyncProgress, ItemFilters } from '../types';

export const listProviders = () =>
  api<{ providers: Provider[] }>('/integrations').then(r => r.providers);

/**
 * Every call takes a provider id. The server routes are `/:provider/...`, so
 * adding a source needs no new endpoints and no new client functions — Notion
 * is only the default because it's the one that's built.
 */
export const listSyncItems = (params: ItemFilters = {}, provider = 'notion') => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, String(v)); });
  const suffix = qs.toString();
  return api<{ items: SyncItem[]; stats: SyncStats }>(`/integrations/${provider}/items${suffix ? `?${suffix}` : ''}`);
};

/**
 * Include or exclude items. Pass explicit ids, or `filters` to mean "everything
 * currently listed" — which avoids POSTing hundreds of ids to ignore a database.
 */
export const setItemsStatus = (
  status: 'pending' | 'skipped',
  target: { itemIds?: number[]; filters?: ItemFilters },
  provider = 'notion',
) =>
  api<{ ok: boolean; changed: number; stats: SyncStats }>(`/integrations/${provider}/items/status`, {
    method: 'POST', body: JSON.stringify({ status, ...target }),
  });

export const getLatestRun = (provider = 'notion') =>
  api<{ run: SyncRun | null }>(`/integrations/${provider}/run`).then(r => r.run);

export const cancelRun = (runId: number) =>
  api<{ ok: boolean; stopping: boolean }>(`/integrations/runs/${runId}/cancel`, { method: 'POST' });

/**
 * Shared SSE reader for discover/sync. Both stream `progress` frames and end
 * with `done` or `error`, so the caller just supplies the path and a body.
 */
async function streamRun(
  path: string,
  body: unknown,
  onProgress: (p: SyncProgress) => void,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${getBaseURL()}/api/hq${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try { message = (await res.json()).error || message; } catch { /* keep default */ }
    throw new Error(message);
  }
  if (!res.body) throw new Error('No response stream');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: Record<string, unknown> | null = null;
  let failure: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split('\n\n');
    buffer = frames.pop() || '';

    for (const frame of frames) {
      const lines = frame.split('\n');
      const eventLine = lines.find(l => l.startsWith('event: '));
      const dataLine = lines.find(l => l.startsWith('data: '));
      if (!eventLine || !dataLine) continue;

      const event = eventLine.slice(7).trim();
      let payload: unknown;
      try { payload = JSON.parse(dataLine.slice(6)); } catch { continue; }

      if (event === 'progress') onProgress(payload as SyncProgress);
      else if (event === 'done') result = payload as Record<string, unknown>;
      else if (event === 'error') failure = (payload as { error: string }).error;
    }
  }

  if (failure) throw new Error(failure);
  return result ?? {};
}

/**
 * Watermarked by default — only pages edited since the last pass, which is one
 * request rather than nine when nothing has moved. `full` re-reads everything
 * and is the only way to notice a page deleted in Notion.
 */
export const discoverSource = (
  onProgress: (p: SyncProgress) => void, full = false, provider = 'notion',
) => streamRun(`/integrations/${provider}/discover`, { full }, onProgress);

/**
 * Starts a run and returns its id immediately. The run is NOT tied to this
 * request — closing the tab leaves it going, and `listRuns` reads its progress
 * back from the database. That's why there's no onProgress here.
 */
export const startSourceSync = (
  target: { itemIds?: number[]; filters?: ItemFilters; label?: string },
  provider = 'notion',
) =>
  api<{ ok: boolean; runId: number; total: number }>(`/integrations/${provider}/sync`, {
    method: 'POST', body: JSON.stringify(target),
  });

export const listRuns = (limit = 20) =>
  api<{ runs: SyncRun[] }>(`/integrations/runs?limit=${limit}`).then(r => r.runs);

/** The pages one run worked on, and how each turned out. */
export const listRunItems = (runId: number) =>
  api<{ items: SyncItem[] }>(`/integrations/runs/${runId}/items`).then(r => r.items);

// ─── Employees ───────────────────────────────────────────────────────────────

import type {
  Worker, WorkerCapabilities, WorkerConversation, WorkerMessage,
  Job, MediaItem, MediaFolder, MediaConversationGroup, WorkerEvent, Report, Lesson, WorkerSpend,
} from '../types';

/** What HQ costs to run. Deliberately not on the per-agent admin page. */
export const getHQUsage = (days = 30) =>
  api<import('../types').HQUsage>(`/usage?days=${days}`);

export const listWorkers = () =>
  api<{ workers: Worker[]; capabilities: WorkerCapabilities }>('/workers');

export const getWorker = (slug: string) =>
  api<{ worker: Worker; conversations: WorkerConversation[]; spend: WorkerSpend | null }>(
    `/workers/${slug}`);

// ─── What she has been given ────────────────────────────────────────────────

/**
 * Upload to her briefcase (no conversation) or to one conversation.
 *
 * Multipart, so no JSON Content-Type — setting it by hand strips the boundary
 * and multer sees an empty body.
 */
export async function uploadWorkerFile(
  slug: string,
  file: File,
  opts: { conversationId?: number | null; label?: string; kind?: string } = {},
) {
  const body = new FormData();
  body.append('file', file);
  if (opts.label) body.append('label', opts.label);
  if (opts.kind) body.append('kind', opts.kind);

  const path = opts.conversationId
    ? `/workers/${slug}/conversations/${opts.conversationId}/files`
    : `/workers/${slug}/files`;

  const res = await fetch(`${getBaseURL()}/api/hq${path}`, { method: 'POST', body });
  if (!res.ok) {
    let message = `Upload failed (${res.status})`;
    try { message = (await res.json()).error || message; } catch { /* keep default */ }
    throw new Error(message);
  }
  return (await res.json()).file as import('../types').WorkerFile;
}

export const listWorkerFiles = (slug: string, conversationId?: number | null) =>
  api<{ files: import('../types').WorkerFile[] }>(
    `/workers/${slug}/files${conversationId ? `?conversationId=${conversationId}` : ''}`,
  ).then(r => r.files);

/** Off rather than deleted, for a guide you are between versions of. */
export const setWorkerFileActive = (id: number, active: boolean) =>
  api<{ file: import('../types').WorkerFile }>(`/workers/files/${id}`, {
    method: 'PATCH', body: JSON.stringify({ active }),
  }).then(r => r.file);

export const deleteWorkerFile = (id: number) =>
  api<{ ok: boolean }>(`/workers/files/${id}`, { method: 'DELETE' });

/** The employment definition is meant to be edited — that's the whole point. */
export const updateWorker = (slug: string, patch: Partial<{
  name: string; roleTitle: string; tagline: string; avatar: string;
  accent: string; roleDefinition: string; model: string; tools: string[];
  /** Which model writes the actual copy. Changing it changes nothing else. */
  phrasingModel: string | null;
  /** Her default picture model. null means she picks per brief. */
  imageModel: string | null;
}>) =>
  api<{ worker: Worker }>(`/workers/${slug}`, { method: 'PATCH', body: JSON.stringify(patch) })
    .then(r => r.worker);

/**
 * What a worker has learned. Shown next to the job description because they are
 * the same kind of thing — instructions that shape every answer.
 */
export const listLessons = (slug: string) =>
  api<{ lessons: Lesson[] }>(`/workers/${slug}/lessons`).then(r => r.lessons);

export const addLesson = (slug: string, lesson: string) =>
  api<{ lesson: Lesson }>(`/workers/${slug}/lessons`, {
    method: 'POST', body: JSON.stringify({ lesson }),
  }).then(r => r.lesson);

export const updateLesson = (id: number, patch: { lesson?: string; active?: boolean }) =>
  api<{ lesson: Lesson }>(`/workers/lessons/${id}`, {
    method: 'PATCH', body: JSON.stringify(patch),
  }).then(r => r.lesson);

export const deleteLesson = (id: number) =>
  api<{ ok: boolean }>(`/workers/lessons/${id}`, { method: 'DELETE' });

export const newConversation = (slug: string, title?: string) =>
  api<{ conversation: WorkerConversation }>(`/workers/${slug}/conversations`, {
    method: 'POST', body: JSON.stringify({ title }),
  }).then(r => r.conversation);

export const getConversation = (slug: string, id: number) =>
  api<{
    conversation: WorkerConversation | null;
    messages: WorkerMessage[]; jobs: Job[]; media: MediaItem[]; reports: Report[];
  }>(`/workers/${slug}/conversations/${id}`);

/**
 * Which models this conversation uses, overriding the employee's defaults.
 * Only the keys you pass are touched — null on any of them means "follow her
 * default" rather than "pick nothing".
 */
export const setConversationModels = (
  slug: string,
  id: number,
  patch: { model?: string | null; phrasingModel?: string | null; imageModel?: string | null },
) =>
  api<{ conversation: WorkerConversation }>(`/workers/${slug}/conversations/${id}`, {
    method: 'PATCH', body: JSON.stringify(patch),
  }).then(r => r.conversation);

/** Models a worker can be switched between, from the platform's own list. */
export const WORKER_MODELS = [
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6', about: 'Fast and sharp. The default.' },
  { id: 'claude-opus-4-7',   label: 'Opus 4.7',   about: 'Best reasoning. Slower and dearer.' },
];

export const listReports = (conversationId?: number) =>
  api<{ reports: Report[] }>(`/reports${conversationId ? `?conversationId=${conversationId}` : ''}`)
    .then(r => r.reports);

/** A report is a page you open, not JSON — this is the link to hand someone. */
export const reportUrl = (id: number) => `${getBaseURL()}/api/hq/reports/${id}/view`;

export const listJobs = (slug: string) =>
  api<{ jobs: Job[] }>(`/workers/${slug}/jobs`).then(r => r.jobs);

export const cancelJob = (jobId: number) =>
  api<{ ok: boolean; stopping: boolean }>(`/workers/jobs/${jobId}/cancel`, { method: 'POST' });

/**
 * Send a message and watch the worker work.
 *
 * The stream is a WINDOW, not the work itself — jobs and media are written
 * server-side as they happen, so losing this connection costs you the live
 * view and nothing else. Reload and the job is still there.
 */
export async function sendToWorker(
  slug: string,
  conversationId: number,
  message: string,
  onEvent: (e: WorkerEvent) => void,
): Promise<{ text: string; jobId: number | null; media: MediaItem[]; jobs: Job[] }> {
  const res = await fetch(`${getBaseURL()}/api/hq/workers/${slug}/conversations/${conversationId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  if (!res.ok || !res.body) throw new Error(`Request failed (${res.status})`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: { text: string; jobId: number | null; media: MediaItem[]; jobs: Job[] } | null = null;
  let failure: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split('\n\n');
    buffer = frames.pop() || '';
    for (const frame of frames) {
      const ev = frame.match(/^event: (.*)$/m)?.[1];
      const data = frame.match(/^data: (.*)$/m)?.[1];
      if (!ev || !data) continue;
      let payload: unknown;
      try { payload = JSON.parse(data); } catch { continue; }

      if (ev === 'event') onEvent(payload as WorkerEvent);
      else if (ev === 'done') result = payload as typeof result;
      else if (ev === 'error') failure = (payload as { error: string }).error;
    }
  }

  if (failure) throw new Error(failure);
  return result ?? { text: '', jobId: null, media: [], jobs: [] };
}

// ─── Media library ───────────────────────────────────────────────────────────

export const listMedia = (params: {
  conversationId?: number; folderId?: number; jobId?: number; workerId?: number;
} = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, String(v)); });
  const suffix = qs.toString();
  return api<{ items: MediaItem[] }>(`/media${suffix ? `?${suffix}` : ''}`).then(r => r.items);
};

export const mediaByConversation = () =>
  api<{ conversations: MediaConversationGroup[] }>('/media/by-conversation').then(r => r.conversations);

export const listMediaFolders = () =>
  api<{ folders: MediaFolder[] }>('/media/folders').then(r => r.folders);

export const createMediaFolder = (name: string) =>
  api<{ folder: MediaFolder }>('/media/folders', { method: 'POST', body: JSON.stringify({ name }) })
    .then(r => r.folder);

export const moveMedia = (mediaIds: number[], folderId: number | null) =>
  api<{ ok: boolean; moved: number }>('/media/move', {
    method: 'POST', body: JSON.stringify({ mediaIds, folderId }),
  });

export const deleteMedia = (id: number) =>
  api<{ ok: boolean }>(`/media/${id}`, { method: 'DELETE' });
