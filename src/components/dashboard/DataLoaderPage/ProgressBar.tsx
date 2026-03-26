import styles from './DataLoaderPage.module.css';

interface ProgressBarProps {
  step: string;
  filesCompleted?: number;
  totalFiles?: number;
}

function stepToPercent(step: string, filesCompleted = 0, totalFiles = 1): number {
  switch (step) {
    case 'scanning':        return 5;
    case 'creating_schema': return 10;
    case 'loading_data':    return 10 + Math.round((filesCompleted / Math.max(totalFiles, 1)) * 70);
    case 'creating_indexes':return 80;
    case 'creating_views':  return 90;
    case 'swapping':        return 95;
    case 'cleanup':         return 98;
    case 'completed':       return 100;
    default:                return 2;
  }
}

export function ProgressBar({ step, filesCompleted, totalFiles }: ProgressBarProps) {
  const pct = stepToPercent(step, filesCompleted, totalFiles);
  return (
    <div className={styles.progressBar}>
      <div className={styles.progressFill} style={{ width: `${pct}%` }} />
      <span className={styles.progressLabel}>{pct}%</span>
    </div>
  );
}
