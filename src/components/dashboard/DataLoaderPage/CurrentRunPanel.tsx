import { useState, useEffect } from 'react';
import { StatusBadge } from './StatusBadge';
import { ProgressBar } from './ProgressBar';
import { LogViewer, type LogEntry } from './LogViewer';
import styles from './DataLoaderPage.module.css';

export interface RunState {
  id: number;
  status: string;
  phase?: 'import' | 'indexing';
  step?: string;
  triggeredBy?: string;
  triggered_by?: string;
  startedAt?: string;
  started_at?: string;
  completedAt?: string;
  completed_at?: string;
  totalFiles?: number;
  total_files?: number;
  filesLoaded?: number;
  files_loaded?: number;
  totalRows?: number;
  total_rows?: number;
  errorMessage?: string;
  error_message?: string;
}

interface CurrentRunPanelProps {
  run: RunState | null;
  logs: LogEntry[];
  filesCompleted?: number;
}

function useElapsed(startedAt?: string, isRunning?: boolean) {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    if (!startedAt || !isRunning) {
      setElapsed('');
      return;
    }
    const update = () => {
      const ms = Date.now() - new Date(startedAt).getTime();
      const s = Math.floor(ms / 1000);
      const m = Math.floor(s / 60);
      const h = Math.floor(m / 60);
      if (h > 0) setElapsed(`${h}h ${m % 60}m ${s % 60}s`);
      else if (m > 0) setElapsed(`${m}m ${s % 60}s`);
      else setElapsed(`${s}s`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startedAt, isRunning]);
  return elapsed;
}

function formatDuration(started?: string, completed?: string) {
  if (!started || !completed) return '—';
  const ms = new Date(completed).getTime() - new Date(started).getTime();
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export function CurrentRunPanel({ run, logs, filesCompleted }: CurrentRunPanelProps) {
  const isRunning = run?.status === 'running';
  const startedAt = run?.startedAt ?? run?.started_at;
  const completedAt = run?.completedAt ?? run?.completed_at;
  const triggeredBy = run?.triggeredBy ?? run?.triggered_by;
  const totalFiles = run?.totalFiles ?? run?.total_files;
  const totalRows = run?.totalRows ?? run?.total_rows;
  const errorMessage = run?.errorMessage ?? run?.error_message;
  const elapsed = useElapsed(startedAt, isRunning);

  const phaseLabel = run?.phase === 'import' ? 'Import' : run?.phase === 'indexing' ? 'Indexing' : null;

  if (!run) {
    return (
      <div className={styles.panelEmpty}>
        No runs yet. Click <strong>Import Data</strong> to start.
      </div>
    );
  }

  return (
    <div className={styles.currentRunPanel}>
      <div className={styles.runMeta}>
        <div className={styles.runMetaRow}>
          <span className={styles.metaLabel}>Status</span>
          <StatusBadge status={run.status} step={run.step} />
        </div>
        {phaseLabel && (
          <div className={styles.runMetaRow}>
            <span className={styles.metaLabel}>Phase</span>
            <span>{phaseLabel}</span>
          </div>
        )}
        {run.step && (
          <div className={styles.runMetaRow}>
            <span className={styles.metaLabel}>Step</span>
            <span>{run.step.replace(/_/g, ' ')}</span>
          </div>
        )}
        {startedAt && (
          <div className={styles.runMetaRow}>
            <span className={styles.metaLabel}>Started</span>
            <span>{new Date(startedAt).toLocaleDateString('en-GB')} {new Date(startedAt).toLocaleTimeString('en-GB', { hour12: false })}</span>
          </div>
        )}
        {isRunning && elapsed && (
          <div className={styles.runMetaRow}>
            <span className={styles.metaLabel}>Elapsed</span>
            <span>{elapsed}</span>
          </div>
        )}
        {!isRunning && completedAt && (
          <div className={styles.runMetaRow}>
            <span className={styles.metaLabel}>Duration</span>
            <span>{formatDuration(startedAt, completedAt)}</span>
          </div>
        )}
        {triggeredBy && (
          <div className={styles.runMetaRow}>
            <span className={styles.metaLabel}>Triggered by</span>
            <span>{triggeredBy}</span>
          </div>
        )}
        {totalRows != null && totalRows > 0 && (
          <div className={styles.runMetaRow}>
            <span className={styles.metaLabel}>Rows loaded</span>
            <span>{Number(totalRows).toLocaleString()}</span>
          </div>
        )}
        {totalFiles != null && (
          <div className={styles.runMetaRow}>
            <span className={styles.metaLabel}>Files</span>
            <span>{filesCompleted ?? 0}/{totalFiles}</span>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className={styles.errorBox}>
          <strong>Error:</strong> {errorMessage}
        </div>
      )}

      {isRunning && (
        <ProgressBar
          step={run.step ?? 'starting'}
          phase={run.phase}
          filesCompleted={filesCompleted}
          totalFiles={totalFiles}
        />
      )}

      <div className={styles.logSection}>
        <div className={styles.logHeader}>
          {isRunning ? 'Live Log' : 'Log'}
        </div>
        <LogViewer logs={logs} autoScroll={isRunning} />
      </div>
    </div>
  );
}
