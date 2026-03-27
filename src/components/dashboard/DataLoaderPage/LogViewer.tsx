import { useEffect, useRef } from 'react';
import styles from './DataLoaderPage.module.css';

export interface LogEntry {
  timestamp: string;
  level: string;
  step: string;
  message: string;
  data?: unknown;
}

interface LogViewerProps {
  logs: LogEntry[];
  autoScroll?: boolean;
}

const STEP_COLORS: Record<string, string> = {
  scanning: '#60a5fa',
  creating_schema: '#a78bfa',
  loading_data: '#34d399',
  creating_indexes: '#fbbf24',
  creating_views: '#f97316',
  swapping: '#e879f9',
  cleanup: '#94a3b8',
  completed: '#4ade80',
  failed: '#f87171',
};

function formatTime(ts: string) {
  try {
    return new Date(ts).toLocaleTimeString('en-GB', { hour12: false });
  } catch {
    return ts;
  }
}

export function LogViewer({ logs, autoScroll = true }: LogViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the log container to bottom on every new entry
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  if (logs.length === 0) {
    return (
      <div className={styles.logViewer}>
        <span className={styles.logEmpty}>No log entries yet.</span>
      </div>
    );
  }

  return (
    <div className={styles.logViewer} ref={containerRef}>
      {logs.map((entry, i) => {
        const color = STEP_COLORS[entry.step] || '#94a3b8';
        return (
          <div key={i} className={styles.logLine}>
            <span className={styles.logTime}>{formatTime(entry.timestamp)}</span>
            <span className={styles.logStep} style={{ color }}>[{entry.step}]</span>
            <span className={`${styles.logMessage} ${entry.level === 'error' ? styles.logError : ''}`}>
              {entry.message}
            </span>
          </div>
        );
      })}
    </div>
  );
}
