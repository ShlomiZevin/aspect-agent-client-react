/**
 * A saved dashboard: grid of widgets sharing one interactive cross-filter.
 * Click any category (bar, pie slice, table row) to filter every widget by it;
 * click again or "Clear" to reset.
 */
import { useCallback, useEffect, useState } from 'react';
import type { Dashboard, DatasetModel } from '../../../types/bi';
import { biService } from '../../../services/biService';
import { Widget, type CrossFilter } from './Widget';
import { buildLabels } from '../labels';
import styles from './DashboardView.module.css';

interface Props {
  dashboardId: number;
  model: DatasetModel;
  onBack: () => void;
}

export function DashboardView({ dashboardId, model, onBack }: Props) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [crossFilter, setCrossFilter] = useState<CrossFilter | null>(null);
  const [editable, setEditable] = useState(false);
  const labels = buildLabels(model);

  useEffect(() => {
    setLoading(true);
    biService.getDashboard(dashboardId)
      .then(d => { setDashboard(d); setError(null); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [dashboardId]);

  const handleSelect = useCallback((dimId: string, value: string) => {
    setCrossFilter(cur => (cur && cur.dimId === dimId && cur.value === value ? null : { dimId, value }));
  }, []);

  const removeWidget = async (widgetId: string) => {
    if (!dashboard) return;
    const widgets = dashboard.definition.widgets.filter(w => w.id !== widgetId);
    const updated = await biService.updateDashboard(dashboard.id, { definition: { widgets } });
    setDashboard(updated);
  };

  if (loading) return <div className={styles.state}>Loading dashboard…</div>;
  if (error) return <div className={styles.stateError}>⚠ {error}</div>;
  if (!dashboard) return null;

  const widgets = dashboard.definition.widgets || [];

  return (
    <div className={styles.view}>
      <div className={styles.bar}>
        <button className={styles.back} onClick={onBack}>← Dashboards</button>
        <h2 className={styles.name}>{dashboard.name}</h2>
        <div className={styles.spacer} />
        {crossFilter && (
          <span className={styles.crossPill}>
            {labels[crossFilter.dimId] ?? crossFilter.dimId}: <strong>{crossFilter.value}</strong>
            <button className={styles.clear} onClick={() => setCrossFilter(null)}>×</button>
          </span>
        )}
        <button className={styles.editToggle} onClick={() => setEditable(e => !e)}>
          {editable ? 'Done' : 'Edit'}
        </button>
      </div>

      {widgets.length === 0 ? (
        <div className={styles.empty}>
          No widgets yet. Build a query in the Explorer and use “Save to dashboard”.
        </div>
      ) : (
        <div className={styles.grid}>
          {widgets.map(w => (
            <Widget
              key={w.id}
              widget={w}
              model={model}
              crossFilter={crossFilter}
              onSelect={handleSelect}
              onRemove={() => removeWidget(w.id)}
              editable={editable}
            />
          ))}
        </div>
      )}
    </div>
  );
}
