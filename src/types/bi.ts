/**
 * Types for the Aspect BI tool (client side).
 * Mirrors the server semantic model in aspect-agent-server/bi/.
 */

export type MeasureFormat = 'currency' | 'number' | 'percent';
export type FieldType = 'text' | 'number' | 'date';

export interface Dimension {
  id: string;
  label: string;
  labelHe: string | null;
  group: string;
  type: FieldType;
}

export interface Measure {
  id: string;
  label: string;
  format: MeasureFormat;
}

export interface DatasetSummary {
  id: string;
  name: string;
  description: string;
}

export interface DatasetModel extends DatasetSummary {
  dimensions: Dimension[];
  measures: Measure[];
}

export type FilterOp =
  | 'eq' | 'neq' | 'in' | 'not_in' | 'contains'
  | 'gte' | 'lte' | 'between' | 'is_null' | 'not_null';

export interface Filter {
  field: string;
  op: FilterOp;
  values: (string | number)[];
}

export type SortDir = 'asc' | 'desc';

export interface QuerySpec {
  dimensions: string[];
  measures: string[];
  filters: Filter[];
  sort?: { field: string; dir: SortDir };
  limit?: number;
}

export interface QueryResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  columns: string[];
  duration: number;
  sql: string;
}

export type ChartType = 'kpi' | 'bar' | 'grouped-bar' | 'line' | 'table' | 'pie';

/** A saved dashboard widget: a query spec + how to render it. */
export interface Widget {
  id: string;
  title: string;
  chartType: ChartType;
  spec: QuerySpec;
}

export interface DashboardDefinition {
  widgets: Widget[];
}

export interface DashboardSummary {
  id: number;
  dataset_id: string;
  name: string;
  updated_at: string;
  widget_count: number;
}

export interface Dashboard {
  id: number;
  dataset_id: string;
  name: string;
  definition: DashboardDefinition;
  created_at: string;
  updated_at: string;
}
