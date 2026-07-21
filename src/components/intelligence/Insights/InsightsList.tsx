import { useEffect, useMemo, useRef, useState } from 'react';
import { InvestigateHero } from '../Home/InvestigateHero';
import { InsightCard, InsightCardSkeleton } from './InsightCard';
import { TrackedStrip } from './TrackedStrip';
import { useInsights, useTracked } from '../useInsightsFeed';
import { insightsService } from '../../../services/insightsService';
import { useJobs } from '../jobs/JobsContext';
import { JobStrip } from '../jobs/JobStrip';
import type { InsightCategory } from '../../../types/insights';
import styles from './InsightsList.module.css';

const CATEGORIES: { key: InsightCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'cross-sell', label: 'Cross-sell' },
  { key: 'margin', label: 'Margin' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'trend', label: 'Trend' },
  { key: 'risk', label: 'Risk' },
];

interface Props {
  datasetId: string;
  onOpenInsight: (id: string) => void;
  onAskInChat: (question: string) => void;
}

export function InsightsList({ datasetId, onOpenInsight, onAskInChat }: Props) {
  // Two independent requests, two independent loaders — insights are an
  // instant in-memory read, tracked metrics run real SQL and are visibly
  // slower; bundling them into one loading gate meant the whole page waited
  // on the slower one for no reason.
  const { data: insights, loading: insightsLoading, error: insightsError, refetch } = useInsights(datasetId);
  const { data: tracked, loading: trackedLoading, error: trackedError, refetch: refetchTracked } = useTracked(datasetId);
  const [filter, setFilter] = useState<InsightCategory | 'all'>('all');
  const { jobs } = useJobs();

  // The grid otherwise only loads once on mount — a job finishing in the
  // background (header badge / JobStrip both go to "completed") had no way
  // to make the new insight show up here without a manual page reload.
  const seenCompleted = useRef(new Set<string>());
  useEffect(() => {
    const freshlyDone = jobs.filter(j => j.status === 'completed' && !seenCompleted.current.has(j.id));
    if (freshlyDone.length === 0) return;
    freshlyDone.forEach(j => seenCompleted.current.add(j.id));
    refetch();
  }, [jobs, refetch]);

  const filtered = useMemo(() => {
    if (!insights) return [];
    return filter === 'all' ? insights : insights.filter(i => i.category === filter);
  }, [insights, filter]);

  const deleteInsight = (id: string) => {
    insightsService.deleteInsight(datasetId, id).then(refetch).catch(() => {});
  };

  return (
    <div className={styles.page}>
      <div className={styles.heroBlock}>
        <InvestigateHero datasetId={datasetId} onAskInChat={onAskInChat} />
        <JobStrip datasetId={datasetId} onOpenInsight={onOpenInsight} />
      </div>

      <TrackedStrip datasetId={datasetId} tracked={tracked} loading={trackedLoading} error={trackedError} onChanged={refetchTracked} onOpenInsight={onOpenInsight} />

      <div className={styles.section}>
        <div className={styles.head}>
          <div className={styles.title}>All insights</div>
          <div className={styles.pills}>
            {CATEGORIES.map(c => (
              <button
                key={c.key}
                className={`${styles.pill} ${filter === c.key ? styles.pillActive : ''}`}
                onClick={() => setFilter(c.key)}
                disabled={insightsLoading}
              >
                {c.label}{c.key === 'all' && insights ? ` · ${insights.length}` : ''}
              </button>
            ))}
          </div>
          {/* "Sort: Impact" hidden for now — not a real, working sort yet. */}
        </div>

        {insightsLoading && (
          <div className={styles.grid}>
            {[0, 1, 2].map(i => <InsightCardSkeleton key={i} />)}
          </div>
        )}
        {!insightsLoading && insightsError && <div className={styles.state}>⚠ {insightsError}</div>}
        {!insightsLoading && !insightsError && insights && (
          <div className={styles.grid}>
            {filtered.map(i => <InsightCard key={i.id} insight={i} onOpen={onOpenInsight} onDelete={deleteInsight} />)}
            {/* "Request a new insight" card hidden for now, per Kosta. */}
          </div>
        )}
      </div>
    </div>
  );
}
