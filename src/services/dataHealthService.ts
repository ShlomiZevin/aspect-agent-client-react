/**
 * "What data is currently in scope?" — read-only, assembled server-side from
 * the reload history, the source folder and the live catalog.
 *
 * Takes an explicit `baseURL` rather than using the shared `apiRequest` default,
 * because each agent portal points at its own backend (the same reason
 * DataStatusBar does). Nothing here is cached client-side: the server already
 * caches for 5 minutes, and a stale panel about data freshness would be a
 * particularly poor joke.
 */

export interface DataHealthFile {
  file: string;
  table: string | null;
  size: string | null;
  updatedAt: string | null;
  rows: number | null;
  /** false when `rows` is the planner's estimate rather than a counted value. */
  exactRows: boolean;
  /** null when the table carries no date column — it is a lookup, not a history. */
  from: string | null;
  through: string | null;
  dateColumn: string | null;
}

/** One relation in the live schema — Stage 3: the panel lists EVERY table and
 *  materialized view, not only those mapped from a current source file. */
export interface DataHealthTable {
  name: string;
  kind: 'table' | 'view';
  rows: number | null;
  from: string | null;
  through: string | null;
  /** true = no date column (snapshot/dimension) — labeled, not dashed. */
  dateless: boolean;
}

/** Result of the post-reload MV freshness assertion (may be absent). */
export interface DataHealthFreshness {
  at: string;
  ok: boolean;
  baseMax: string;
  details: { view: string; viewMax?: string; baseMax?: string; fresh?: boolean; error?: string }[];
}

export interface DataHealth {
  schema: string;
  lastSync: {
    at: string | null;
    status: string | null;
    triggeredBy: string | null;
    totalRows: number | null;
  } | null;
  coverage: { from: string | null; through: string | null };
  files: DataHealthFile[];
  tables?: DataHealthTable[];
  freshness?: DataHealthFreshness | null;
  notes: { ignoredFiles: string[] };
}

export const dataHealthService = {
  get: async (baseURL: string, schema: string): Promise<DataHealth> => {
    const res = await fetch(`${baseURL}/api/admin/data-loader/${schema}/data-health`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Failed to load data health (${res.status})`);
    }
    return res.json();
  },
};
