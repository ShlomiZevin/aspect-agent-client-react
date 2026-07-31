/** In-process sidebar (design turn 4b) — step-by-step detail for a running, completed, or errored job. */
import { useJobs, type Job } from './JobsContext';
import { STEP_SCRIPT, stepStatus } from './investigationSteps';
import { useLanguage } from '../../../context/LanguageContext';
import styles from './JobSidebar.module.css';

interface Props {
  datasetId: string;
  onReview: (job: Job) => void;
}

export function JobSidebar({ datasetId, onReview }: Props) {
  const { t } = useLanguage();
  const { jobs, selectedJobId, selectJob, cancelJob, restartJob } = useJobs();
  const job = jobs.find(j => j.id === selectedJobId);
  if (!job) return null;

  // A job can finish WHILE this sidebar is open (investigations run 30-90s,
  // plenty of time to be watching) — completed reuses the exact same
  // progress-block + step-list layout as running rather than the panel
  // going blank the instant status flips, just entirely green/done instead
  // of mid-flight. job.progress is already 100 on completion, so every step
  // naturally reads as done with no separate branching needed for the steps.
  const showProgress = job.status === 'running' || job.status === 'completed';
  const activeStepIndex = STEP_SCRIPT.findIndex((_, i) => stepStatus(job.progress, i) !== 'done');
  const startedLabel = new Date(job.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  // The fake ramp caps at 96% within ~8s, but a real investigation runs far
  // longer — past that cap, a number derived from the same 8s window would
  // keep claiming "~1s left" for the next minute. Say so honestly instead.
  const nearCap = job.progress >= 90;
  const secondsLeft = Math.max(1, Math.round((100 - job.progress) / 100 * 8));

  const statusMeta = job.status === 'error'
    ? { className: styles.statusError, label: t('intel.sidebar.statusFailed') }
    : job.status === 'completed'
      ? { className: styles.statusDone, label: t('intel.sidebar.statusDone') }
      : { className: styles.statusRunning, label: t('intel.sidebar.statusRunning') };

  return (
    <>
      <div className={styles.scrim} onClick={() => selectJob(null)} />
      <div className={styles.panel}>
        <div className={styles.head}>
          <span className={styles.kicker}>{t('intel.sidebar.kicker')}</span>
          <span className={statusMeta.className}>
            <span className={styles.statusDot} />
            {statusMeta.label}
          </span>
          <button className={styles.closeBtn} onClick={() => selectJob(null)} aria-label="Close">✕</button>
        </div>

        <div className={styles.title}>{job.prompt}</div>
        <div className={styles.meta}>
          {t('intel.sidebar.requestedBy')} · {t('intel.sidebar.started')} {startedLabel}
          {job.status === 'running' && (nearCap ? ` · ${t('intel.progress.finishing')}` : ` · ~${secondsLeft}s ${t('intel.progress.left')}`)}
          {job.status === 'completed' && ` · ${t('intel.sidebar.readyToReview')}`}
        </div>

        {job.status === 'error' && (
          <div className={styles.errorBox}>{job.errorMessage || t('intel.sidebar.errorDefault')}</div>
        )}

        {showProgress && (
          <div className={`${styles.progressBlock} ${job.status === 'completed' ? styles.progressBlockDone : ''}`}>
            <div className={styles.progressLabelRow}>
              <span>{t('intel.sidebar.overallProgress')}</span>
              <b className={job.status === 'completed' ? styles.progressPctDone : ''}>{job.progress}%</b>
            </div>
            <div className={styles.progressTrack}><div className={`${styles.progressFill} ${job.status === 'completed' ? styles.progressFillDone : ''}`} style={{ width: `${job.progress}%` }} /></div>
            {job.status === 'completed' ? (
              <div className={styles.progressSub}>{t('intel.sidebar.allStepsComplete')} · {t('intel.sidebar.readyToReview')}</div>
            ) : activeStepIndex >= 0 && (
              <div className={styles.progressSub}>{t('intel.sidebar.step')} {activeStepIndex + 1} {t('intel.history.of')} {STEP_SCRIPT.length} · {t(STEP_SCRIPT[activeStepIndex].descKey)}</div>
            )}
          </div>
        )}

        {showProgress && (
          <>
            <div className={styles.stepsTitle}>{t('intel.sidebar.steps')}</div>
            <div className={styles.steps}>
              {STEP_SCRIPT.map((step, i) => {
                const status = stepStatus(job.progress, i);
                const statusClass = status === 'done' ? styles.stepDone : status === 'active' ? styles.stepActive : styles.stepPending;
                return (
                  <div key={step.labelKey} className={`${styles.step} ${statusClass}`}>
                    <div className={styles.stepCol}>
                      <span className={styles.stepIcon}>{status === 'done' ? '✓' : status === 'pending' ? i + 1 : ''}</span>
                      {i < STEP_SCRIPT.length - 1 && <span className={styles.stepLine} />}
                    </div>
                    <div className={styles.stepBody}>
                      <span className={styles.stepLabel}>{t(step.labelKey)}</span>
                      <div className={styles.stepDesc}>{t(step.descKey)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className={styles.footer}>
          {job.status === 'error' ? (
            <button className={styles.restartBtn} onClick={() => restartJob(datasetId, job.id)}>{t('intel.sidebar.restart')} ↻</button>
          ) : job.status === 'completed' ? (
            <button className={styles.reviewBtn} onClick={() => onReview(job)}>{t('intel.sidebar.reviewResults')} →</button>
          ) : (
            <button className={styles.cancelBtn} onClick={() => cancelJob(job.id)}>{t('intel.sidebar.cancelJob')}</button>
          )}
        </div>
      </div>
    </>
  );
}
