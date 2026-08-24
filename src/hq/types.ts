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

// ─── Employees ───────────────────────────────────────────────────────────────

export interface Worker {
  id: number;
  slug: string;
  name: string;
  role_title: string;
  tagline: string | null;
  avatar: string | null;
  accent: string | null;
  /** The employment definition — a plain system prompt, editable by anyone. */
  role_definition: string;
  model: string;
  tools: string[];
  settings: Record<string, unknown>;
  running_jobs?: number;
  conversations?: number;
  spend?: WorkerSpend | null;
}

/** Both kinds of money a worker costs — images and reasoning are billed apart. */
export interface WorkerSpend {
  imagesUsd: number;
  imagesThisMonthUsd: number;
  imageCount: number;
  thinkingUsd: number;
  totalUsd: number;
}

export interface WorkerCapabilities {
  images: boolean;
  htmlRender: boolean;
  imageModels: { id: string; label: string; about: string; approxCost: number }[];
  /** Models offered for the phrasing step — see hq/services/phrasing.service.js. */
  phrasingModels: { id: string; label: string; about: string }[];
}

export interface WorkerConversation {
  id: number;
  worker_id: number;
  title: string;
  updated_at: string;
  message_count?: number;
  media_count?: number;
  /**
   * Per-conversation overrides of the employee's model choices. null on any of
   * them means "follow her default", not "none".
   */
  model?: string | null;
  phrasing_model?: string | null;
  image_model?: string | null;
}

export interface WorkerMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  metadata: { toolCalls?: { name: string }[]; jobId?: number | null };
  created_at: string;
}

export interface JobStep {
  n: number;
  title: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  detail?: string;
}

export interface Job {
  id: number;
  worker_id: number;
  conversation_id: number | null;
  title: string;
  brief: string | null;
  status: 'running' | 'done' | 'cancelled' | 'failed';
  steps: JobStep[];
  current_step: number | null;
  error: string | null;
  cost_usd: string | number;
  /** Token spend, split by what it was for — two providers bill separately. */
  llm_cost_usd?: string | number;
  phrasing_cost_usd?: string | number;
  llm_tokens_in?: number;
  llm_tokens_out?: number;
  estimated_usd: string | number | null;
  started_at: string;
  finished_at: string | null;
  media_count?: number;
  live?: boolean;
  worker_name?: string;
  avatar?: string;
}

export interface MediaItem {
  id: number;
  conversation_id: number | null;
  job_id: number | null;
  folder_id: number | null;
  kind: string;
  title: string | null;
  url: string | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  prompt: string | null;
  model: string | null;
  cost_usd: string | number | null;
  source: string | null;
  created_at: string;
}

export interface MediaFolder {
  id: number;
  name: string;
  parent_id: number | null;
  media_count: number;
}

export interface MediaConversationGroup {
  id: number;
  title: string;
  updated_at: string;
  worker_name: string | null;
  avatar: string | null;
  media_count: number;
}

/** A craft note a worker follows. Not company knowledge — see hq_worker_lessons. */
export interface Lesson {
  id: number;
  worker_id: number;
  lesson: string;
  learned_from: string | null;
  active: boolean;
  created_at: string;
}

export interface Report {
  id: number;
  title: string;
  summary: string | null;
  conversation_id: number | null;
  job_id: number | null;
  worker_name: string | null;
  avatar: string | null;
  created_at: string;
}

/** One frame from a worker's stream. */
export interface WorkerEvent {
  type: 'text' | 'tool_start' | 'tool_done' | 'tool_failed' | 'tool_progress'
      | 'job_started' | 'job_step' | 'job_finished' | 'media' | 'report' | 'stopped';
  text?: string;
  tool?: string;
  input?: Record<string, unknown>;
  error?: string;
  job?: Job;
  jobId?: number;
  steps?: JobStep[];
  done?: number;
  total?: number;
  item?: MediaItem;
  report?: Report;
  summary?: string;
  note?: string;
}

/** What HQ itself costs — tokens and images together. */
export interface HQUsage {
  days: number;
  totals: {
    tokensUsd: number; imagesUsd: number; totalUsd: number;
    imageCount: number; calls: number;
  };
  byProcess: { process: string; label: string; model: string; modelName: string; inp: number; outp: number; calls: number; usd: number }[];
  byModel: { model: string; modelName: string; provider: string; inp: number; outp: number; calls: number; usd: number }[];
  byImageModel: { model: string; label: string; n: number; usd: number; each: number }[];
  byWorker: {
    who: string; model: string; modelName: string; kind: 'tokens' | 'images';
    calls: number; inp: number | null; outp: number | null;
    pictures: number | null; usd: number;
  }[];
  byDay: { day: string; tokensUsd: number; imagesUsd: number; totalUsd: number }[];
  recent: {
    key: string; kind: 'tokens' | 'images'; who: string; label: string;
    model: string; modelName: string; provider: string;
    input_tokens: number | null; output_tokens: number | null;
    title?: string | null; created_at: string; usd: number;
  }[];
  budget: { spentTodayUsd: number; dailyLimitUsd: number; remainingUsd: number; blocked: boolean } | null;
}
