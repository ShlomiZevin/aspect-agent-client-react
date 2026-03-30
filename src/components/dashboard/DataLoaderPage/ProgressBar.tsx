import styles from './DataLoaderPage.module.css';

interface ProgressBarProps {
  step: string;
  phase?: string;
  filesCompleted?: number;
  totalFiles?: number;
}

function stepToPercent(step: string, phase: string, filesCompleted = 0, totalFiles = 1): number {
  if (phase === 'indexing') {
    switch (step) {
      case 'creating_indexes': return 40;
      case 'creating_views':   return 75;
      case 'completed':        return 100;
      default:                 return 5;
    }
  }
  // import phase
  switch (step) {
    case 'scanning':        return 5;
    case 'creating_schema': return 10;
    case 'loading_data':    return 10 + Math.round((filesCompleted / Math.max(totalFiles, 1)) * 70);
    case 'swapping':        return 95;
    case 'cleanup':         return 98;
    case 'completed':       return 100;
    default:                return 2;
  }
}

export function ProgressBar({ step, phase, filesCompleted, totalFiles }: ProgressBarProps) {
  const pct = stepToPercent(step, phase ?? '', filesCompleted, totalFiles);
  return (
    <div className={styles.progressBar}>
      <div className={styles.progressFill} style={{ width: `${pct}%` }} />
      <span className={styles.progressLabel}>{pct}%</span>
    </div>
  );
}
