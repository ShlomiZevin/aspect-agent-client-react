import type { Job } from './JobsContext';
import styles from './JobBadge.module.css';

interface Props {
  job: Job;
  onClick: () => void;
  onRestart: (e: React.MouseEvent) => void;
}

// An auto-proposed investigation (started from "Request a new insight", no
// text typed) has an empty job.prompt until the server picks the real angle
// and returns it — show this instead of a blank label while that's pending.
const AUTO_LABEL = 'Aspect is picking a new angle to investigate…';

export function JobBadge({ job, onClick, onRestart }: Props) {
  const label = job.prompt || AUTO_LABEL;

  if (job.status === 'completed') {
    return (
      <button className={`${styles.badge} ${styles.completed}`} onClick={onClick} title={label}>
        <span className={styles.checkIcon}>✓</span>
        <span className={styles.label}>{label}</span>
        <span className={styles.reviewLink}>Review →</span>
        <span className={styles.doneBar} />
      </button>
    );
  }

  if (job.status === 'error') {
    return (
      <button className={`${styles.badge} ${styles.error}`} onClick={onClick} title={job.errorMessage || label}>
        <span className={styles.errIcon}>!</span>
        <span className={styles.label}>{label}</span>
        <span className={styles.restartLink} onClick={onRestart}>Restart ↻</span>
        <span className={styles.errBar} />
      </button>
    );
  }

  return (
    <button className={styles.badge} onClick={onClick} title={label}>
      <span className={styles.dot} />
      <span className={styles.label}>{label}</span>
      <span className={styles.pct}>{job.progress}%</span>
      <span className={styles.progressBar}><span className={styles.progressBarFill} style={{ width: `${job.progress}%` }} /></span>
    </button>
  );
}
