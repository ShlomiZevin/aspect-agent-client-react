import { useState } from 'react';
import type { TrackedMetric } from '../../../types/insights';
import { MiniChart } from './MiniChart';
import { Skeleton } from './Skeleton';
import { ManageTrackingModal } from './ManageTrackingModal';
import styles from './TrackedStrip.module.css';

interface Props {
  datasetId: string;
  tracked: TrackedMetric[] | null;
  loading: boolean;
  error: string | null;
  /** Refetches the tracked list — called after Manage Tracking closes, so reorders/untracks show up here too. */
  onChanged: () => void;
  onOpenInsight: (id: string) => void;
}

export function TrackedStrip({ datasetId, tracked, loading, error, onChanged, onOpenInsight }: Props) {
  const [managing, setManaging] = useState(false);
  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div className={styles.title}>Tracked by you</div>
        {/* Not "Refreshed nightly" — this strip is exactly whichever
            insights you've hit Track on, a snapshot from when each was
            found, not a live auto-refreshing feed. */}
        <div className={styles.sub}>From insights you've tracked</div>
        <button className={styles.manage} onClick={() => setManaging(true)} disabled={!tracked || tracked.length === 0}>Manage tracking →</button>
      </div>
      {loading && (
        <div className={styles.grid}>
          {[0, 1, 2].map(i => (
            <div key={i} className={styles.item}>
              <Skeleton width={18} height={18} radius={3} />
              <div className={styles.body}>
                <Skeleton width="70%" height={13} />
                <div style={{ marginTop: 6 }}><Skeleton width="45%" height={11} /></div>
              </div>
              <div className={styles.chartCol}>
                <Skeleton width={72} height={30} radius={6} />
                <div style={{ marginTop: 4 }}><Skeleton width={50} height={10} /></div>
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && error && <div className={styles.state}>⚠ {error}</div>}
      {!loading && !error && tracked && tracked.length === 0 && (
        <div className={styles.empty}>Nothing tracked yet — open an insight and hit "Track" to pin it here.</div>
      )}
      {!loading && !error && tracked && tracked.length > 0 && (
        <div className={styles.grid}>
          {tracked.map(t => (
            <div key={t.id} className={styles.item} onClick={() => onOpenInsight(t.id)} role="button" tabIndex={0}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#C026D3" className={styles.flag}><path d="M6 3.5h12V21l-6-4.6L6 21z" /></svg>
              <div className={styles.body}>
                <div className={styles.label}>{t.label}</div>
                <div className={styles.sub2}>{t.value} · {t.sub}</div>
              </div>
              <div className={styles.chartCol}>
                {/* A ranking (many entities, one snapshot) reads as a bar —
                    a line/sparkline implies a value sampled over time, which
                    would misleadingly suggest rank #1 "declined" into rank #8. */}
                <MiniChart series={[{ key: t.id, color: '#8B5CF6', points: t.points }]} variant={t.isRanking ? 'bar' : 'line'} width={72} height={30} fluid={false} />
                <span className={`${styles.trend} ${styles[t.trendDir]}`} title={t.trendLabel}>{t.trendLabel}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {managing && tracked && (
        <ManageTrackingModal
          datasetId={datasetId}
          tracked={tracked}
          onClose={() => setManaging(false)}
          onChanged={onChanged}
        />
      )}
    </div>
  );
}
