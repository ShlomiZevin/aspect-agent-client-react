/**
 * Client API for Aspect Intelligence. Talks to /api/insights/* on the agent
 * server — a separate product from Aspect BI (/api/bi), see insightsService's
 * server counterpart at aspect-agent-server/insights/routes/insights.routes.js.
 */
import type { InsightSummary, TrackedMetric, InsightDetail, InvestigateResult, IntelligenceDatasetMeta, ActionPlan, InvestigationProgress } from '../types/insights';

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
  /**
   * The example questions this dataset's hero should offer.
   *
   * Per dataset, because the chips used to be the same three for everyone —
   * and two of them ask about stores and margins, which some clients simply do
   * not have. A suggestion the product then refuses is worse than none.
   */
  getExamplePrompts: (datasetId: string) =>
    request<{ examplePrompts: string[] }>(`/${encodeURIComponent(datasetId)}/prompts`)
      .then(r => r.examplePrompts)
      .catch(() => []),

  listDatasets: () => request<{ datasets: IntelligenceDatasetMeta[] }>('').then(r => r.datasets),

  // Reports are private per anonymous browser session — every call below
  // (except classifyPrompt, which touches no storage, and bootstrap, which
  // is an admin/dataset-level seed action) requires the same userId the
  // embedded chat widget already uses, so "your reports" and "your chats"
  // are scoped to the same session (see IntelligenceShell's UserProvider).

  // Separate endpoints, not one combined "feed", so the UI loads/renders
  // each independently.
  getInsights: (datasetId: string, userId: string) =>
    request<{ insights: InsightSummary[] }>(`/${datasetId}/insights?userId=${encodeURIComponent(userId)}`).then(r => r.insights),

  /** The subset of insights currently marked `tracked` (via setTracked), as strip cards — see insights.routes.js. */
  getTracked: (datasetId: string, userId: string) =>
    request<{ tracked: TrackedMetric[] }>(`/${datasetId}/tracked?userId=${encodeURIComponent(userId)}`).then(r => r.tracked),

  getInsight: (datasetId: string, userId: string, insightId: string) =>
    request<InsightDetail>(`/${datasetId}/${insightId}?userId=${encodeURIComponent(userId)}`),

  /** `jobId` is the client-generated progress key — the server reports real pipeline stages against it (see getProgress). */
  investigate: (datasetId: string, userId: string, prompt: string, jobId?: string) =>
    request<InvestigateResult>(`/${datasetId}/investigate`, {
      method: 'POST',
      body: JSON.stringify({ userId, prompt, jobId }),
    }),

  /**
   * Real pipeline stage for a running investigation. Polled while the
   * (long, 30-100s) investigate POST is still open, so the progress bar
   * reflects what the server is actually doing instead of a guessed timer.
   * Rejects with 404 once the job is unknown to this instance — callers
   * treat that as "fall back to an estimate", not as an error.
   */
  getProgress: (datasetId: string, jobId: string) =>
    request<InvestigationProgress>(`/${datasetId}/progress/${encodeURIComponent(jobId)}`),

  /** Runs the dataset's curated bootstrap prompt set (admin panel "Run bootstrap now") — dataset-level, no user scope. */
  bootstrap: (datasetId: string) =>
    request<{ created: number; insightIds: string[] }>(`/${datasetId}/bootstrap`, { method: 'POST' }),

  /** "Gentle helper" — is this typed prompt a quick lookup (suggest Data Chat) or a real investigation? Stateless, no user scope. */
  classifyPrompt: (datasetId: string, prompt: string) =>
    request<{ isSimpleQuery: boolean }>(`/${datasetId}/classify-prompt`, {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    }),

  /** Toggles whether an insight shows up in "Tracked by you" — the only way anything lands in that strip. */
  setTracked: (datasetId: string, userId: string, insightId: string, tracked: boolean) =>
    request<{ id: string; tracked: boolean }>(`/${datasetId}/${insightId}/track`, {
      method: 'POST',
      body: JSON.stringify({ userId, tracked }),
    }),

  /** "Manage tracking" drag-to-reorder — sends the complete new order, returns the re-sorted list. */
  reorderTracked: (datasetId: string, userId: string, insightIds: string[]) =>
    request<{ tracked: TrackedMetric[] }>(`/${datasetId}/tracked/reorder`, {
      method: 'POST',
      body: JSON.stringify({ userId, insightIds }),
    }).then(r => r.tracked),

  /** Only works for generated insights (isGenerated: true) — seed content has no delete path. */
  deleteInsight: (datasetId: string, userId: string, insightId: string) =>
    request<{ deleted: true }>(`/${datasetId}/${insightId}?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' }),

  /** "Open <cta> plan" — generates (or returns the server's cached) action plan for this insight. */
  getActionPlan: (datasetId: string, userId: string, insightId: string) =>
    request<ActionPlan>(`/${datasetId}/${insightId}/plan`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),
};
