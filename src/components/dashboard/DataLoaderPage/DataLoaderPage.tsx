import { useState, useEffect, useRef, useCallback } from 'react';
import { SourceFilesTable, type GCSFile, type FileProgress } from './SourceFilesTable';
import { CurrentRunPanel, type RunState } from './CurrentRunPanel';
import { RunHistoryTable, type HistoryRun } from './RunHistoryTable';
import { type LogEntry } from './LogViewer';
import styles from './DataLoaderPage.module.css';

interface DataLoaderPageProps {
  agentName: string;
  baseURL: string;
  schemaName: string;
}

export function DataLoaderPage({ baseURL, schemaName }: DataLoaderPageProps) {
  const [files, setFiles] = useState<GCSFile[]>([]);
  const [currentRun, setCurrentRun] = useState<RunState | null>(null);
  const [history, setHistory] = useState<HistoryRun[]>([]);
  const [liveLogs, setLiveLogs] = useState<LogEntry[]>([]);
  const [fileProgress, setFileProgress] = useState<FileProgress[]>([]);
  const [isReloading, setIsReloading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const apiBase = `${baseURL}/api/admin/data-loader/${schemaName}`;

  const loadData = useCallback(async () => {
    try {
      const [filesRes, statusRes, historyRes] = await Promise.all([
        fetch(`${apiBase}/files`),
        fetch(`${apiBase}/status`),
        fetch(`${apiBase}/history`),
      ]);
      const [filesData, statusData, historyData] = await Promise.all([
        filesRes.json(),
        statusRes.json(),
        historyRes.json(),
      ]);
      if (filesData.files) setFiles(filesData.files);
      if (statusData.status) {
        setCurrentRun(statusData.status);
        setIsReloading(statusData.status?.status === 'running' || statusData.status?.isLive);
      }
      if (historyData.history) setHistory(historyData.history);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  function connectSSE() {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    const es = new EventSource(`${apiBase}/logs`);
    eventSourceRef.current = es;

    es.addEventListener('log', (e) => {
      const entry: LogEntry = JSON.parse(e.data);
      setLiveLogs(prev => [...prev, entry]);
    });

    es.addEventListener('progress', (e) => {
      const data = JSON.parse(e.data);
      setCurrentRun(prev => prev ? {
        ...prev,
        step: data.step,
        filesLoaded: data.filesCompleted,
        totalFiles: data.totalFiles,
        totalRows: data.totalRows,
      } : prev);
      // Update file progress
      if (data.currentFile) {
        setFileProgress(prev => {
          const existing = prev.findIndex(fp => fp.file === data.currentFile);
          const updated: FileProgress = {
            file: data.currentFile,
            status: 'loading',
            rowsLoaded: data.currentFileRows,
          };
          if (existing >= 0) {
            const next = [...prev];
            next[existing] = updated;
            return next;
          }
          return [...prev, updated];
        });
      }
    });

    es.addEventListener('status', (e) => {
      const data = JSON.parse(e.data);
      setCurrentRun(data);
      setIsReloading(data?.status === 'running');
    });

    es.addEventListener('complete', (e) => {
      const data = JSON.parse(e.data);
      setIsReloading(false);
      setCurrentRun(prev => prev ? { ...prev, ...data, status: 'completed' } : null);
      // Mark all files as loaded
      setFileProgress(prev =>
        prev.map(fp => fp.status === 'loading' ? { ...fp, status: 'loaded' } : fp)
      );
      es.close();
      eventSourceRef.current = null;
      // Refresh history
      loadData();
    });

    es.addEventListener('error', () => {
      setIsReloading(false);
      es.close();
      eventSourceRef.current = null;
      loadData();
    });

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
    };
  }

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-connect SSE if already running on mount
  useEffect(() => {
    if (isReloading && !eventSourceRef.current) {
      connectSSE();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReloading]);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  async function handleReloadClick() {
    setConfirming(true);
  }

  async function handleReloadConfirm() {
    setConfirming(false);
    try {
      const res = await fetch(`${apiBase}/reload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggeredBy: 'manual' }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start reload');
      }
      setIsReloading(true);
      setLiveLogs([]);
      setFileProgress([]);
      setCurrentRun(prev => prev ? { ...prev, status: 'running', step: 'starting' } : {
        id: 0, status: 'running', step: 'starting',
        startedAt: new Date().toISOString(), triggeredBy: 'manual',
      } as RunState);
      connectSSE();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to start reload');
    }
  }

  if (loading) {
    return <div className={styles.loading}>Loading Data Loader...</div>;
  }

  if (error) {
    return <div className={styles.errorBox}>{error}</div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Data Loader</h1>
          <p className={styles.pageSubtitle}>Schema: <code>{schemaName}</code></p>
        </div>
        <button
          className={`${styles.reloadBtn} ${isReloading ? styles.reloadBtnDisabled : ''}`}
          onClick={handleReloadClick}
          disabled={isReloading}
        >
          {isReloading ? '● Reloading...' : '▶ Reload Now'}
        </button>
      </div>

      {confirming && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmDialog}>
            <p>Start a full data reload for <strong>{schemaName}</strong>?</p>
            <p className={styles.confirmNote}>The live agent will not be affected during reload.</p>
            <div className={styles.confirmActions}>
              <button className={styles.confirmBtn} onClick={handleReloadConfirm}>Start Reload</button>
              <button className={styles.cancelBtn} onClick={() => setConfirming(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Source Files</h2>
          <span className={styles.sectionCount}>{files.length} files</span>
        </div>
        <SourceFilesTable
          files={files}
          fileProgress={fileProgress}
          isReloading={isReloading}
        />
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            {isReloading ? 'Current Run' : 'Last Run'}
          </h2>
        </div>
        <CurrentRunPanel
          run={currentRun}
          logs={liveLogs}
          filesCompleted={currentRun?.filesLoaded ?? currentRun?.files_loaded}
        />
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Run History</h2>
          <span className={styles.sectionCount}>{history.length} runs</span>
        </div>
        <RunHistoryTable
          history={history}
          baseURL={baseURL}
          schemaName={schemaName}
        />
      </div>
    </div>
  );
}
