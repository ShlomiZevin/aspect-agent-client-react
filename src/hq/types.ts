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
