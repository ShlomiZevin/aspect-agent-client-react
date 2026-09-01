/**
 * The Silence trigger's config shape and its one-line summary.
 *
 * Split out from the component only because React Fast Refresh requires
 * a .tsx to export components and nothing else. The summary lives with
 * the shape rather than on the card, because only this type knows what
 * its numbers mean.
 */

export interface SilenceConfig {
  after: { value: number; unit: 'minutes' | 'hours' | 'days' };
  maxAttempts: number;
}

export const SILENCE_UNITS: SilenceConfig['after']['unit'][] = ['minutes', 'hours', 'days'];

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function summarizeSilence(config: SilenceConfig): string {
  const v = config?.after?.value ?? 30;
  const u = config?.after?.unit ?? 'minutes';
  const n = config?.maxAttempts ?? 3;
  return `after ${plural(v, u.replace(/s$/, ''))} of quiet · up to ${n} time${n === 1 ? '' : 's'}`;
}
