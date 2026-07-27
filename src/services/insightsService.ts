/**
 * Client API for Aspect Intelligence. Talks to /api/insights/* on the agent
 * server — a separate product from Aspect BI (/api/bi), see insightsService's
 * server counterpart at aspect-agent-server/insights/routes/insights.routes.js.
 */
import type { InsightSummary, TrackedMetric, InsightDetail, InvestigateResult, IntelligenceDatasetMeta, ActionPlan } from '../types/insights';

const PROD_BASE = 'https://aspect-agent-server-1018338671074.europe-west1.run.app';
const BASE = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || PROD_BASE);

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}/api/insights${path}`, {
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

export const insightsService = {
  listDatasets: () => request<{ datasets: IntelligenceDatasetMeta[] }>('').then(r => r.datasets),

  // Separate endpoints, not one combined "feed", so the UI loads/renders
  // each independently.
  getInsights: (datasetId: string) => request<{ insights: InsightSummary[] }>(`/${datasetId}/insights`).then(r => r.insights),

  /** The subset of insights currently marked `tracked` (via setTracked), as strip cards — see insights.routes.js. */
  getTracked: (datasetId: string) => request<{ tracked: TrackedMetric[] }>(`/${datasetId}/tracked`).then(r => r.tracked),

  getInsight: (datasetId: string, insightId: string) =>
    request<InsightDetail>(`/${datasetId}/${insightId}`),

  investigate: (datasetId: string, prompt: string) =>
    request<InvestigateResult>(`/${datasetId}/investigate`, {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    }),

  /** Runs the dataset's curated bootstrap prompt set (admin panel "Run bootstrap now"). */
  bootstrap: (datasetId: string) =>
    request<{ created: number; insightIds: string[] }>(`/${datasetId}/bootstrap`, { method: 'POST' }),

  /** "Gentle helper" — is this typed prompt a quick lookup (suggest Data Chat) or a real investigation? */
  classifyPrompt: (datasetId: string, prompt: string) =>
    request<{ isSimpleQuery: boolean }>(`/${datasetId}/classify-prompt`, {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    }),

  /** Toggles whether an insight shows up in "Tracked by you" — the only way anything lands in that strip. */
  setTracked: (datasetId: string, insightId: string, tracked: boolean) =>
    request<{ id: string; tracked: boolean }>(`/${datasetId}/${insightId}/track`, {
      method: 'POST',
      body: JSON.stringify({ tracked }),
    }),

  /** "Manage tracking" drag-to-reorder — sends the complete new order, returns the re-sorted list. */
  reorderTracked: (datasetId: string, insightIds: string[]) =>
    request<{ tracked: TrackedMetric[] }>(`/${datasetId}/tracked/reorder`, {
      method: 'POST',
      body: JSON.stringify({ insightIds }),
    }).then(r => r.tracked),

  /** Only works for generated insights (isGenerated: true) — seed content has no delete path. */
  deleteInsight: (datasetId: string, insightId: string) =>
    request<{ deleted: true }>(`/${datasetId}/${insightId}`, { method: 'DELETE' }),

  /** "Open <cta> plan" — generates (or returns the server's cached) action plan for this insight. */
  getActionPlan: (datasetId: string, insightId: string) =>
    request<ActionPlan>(`/${datasetId}/${insightId}/plan`, { method: 'POST' }),
};
