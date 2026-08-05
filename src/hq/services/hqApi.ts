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

export const dropSimple = (input: string, kind = 'auto', title?: string) =>
  api<{ ok: boolean; type: string; atom: Atom }>('/drop', {
    method: 'POST',
    body: JSON.stringify({ input, kind, title }),
  });

export interface DropProgress { done: number; total: number; title: string }
export interface DropDone {
  ok: boolean; label: string; notionType: string;
  total: number; ingested: number;
  failures: { title: string; error: string }[];
}

/**
 * Notion imports stream SSE — a meetings database can be hundreds of pages and
 * a silent multi-minute request is indistinguishable from a hang.
 */
export async function dropNotionStreaming(
  input: string,
  kind: string,
  onProgress: (p: DropProgress) => void,
): Promise<DropDone> {
  const res = await fetch(`${getBaseURL()}/api/hq/drop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, kind }),
  });

  if (!res.ok || !res.body) throw new Error(`Import failed (${res.status})`);

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
      const eventLine = frame.split('\n').find(l => l.startsWith('event: '));
      const dataLine = frame.split('\n').find(l => l.startsWith('data: '));
      if (!eventLine || !dataLine) continue;

      const event = eventLine.slice(7).trim();
      let payload: unknown;
      try { payload = JSON.parse(dataLine.slice(6)); } catch { continue; }

      if (event === 'progress') onProgress(payload as DropProgress);
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

export const ask = (question: string) =>
  api<AskResult>('/ask', { method: 'POST', body: JSON.stringify({ question }) });
