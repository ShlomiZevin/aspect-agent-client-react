/**
 * Client API for the real-estate demo screens (live sales board, AI advisor
 * brief). Server: aspect-agent-server/agents/realestate/routes.js.
 */
import { apiRequest, getBaseURL } from './api';

// In dev the Vite proxy serves /api. Not '' — apiRequest treats an empty base
// as "none" and falls back to the production server.
const BASE = import.meta.env.DEV ? window.location.origin : getBaseURL();

export type UnitStatus = 'נמכרה' | 'שמורה' | 'פנויה';

export interface BoardUnit {
  id: number;
  floor: number;
  position: number;
  number: number;
  rooms: number;
  type: string;
  sqm: number;
  outdoorSqm: number;
  direction: string;
  view: string;
  price: number;
  status: UnitStatus;
  stuck: boolean;
  daysOnMarket: number;
  /** % above what the same kind of unit sold for in the project (unsold units over 180 days only). */
  premiumPct: number | null;
}

export interface BoardBuilding {
  building: number;
  pctSold: number;
  units: BoardUnit[];
}

export interface BoardProject {
  id: number;
  name: string;
  city: string;
  region: string;
  floors: number;
  totalUnits: number;
  sold: number;
  reserved: number;
  free: number;
  pctSold: number;
  monthlyPace: number;
  sellOutDate: string | null;
  buildings: BoardBuilding[];
}

export interface BoardData {
  date: string;
  kpis: { totalUnits: number; soldUnits: number; pctSold: number; soldLast30Days: number };
  projects: BoardProject[];
  /** Three short overnight findings, composed from the data (not report titles). */
  insights: { id: string; icon: string; title: string }[];
}

/** A group of stuck apartments that share a cause (project, size, type, side). */
export interface StuckGroup {
  unitId: number;
  projectId: number;
  project: string;
  rooms: number;
  type: string;
  direction: string;
  units: number;
  minDays: number;
  maxDays: number;
  title: string;
  reason: string;
  action: string;
}

/** A share of buyers in one bucket. */
export interface Share { label: string; n: number; pct: number }

export interface MarketData {
  buyers: { purpose: Share[]; age: Share[]; decile: Share[]; homes: Share[]; gender: Share[]; profession: Share[] };
  sources: { source: string; leads: number; deals: number; conversionPct: number; costPerDeal: number | null }[];
  projects: { name: string; city: string; region: string; pctSold: number; monthlyPace: number; leads: number; pricePerSqm: number }[];
  rooms: { rooms: number; demand: number; freeUnits: number; avgSqm: number }[];
  segments: { segment: string; best: string; bestRate: number; worst: string; worstRate: number }[];
}

export interface BriefData {
  date: string;
  intro: string;
  kpis: {
    calls: { count: number; sub: string };
    stuck: { count: number; sub: string };
    leakage: { amount: string; sub: string };
  };
  calls: { leadId: number; name: string; phone: string; project: string; rep: string; score: number; daysWithoutContact: number; reason: string }[];
  stuck: StuckGroup[];
  leakage: { amount: string; amountSub: string; bullets: string[] };
}

/** An Intelligence report (server: insights/routes/insights.routes.js), as the demo reads it. */
export interface ReportSummary {
  id: string;
  categoryLabel: string;
  confidence: number;
  headline: string;
  impactValue: string;
  impactLabel: string;
  impactDirection: 'positive' | 'negative' | 'neutral';
  /** True for the dataset's shared reports; absent on the visitor's own. */
  shared?: boolean;
  chartPreview?: { categories: string[]; series: { points: number[] }[] };
}

export type ReportBlock =
  | { type: 'stat_callout'; label: string; value: string; description?: string }
  | { type: 'ranked_list'; title?: string; unit?: string; items: { label: string; value: string; pct: number }[] }
  | { type: 'comparison'; items: { label: string; value: string; sub?: string; direction?: string }[] }
  | { type: 'scenarios'; items: { key: string; label: string; value: string; description?: string }[] };

export interface ReportDetail extends ReportSummary {
  title: string;
  chart?: { title: string; unit?: string; categories: string[]; series: { key: string; label: string; points: number[] }[] };
  blocks: ReportBlock[];
  reasoning: { title: string; description: string }[];
  sourceNote?: string;
  confidenceBasis?: string;
}

/** Live progress of a report being written (server: investigation-progress.service.js). */
export interface ReportProgress {
  stage: 'plan' | 'query' | 'aggregate' | 'synthesize' | 'verify' | 'done' | 'failed';
  percent: number;
  done: boolean;
  failed: boolean;
  etaMs?: number;
}

// Reports belong to the visitor's anonymous chat user: the list is their own
// new reports plus the dataset's shared ones (written by the "system" user at
// bootstrap), so nobody sees another visitor's reports and nobody signs in.
const q = (userId: string) => `userId=${encodeURIComponent(userId)}`;

export const realestateService = {
  getBoard: () => apiRequest<BoardData>('/api/realestate/board', {}, BASE),
  getBrief: () => apiRequest<BriefData>('/api/realestate/brief', {}, BASE),
  getMarket: () => apiRequest<MarketData>('/api/realestate/market', {}, BASE),
  getReports: (userId: string) => apiRequest<{ insights: ReportSummary[] }>(`/api/insights/realestate/insights?${q(userId)}`, {}, BASE).then(r => r.insights),
  getReport: (id: string, userId: string) => apiRequest<ReportDetail>(`/api/insights/realestate/${encodeURIComponent(id)}?${q(userId)}`, {}, BASE),
  /** Writes a new report (2-3 minutes); resolves with its id. Poll getReportProgress(jobId) meanwhile. */
  createReport: (prompt: string, userId: string, jobId: string) =>
    apiRequest<{ insightIds: string[] }>('/api/insights/realestate/investigate', { method: 'POST', body: JSON.stringify({ prompt, userId, jobId }) }, BASE)
      .then(r => r.insightIds[0]),
  getReportProgress: (jobId: string) => apiRequest<ReportProgress>(`/api/insights/realestate/progress/${encodeURIComponent(jobId)}`, {}, BASE),
};
