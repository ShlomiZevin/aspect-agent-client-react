/**
 * Lybi Gate (beta) — the client of /api/gate (server: aspect-agent-server/gate/).
 * The management center's session token rides on every call, like
 * manageService; a 401 hands over to the center's own sign-out (it re-checks
 * /me, which drops the session and shows the sign-in screen).
 */

import { getBaseURL } from '../../../services/api';
import { manageService } from '../../../services/manageService';
import { getToken } from '../../session';

export type GateAction = 'pass' | 'hide' | 'token' | 'enc' | 'conv';
export type GateBy = 'detector' | 'name' | 'none';

export interface GateField { field: string; detected: string; by: GateBy; action: GateAction; isNew?: boolean }
export interface GatePolicy {
  id: number; version: number; status: 'draft' | 'signed'; fields: GateField[];
  signature: string | null; signedBy: string | null; signedAt: string | null; createdAt: string; updatedAt: string;
}
export interface GateVersion extends GatePolicy { valid: boolean | null }
export interface GateKey { id: string; name: string; prefix: string; createdBy: string | null; createdAt: string; lastUsedAt: string | null; revokedAt: string | null; active: boolean; key?: string }
export interface GateConnection {
  id: string; kind: 'lookup' | 'handoff'; name: string; method: 'GET' | 'POST'; url: string; sendFields: string[];
  authHeader: string | null; hasSecret: boolean; enabled: boolean; lastCalledAt: string | null; lastStatus: string | null;
}
export interface GateStoredValue { a: GateAction; v?: string; t?: string; enc?: string; empty?: boolean }
export type GateData = Record<string, GateStoredValue>;
export interface GateRecord {
  id: string; source: 'api' | 'file' | 'bank'; externalRef: string | null; policyVersion: number | null;
  data: GateData; modelView: Record<string, string>; createdAt: string; answers?: GateRecord[];
}
export interface GateLogRow {
  id: number; at: string; kind: string; direction: 'in' | 'out' | 'admin'; status: 'ok' | 'rejected' | 'error';
  httpStatus: number | null; actor: string | null; connectionId: string | null; recordId: string | null;
  policyVersion: number | null; summary: Record<string, unknown>; durationMs: number | null;
}
export interface GateOverview {
  configured: boolean;
  bankKey: { name: string; fingerprint: string; createdAt: string } | null;
  policy: {
    signed: { version: number; signedBy: string | null; signedAt: string | null; fields: number } | null;
    draft: { version: number; fields: number; newFields: number } | null;
  };
  keys: { active: number; total: number };
  connections: { id: string; kind: string; name: string; enabled: boolean; lastStatus: string | null; lastCalledAt: string | null }[];
  records: Record<string, number>;
  today: { kind: string; status: string; n: number }[];
}
export interface GateIngestResult { policyVersion: number | null; records: { id: string; externalRef: string | null; actions: Record<string, GateAction> }[]; newFields: string[] }
export interface GateCallResult {
  ok: boolean; httpStatus: number; ms: number; sent: Record<string, GateAction>; skipped: string[];
  request: { ref: string; fields: Record<string, { value?: string; token?: string; enc?: string }> };
  error?: string;
  answer?: { recordId?: string; stored?: GateData; modelView?: Record<string, string>; newFields?: string[]; received?: number; opened?: { field: string; ok: boolean; sealed: boolean }[]; reference?: string };
}
export interface GateDryRun { policyVersion: number | null; policyStatus: string | null; stored: GateData; modelView: Record<string, string>; unknown: string[] }

export class GateApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly fields: string[] | null;
  constructor(message: string, status: number, code: string | null, fields: string[] | null) {
    super(message); this.name = 'GateApiError'; this.status = status; this.code = code; this.fields = fields;
  }
}

/** The server root (the same rule as manageService). */
export const gateRoot = () => `${import.meta.env.DEV && !import.meta.env.VITE_API_URL ? 'http://localhost:3000' : getBaseURL()}/api/gate`;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${gateRoot()}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: string; code?: string; fields?: string[] } | null;
    if (res.status === 401) manageService.getMe().catch(() => { /* the center signs out */ });
    throw new GateApiError(body?.error || `${res.status} ${res.statusText}`, res.status, body?.code ?? null, body?.fields ?? null);
  }
  return res.json() as Promise<T>;
}

const post = <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) });

export const gateApi = {
  overview: () => request<GateOverview>('/overview'),
  policy: () => request<{ signed: GatePolicy | null; draft: GatePolicy | null; publicKeyPem: string | null }>('/policy'),
  updateDraft: (changes: { field: string; action: GateAction }[]) =>
    request<{ draft: GatePolicy }>('/policy/draft', { method: 'PUT', body: JSON.stringify({ changes }) }),
  learn: (records: Record<string, unknown>[]) => post<{ draft: GatePolicy; added: string[] }>('/policy/learn', { records }),
  sign: (acceptNew: boolean) => post<{ signed: GatePolicy }>('/policy/sign', { acceptNew }),
  versions: () => request<{ versions: GateVersion[] }>('/policy/versions'),

  keys: () => request<{ keys: GateKey[] }>('/keys'),
  createKey: (name: string) => post<{ key: GateKey }>('/keys', { name }),
  revokeKey: (id: string) => request<{ key: GateKey }>(`/keys/${id}`, { method: 'DELETE' }),

  connections: () => request<{ connections: GateConnection[] }>('/connections'),
  createConnection: (c: Partial<GateConnection> & { authSecret?: string }) => post<{ connection: GateConnection }>('/connections', c),
  updateConnection: (id: string, c: Partial<GateConnection> & { authSecret?: string }) =>
    request<{ connection: GateConnection }>(`/connections/${id}`, { method: 'PUT', body: JSON.stringify(c) }),
  deleteConnection: (id: string) => request<{ ok: true }>(`/connections/${id}`, { method: 'DELETE' }),
  testConnection: (id: string) => post<{ ok: boolean; httpStatus: number; ms: number; error?: string }>(`/connections/${id}/test`),
  call: (id: string, recordId: string) => post<GateCallResult>(`/connections/${id}/call`, { recordId }),
  setupMockBank: () => post<{ bankKey: { name: string; fingerprint: string }; connections: GateConnection[] }>('/setup/mock-bank'),

  upload: (fileName: string, records: Record<string, unknown>[]) => post<GateIngestResult>('/upload', { fileName, records }),
  records: () => request<{ records: GateRecord[] }>('/records?limit=30'),
  record: (id: string) => request<{ record: GateRecord }>(`/records/${id}`),
  test: (record: Record<string, unknown>, useDraft: boolean) => post<GateDryRun>('/test', { record, useDraft }),
  log: () => request<{ log: GateLogRow[] }>('/log?limit=60'),
  sample: () => request<{ records: Record<string, unknown>[] }>('/sample'),
};
