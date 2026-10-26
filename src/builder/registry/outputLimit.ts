/**
 * An addon's output limit — "Max output" beside its model (tasks #889, #920).
 *
 * The most the model may write in one run, thinking included. A run that
 * reaches it fails instead of saving half an answer. Unset = DEFAULT.
 * Mirrors the server: aspect-agent-server/builder/runtime/outputLimit.js.
 */

import type { ModelInfo } from './providerModels';

export const DEFAULT_OUTPUT_TOKENS = 16000;
export const OUTPUT_LIMIT_PRESETS = [4000, 8000, 16000, 32000, 64000];

/** USD if one run writes the whole limit, or null when the price is unknown. */
export function fullLimitCost(limit: number, model: ModelInfo | undefined): number | null {
  const out = model?.price?.out;
  return typeof out === 'number' ? (limit * out) / 1_000_000 : null;
}

export function formatCost(usd: number): string {
  if (usd < 0.01) return '< $0.01';
  return `$${usd < 1 ? usd.toFixed(2) : usd.toFixed(2).replace(/\.00$/, '')}`;
}
