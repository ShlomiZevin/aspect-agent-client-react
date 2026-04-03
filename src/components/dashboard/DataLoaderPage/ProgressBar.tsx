import styles from './DataLoaderPage.module.css';

interface ProgressBarProps {
  step: string;
  phase?: string;
  filesCompleted?: number;
  totalFiles?: number;
  isRunning?: boolean;
}

const STEP_LABELS: Record<string, string> = {
  starting:        'Starting...',
  scanning:        'Scanning files',
  creating_schema: 'Creating tables',
  loading_data:    'Loading data',
  creating_indexes:'Creating indexes',
  creating_views:  'Creating views',
  swapping:        'Swapping schema',
  cleanup:         'Cleanup',
  completed:       'Complete',
};

function stepToPercent(step: string, phase: string, filesCompleted = 0, totalFiles = 1): number {
  if (phase === 'indexing') {
    switch (step) {
      case 'creating_indexes': return 40;
      case 'creating_views':   return 75;
      case 'completed':        return 100;
      default:                 return 5;
    }
  }
  switch (step) {
    case 'scanning':        return totalFiles > 0
      ? 2 + Math.round((filesCompleted / Math.max(totalFiles, 1)) * 8)
      : 2;
    case 'creating_schema': return 11;
    case 'loading_data':    return 12 + Math.round((filesCompleted / Math.max(totalFiles, 1)) * 80);
    case 'swapping':        return 95;
    case 'cleanup':         return 98;
    case 'completed':       return 100;
    default:                return 0;
  }
}

// Steps where we show an indeterminate (animated) bar because exact progress is unknown
function isIndeterminate(step: string, phase: string): boolean {
  if (phase === 'indexing') return ['creating_indexes', 'creating_views'].includes(step);
  return ['starting', 'creating_schema', 'swapping', 'cleanup'].includes(step) || !step;
}

export function ProgressBar({ step, phase, filesCompleted, totalFiles, isRunning }: ProgressBarProps) {
  const effectiveStep = step ?? 'starting';
  const effectivePhase = phase ?? 'import';
  const pct = stepToPercent(effectiveStep, effectivePhase, filesCompleted, totalFiles);
  const indeterminate = isRunning && isIndeterminate(effectiveStep, effectivePhase);

  const label = STEP_LABELS[effectiveStep] ?? effectiveStep.replace(/_/g, ' ');
  const fileInfo = effectiveStep === 'loading_data' && totalFiles
    ? `${filesCompleted ?? 0} / ${totalFiles} files`
    : effectiveStep === 'scanning' && totalFiles
    ? `${filesCompleted ?? 0} / ${totalFiles} files`
    : null;

  return (
    <div className={styles.progressWrapper}>
      <div className={styles.progressBar}>
        {indeterminate ? (
          <div className={styles.progressIndeterminate} />
        ) : (
          <div className={styles.progressFill} style={{ width: `${pct}%` }} />
        )}
        {!indeterminate && (
          <span className={styles.progressLabel}>{pct}%</span>
        )}
      </div>
      <div className={styles.progressStepLabel}>
        {label}{fileInfo ? ` — ${fileInfo}` : ''}
      </div>
    </div>
  );
}
