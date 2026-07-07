/** Grid of saved dashboards for a dataset, with create + delete. */
import { useEffect, useState } from 'react';
import type { DashboardSummary } from '../../../types/bi';
import { biService } from '../../../services/biService';
import styles from './DashboardList.module.css';

interface Props {
  datasetId: string;
  onOpen: (id: number) => void;
}

export function DashboardList({ datasetId, onOpen }: Props) {
  const [items, setItems] = useState<DashboardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const load = () => {
    setLoading(true);
    biService.listDashboards(datasetId)
      .then(list => { setItems(list); setError(null); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, [datasetId]);

  const create = async () => {
    const n = name.trim();
    if (!n) return;
    const dash = await biService.createDashboard(datasetId, n, { widgets: [] });
    setName('');
    setCreating(false);
    onOpen(dash.id);
  };

  const remove = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    await biService.deleteDashboard(id);
    load();
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h2 className={styles.h}>Dashboards</h2>
        {creating ? (
          <div className={styles.createRow}>
            <input className={styles.input} autoFocus placeholder="Dashboard name" value={name}
              onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && create()} />
            <button className={styles.primary} onClick={create}>Create</button>
            <button className={styles.ghost} onClick={() => setCreating(false)}>Cancel</button>
          </div>
        ) : (
          <button className={styles.primary} onClick={() => setCreating(true)}>+ New dashboard</button>
        )}
      </div>

      {loading && <div className={styles.state}>Loading…</div>}
      {error && <div className={styles.stateError}>⚠ {error}</div>}
      {!loading && !error && items.length === 0 && (
        <div className={styles.state}>No dashboards yet. Create one, then pin widgets from the Explorer.</div>
      )}

      <div className={styles.grid}>
        {items.map(d => (
          <div key={d.id} className={styles.card} onClick={() => onOpen(d.id)}>
            <div className={styles.cardTop}>
              <span className={styles.cardName}>{d.name}</span>
              <button className={styles.del} onClick={e => remove(e, d.id)} title="Delete">🗑</button>
            </div>
            <div className={styles.cardMeta}>
              <span className={styles.badge}>{d.widget_count} widget{d.widget_count === 1 ? '' : 's'}</span>
              updated {new Date(d.updated_at).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
