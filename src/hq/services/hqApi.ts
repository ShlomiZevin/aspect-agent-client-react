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

export const listSyncItems = (params: ItemFilters = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, String(v)); });
  const suffix = qs.toString();
  return api<{ items: SyncItem[]; stats: SyncStats }>(`/integrations/notion/items${suffix ? `?${suffix}` : ''}`);
};

/**
 * Include or exclude items. Pass explicit ids, or `filters` to mean "everything
 * currently listed" — which avoids POSTing hundreds of ids to ignore a database.
 */
export const setItemsStatus = (
  status: 'pending' | 'skipped',
  target: { itemIds?: number[]; filters?: ItemFilters },
) =>
  api<{ ok: boolean; changed: number; stats: SyncStats }>('/integrations/notion/items/status', {
    method: 'POST', body: JSON.stringify({ status, ...target }),
  });

export const getLatestRun = () =>
  api<{ run: SyncRun | null }>('/integrations/notion/run').then(r => r.run);

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
export const discoverNotion = (onProgress: (p: SyncProgress) => void, full = false) =>
  streamRun('/integrations/notion/discover', { full }, onProgress);

/**
 * Starts a run and returns its id immediately. The run is NOT tied to this
 * request — closing the tab leaves it going, and `listRuns` reads its progress
 * back from the database. That's why there's no onProgress here.
 */
export const startNotionSync = (target: { itemIds?: number[]; filters?: ItemFilters; label?: string }) =>
  api<{ ok: boolean; runId: number; total: number }>('/integrations/notion/sync', {
    method: 'POST', body: JSON.stringify(target),
  });

export const listRuns = (limit = 20) =>
  api<{ runs: SyncRun[] }>(`/integrations/runs?limit=${limit}`).then(r => r.runs);

/** The pages one run worked on, and how each turned out. */
export const listRunItems = (runId: number) =>
  api<{ items: SyncItem[] }>(`/integrations/runs/${runId}/items`).then(r => r.items);
