/**
 * "Save to dashboard" modal. Pins the current Explorer spec as a widget onto
 * an existing dashboard or a brand-new one.
 */
import { useEffect, useState } from 'react';
import type { QuerySpec, ChartType, DashboardSummary } from '../../../types/bi';
import { biService } from '../../../services/biService';
import styles from './SaveWidgetModal.module.css';

interface Props {
  datasetId: string;
  spec: QuerySpec;
  chartType: ChartType;
  suggestedTitle: string;
  onClose: () => void;
}

export function SaveWidgetModal({ datasetId, spec, chartType, suggestedTitle, onClose }: Props) {
  const [dashboards, setDashboards] = useState<DashboardSummary[]>([]);
  const [target, setTarget] = useState<'new' | number>('new');
  const [newName, setNewName] = useState('');
  const [title, setTitle] = useState(suggestedTitle || 'Untitled widget');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    biService.listDashboards(datasetId)
      .then(list => {
        setDashboards(list);
        if (list.length > 0) setTarget(list[0].id);
      })
      .catch(() => { /* keep 'new' */ });
  }, [datasetId]);

  const widgetId = () => `w_${Math.random().toString(36).slice(2, 9)}`;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const widget = { id: widgetId(), title: title.trim() || 'Untitled', chartType, spec };
      if (target === 'new') {
        const name = newName.trim();
        if (!name) { setError('Enter a dashboard name'); setSaving(false); return; }
        await biService.createDashboard(datasetId, name, { widgets: [widget] });
      } else {
        const dash = await biService.getDashboard(target);
        const widgets = [...(dash.definition.widgets || []), widget];
        await biService.updateDashboard(target, { definition: { widgets } });
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.title}>Save to dashboard</h2>

        <label className={styles.label}>Widget title</label>
        <input className={styles.input} value={title} onChange={e => setTitle(e.target.value)} />

        <label className={styles.label}>Destination</label>
        <div className={styles.options}>
          {dashboards.map(d => (
            <label key={d.id} className={styles.radio}>
              <input type="radio" checked={target === d.id} onChange={() => setTarget(d.id)} />
              <span>{d.name} <em>({d.widget_count} widgets)</em></span>
            </label>
          ))}
          <label className={styles.radio}>
            <input type="radio" checked={target === 'new'} onChange={() => setTarget('new')} />
            <span>New dashboard…</span>
          </label>
          {target === 'new' && (
            <input className={styles.input} autoFocus placeholder="Dashboard name"
              value={newName} onChange={e => setNewName(e.target.value)} />
          )}
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.actions}>
          <button className={styles.cancel} onClick={onClose} disabled={saving}>Cancel</button>
          <button className={styles.save} onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save widget'}
          </button>
        </div>
      </div>
    </div>
  );
}
