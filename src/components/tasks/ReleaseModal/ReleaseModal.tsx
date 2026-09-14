import { useEffect, useState } from 'react';
import type { ReleaseCandidate } from '../../../types/task';
import * as taskService from '../../../services/taskService';
import styles from './ReleaseModal.module.css';

interface ReleaseModalProps {
  isOpen: boolean;
  identity?: string;
  onClose: () => void;
  onReleased: () => void;
}

function formatDoneAt(iso?: string | null): string {
  if (!iso) return 'Done earlier';
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Done today';
  if (diffDays === 1) return 'Done yesterday';
  if (diffDays < 7) return `Done ${diffDays}d ago`;
  return `Done ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}

/**
 * Shlomi's Release window: every task that is Done and not yet released since it was done,
 * newest "moved to Done" first. Ticked tasks are marked deployed in one go.
 */
export function ReleaseModal({ isOpen, identity, onClose, onReleased }: ReleaseModalProps) {
  const [candidates, setCandidates] = useState<ReleaseCandidate[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isReleasing, setIsReleasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setIsLoading(true);
    setError(null);
    taskService.getReleaseCandidates()
      .then(list => {
        if (!active) return;
        setCandidates(list);
        setSelected(new Set(list.map(t => t.id)));
      })
      .catch(err => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load the release list');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const allSelected = candidates.length > 0 && selected.size === candidates.length;

  const toggle = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(candidates.map(t => t.id)));
  };

  const handleNotForRelease = async (id: number) => {
    setCandidates(prev => prev.filter(t => t.id !== id));
    setSelected(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    try {
      await taskService.updateTask(id, { notForRelease: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not update #${id}`);
    }
  };

  const handleRelease = async () => {
    if (selected.size === 0) return;
    setIsReleasing(true);
    setError(null);
    try {
      await taskService.releaseTasks([...selected], identity);
      onReleased();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Release failed');
    } finally {
      setIsReleasing(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Release" onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>🚀 Release</h3>
          <span className={styles.subtitle}>{isLoading ? '' : `${candidates.length} waiting`}</span>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className={styles.toolbar}>
          <label className={styles.selectAll}>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              disabled={candidates.length === 0}
            />
            Select all
          </label>
        </div>

        <div className={styles.list}>
          {isLoading ? (
            <div className={styles.empty}>Loading…</div>
          ) : candidates.length === 0 ? (
            <div className={styles.empty}>Nothing waiting for release.</div>
          ) : (
            candidates.map(t => {
              const isSelected = selected.has(t.id);
              return (
                <div key={t.id} className={`${styles.row} ${isSelected ? '' : styles.rowUnselected}`}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={isSelected}
                    onChange={() => toggle(t.id)}
                    aria-label={`Release #${t.id}`}
                  />
                  <div className={styles.rowMain} onClick={() => toggle(t.id)}>
                    <div className={styles.rowTitle} dir="auto">{t.title}</div>
                    {t.whatsNewHeadline && (
                      <div className={styles.rowHeadline} dir="auto">🎁 {t.whatsNewHeadline}</div>
                    )}
                    <div className={styles.rowMeta}>
                      <span>#{t.id}</span>
                      {t.assignee && <span>{t.assignee}</span>}
                      <span>{formatDoneAt(t.doneAt)}</span>
                      {!t.whatChanged?.trim() && <span className={styles.missing}>No What changed</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={styles.skipBtn}
                    onClick={() => handleNotForRelease(t.id)}
                    title="Remove from the release list"
                  >
                    Not for release
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className={styles.errorSlot}>{error}</div>

        <div className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button
            type="button"
            className={styles.releaseBtn}
            onClick={handleRelease}
            disabled={selected.size === 0 || isReleasing}
          >
            {isReleasing ? 'Releasing…' : `Mark ${selected.size} as released`}
          </button>
        </div>
      </div>
    </div>
  );
}
