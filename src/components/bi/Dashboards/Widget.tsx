/**
 * Renders one saved dashboard widget: runs its query spec (with any active
 * cross-filter merged in) and draws the chart. Clicking a category emits a
 * cross-filter for the whole dashboard.
 */
import { useMemo } from 'react';
import type { Widget as WidgetDef, DatasetModel, QuerySpec } from '../../../types/bi';
import { ChartRenderer } from '../charts/ChartRenderer';
import { useBiQuery } from '../useBiQuery';
import { buildLabels } from '../labels';
import styles from './Widget.module.css';

export interface CrossFilter { dimId: string; value: string; }

interface Props {
  widget: WidgetDef;
  model: DatasetModel;
  crossFilter: CrossFilter | null;
  onSelect: (dimId: string, value: string) => void;
  onRemove?: () => void;
  editable?: boolean;
}

/** Merge an active cross-filter into a widget spec (overriding same-field filters). */
function withCrossFilter(spec: QuerySpec, cf: CrossFilter | null): QuerySpec {
  if (!cf) return spec;
  const filters = spec.filters.filter(f => f.field !== cf.dimId);
  return { ...spec, filters: [...filters, { field: cf.dimId, op: 'eq', values: [cf.value] }] };
}

export function Widget({ widget, model, crossFilter, onSelect, onRemove, editable }: Props) {
  const labels = useMemo(() => buildLabels(model), [model]);
  // Only apply a cross-filter that this dataset actually has as a dimension.
  const applicable = crossFilter && model.dimensions.some(d => d.id === crossFilter.dimId)
    ? crossFilter : null;
  const spec = useMemo(() => withCrossFilter(widget.spec, applicable), [widget.spec, applicable]);
  const { result, loading, error } = useBiQuery(model.id, spec, spec.measures.length > 0);

  // Highlight only when the widget groups by the cross-filtered dimension.
  const selected = applicable && widget.spec.dimensions.includes(applicable.dimId)
    ? { dimId: applicable.dimId, value: applicable.value } : null;

  return (
    <div className={styles.widget}>
      <div className={styles.head}>
        <span className={styles.title}>{widget.title}</span>
        {editable && onRemove && (
          <button className={styles.remove} onClick={onRemove} title="Remove widget">×</button>
        )}
      </div>
      <div className={styles.body}>
        {loading && <div className={styles.hint}>Loading…</div>}
        {error && <div className={styles.error}>⚠ {error}</div>}
        {!loading && !error && result && (
          <ChartRenderer
            chartType={widget.chartType}
            result={result}
            spec={spec}
            measures={model.measures}
            labels={labels}
            onSelect={onSelect}
            selected={selected}
          />
        )}
      </div>
    </div>
  );
}
