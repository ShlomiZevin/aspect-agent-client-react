/**
 * Central provider → model registry — client side.
 *
 * The actual list is owned by the server (services/models.service.js)
 * and fetched once on app load via `loadModelsFromServer()`. Until
 * the fetch resolves, the in-memory cache is empty and read helpers
 * fall back gracefully (so a brief flash on first render won't crash).
 *
 * Constants (DEFAULT_FAST_MODEL etc.) stay declared statically here
 * because plugins read them at module-load time, before any HTTP
 * call can complete. Keep these in sync with the server registry —
 * if a default points at an id the server no longer knows about,
 * runtime calls will fail loudly.
 */

import type { ModelRef } from '../types';

export interface ModelInfo {
  id: string;
  /** Provider id this model belongs to. Set by the server payload. */
  providerId: string;
  /** Human-facing label shown in dropdowns. (was `label` before; now matches server `name`.) */
  name: string;
  /** Short tagline shown in dropdowns and anywhere the model is named to a user. */
  notes?: string;
}

export interface ProviderInfo {
  id: string;
  label: string;
  /** Single emoji or short symbol used in dense UI. */
  icon: string;
  models: ModelInfo[];
}

// ─── In-memory cache, populated by loadModelsFromServer() ──────────

let _providers: ProviderInfo[] = [];
let _loadPromise: Promise<ProviderInfo[]> | null = null;
const _listeners = new Set<() => void>();

/**
 * Subscribe to load completion. Consumers (the useModels hook) use
 * this to re-render once the registry is ready.
 */
export function subscribeModels(fn: () => void): () => void {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

const API_BASE =
  (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ||
  'https://aspect-agent-server-1018338671074.europe-west1.run.app';

/**
 * Fetch the model registry from the server. Idempotent — concurrent
 * callers share one in-flight request, and once resolved subsequent
 * calls are no-ops. Call at app boot.
 */
export function loadModelsFromServer(): Promise<ProviderInfo[]> {
  if (_providers.length > 0) return Promise.resolve(_providers);
  if (_loadPromise) return _loadPromise;

  _loadPromise = fetch(`${API_BASE}/api/models`)
    .then(r => r.json())
    .then((data: { providers: ProviderInfo[] }) => {
      _providers = data.providers || [];
      _listeners.forEach(l => l());
      return _providers;
    })
    .catch(err => {
      console.error('[builder] failed to load models from server:', err);
      _loadPromise = null; // allow retry
      return [];
    });

  return _loadPromise;
}

/**
 * Synchronous access to the cached list. Empty until
 * loadModelsFromServer() resolves. UI components should prefer the
 * `useModels` hook so they re-render when the load completes.
 */
export function getProviders(): ProviderInfo[] {
  return _providers;
}

export function getProvider(providerId: string): ProviderInfo | undefined {
  return _providers.find(p => p.id === providerId);
}

export function getModel(ref: ModelRef): ModelInfo | undefined {
  return getProvider(ref.providerId)?.models.find(m => m.id === ref.modelId);
}

export function formatModelRef(ref: ModelRef): string {
  const p = getProvider(ref.providerId);
  const m = getModel(ref);
  if (!p || !m) return `${ref.providerId}/${ref.modelId}`;
  return `${p.label} · ${m.name}`;
}

// ─── Defaults referenced at plugin registration time ───────────────
// These are static so plugins don't depend on the registry having
// loaded. They must point at ids that exist in the server registry.

/** Default for any new field-extractor or addon that needs a cheap model. */
export const DEFAULT_FAST_MODEL: ModelRef = {
  providerId: 'openai',
  modelId: 'gpt-4o-mini',
};

/** Default for any new talker / generation step. */
export const DEFAULT_BALANCED_MODEL: ModelRef = {
  providerId: 'google',
  modelId: 'gemini-2.5-flash',
};

/** Hardwired model for the AI Builder Chat helper. */
export const BUILDER_HELPER_MODEL: ModelRef = {
  providerId: 'anthropic',
  modelId: 'claude-sonnet-4-6',
};
