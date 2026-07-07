/**
 * Ad-hoc query builder. Pick measures + dimensions from the field panel, add
 * filters, choose a chart type, and (optionally) pin the result to a dashboard.
 */
import { useEffect, useMemo, useState } from 'react';
import type { DatasetModel, QuerySpec, ChartType, SortDir } from '../../../types/bi';
import { FieldPanel } from './FieldPanel';
import { FilterEditor } from './FilterEditor';
import { ChartRenderer } from '../charts/ChartRenderer';
import { useBiQuery } from '../useBiQuery';
import { buildLabels } from '../labels';
import { validChartTypes, defaultChartType, CHART_META } from '../chartTypes';
import { SaveWidgetModal } from '../Dashboards/SaveWidgetModal';
import styles from './Explorer.module.css';

const EMPTY: QuerySpec = { dimensions: [], measures: [], filters: [], limit: 100 };

export function Explorer({ model }: { model: DatasetModel }) {
  const [spec, setSpec] = useState<QuerySpec>(EMPTY);
  const [chartType, setChartType] = useState<ChartType>('table');
  const [chartTouched, setChartTouched] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [saving, setSaving] = useState(false);

  const labels = useMemo(() => buildLabels(model), [model]);
  const enabled = spec.measures.length > 0;
  const { result, loading, error } = useBiQuery(model.id, spec, enabled);

  const allowedCharts = validChartTypes(spec);

  // Keep chart type valid; auto-pick a sensible default until the user overrides.
  useEffect(() => {
    if (!enabled) return;
    if (chartTouched && allowedCharts.includes(chartType)) return;
    setChartType(defaultChartType(spec));
    setChartTouched(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.dimensions.join(), spec.measures.join(), enabled]);

  const toggleDimension = (id: string) =>
    setSpec(s => ({
      ...s,
      dimensions: s.dimensions.includes(id)
        ? s.dimensions.filter(x => x !== id)
        : s.dimensions.length < 3 ? [...s.dimensions, id] : s.dimensions,
    }));

  const toggleMeasure = (id: string) =>
    setSpec(s => ({
      ...s,
      measures: s.measures.includes(id) ? s.measures.filter(x => x !== id) : [...s.measures, id],
    }));

  const setSort = (field: string) =>
    setSpec(s => {
      const dir: SortDir = s.sort?.field === field && s.sort.dir === 'desc' ? 'asc' : 'desc';
      return { ...s, sort: { field, dir } };
    });

  const selectedChips = [
    ...spec.measures.map(id => ({ id, kind: 'measure' as const, label: labels[id] })),
    ...spec.dimensions.map(id => ({ id, kind: 'dimension' as const, label: labels[id] })),
  ];

  return (
    <div className={styles.explorer}>
      <FieldPanel
        model={model}
        activeDimensions={spec.dimensions}
        activeMeasures={spec.measures}
        onToggleDimension={toggleDimension}
        onToggleMeasure={toggleMeasure}
      />

      <div className={styles.main}>
        {/* Selected fields + sort/limit */}
        <div className={styles.selected}>
          {selectedChips.length === 0 && (
            <span className={styles.placeholder}>Pick one or more measures to begin →</span>
          )}
          {selectedChips.map(c => (
            <button key={c.id} className={`${styles.selChip} ${styles[c.kind]}`}
              onClick={() => c.kind === 'measure' ? toggleMeasure(c.id) : toggleDimension(c.id)}
              title="Click to remove">
              {c.label} <span className={styles.x}>×</span>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className={styles.filters}>
          <FilterEditor
            datasetId={model.id}
            dimensions={model.dimensions}
            filters={spec.filters}
            onChange={filters => setSpec(s => ({ ...s, filters }))}
          />
        </div>

        {/* Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.chartTypes}>
            {allowedCharts.map(ct => (
              <button key={ct}
                className={`${styles.ctBtn} ${chartType === ct ? styles.ctActive : ''}`}
                onClick={() => { setChartType(ct); setChartTouched(true); }}>
                <span className={styles.ctIcon}>{CHART_META[ct].icon}</span> {CHART_META[ct].label}
              </button>
            ))}
          </div>
          <div className={styles.toolRight}>
            <label className={styles.limit}>
              Rows
              <select value={spec.limit ?? 100} onChange={e => setSpec(s => ({ ...s, limit: Number(e.target.value) }))}>
                {[10, 25, 50, 100, 500, 1000].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <button className={styles.ghost} disabled={!result} onClick={() => setShowSql(v => !v)}>
              {showSql ? 'Hide SQL' : 'SQL'}
            </button>
            <button className={styles.primary} disabled={!enabled || !result} onClick={() => setSaving(true)}>
              ★ Save to dashboard
            </button>
          </div>
        </div>

        {/* Sort hint for table */}
        {chartType === 'table' && enabled && (
          <div className={styles.sortRow}>
            <span>Sort:</span>
            {[...spec.measures, ...spec.dimensions].map(id => (
              <button key={id} className={`${styles.sortBtn} ${spec.sort?.field === id ? styles.sortActive : ''}`}
                onClick={() => setSort(id)}>
                {labels[id]} {spec.sort?.field === id ? (spec.sort.dir === 'desc' ? '↓' : '↑') : ''}
              </button>
            ))}
          </div>
        )}

        {/* Result */}
        <div className={styles.result}>
          {!enabled && <div className={styles.hint}>Select a measure to run a query.</div>}
          {enabled && loading && <div className={styles.hint}>Running query…</div>}
          {enabled && error && <div className={styles.error}>⚠ {error}</div>}
          {enabled && !loading && !error && result && (
            <>
              <div className={styles.meta}>
                {result.rowCount} rows · {result.duration} ms
              </div>
              <ChartRenderer
                chartType={chartType}
                result={result}
                spec={spec}
                measures={model.measures}
                labels={labels}
              />
              {showSql && <pre className={styles.sql}>{result.sql}</pre>}
            </>
          )}
        </div>
      </div>

      {saving && (
        <SaveWidgetModal
          datasetId={model.id}
          spec={spec}
          chartType={chartType}
          suggestedTitle={selectedChips.map(c => c.label).slice(0, 3).join(' · ')}
          onClose={() => setSaving(false)}
        />
      )}
    </div>
  );
}
