/**
 * Left-hand field catalog for the Explorer. Searchable; lists measures and
 * dimensions (grouped). Clicking toggles a field into the current query spec.
 */
import { useMemo, useState } from 'react';
import type { DatasetModel } from '../../../types/bi';
import styles from './FieldPanel.module.css';

interface Props {
  model: DatasetModel;
  activeDimensions: string[];
  activeMeasures: string[];
  onToggleDimension: (id: string) => void;
  onToggleMeasure: (id: string) => void;
}

const GROUP_ICON: Record<string, string> = {
  Time: '◷', Store: '⌂', Product: '❑', 'Sales context': '⊞', Customer: '☺',
};

export function FieldPanel({ model, activeDimensions, activeMeasures, onToggleDimension, onToggleMeasure }: Props) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const match = (label: string, id: string) =>
    !query || label.toLowerCase().includes(query) || id.includes(query);

  const measures = model.measures.filter(m => match(m.label, m.id));

  const grouped = useMemo(() => {
    const groups: Record<string, typeof model.dimensions> = {};
    for (const d of model.dimensions) {
      if (!match(d.label, d.id) && !(d.labelHe && d.labelHe.includes(q.trim()))) continue;
      (groups[d.group] ||= []).push(d);
    }
    return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.dimensions, query]);

  return (
    <aside className={styles.panel}>
      <div className={styles.searchWrap}>
        <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
        </svg>
        <input className={styles.search} placeholder="Search fields…" value={q}
          onChange={e => setQ(e.target.value)} />
        {q && <button className={styles.clear} onClick={() => setQ('')}>×</button>}
      </div>

      <div className={styles.scroll}>
        <div className={styles.section}>
          <h3 className={styles.heading}><span className={styles.hicon}>∑</span> Measures</h3>
          <div className={styles.chips}>
            {measures.map(m => (
              <button key={m.id}
                className={`${styles.chip} ${styles.measure} ${activeMeasures.includes(m.id) ? styles.active : ''}`}
                onClick={() => onToggleMeasure(m.id)} title={m.label}>
                {m.label}
              </button>
            ))}
            {measures.length === 0 && <span className={styles.none}>No matches</span>}
          </div>
        </div>

        {Object.entries(grouped).map(([group, dims]) => (
          <div key={group} className={styles.section}>
            <h3 className={styles.heading}>
              <span className={styles.hicon}>{GROUP_ICON[group] ?? '◆'}</span> {group}
            </h3>
            <div className={styles.chips}>
              {dims.map(d => (
                <button key={d.id}
                  className={`${styles.chip} ${styles.dimension} ${activeDimensions.includes(d.id) ? styles.active : ''}`}
                  onClick={() => onToggleDimension(d.id)}
                  title={d.labelHe ? `${d.label} · ${d.labelHe}` : d.label}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
