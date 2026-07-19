/** In-process sidebar (design turn 4b) — step-by-step detail for a running, completed, or errored job. */
import { useJobs, type Job } from './JobsContext';
import styles from './JobSidebar.module.css';

const STEP_SCRIPT = [
  { label: 'Scope the question', description: 'Mapped your question to the relevant data areas.' },
  { label: 'Scan sales & targets', description: 'Aggregating relevant rows across stores and time.' },
  { label: 'Correlate signals', description: 'Cross-checking patterns across dimensions.' },
  { label: 'Stress-test findings', description: 'Validating against seasonality and outliers.' },
  { label: 'Compose the insight', description: 'Quantifying impact, confidence and recommendations.' },
];

function stepStatus(progress: number, index: number): 'done' | 'active' | 'pending' {
  const threshold = (index + 1) * (100 / STEP_SCRIPT.length);
  const prevThreshold = index * (100 / STEP_SCRIPT.length);
  if (progress >= threshold) return 'done';
  if (progress >= prevThreshold) return 'active';
  return 'pending';
}

interface Props {
  datasetId: string;
  onReview: (job: Job) => void;
}

export function JobSidebar({ datasetId, onReview }: Props) {
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
  const currentStepIndex = STEP_SCRIPT.findIndex((_, i) => stepStatus(job.progress, i) !== 'done');
  const startedLabel = new Date(job.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  // The fake ramp caps at 96% within ~8s, but a real investigation runs far
  // longer — past that cap, a number derived from the same 8s window would
  // keep claiming "~1s left" for the next minute. Say so honestly instead.
  const nearCap = job.progress >= 90;
  const secondsLeft = Math.max(1, Math.round((100 - job.progress) / 100 * 8));

  const statusMeta = job.status === 'error'
    ? { className: styles.statusError, label: 'FAILED' }
    : job.status === 'completed'
      ? { className: styles.statusDone, label: 'DONE' }
      : { className: styles.statusRunning, label: 'IN PROCESS' };

  return (
    <>
      <div className={styles.scrim} onClick={() => selectJob(null)} />
      <div className={styles.panel}>
        <div className={styles.head}>
          <span className={styles.kicker}>INVESTIGATION</span>
          <span className={statusMeta.className}>
            <span className={styles.statusDot} />
            {statusMeta.label}
          </span>
          <button className={styles.closeBtn} onClick={() => selectJob(null)} aria-label="Close">✕</button>
        </div>

        <div className={styles.title}>{job.prompt}</div>
        <div className={styles.meta}>
          Requested by you · started {startedLabel}
          {job.status === 'running' && (nearCap ? ' · finishing up…' : ` · est. ~${secondsLeft}s left`)}
          {job.status === 'completed' && ' · ready to review'}
        </div>

        {job.status === 'error' && (
          <div className={styles.errorBox}>{job.errorMessage || 'Something went wrong while running this investigation.'}</div>
        )}

        {showProgress && (
          <div className={`${styles.progressBlock} ${job.status === 'completed' ? styles.progressBlockDone : ''}`}>
            <div className={styles.progressLabelRow}>
              <span>Overall progress</span>
              <b className={job.status === 'completed' ? styles.progressPctDone : ''}>{job.progress}%</b>
            </div>
            <div className={styles.progressTrack}><div className={`${styles.progressFill} ${job.status === 'completed' ? styles.progressFillDone : ''}`} style={{ width: `${job.progress}%` }} /></div>
            {job.status === 'completed' ? (
              <div className={styles.progressSub}>All 5 steps complete · ready to review</div>
            ) : currentStepIndex >= 0 && (
              <div className={styles.progressSub}>Step {currentStepIndex + 1} of {STEP_SCRIPT.length} · {STEP_SCRIPT[currentStepIndex].description}</div>
            )}
          </div>
        )}

        {showProgress && (
          <>
            <div className={styles.stepsTitle}>STEPS</div>
            <div className={styles.steps}>
              {STEP_SCRIPT.map((step, i) => {
                const status = stepStatus(job.progress, i);
                const statusClass = status === 'done' ? styles.stepDone : status === 'active' ? styles.stepActive : styles.stepPending;
                return (
                  <div key={step.label} className={`${styles.step} ${statusClass}`}>
                    <div className={styles.stepCol}>
                      <span className={styles.stepIcon}>{status === 'done' ? '✓' : status === 'pending' ? i + 1 : ''}</span>
                      {i < STEP_SCRIPT.length - 1 && <span className={styles.stepLine} />}
                    </div>
                    <div className={styles.stepBody}>
                      <span className={styles.stepLabel}>{step.label}</span>
                      <div className={styles.stepDesc}>{step.description}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className={styles.footer}>
          {job.status === 'error' ? (
            <button className={styles.restartBtn} onClick={() => restartJob(datasetId, job.id)}>Restart ↻</button>
          ) : job.status === 'completed' ? (
            <button className={styles.reviewBtn} onClick={() => onReview(job)}>Review results →</button>
          ) : (
            <button className={styles.cancelBtn} onClick={() => cancelJob(job.id)}>Cancel job</button>
          )}
        </div>
      </div>
    </>
  );
}
