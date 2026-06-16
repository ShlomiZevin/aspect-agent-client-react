/**
 * Prompt Repo — DB-backed, shared across users.
 *
 * Two layers of entries:
 *
 *   1. SEEDS — synthesised on the client from the live
 *      `@addons/*.addon.json` imports. One seed per addon plugin
 *      with id `default-<pluginId>` and the current
 *      `defaultConfig.prompt` as the body. NOT stored in the DB —
 *      updating an addon descriptor's prompt lands automatically for
 *      every user with no migration.
 *
 *   2. USER ENTRIES — fetched from the server (table
 *      `repo_entries`, kind='prompt'). Saved with POST; deleted with
 *      DELETE. Cached in-memory after the first fetch so the chip
 *      row paints instantly on subsequent opens.
 *
 * Listing surfaces the union (seeds first, then user, newest first
 * within the user batch as ordered by the server).
 *
 * Architecture note for the future addon repo: the same DB table
 * stores both kinds. When the addon-repo work begins, this module
 * will gain `listAddonEntriesForPlugin` / `saveUserAddon` etc., all
 * hitting the same `/api/builder/repo/entries` surface with
 * `kind='addon'`. The current prompt API exists in a way that's
 * additive — no rewrite needed there.
 */

import fieldExtractor   from '@addons/fieldExtractor.addon.json';
import vibeExtractor    from '@addons/vibeExtractor.addon.json';
import fieldReasoner    from '@addons/fieldReasoner.addon.json';
import fieldInterviewer from '@addons/fieldInterviewer.addon.json';
import thinker          from '@addons/thinker.addon.json';
import talker           from '@addons/talker.addon.json';
import summarizer       from '@addons/summarizer.addon.json';

