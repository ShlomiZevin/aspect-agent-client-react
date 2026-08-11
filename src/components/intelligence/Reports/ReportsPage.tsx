/**
 * "My Reports" page (design turn 11a) — two sections: Saved reports (whatever
 * you've tracked, same source as the old "Tracked by you" strip — see
 * TrackedStrip) and Suggested reports (system-proposed, not yet
 * saved/dismissed). Replaces the old single "All insights" grid with
 * category-filter pills (InsightsList, design turn 3a) — that filter UI
 * doesn't exist in the new design.
 */
import { useNavigate } from 'react-router-dom';
import { useTracked, useInsights } from '../useInsightsFeed';
import { insightsService } from '../../../services/insightsService';
import { MiniChart } from '../Insights/MiniChart';
import { Skeleton } from '../Insights/Skeleton';
import { useLanguage } from '../../../context/LanguageContext';
import styles from './ReportsPage.module.css';

interface Props {
  datasetId: string;
  /** Anon session id (see IntelligenceShell's UserProvider) — null until the async create finishes. */
  userId: string | null;
  onOpenInsight: (id: string) => void;
  onOpenHistory: () => void;
}

export function ReportsPage({ datasetId, userId, onOpenInsight, onOpenHistory }: Props) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { data: tracked, loading: trackedLoading, refetch: refetchTracked } = useTracked(datasetId, userId);
  const { data: insights, loading: insightsLoading, refetch: refetchInsights } = useInsights(datasetId, userId);

  const suggested = (insights || []).filter(i => !i.tracked && i.origin !== 'user');

  const untrack = (id: string) => {
    if (!userId) return;
    insightsService.setTracked(datasetId, userId, id, false).then(() => { refetchTracked(); refetchInsights(); }).catch(() => {});
  };
  const save = (id: string) => {
    if (!userId) return;
    insightsService.setTracked(datasetId, userId, id, true).then(() => { refetchTracked(); refetchInsights(); }).catch(() => {});
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
        {/* An empty page that only states a fact leaves the user with nothing
            to do — and "check back after tonight's run" is misleading when
            asking a question right now is the actual path to a report. Offer
            that instead. */}
        {!insightsLoading && suggested.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon} aria-hidden="true">✦</div>
            <div className={styles.emptyTitle}>{t('intel.reports.suggestedEmptyTitle')}</div>
            <div className={styles.emptyBody}>{t('intel.reports.suggestedEmptyBody')}</div>
            <button className={styles.emptyCta} onClick={() => navigate(`/intelligence/${datasetId}`)}>{t('intel.reports.suggestedEmptyCta')}</button>
          </div>
        )}
        {!insightsLoading && suggested.length > 0 && (
          <div className={styles.grid}>
            {suggested.map(i => (
              <div key={i.id} className={styles.card}>
                <div className={styles.cardHeadline}>{i.headline}</div>
                {/* The preview chart already travels on every summary
                    (chartPreview) — it was simply never rendered here, so a
                    suggestion was a wall of text while a saved report got a
                    sparkline. Same data, same component as the saved cards. */}
                {i.chartPreview?.series?.[0]?.points?.length > 1 && (
                  <div className={styles.cardChart}>
                    <MiniChart
                      series={i.chartPreview.series}
                      variant={isTimeSeries(i.chartPreview.categories) ? 'line' : 'bar'}
                      height={40}
                    />
                  </div>
                )}
                <div className={styles.cardImpact} data-dir={i.impactDirection}>
                  {/* impactValue is a plain unlocalized number string (e.g. "-₪386K") —
                      isolated as its own LTR run so RTL doesn't reorder the minus
                      sign/currency symbol around the digits; the rest of the line
                      (including the translated "sure") stays in normal flow. */}
                  <span dir="ltr">{i.impactValue}</span> <span className={styles.cardConfidence}>· {i.confidence}% {t('intel.reports.sure')}</span>
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


/**
 * Calendar-shaped categories (months, quarters, week numbers, bare years) are a
 * genuine TIME TREND and read correctly as a line. Anything else — store,
 * product or campaign names — is a ranked snapshot, where a line would imply a
 * before/after between rank #1 and rank #8 that does not exist. Mirrors
 * looksLikeTimeSeries() in investigation.service.js.
 */
const TIME_CATEGORY = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|q[1-4]|w(eek)?\s?\d{1,2}|\d{4})/i;
function isTimeSeries(categories: string[] = []): boolean {
  return categories.length > 0 && categories.every(c => TIME_CATEGORY.test(String(c).trim()));
}

function BookmarkIcon({ filled }: { filled?: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill={filled ? 'var(--ai-accent-2)' : 'none'} stroke="var(--ai-accent-2)" strokeWidth="2.2" strokeLinejoin="round">
      <path d="M6 3.5h12V21l-6-4.6L6 21z" />
    </svg>
  );
}
