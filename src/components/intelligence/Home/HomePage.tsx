/**
 * Aspect Intelligence home (design turn 10a/10b) — "one job: ask a question".
 * Replaces the old hero+tracked-strip+all-insights-grid layout (InsightsList,
 * design turn 3a): a single big question box, a live "report in progress"
 * card that only appears while something is running, then two compact lists
 * — My saved reports and Last run reports. The full grid (Saved + Suggested)
 * lives on the separate My Reports page now (design turn 11a).
 */
import { useEffect, useMemo, useRef } from 'react';
import { InvestigateHero } from './InvestigateHero';
import { ReportProgressCard } from './ReportProgressCard';
import { HomeRail, useRailExpanded } from './HomeRail';
import { useInsights, useTracked } from '../useInsightsFeed';
import { useJobs, type Job } from '../jobs/JobsContext';
import { useLanguage } from '../../../context/LanguageContext';
import { formatRelativeDateTime } from '../dateFormat';
import styles from './HomePage.module.css';

interface Props {
  datasetId: string;
  /** Anon session id (see IntelligenceShell's UserProvider) — null until the async create finishes. */
  userId: string | null;
  onOpenInsight: (id: string) => void;
  onAskInChat: (question: string) => void;
  onSeeAllReports: () => void;
  onOpenHistory: () => void;
}

function greetingKey(): string {
  const h = new Date().getHours();
  if (h < 12) return 'intel.home.greeting.morning';
  if (h < 18) return 'intel.home.greeting.afternoon';
  return 'intel.home.greeting.evening';
}

export function HomePage({ datasetId, userId, onOpenInsight, onAskInChat, onSeeAllReports, onOpenHistory }: Props) {
  const { t } = useLanguage();
  const { data: insights, refetch } = useInsights(datasetId, userId);
  const { data: tracked, loading: trackedLoading } = useTracked(datasetId, userId);
  const { jobs, restartJob, selectJob, cancelJob } = useJobs();

  // A job finishing in the background needs to make its report show up in
  // "Last run reports" without a manual page reload.
  const seenCompleted = useRef(new Set<string>());
  useEffect(() => {
    const freshlyDone = jobs.filter(j => j.status === 'completed' && !seenCompleted.current.has(j.id));
    if (freshlyDone.length === 0) return;
    freshlyDone.forEach(j => seenCompleted.current.add(j.id));
    refetch();
  }, [jobs, refetch]);

  const runningJob = jobs.find(j => j.status === 'running');

  const openJobResult = (job: Job) => {
    const firstId = job.result?.insightIds[0];
    cancelJob(job.id);
    if (firstId) onOpenInsight(firstId);
  };

  // Last run reports: active jobs (running/completed-not-yet-reviewed/error)
  // first, then the most recent already-settled reports that aren't
  // represented by one of those jobs — capped at 3 rows (design turn 10a/10b).
  const jobInsightIds = new Set(jobs.flatMap(j => j.result?.insightIds || []));
  const recentInsights = useMemo(
    () => [...(insights || [])].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    [insights],
  );
  const lastRunRows = [
    ...[...jobs].reverse().map(j => ({ kind: 'job' as const, job: j })),
    ...recentInsights.filter(i => !jobInsightIds.has(i.id)).map(i => ({ kind: 'insight' as const, insight: i })),
  ].slice(0, 3);

  const savedCount = tracked?.length ?? 0;
  const totalCount = insights?.length ?? 0;
  const { expanded: railExpanded, toggle: toggleRail } = useRailExpanded(datasetId);
  // Recent Reports in the expanded rail (design turn 7c/9c) — 2 most recent
  // reports not already shown as Saved, same idea as "Last run reports"
  // below but without job/status noise, matching the design's plain list.
  const railRecent = useMemo(
    () => recentInsights.filter(i => !i.tracked).slice(0, 2),
    [recentInsights],
  );

  return (
    <div className={styles.outer}>
      <HomeRail
        expanded={railExpanded}
        onToggleExpanded={toggleRail}
        tracked={tracked}
        recent={railRecent}
        totalCount={totalCount}
        onOpenInsight={onOpenInsight}
        onOpenAll={onSeeAllReports}
        onOpenHistory={onOpenHistory}
      />
      <div className={styles.page}>
        <div className={styles.greetingBlock}>
          <div className={styles.greeting}>{t(greetingKey())}</div>
          <div className={styles.subtitle}>{t('intel.home.subtitle')}</div>
        </div>

        <InvestigateHero datasetId={datasetId} userId={userId} onAskInChat={onAskInChat} />

        {runningJob && <ReportProgressCard job={runningJob} />}

        <div className={styles.twoCol}>
          <div className={styles.panel}>
            <div className={styles.panelTitle}>{t('intel.home.saved')} <span className={styles.panelCount}>· {savedCount}</span></div>
            {trackedLoading && <div className={styles.panelEmpty}>…</div>}
            {!trackedLoading && savedCount === 0 && <div className={styles.panelEmpty}>{t('intel.home.savedEmpty')}</div>}
            {!trackedLoading && tracked && tracked.slice(0, 3).map(item => (
              <button key={item.id} className={styles.row} onClick={() => onOpenInsight(item.id)}>
                <BookmarkIcon />
                <span className={styles.rowLabel}>{item.label}</span>
                <span className={styles.rowAction}>{t('intel.home.open')}</span>
              </button>
            ))}
          </div>

          <div className={styles.panel}>
            <div className={styles.panelTitle}>{t('intel.home.lastRun')}</div>
            {lastRunRows.length === 0 && <div className={styles.panelEmpty}>{t('intel.home.lastRunEmpty')}</div>}
            {lastRunRows.map(row => row.kind === 'job'
              ? <JobRow key={row.job.id} job={row.job} onOpen={() => openJobResult(row.job)} onRestart={() => restartJob(datasetId, row.job.id)} onOpenSidebar={() => selectJob(row.job.id)} />
              : <InsightRow key={row.insight.id} insight={row.insight} onOpen={() => onOpenInsight(row.insight.id)} />
            )}
          </div>
        </div>

        <button className={styles.seeAll} onClick={onSeeAllReports}>{t('intel.home.seeAll')} ({totalCount}) →</button>
      </div>
    </div>
  );
}

