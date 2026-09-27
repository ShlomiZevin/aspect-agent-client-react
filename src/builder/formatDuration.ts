/**
 * Human durations for run cards and admin tables (task #874).
 *
 * Timings are stored and sent in milliseconds, and that stays true — the
 * server, Alfred's tools and the logs all speak ms. Only what a person
 * READS changes: "19920ms" had to be divided in your head every time, so
 * the builder shows seconds.
 *
 *   646     → 0.6s
 *   19920   → 19.9s
 *   72400   → 1m 12s
 *   30      → <0.1s   (a real, non-zero time never reads as "0.0s")
 */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '';
  if (ms <= 0) return '0s';
  if (ms < 100) return '<0.1s';
  const s = ms / 1000;
  // Compare AFTER rounding, or 59.96s would print as "60.0s".
  if (Math.round(s * 10) / 10 < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rest = Math.round(s - m * 60);
  return rest === 60 ? `${m + 1}m 0s` : `${m}m ${rest}s`;
}
