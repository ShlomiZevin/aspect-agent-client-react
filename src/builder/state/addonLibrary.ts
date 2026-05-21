/**
 * Addon Library — mock cross-project repo of shareable addon configs.
 *
 * Storage: localStorage at `builder:addonLibrary` (single key, not
 * scoped per agent — the library is cross-project by design).
 *
 * Lifecycle:
 *   - Export a good addon config → new entry, named.
 *   - Browse the library when adding a step → copy-in a fresh addon
 *     instance with that config. No live link, no updates from
 *     upstream — once imported, the addon belongs to the crew.
 *
 * Entries are immutable once created (no edit-in-place). To "update"
 * a library entry, export again with a new name (or the same name —
 * future feature: versions per entry).
 */

import type { AddonInstance, AddonLane } from '../types';
import { getPlugin } from '../registry/plugins';

const STORAGE_KEY = 'builder:addonLibrary';

export interface LibraryEntry {
  id: string;
  /** Display name. Curator-supplied, distinct from the plugin name. */
  name: string;
  /** Free-text description / when to use this. */
  description?: string;
  /** Plugin id this entry is built on (must match a registered plugin). */
  pluginId: string;
  /** Suggested lane when imported. */
  defaultLane: AddonLane;
  /** Plugin-defined config blob. */
  config: unknown;
  createdAt: string;
}

function uid(): string {
  return `lib_${Math.random().toString(36).slice(2, 10)}`;
}

// ─── Seed entries shown on first load ─────────────────────────────

const SEED: LibraryEntry[] = [
  {
    id: 'lib_seed_banking_extractor',
    name: 'Banking onboarding extractor',
    description:
      'Captures name, age, employment status, and income range from an onboarding chat. Tuned for Hebrew but works in English.',
    pluginId: 'field-extractor',
    defaultLane: 'main',
    config: {
      prompt:
        "Extract field values from the user's latest message and recent context.\n" +
        'Capture only what is clearly supported by the conversation.\n' +
        "For 'explicit' fields, only what the user literally said.\n" +
        "For 'inferred' fields, allow conclusions based on patterns.",
      model: { providerId: 'openai', modelId: 'gpt-4o-mini' },
      fields: [
        {
          id: 'fld_name',
          name: 'name',
          type: 'string',
          source: 'explicit',
          howToExtract: "The customer's first name. Capture only when they introduce themselves.",
        },
        {
          id: 'fld_age',
          name: 'age',
          type: 'int',
          source: 'explicit',
          howToExtract: 'Age in years. Only when explicitly stated.',
        },
        {
          id: 'fld_employment',
          name: 'employment_status',
          type: 'enum',
          source: 'explicit',
          howToExtract: 'Employment situation, as stated by the user.',
          enumValues: ['salaried', 'self_employed', 'unemployed', 'student', 'retired'],
        },
        {
          id: 'fld_income',
          name: 'income_range',
          type: 'string',
          source: 'explicit',
          howToExtract: 'Monthly net income range as the user describes it.',
        },
      ],
    },
    createdAt: new Date('2026-04-01T10:00:00Z').toISOString(),
  },
  {
    id: 'lib_seed_warm_talker',
    name: 'Warm, conversational talker',
    description:
      'Friendly, never-pushy talker for consumer-facing onboarding. Defaults to Gemini Flash for speed.',
    pluginId: 'talker',
    defaultLane: 'main',
    config: {
      prompt:
        'You are warm, conversational, and never pushy.\n\n' +
        'Rules:\n' +
        '- One question at a time\n' +
        "- Mirror the user's tone\n" +
        '- Use their name once it has been shared\n' +
        '- Never mention fees, costs, or limitations unless the user asks first',
      model: { providerId: 'google', modelId: 'gemini-2.5-flash' },
    },
    createdAt: new Date('2026-04-12T10:00:00Z').toISOString(),
  },
];

// ─── Load / save ──────────────────────────────────────────────────

function load(): LibraryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // First visit — seed.
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED));
      return [...SEED];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...SEED];
    return parsed as LibraryEntry[];
  } catch {
    return [...SEED];
  }
}

function persist(entries: LibraryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* quota / private mode — fine, in-memory entries still work */
  }
}

// In-memory cache + simple change subscription so UIs that browse the
// library refresh after a new export.
let cache: LibraryEntry[] | null = null;
const listeners = new Set<() => void>();

function getCache(): LibraryEntry[] {
  if (cache === null) cache = load();
  return cache;
}

function emit(): void {
  for (const l of listeners) l();
}

export function subscribeToLibrary(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ─── Public API ───────────────────────────────────────────────────

export function listLibraryEntries(): LibraryEntry[] {
  return getCache();
}

export function listLibraryEntriesForPlugin(pluginId: string): LibraryEntry[] {
  return getCache().filter(e => e.pluginId === pluginId);
}

export function getLibraryEntry(id: string): LibraryEntry | undefined {
  return getCache().find(e => e.id === id);
}

/** Save the current addon config to the library as a named entry. */
export function exportToLibrary(args: {
  name: string;
  description?: string;
  instance: AddonInstance;
}): LibraryEntry {
  const desc = getPlugin(args.instance.pluginId);
  const entry: LibraryEntry = {
    id: uid(),
    name: args.name.trim(),
    description: args.description?.trim() || undefined,
    pluginId: args.instance.pluginId,
    // Use the plugin's default lane, not the source instance's lane —
    // a library entry shouldn't lock callers into a specific lane.
    defaultLane: desc?.defaultLane ?? args.instance.lane,
    // Deep clone via JSON to ensure mutations after export don't leak.
    config: JSON.parse(JSON.stringify(args.instance.config)),
    createdAt: new Date().toISOString(),
  };
  const next = [entry, ...getCache()];
  cache = next;
  persist(next);
  emit();
  return entry;
}
