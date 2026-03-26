import { useState } from 'react';
import { LogViewer, type LogEntry } from './LogViewer';
import styles from './DataLoaderPage.module.css';

export interface HistoryRun {
  id: number;
  schema_name: string;
  status: string;
  triggered_by: string;
  step?: string;
  started_at: string;
  completed_at?: string;
  total_files?: number;
  files_loaded?: number;
  total_rows?: number;
  error_message?: string;
}

interface RunHistoryTableProps {
  history: HistoryRun[];
  baseURL: string;
  schemaName: string;
}

function formatDate(iso: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatDuration(started: string, completed?: string) {
  if (!completed) return '—';
  const ms = new Date(completed).getTime() - new Date(started).getTime();
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export function RunHistoryTable({ history, baseURL, schemaName }: RunHistoryTableProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Record<number, LogEntry[]>>({});
  const [loadingId, setLoadingId] = useState<number | null>(null);

  async function toggleLog(run: HistoryRun) {
    if (expandedId === run.id) {
      setExpandedId(null);
      return;
    }
    if (!expandedLogs[run.id]) {
      setLoadingId(run.id);
      try {
        const res = await fetch(`${baseURL}/api/admin/data-loader/${schemaName}/runs/${run.id}/log`);
        const data = await res.json();
        setExpandedLogs(prev => ({ ...prev, [run.id]: data.logs || [] }));
      } catch {
        setExpandedLogs(prev => ({ ...prev, [run.id]: [] }));
      } finally {
        setLoadingId(null);
      }
    }
    setExpandedId(run.id);
  }

  if (history.length === 0) {
    return <div className={styles.emptyState}>No reload history yet.</div>;
  }

  return (
    <div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Duration</th>
            <th>Status</th>
            <th>Files</th>
            <th>Rows</th>
            <th>By</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {history.map(run => (
            <>
              <tr key={run.id}>
                <td>{formatDate(run.started_at)}</td>
                <td>{formatDuration(run.started_at, run.completed_at)}</td>
                <td>
                  <span className={run.status === 'completed' ? styles.statusDone : styles.statusFailed}>
                    {run.status === 'completed' ? 'Done' : run.status === 'failed' ? 'Failed' : run.status}
                  </span>
                </td>
                <td>{run.files_loaded != null ? `${run.files_loaded}/${run.total_files ?? '?'}` : '—'}</td>
                <td>{run.total_rows ? Number(run.total_rows).toLocaleString() : '—'}</td>
                <td>{run.triggered_by}</td>
                <td>
                  <button
                    className={styles.viewLogBtn}
                    onClick={() => toggleLog(run)}
                    disabled={loadingId === run.id}
                  >
                    {loadingId === run.id ? 'Loading...' : expandedId === run.id ? 'Hide Log' : 'View Log'}
                  </button>
                </td>
              </tr>
              {expandedId === run.id && (
                <tr key={`log-${run.id}`}>
                  <td colSpan={7} className={styles.expandedLog}>
                    <LogViewer logs={expandedLogs[run.id] ?? []} autoScroll={false} />
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
