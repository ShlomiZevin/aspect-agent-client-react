/**
 * "My Reports" page (design turn 11a) — two sections: Saved reports (whatever
 * you've tracked, same source as the old "Tracked by you" strip — see
 * TrackedStrip) and Suggested reports (system-proposed, not yet
 * saved/dismissed). Replaces the old single "All insights" grid with
 * category-filter pills (InsightsList, design turn 3a) — that filter UI
 * doesn't exist in the new design.
 */
import { useTracked, useInsights } from '../useInsightsFeed';
import { insightsService } from '../../../services/insightsService';
import { MiniChart } from '../Insights/MiniChart';
import { Skeleton } from '../Insights/Skeleton';
import { useLanguage } from '../../../context/LanguageContext';
import styles from './ReportsPage.module.css';

interface Props {
  datasetId: string;
  onOpenInsight: (id: string) => void;
  onOpenHistory: () => void;
}

export function ReportsPage({ datasetId, onOpenInsight, onOpenHistory }: Props) {
  const { t } = useLanguage();
  const { data: tracked, loading: trackedLoading, refetch: refetchTracked } = useTracked(datasetId);
  const { data: insights, loading: insightsLoading, refetch: refetchInsights } = useInsights(datasetId);

  const suggested = (insights || []).filter(i => !i.tracked && i.origin !== 'user');

  const untrack = (id: string) => {
    insightsService.setTracked(datasetId, id, false).then(() => { refetchTracked(); refetchInsights(); }).catch(() => {});
  };
  const save = (id: string) => {
    insightsService.setTracked(datasetId, id, true).then(() => { refetchTracked(); refetchInsights(); }).catch(() => {});
  };

  return (
    <div className={styles.page}>
      <div className={styles.headRow}>
        <div className={styles.title}>{t('intel.reports.title')}</div>
        <div className={styles.updated}>{t('intel.reports.updated')}</div>
        <button className={styles.historyLink} onClick={onOpenHistory}>{t('intel.reports.history')} →</button>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <BookmarkIcon filled />
          <div className={styles.sectionTitle}>{t('intel.reports.saved')}</div>
        </div>
        {trackedLoading && (
          <div className={styles.grid}>
            {[0, 1, 2].map(i => <Skeleton key={i} width="100%" height={150} radius={14} />)}
          </div>
        )}
        {!trackedLoading && (!tracked || tracked.length === 0) && (
          <div className={styles.empty}>{t('intel.reports.savedEmpty')}</div>
        )}
        {!trackedLoading && tracked && tracked.length > 0 && (
          <div className={styles.grid}>
            {tracked.map(item => (
              <div key={item.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <span className={styles.cardLabel}>{item.label}</span>
                  <span className={`${styles.deltaChip} ${styles[item.trendDir]}`}>{item.trendLabel}</span>
                </div>
                <div className={styles.cardValue}>{item.value}</div>
                <MiniChart series={[{ key: item.id, color: '#8B5CF6', points: item.points }]} variant={item.isRanking ? 'bar' : 'line'} height={36} />
                <div className={styles.cardComment}>{item.sub}</div>
                <div className={styles.cardFooter}>
                  <button className={styles.iconBtn} onClick={() => untrack(item.id)} title={t('intel.reports.remove')}><BookmarkIcon filled /></button>
                  <button className={styles.openBtn} onClick={() => onOpenInsight(item.id)}>{t('intel.reports.open')}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.divider} />

      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sparkle}>✦</span>
          <div className={styles.sectionTitle}>{t('intel.reports.suggested')}</div>
          <div className={styles.sectionSub}>{t('intel.reports.suggestedSub')}</div>
        </div>
        {insightsLoading && (
          <div className={styles.grid}>
            {[0, 1, 2].map(i => <Skeleton key={i} width="100%" height={150} radius={14} />)}
          </div>
        )}
        {!insightsLoading && suggested.length === 0 && (
          <div className={styles.empty}>{t('intel.reports.suggestedEmpty')}</div>
        )}
        {!insightsLoading && suggested.length > 0 && (
          <div className={styles.grid}>
            {suggested.map(i => (
              <div key={i.id} className={styles.card}>
                <div className={styles.cardHeadline}>{i.headline}</div>
                <div className={styles.cardImpact} data-dir={i.impactDirection}>
                  {i.impactValue} <span className={styles.cardConfidence}>· {i.confidence}% {t('intel.reports.sure')}</span>
                </div>
                <div className={styles.cardFooter} style={{ marginTop: 'auto' }}>
                  <button className={styles.iconBtn} onClick={() => save(i.id)} title={t('intel.reports.save')}><BookmarkIcon /></button>
                  <button className={styles.openBtn} onClick={() => onOpenInsight(i.id)}>{t('intel.reports.open')}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BookmarkIcon({ filled }: { filled?: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill={filled ? 'var(--ai-accent-2)' : 'none'} stroke="var(--ai-accent-2)" strokeWidth="2.2" strokeLinejoin="round">
      <path d="M6 3.5h12V21l-6-4.6L6 21z" />
    </svg>
  );
}
