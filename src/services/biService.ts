/**
 * Client API for the Aspect BI tool. Talks to /api/bi/* on the agent server.
 *
 * Base URL: in dev we use an empty base so requests go to a relative
 * `/api/bi/...` path and Vite proxies them to localhost:3000 (see
 * vite.config.ts). In prod we hit the deployed Cloud Run server.
 */
import type {
  DatasetSummary, DatasetModel, QuerySpec, QueryResult,
  Dashboard, DashboardSummary, DashboardDefinition,
} from '../types/bi';

const PROD_BASE = 'https://aspect-agent-server-1018338671074.europe-west1.run.app';
const BASE = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || PROD_BASE);

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}/api/bi${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) {
    let detail: string | null = null;
    try {
      const body = await res.json();
      detail = body?.error || body?.message || null;
    } catch { /* ignore */ }
    throw new Error(detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const biService = {
  listDatasets: () => request<DatasetSummary[]>('/datasets'),

  getDataset: (id: string) => request<DatasetModel>(`/datasets/${id}`),

  query: (dataset: string, spec: QuerySpec) =>
    request<QueryResult>('/query', {
      method: 'POST',
      body: JSON.stringify({ dataset, ...spec }),
    }),

  fieldValues: (dataset: string, fieldId: string, search?: string) =>
    request<{ values: string[] }>(
      `/datasets/${dataset}/values/${fieldId}${search ? `?search=${encodeURIComponent(search)}` : ''}`
    ).then(r => r.values),

  listDashboards: (dataset?: string) =>
    request<DashboardSummary[]>(`/dashboards${dataset ? `?dataset=${dataset}` : ''}`),

  getDashboard: (id: number) => request<Dashboard>(`/dashboards/${id}`),

  createDashboard: (datasetId: string, name: string, definition: DashboardDefinition) =>
    request<Dashboard>('/dashboards', {
      method: 'POST',
      body: JSON.stringify({ datasetId, name, definition }),
    }),

  updateDashboard: (id: number, patch: { name?: string; definition?: DashboardDefinition }) =>
    request<Dashboard>(`/dashboards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),

  deleteDashboard: (id: number) =>
    request<{ deleted: boolean }>(`/dashboards/${id}`, { method: 'DELETE' }),
};
