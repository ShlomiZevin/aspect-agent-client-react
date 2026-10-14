/**
 * Admin API for Aspect Intelligence — talks to /api/admin/intelligence/* on
 * the agent server (aspect-agent-server/insights/routes/insights-admin.routes.js).
 * Separate from insightsService.ts (the public, per-dataset product API);
 * this one covers all datasets at once for the admin panel.
 */
import { apiRequest, getBaseURL } from './api';
import type { InsightDetail } from '../types/insights';
import type { QuickQuestion } from '../types/agent';

export interface IntelligenceDatasetConfig {
  enabled: boolean;
  dataModelDescription: string;
  brandLabel: string;
  bootstrapPrompts: string[];
  examplePrompts: string[];
  /** Data Chat quick-question tiles (task #63) — overrides the agent's hardcoded quickQuestions when non-empty. */
  quickQuestions: QuickQuestion[];
}

export interface IntelligenceAdminDataset {
  id: string;
  name: string;
  description: string;
  logoText: string;
  gradientFrom: string;
  gradientTo: string;
  config: IntelligenceDatasetConfig;
  insightCount: number;
  trackedCount: number;
  /** Usage — null when the server could not count it (the list still loads). */
  activity: DatasetActivity | null;
}

/**
 * How much a dataset is used (insights/services/dataset-activity.service.js).
 * Conversations exclude our own test traffic (replay batteries, Playground).
 * Apps exclude archived ones; Otto vs MCP is by where the app was built.
 */
export interface DatasetActivity {
  conversations: number;
  conversations30d: number;
  users: number;
  lastConversationAt: string | null;
  ottoApps: number;
  mcpApps: number;
  publishedApps: number;
}

/** One real chat conversation of a dataset (test traffic excluded). */
export interface DatasetConversation {
  id: number;
  /** What the admin's per-user conversation viewer opens by; null rows can't be opened there. */
  externalId: string | null;
  userId: number | null;
  /** Email, name or visitor id — whatever identifies the user best. */
  user: string | null;
  channel: string | null;
  startedAt: string;
  lastMessageAt: string;
  messageCount: number;
  firstQuestion: string | null;
}

/** One custom app of a dataset. */
export interface DatasetApp {
  id: string;
  title: { en?: string; he?: string } | null;
  summary: { en?: string; he?: string } | null;
  status: 'draft' | 'ready' | 'active' | 'archived';
  /** Built in Otto, or through the AI builder door with the client's own AI tool. */
  origin: 'otto' | 'mcp';
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  lastBuild: { status: 'running' | 'succeeded' | 'failed'; finishedAt: string | null } | null;
}

/** One project's own Overview page (GET /datasets/:id/overview). */
export interface DatasetOverview {
  id: string;
  insightCount: number;
  trackedCount: number;
  activity: DatasetActivity | null;
  /** Null for a dataset with no data loader (e.g. the aspect demo). */
  data: { firstDataDate: string | null; lastDataDate: string | null; lastLoadAt: string | null } | null;
  lastCycle: {
    importStartedAt: string | null;
    importCompletedAt: string | null;
    importStatus: string | null;
    totalRows: number | null;
    indexCompletedAt: string | null;
    indexStatus: string | null;
    durationMs: number | null;
  } | null;
  recentInsights: Array<Pick<InsightDetail, 'id' | 'headline' | 'category' | 'categoryLabel' | 'impactValue' | 'impactDirection'> & {
    tracked: boolean;
    createdAt: number | null;
  }>;
}

/** One past content snapshot for a single section — 'config' entries carry brandLabel/dataModelDescription, 'prompts' entries carry bootstrapPrompts/examplePrompts; the other section's fields are absent, not just empty. */
export interface IntelligenceConfigVersion {
  savedAt: number;
  brandLabel?: string;
  dataModelDescription?: string;
  bootstrapPrompts?: string[];
  examplePrompts?: string[];
}

