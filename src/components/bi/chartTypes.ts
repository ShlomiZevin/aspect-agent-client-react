/** Which chart types make sense for a given spec, and a sensible default. */
import type { ChartType, QuerySpec } from '../../types/bi';

export const CHART_META: Record<ChartType, { label: string; icon: string }> = {
  kpi:           { label: 'KPI', icon: '#' },
  bar:           { label: 'Bar', icon: '▊' },
  'grouped-bar': { label: 'Grouped', icon: '▊▊' },
  line:          { label: 'Trend', icon: '∿' },
  pie:           { label: 'Donut', icon: '◕' },
  table:         { label: 'Table', icon: '☰' },
};

export function validChartTypes(spec: QuerySpec): ChartType[] {
  const nDim = spec.dimensions.length;
  const nMeasure = spec.measures.length;
  if (nMeasure === 0) return [];
  if (nDim === 0) return ['kpi', 'table'];

  const types: ChartType[] = [];
  if (nDim === 1 && nMeasure === 1) types.push('bar', 'line', 'pie');
  if (nDim === 1 && nMeasure > 1) types.push('grouped-bar', 'line');
  if (nDim >= 1) types.push('table');
  return [...new Set(types)];
}

export function defaultChartType(spec: QuerySpec): ChartType {
  const valid = validChartTypes(spec);
  if (valid.length === 0) return 'table';
  // Prefer a visual over a table when possible.
  const firstDim = spec.dimensions[0] || '';
  if (firstDim.startsWith('date_') && valid.includes('line')) return 'line';
  return valid[0];
}
