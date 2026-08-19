/** Lybi HQ — shared types. Mirrors hq_atoms / hq_sources on the server. */

export type AtomKind = 'meeting' | 'doc' | 'note' | 'transcript' | 'page' | 'decision';
export type AtomStatus = 'pending' | 'indexed' | 'failed' | 'superseded';
export type ScribeStatus = 'none' | 'running' | 'done' | 'failed';

export interface Decision {
  text: string;
  who?: string | null;
  quote?: string | null;
}

export interface ActionItem {
  text: string;
  owner?: string | null;
  due?: string | null;
}

export interface Atom {
  id: number;
  kind: AtomKind;
  title: string;
  body?: string;
  summary: string | null;
  external_url: string | null;
  occurred_at: string | null;
  ingested_at: string;
  participants: string[];
  projects: string[];
  decisions: Decision[];
  actions: ActionItem[];
  questions: string[];
  status: AtomStatus;
  scribe_status: ScribeStatus;
  chunk_count: number;
  error: string | null;
  /** Which connector it came from — joined from hq_sources, not guessed. */
  source_kind?: string | null;
  source_label?: string | null;
}

export interface Source {
  id: number;
  kind: string;
  label: string;
  config: { notionId?: string; notionType?: string; url?: string };
  sync_mode: string;
  last_sync_at: string | null;
  last_status: 'pending' | 'syncing' | 'ok' | 'failed';
  last_error: string | null;
  atom_count: number;
  created_at: string;
}

export interface Citation {
  n: number;
  atomId: number | null;
  title: string;
  kind: string;
  url: string | null;
  date: string | null;
  score: number;
  snippet: string;
}

export interface AskResult {
  answer: string;
  citations: Citation[];
  hits: Citation[];
  usedAtomIds: number[];
}

export interface HQStatus {
  ok: boolean;
  notionConfigured: boolean;
  /** Every built connector and whether its credentials are present. */
  sources?: { id: string; name: string; connected: boolean }[];
  totalAtoms: number;
  byKind: Record<string, number>;
  indexed: number;
  failed: number;
}

/** What the server made of a pasted string, before we commit to importing. */
export interface DropInspection {
  type: 'notion' | 'url' | 'text' | 'empty';
  id?: string;
  notionType?: 'page' | 'database';
  title?: string;
  url?: string | null;
  rowCount?: number | null;
  text?: string;
  error?: string;
}

// ─── Integrations ────────────────────────────────────────────────────────────

export type SyncItemStatus =
  | 'pending' | 'selected' | 'syncing' | 'done' | 'stale' | 'skipped' | 'failed';

export interface SyncItem {
  id: number;
  external_id: string;
  title: string;
  url: string | null;
  parent_title: string | null;
  object_type: string;
  status: SyncItemStatus;
  chars: number | null;
  chunks: number | null;
  error: string | null;
  atom_id: number | null;
  remote_edited_at: string | null;
  synced_at: string | null;
}

export interface SyncStats {
  byStatus: Partial<Record<SyncItemStatus, number>>;
  byType: Record<string, number>;
  /** Which database or page each item sits under — the handle for bulk pruning. */
  parents: { title: string; count: number; done: number }[];
  /** What the list is showing, with every filter applied. */
  total: number;
  /** Totals for the "Everything"/"Both" options — that dimension unfiltered. */
  statusTotal: number;
  typeTotal: number;
  syncedChars: number;
}

export interface ItemFilters {
  status?: string;
  search?: string;
  type?: string;
  parent?: string;
  /** ISO dates, on when the page last changed at the source. */
  since?: string;
  until?: string;
}

export interface SyncRun {
  id: number;
  kind: 'discover' | 'sync';
  /** How it was started — a person, or (later) a schedule. */
  trigger: 'manual' | 'auto';
  label: string | null;
  status: 'running' | 'done' | 'cancelled' | 'failed';
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  current_title: string | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
  source_label?: string;
  source_kind?: string;
  /** True while this process still holds the run in memory. */
  live?: boolean;
}

export interface Provider {
  id: string;
  name: string;
  connected: boolean;
  comingSoon?: boolean;
  sourceId?: number;
  defaultKind?: string;
  stats?: SyncStats;
  lastRun?: SyncRun | null;
  lastSyncAt?: string | null;
}

/** One frame of a discover/sync stream. */
export interface SyncProgress {
  phase: 'discover' | 'start' | 'item' | 'item_done' | 'item_failed' | 'done' | 'cancelled';
  runId?: number;
  itemId?: number;
  title?: string;
  found?: number;
  processed?: number;
  total?: number;
  succeeded?: number;
  failed?: number;
  chars?: number;
  chunks?: number;
  error?: string;
}
