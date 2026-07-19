import { useRef, useState } from 'react';
import type { TrackedMetric } from '../../../types/insights';
import { insightsService } from '../../../services/insightsService';
import styles from './ManageTrackingModal.module.css';

interface Props {
  datasetId: string;
  tracked: TrackedMetric[];
  onClose: () => void;
  /** Called on close so the strip behind the modal reflects whatever order/removals happened here. */
  onChanged: () => void;
}

/**
 * "Manage tracking" — was a dead link. Drag rows to reorder (native HTML5
 * drag-and-drop, no extra library) and untrack anything you don't want
 * pinned anymore. Reorders/untracks apply immediately (optimistic UI, real
 * requests underneath) rather than needing a separate "Save" step.
 */
export function ManageTrackingModal({ datasetId, tracked, onClose, onChanged }: Props) {
  const [items, setItems] = useState(tracked);
  const [dragId, setDragId] = useState<string | null>(null);
  const changed = useRef(false);

  const close = () => {
    if (changed.current) onChanged();
    onClose();
  };

  const persistOrder = (next: TrackedMetric[]) => {
    changed.current = true;
    insightsService.reorderTracked(datasetId, next.map(i => i.id)).catch(() => {});
  };

  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    setItems(cur => {
      const from = cur.findIndex(i => i.id === dragId);
      const to = cur.findIndex(i => i.id === targetId);
      if (from < 0 || to < 0) return cur;
      const next = [...cur];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      persistOrder(next);
      return next;
    });
    setDragId(null);
  };

  const untrack = (id: string) => {
    changed.current = true;
    setItems(cur => cur.filter(i => i.id !== id));
    insightsService.setTracked(datasetId, id, false).catch(() => {});
  };

  return (
    <div className={styles.overlay} onClick={close}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className={styles.header}>
          <div className={styles.headerText}>
            <div className={styles.title}>Manage tracking</div>
            <div className={styles.subtitle}>Drag to reorder · untrack anything you no longer need pinned.</div>
          </div>
          <button className={styles.closeBtn} onClick={close} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className={styles.body}>
          {items.length === 0 && <div className={styles.empty}>Nothing tracked.</div>}
          {items.map(t => (
            <div
              key={t.id}
              className={`${styles.row} ${dragId === t.id ? styles.dragging : ''}`}
              draggable
              onDragStart={() => setDragId(t.id)}
              onDragOver={e => e.preventDefault()}
              onDrop={() => onDrop(t.id)}
              onDragEnd={() => setDragId(null)}
            >
              <span className={styles.handle} aria-hidden="true">⠿</span>
              <div className={styles.rowBody}>
                <div className={styles.rowLabel}>{t.label}</div>
                <div className={styles.rowSub}>{t.value} · {t.sub}</div>
              </div>
              <button className={styles.untrackBtn} onClick={() => untrack(t.id)}>Untrack</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
