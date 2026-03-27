import styles from './DataLoaderPage.module.css';

interface StatusBadgeProps {
  status: string;
  step?: string;
}

const STEP_LABELS: Record<string, string> = {
  starting: 'Starting',
  scanning: 'Scanning files',
  creating_schema: 'Creating tables',
  loading_data: 'Loading data',
  creating_indexes: 'Creating indexes',
  creating_views: 'Creating views',
  swapping: 'Swapping schemas',
  cleanup: 'Cleanup',
  completed: 'Completed',
  failed: 'Failed',
};

export function StatusBadge({ status, step }: StatusBadgeProps) {
  const label = status === 'running' && step
    ? (STEP_LABELS[step] ?? step)
    : status === 'completed' ? 'Completed'
    : status === 'failed' ? 'Failed'
    : status === 'running' ? 'Running'
    : status === 'loaded' ? 'Import Done'
    : 'Idle';

  const cls = status === 'running'
    ? styles.badgeRunning
    : status === 'completed'
    ? styles.badgeCompleted
    : status === 'failed'
    ? styles.badgeFailed
    : status === 'loaded'
    ? styles.badgeLoaded
    : styles.badgeIdle;

  return (
    <span className={`${styles.badge} ${cls}`}>
      {status === 'running' && <span className={styles.badgeDot} />}
      {label}
    </span>
  );
}
