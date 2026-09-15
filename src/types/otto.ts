/**
 * Otto custom screens — the client half of the server contract in
 * aspect-agent-server/otto/services/spec.contract.js. A screen is a JSON
 * spec (result sets + catalog blocks) rendered by OUR components; the
 * model never ships code, and the browser never sees a query surface —
 * only these shapes.
 */

import type { Localized } from './apps';

export type OttoScreenStatus = 'draft' | 'ready' | 'active' | 'archived';

export interface OttoScreenSummary {
  id: string;
  title: Localized;
  summary: Localized | null;
  icon: string;
  status: OttoScreenStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  hasSpec: boolean;
}

export interface OttoMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface OttoPlanRef {
  field?: string;
  label: Localized;
  detail?: Localized;
}

export interface OttoPlan {
  title: Localized;
  summary: Localized;
  icon?: string;
  sources: Array<{ id: string; label: Localized }>;
  columns: OttoPlanRef[];
  filters: OttoPlanRef[];
  kpis: OttoPlanRef[];
  charts?: OttoPlanRef[];
  actions: OttoPlanRef[];
  notes: Localized[];
  isChange?: boolean;
  changes: Localized[];
}

export interface OttoScreen {
  id: string;
  datasetId: string;
  title: Localized;
  summary: Localized | null;
  icon: string | null;
  plan: OttoPlan | Record<string, never>;
  screenSpec: ScreenSpec | null;
  conversation: OttoMessage[];
  status: OttoScreenStatus;
  /** The last PUBLISHED state — non-null means this app has been published
   *  at least once, which is what makes "Cancel changes" available (and
   *  hides plain Delete: cancel is the escape hatch for a published app). */
  publishedState?: unknown | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── the spec ─────────────────────────────────────────────────────────────

export type OttoFormat = 'money' | 'int' | 'decimal' | 'percent' | 'date' | 'text';
export type OttoTone = 'normal' | 'alarm' | 'warn' | 'good';

export interface ComputedColumn {
  id: string;
  label: Localized;
  expr: string;
  format?: OttoFormat;
}

export interface AggregateMeasure {
  id: string;
  agg: 'sum' | 'count' | 'avg' | 'min' | 'max';
  field?: string;
  label: Localized;
  format?: OttoFormat;
}

export interface ResultSetSpec {
  id: string;
  source: string;
  select?: string[];
  aggregate?: { groupBy: string[]; measures: AggregateMeasure[] };
  computed?: ComputedColumn[];
  where?: string;
  orderBy?: { field: string; dir?: 'asc' | 'desc' };
  limit?: number;
}

export interface KpiCard {
  id: string;
  label: Localized;
  sub?: Localized;
  agg: 'sum' | 'count' | 'countWhere' | 'avg' | 'min' | 'max';
  field?: string;
  where?: string;
  format?: OttoFormat;
  tone?: OttoTone;
}

export type ScreenBlock =
  | { kind: 'noteLine'; caveatIds: string[] }
  | { kind: 'kpiCards'; from: string; cards: KpiCard[] }
  | { kind: 'filterBar'; from: string; filters: string[] }
  | { kind: 'dataTable'; from: string; columns: string[]; sortable?: boolean; pageSize?: number }
  | { kind: 'chart'; from: string; variant: 'line' | 'bar'; category: string; series: string[]; title: Localized }
  | {
      kind: 'actionsBar';
      actions: Array<{
        id: string;
        type: 'exportCsv' | 'stub';
        from?: string;
        label: Localized;
        notice?: Localized;
      }>;
    };

export interface ScreenSpec {
  specVersion: 1;
  resultSets: ResultSetSpec[];
  blocks: ScreenBlock[];
}

// ── delivered data ───────────────────────────────────────────────────────

export type CellValue = string | number | null;

/** Every column travels with its own bilingual label, type and format —
 *  the renderer needs no other vocabulary. */
export interface ColumnMeta {
  id: string;
  label: Localized;
  type: 'text' | 'number' | 'date';
  format: OttoFormat;
}

export interface ResultSetData {
  columns: ColumnMeta[];
  rows: Array<Record<string, CellValue>>;
  total: number;
  truncated: boolean;
}

export interface ScreenDataPayload {
  resultSets: Record<string, ResultSetData>;
  kpis: Record<string, number | null>;
  caveats: Array<{ id: string; text: Localized }>;
  dataThrough: string | null;
  computedAt: string;
}

// ── the conversational surface ───────────────────────────────────────────

export interface BrainstormResult {
  reply: string;
  readyToPlan: boolean;
  readySummary: string;
  state: Localized;
  /** Tap-to-answer options for the question the reply asks (0-3). */
  suggestions: string[];
}

export interface BuildProgress {
  buildId: number;
  screenId: string;
  status: 'running' | 'succeeded' | 'failed';
  stage: string;
  round: number;
  percent: number;
  report: {
    outcome?: string;
    reason?: string;
    probes?: Array<{ probe: string; passed: boolean; detail: string }>;
    blocks?: string[];
  } | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface OttoStarter {
  text: Localized;
}