const BASE_URL =
  (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ||
  'https://aspect-agent-server-1018338671074.europe-west1.run.app';

/** One entry in the prompt repo. `source` tells the UI whether this
 *  is a built-in default ('seed') or a user-saved DB row ('user'). */
export interface PromptRepoEntry {
  /** Stable id. Seeds: `default-<pluginId>`. User: `repo_<rand>` from server. */
  id: string;
  /** Display name shown in the picker. */
  name: string;
  /** Plugin id this entry's prompt is meant for. */
  pluginId: string;
  /** The actual prompt content. */
  prompt: string;
  /** Provenance — drives the badge + delete affordance in the picker. */
  source: 'seed' | 'user';
  /** Only set for user entries — ISO string from the server. */
  createdAt?: string;
}

// ─── Seed synthesis ───────────────────────────────────────────────

interface AddonDescriptorLike {
  pluginId: string;
  displayName: string;
  defaultConfig?: { prompt?: string };
}

const SEED_DESCRIPTORS: AddonDescriptorLike[] = [
  fieldExtractor as AddonDescriptorLike,
  vibeExtractor as AddonDescriptorLike,
  fieldReasoner as AddonDescriptorLike,
  fieldInterviewer as AddonDescriptorLike,
  thinker as AddonDescriptorLike,
  talker as AddonDescriptorLike,
  summarizer as AddonDescriptorLike,
];

function buildSeedEntries(): PromptRepoEntry[] {
  return SEED_DESCRIPTORS
    .filter(d =>
      typeof d.defaultConfig?.prompt === 'string'
      && d.defaultConfig.prompt.trim().length > 0,
    )
    .map(d => ({
      // id keeps the `default-` prefix — deleteUserPrompt keys off it
      // to refuse deletion of system entries. The user-facing name no
      // longer says "Default": these are system-provided prompts, not
      // "the default" (a user can mark any saved prompt as their go-to).
      id:       `default-${d.pluginId}`,
      name:     d.displayName,
      pluginId: d.pluginId,
      prompt:   (d.defaultConfig!.prompt as string),
      source:   'seed' as const,
    }));
}

// ─── Live cache (per-plugin), version, subscriptions ──────────────

/** Cached user entries by pluginId. Populated lazily on first fetch
 *  for that plugin, refreshed after every mutation. */
const userByPlugin = new Map<string, PromptRepoEntry[]>();
const inflight = new Map<string, Promise<PromptRepoEntry[]>>();

/** Bumped on every cache mutation so `useSyncExternalStore` consumers
 *  re-derive their memoised entry list. Stable equality on a number
 *  is what keeps the consumer out of infinite-loop territory (see
 *  PromptRepoModal — and the original bug we hit). */
let version = 0;
const listeners = new Set<() => void>();

function emit(): void {
  version += 1;
  for (const l of listeners) l();
}

export function subscribeToPromptRepo(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getPromptRepoVersion(): number {
  return version;
}

// ─── Server <-> client mapping ────────────────────────────────────

interface ServerEntry {
  id: string;
  kind: string;
  pluginId: string;
  name: string;
  content: { prompt?: string };
  createdAt: string;
}

function toClientEntry(s: ServerEntry): PromptRepoEntry | null {
  if (s.kind !== 'prompt' || typeof s.content?.prompt !== 'string') return null;
  return {
    id:        s.id,
    name:      s.name,
    pluginId:  s.pluginId,
    prompt:    s.content.prompt,
    source:    'user',
    createdAt: s.createdAt,
  };
}

async function fetchUserEntries(pluginId: string): Promise<PromptRepoEntry[]> {
  const url = `${BASE_URL}/api/builder/repo/entries?kind=prompt&pluginId=${encodeURIComponent(pluginId)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Prompt repo fetch failed: ${res.status}`);
  const data = await res.json() as { entries: ServerEntry[] };
  return (data.entries || []).map(toClientEntry).filter((e): e is PromptRepoEntry => e !== null);
}

/** Kick off a fetch for this plugin's user entries if we don't have
 *  them cached. Subsequent calls during the same in-flight request
 *  share the same promise. Cache is invalidated by `emit()` on save
 *  / delete. */
function ensureLoaded(pluginId: string): void {
  if (userByPlugin.has(pluginId)) return;
  if (inflight.has(pluginId))     return;
  const p = fetchUserEntries(pluginId)
    .then(entries => {
      userByPlugin.set(pluginId, entries);
      inflight.delete(pluginId);
      emit();
      return entries;
    })
    .catch(err => {
      console.error('[promptRepo] fetch failed:', err);
      userByPlugin.set(pluginId, []);
      inflight.delete(pluginId);
      emit();
      return [];
    });
  inflight.set(pluginId, p);
}

// ─── Public API ───────────────────────────────────────────────────

/** Entries usable by a specific plugin. Triggers a lazy fetch of
 *  user entries the first time it's called for a pluginId; until
 *  that arrives, returns just the seeds (fine — every plugin has
 *  one). The consumer subscribes via `useSyncExternalStore` and
 *  re-renders when the fetch lands. */
export function listPromptEntriesForPlugin(pluginId: string): PromptRepoEntry[] {
  ensureLoaded(pluginId);
  const seeds = buildSeedEntries().filter(e => e.pluginId === pluginId);
  const user  = userByPlugin.get(pluginId) || [];
  return [...seeds, ...user];
}

/** Save a user prompt to the DB. Optimistic on success — appends to
 *  the local cache and bumps version. Throws on server error so the
 *  modal can surface it. */
export async function saveUserPrompt(args: {
  name: string;
  pluginId: string;
  prompt: string;
}): Promise<PromptRepoEntry> {
  const url = `${BASE_URL}/api/builder/repo/entries`;
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      kind:     'prompt',
      pluginId: args.pluginId,
      name:     args.name,
      content:  { prompt: args.prompt },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Save failed: ${res.status} ${text}`);
  }
  const data = await res.json() as { entry: ServerEntry };
  const saved = toClientEntry(data.entry);
  if (!saved) throw new Error('Save returned an entry that did not parse');
  // Newest first within the user batch — same order the GET returns
  // — so the chip the user just saved is the first user-chip on the
  // row.
  const before = userByPlugin.get(args.pluginId) || [];
  userByPlugin.set(args.pluginId, [saved, ...before]);
  emit();
  return saved;
}

/** Remove a user entry. Seeds can't be deleted (they're derived);
 *  trying to delete one is a no-op. */
export async function deleteUserPrompt(id: string): Promise<void> {
  if (id.startsWith('default-')) return; // seed id — ignore
  const url = `${BASE_URL}/api/builder/repo/entries/${encodeURIComponent(id)}`;
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Delete failed: ${res.status} ${text}`);
  }
  // Drop from every per-plugin cache that might hold it. Cheaper than
  // tracking which one it belonged to (we'd have to look it up).
  for (const [k, list] of userByPlugin) {
    const next = list.filter(e => e.id !== id);
    if (next.length !== list.length) userByPlugin.set(k, next);
  }
  emit();
}