export const intelligenceAdminService = {
  listDatasets: (baseURL?: string) =>
    apiRequest<{ datasets: IntelligenceAdminDataset[] }>(
      '/api/admin/intelligence/datasets',
      { method: 'GET' },
      baseURL || getBaseURL()
    ).then(r => r.datasets),

  getOverview: (datasetId: string, baseURL?: string) =>
    apiRequest<DatasetOverview>(
      `/api/admin/intelligence/datasets/${datasetId}/overview`,
      { method: 'GET' },
      baseURL || getBaseURL()
    ),

  listConversations: (datasetId: string, baseURL?: string) =>
    apiRequest<{ conversations: DatasetConversation[] }>(
      `/api/admin/intelligence/datasets/${datasetId}/conversations`,
      { method: 'GET' },
      baseURL || getBaseURL()
    ).then(r => r.conversations),

  listApps: (datasetId: string, baseURL?: string) =>
    apiRequest<{ apps: DatasetApp[] }>(
      `/api/admin/intelligence/datasets/${datasetId}/apps`,
      { method: 'GET' },
      baseURL || getBaseURL()
    ).then(r => r.apps),

  updateConfig: (datasetId: string, patch: Partial<IntelligenceDatasetConfig>, baseURL?: string) =>
    apiRequest<{ id: string; config: IntelligenceDatasetConfig }>(
      `/api/admin/intelligence/datasets/${datasetId}`,
      { method: 'PUT', body: JSON.stringify(patch) },
      baseURL || getBaseURL()
    ),

  listInsights: (datasetId: string, baseURL?: string) =>
    apiRequest<{ insights: InsightDetail[] }>(
      `/api/admin/intelligence/datasets/${datasetId}/insights`,
      { method: 'GET' },
      baseURL || getBaseURL()
    ).then(r => r.insights),

  /** Cross-user — removes an insight regardless of which anonymous session owns it (see insights-admin.routes.js). */
  deleteInsight: (datasetId: string, insightId: string, baseURL?: string) =>
    apiRequest<{ deleted: true }>(
      `/api/admin/intelligence/datasets/${datasetId}/insights/${insightId}`,
      { method: 'DELETE' },
      baseURL || getBaseURL()
    ),

  /** Cross-user — toggles "tracked" regardless of which anonymous session owns it (see insights-admin.routes.js). */
  setTracked: (datasetId: string, insightId: string, tracked: boolean, baseURL?: string) =>
    apiRequest<{ id: string; tracked: boolean }>(
      `/api/admin/intelligence/datasets/${datasetId}/insights/${insightId}/track`,
      { method: 'POST', body: JSON.stringify({ tracked }) },
      baseURL || getBaseURL()
    ),

  /** Introspects the real DB schema and drafts a plain-language data model description — not saved, caller reviews then calls updateConfig. */
  generateDescription: (datasetId: string, baseURL?: string) =>
    apiRequest<{ dataModelDescription: string }>(
      `/api/admin/intelligence/datasets/${datasetId}/generate-description`,
      { method: 'POST' },
      baseURL || getBaseURL()
    ).then(r => r.dataModelDescription),

  /** Version history for one section ('config' | 'prompts'), newest first — every Save on that section's own page snapshots its prior state here. Config and Prompts are versioned independently. */
  listVersions: (datasetId: string, section: 'config' | 'prompts', baseURL?: string) =>
    apiRequest<{ versions: IntelligenceConfigVersion[] }>(
      `/api/admin/intelligence/datasets/${datasetId}/versions/${section}`,
      { method: 'GET' },
      baseURL || getBaseURL()
    ).then(r => r.versions),

  /** Restores a past version of one section — the pre-restore state is itself snapshotted, so this is undoable too. */
  restoreVersion: (datasetId: string, section: 'config' | 'prompts', savedAt: number, baseURL?: string) =>
    apiRequest<{ id: string; config: IntelligenceDatasetConfig }>(
      `/api/admin/intelligence/datasets/${datasetId}/versions/${section}/${savedAt}/restore`,
      { method: 'POST' },
      baseURL || getBaseURL()
    ),

  /** Permanently removes one version entry — doesn't touch the live config. */
  deleteVersion: (datasetId: string, section: 'config' | 'prompts', savedAt: number, baseURL?: string) =>
    apiRequest<{ deleted: true }>(
      `/api/admin/intelligence/datasets/${datasetId}/versions/${section}/${savedAt}`,
      { method: 'DELETE' },
      baseURL || getBaseURL()
    ),

  /** Proposes one new example prompt, distinct from `existingPrompts` — not saved, caller reviews then adds it. */
  generateExamplePrompt: (datasetId: string, existingPrompts: string[], baseURL?: string) =>
    apiRequest<{ prompt: string }>(
      `/api/admin/intelligence/datasets/${datasetId}/generate-example-prompt`,
      { method: 'POST', body: JSON.stringify({ existingPrompts }) },
      baseURL || getBaseURL()
    ).then(r => r.prompt),
};
