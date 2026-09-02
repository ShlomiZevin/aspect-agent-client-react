import type { Job } from './JobsContext';
import { useLanguage } from '../../../context/LanguageContext';
import styles from './JobBadge.module.css';

interface Props {
  job: Job;
  onClick: () => void;
  onRestart: (e: React.MouseEvent) => void;
}

// Two-line "KICKER / title" layout (design turns 9a/10a/11a header badges),
// not a single compact line — matches the same shape everywhere a report's
// status shows up (this badge, ReportProgressCard, JobSidebar).
export function JobBadge({ job, onClick, onRestart }: Props) {
  const { t } = useLanguage();
  const isTask = job.kind === 'task';
  const label = (isTask ? job.label : job.prompt) || t('intel.badge.pickingAngle');

  if (job.status === 'completed') {
    return (
      <button className={`${styles.badge} ${styles.completed}`} onClick={onClick} title={label}>
        <span className={styles.checkIcon}>✓</span>
        <div className={styles.textCol}>
          <div className={styles.kicker}>{t('intel.badge.ready')}</div>
          <div className={styles.label}>{label}</div>
        </div>
        {/* Nothing to open for a task — offering "View" would promise a
            screen that does not exist. */}
        {!isTask && <span className={styles.reviewLink}>{t('intel.badge.view')} →</span>}
        <span className={styles.doneBar} />
      </button>
    );
  }

  if (job.status === 'error') {
    return (
      <button className={`${styles.badge} ${styles.error}`} onClick={onClick} title={job.errorMessage || label}>
        <span className={styles.errIcon}>!</span>
        <div className={styles.textCol}>
          <div className={styles.kicker}>{t('intel.badge.failed')}</div>
          <div className={styles.label}>{label}</div>
        </div>
        {/* Restart re-runs an investigation; a task belongs to the app that
            started it and has no meaning here. */}
        {!isTask && <span className={styles.restartLink} onClick={onRestart}>{t('intel.sidebar.restart')} ↻</span>}
        <span className={styles.errBar} />
      </button>
    );
  }

  return (
    <button className={styles.badge} onClick={onClick} title={label}>
      <span className={styles.dot} />
      <div className={styles.textCol}>
        <div className={styles.kicker}>{t('intel.badge.inProgress')}</div>
        <div className={styles.label}>{label}</div>
      </div>
      <span className={styles.pct}>{job.progress}%</span>
      <span className={styles.progressBar}><span className={styles.progressBarFill} style={{ width: `${job.progress}%` }} /></span>
    </button>
  );
}
