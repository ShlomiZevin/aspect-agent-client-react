import styles from './StatusIndicator.module.css';

interface StatusIndicatorProps {
  status?: 'online' | 'offline' | 'busy';
  label?: string;
}

export function StatusIndicator({ status = 'online', label }: StatusIndicatorProps) {
  return (
    <div className={styles.container}>
      <span className={`${styles.dot} ${styles[status]}`} />
      {label && <span className={styles.label}>{label}</span>}
    </div>
  );
}