function JobRow({ job, onOpen, onRestart, onOpenSidebar }: { job: Job; onOpen: () => void; onRestart: () => void; onOpenSidebar: () => void }) {
  const { t } = useLanguage();
  if (job.status === 'running') {
    return (
      <button className={styles.row} onClick={onOpenSidebar}>
        <span className={`${styles.statusDot} ${styles.dotRunning}`} />
        <span className={styles.rowLabel}>{job.prompt || '…'}</span>
        <span className={styles.rowStatusRunning}>{t('intel.home.inProgress')} · {job.progress}%</span>
      </button>
    );
  }
  if (job.status === 'error') {
    return (
      <button className={styles.row} onClick={onRestart}>
        <span className={`${styles.statusDot} ${styles.dotError}`} />
        <span className={styles.rowLabel}>{job.prompt}</span>
        <span className={styles.rowStatusError}>{t('intel.home.failed')}</span>
      </button>
    );
  }
  return (
    <button className={styles.row} onClick={onOpen}>
      <span className={`${styles.statusDot} ${styles.dotReady}`} />
      <span className={styles.rowLabel}>{job.prompt}</span>
      <span className={styles.rowStatusReady}>{t('intel.home.ready')}</span>
    </button>
  );
}

function InsightRow({ insight, onOpen }: { insight: { id: string; headline: string; createdAt?: number; viewed?: boolean }; onOpen: () => void }) {
  const { t, language } = useLanguage();
  return (
    <button className={styles.row} onClick={onOpen}>
      <span className={`${styles.statusDot} ${styles.dotMuted}`} />
      <span className={styles.rowLabel}>{insight.headline}</span>
      <span className={styles.rowStatusMuted}>
        {insight.viewed
          ? <>{t('intel.home.viewed')} {insight.createdAt && formatRelativeDateTime(insight.createdAt, language)}</>
          : t('intel.home.ready')}
      </span>
    </button>
  );
}

function BookmarkIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="var(--ai-accent-2)" style={{ flex: 'none' }}>
      <path d="M6 3.5h12V21l-6-4.6L6 21z" />
    </svg>
  );
}
