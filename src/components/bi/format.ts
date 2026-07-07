/** Value formatting for the BI tool. */
import type { MeasureFormat, Measure } from '../../types/bi';

const NF = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const NF2 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

export function formatValue(value: unknown, format: MeasureFormat): string {
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  if (value == null || Number.isNaN(n)) return '—';

  switch (format) {
    case 'currency':
      return `₪${compact(n)}`;
    case 'percent':
      return `${NF2.format(n)}%`;
    default:
      return compact(n);
  }
}

/** Compact large numbers (1.2M, 45K) for axis labels and tiles. */
export function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${NF2.format(n / 1_000_000)}M`;
  if (abs >= 1_000) return `${NF2.format(n / 1_000)}K`;
  return NF.format(n);
}

/** Full-precision formatting for tables. */
export function formatExact(value: unknown, format: MeasureFormat): string {
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  if (value == null || Number.isNaN(n)) return '—';
  if (format === 'percent') return `${NF2.format(n)}%`;
  if (format === 'currency') return `₪${NF.format(Math.round(n))}`;
  return NF.format(n);
}

export function measureFormat(measures: Measure[], id: string): MeasureFormat {
  return measures.find(m => m.id === id)?.format ?? 'number';
}

/** Categorical palette — vivid mid-tones that pop on both dark glass and white. */
export const SERIES_COLORS = [
  '#8b5cf6', '#ec4899', '#06b6d4', '#10b981',
  '#f59e0b', '#f43f5e', '#6366f1', '#14b8a6',
];

export function seriesColor(i: number): string {
  return SERIES_COLORS[i % SERIES_COLORS.length];
}
