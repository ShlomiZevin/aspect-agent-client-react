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
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<'import' | 'index' | 'index-full' | 'cancel' | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const currentRunRef = useRef<HTMLDivElement>(null);

  const apiBase = `${baseURL}/api/admin/data-loader/${schemaName}`;

  const runStatus = currentRun?.status;
  const isBusy = runStatus === 'running' && isLive;

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
        setIsLive(!!statusData.status?.isLive);
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

      // Reconstruct file progress from log data.
      // Works for both live events and replayed buffer on reconnect.
      const d = (entry.data ?? {}) as { file?: string; rows?: number; error?: string };
      if (d.file) {
        setFileProgress(prev => {
          const idx = prev.findIndex(fp => fp.file === d.file);
          let updated: FileProgress;
          if (d.error) {
            updated = { file: d.file!, status: 'error', error: d.error };
          } else if (d.rows !== undefined) {
            updated = { file: d.file!, status: 'loaded', rows: d.rows };
          } else {
            // file_start: only add/set loading if not already in a terminal state
            if (idx >= 0 && (prev[idx].status === 'loaded' || prev[idx].status === 'error')) return prev;
            updated = { file: d.file!, status: 'loading' };
          }
          if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next; }
          return [...prev, updated];
        });
      }
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
      // Update live row count for the currently-loading file only
      if (data.currentFile) {
        setFileProgress(prev => {
          const idx = prev.findIndex(fp => fp.file === data.currentFile);
          if (idx >= 0 && prev[idx].status !== 'loading') return prev; // don't override loaded/error
          const updated: FileProgress = { file: data.currentFile, status: 'loading', rowsLoaded: data.currentFileRows };
          if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next; }
          return [...prev, updated];
        });
      }
    });

    es.addEventListener('status', (e) => {
      const data = JSON.parse(e.data);
      setCurrentRun(prev => prev ? { ...prev, ...data } : data);
      setIsLive(data?.status === 'running');
    });

    es.addEventListener('complete', (e) => {
      const data = JSON.parse(e.data);
      setIsLive(false);
      setCurrentRun(prev => prev ? { ...prev, ...data, status: 'completed' } : null);
      setFileProgress(prev =>
        prev.map(fp => fp.status === 'loading' ? { ...fp, status: 'loaded' } : fp)
      );
      es.close();
      eventSourceRef.current = null;
      loadData();
    });

    es.addEventListener('error', () => {
      setIsLive(false);
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

  // Auto-connect SSE if already live on mount
  useEffect(() => {
    if (isLive && !eventSourceRef.current) {
      connectSSE();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive]);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  async function handleImportConfirm() {
    setConfirming(null);
    try {
      const res = await fetch(`${apiBase}/load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggeredBy: 'manual' }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start import');
      }
      setIsLive(true);
      setLiveLogs([]);
      setFileProgress([]);
      setCurrentRun(prev => ({
        ...(prev ?? {}),
        status: 'running',
        phase: 'import',
        step: 'starting',
        startedAt: new Date().toISOString(),
        completedAt: undefined,
      } as RunState));
      connectSSE();
      setTimeout(() => currentRunRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to start import');
    }
  }

  async function handleCancelConfirm() {
    setConfirming(null);
    try {
      const res = await fetch(`${apiBase}/cancel`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to cancel');
      }
      setIsLive(false);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      await loadData();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to cancel run');
    }
  }

  async function handleIndexConfirm(force = false) {
    setConfirming(null);
    try {
      const res = await fetch(`${apiBase}/index`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start indexing');
      }
      setIsLive(true);
      setLiveLogs([]);
      setCurrentRun(prev => ({
        ...(prev ?? {}),
        status: 'running',
        phase: 'indexing',
        step: 'creating_indexes',
        startedAt: new Date().toISOString(),
        completedAt: undefined,
      } as RunState));
      connectSSE();
      setTimeout(() => currentRunRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to start indexing');
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
        <div className={styles.headerActions}>
          <button
            className={`${styles.reloadBtn} ${isBusy ? styles.reloadBtnDisabled : ''}`}
            onClick={() => setConfirming('import')}
            disabled={isBusy}
          >
            {isBusy && currentRun?.phase === 'import' ? '● Importing...' : '▶ Import Data'}
          </button>
          <button
            className={`${styles.indexBtn} ${isBusy ? styles.reloadBtnDisabled : ''}`}
            onClick={() => setConfirming('index')}
            disabled={isBusy}
          >
            {isBusy && currentRun?.phase === 'indexing' ? '● Indexing...' : 'Create Indexes'}
          </button>
          <button
            className={`${styles.indexBtn} ${isBusy ? styles.reloadBtnDisabled : ''}`}
            onClick={() => setConfirming('index-full')}
            disabled={isBusy}
          >
            Full Rebuild
          </button>
          {(isBusy || runStatus === 'running') && (
            <button
              className={styles.dangerBtn}
              onClick={() => setConfirming('cancel')}
            >
              ✕ Force Cancel
            </button>
          )}
        </div>
      </div>

      {confirming === 'import' && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmDialog}>
            <p>Start data import for <strong>{schemaName}</strong>?</p>
            <p className={styles.confirmNote}>This loads all CSV files from GCS into a shadow schema. The live agent is not affected.</p>
            <div className={styles.confirmActions}>
              <button className={styles.confirmBtn} onClick={handleImportConfirm}>Start Import</button>
              <button className={styles.cancelBtn} onClick={() => setConfirming(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {confirming === 'cancel' && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmDialog}>
            <p>Force-cancel the running job for <strong>{schemaName}</strong>?</p>
            <p className={styles.confirmNote}>The background process may still be running on the server. This only marks the run as failed in the database so you can start a new one.</p>
            <div className={styles.confirmActions}>
              <button className={styles.dangerBtn} onClick={handleCancelConfirm}>Force Cancel</button>
              <button className={styles.cancelBtn} onClick={() => setConfirming(null)}>Keep Running</button>
            </div>
          </div>
        </div>
      )}

      {confirming === 'index' && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmDialog}>
            <p>Create indexes for <strong>{schemaName}</strong>?</p>
            <p className={styles.confirmNote}>Creates indexes and materialized views — skips any that already exist. Use after a schema swap.</p>
            <div className={styles.confirmActions}>
              <button className={styles.confirmBtn} onClick={() => handleIndexConfirm(false)}>Create Indexes</button>
              <button className={styles.cancelBtn} onClick={() => setConfirming(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {confirming === 'index-full' && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmDialog}>
            <p>Full Rebuild for <strong>{schemaName}</strong>?</p>
            <p className={styles.confirmNote}>Creates all indexes, then drops and recreates all materialized views from scratch. Use after a fresh import.</p>
            <div className={styles.confirmActions}>
              <button className={styles.confirmBtn} onClick={() => handleIndexConfirm(true)}>Full Rebuild</button>
              <button className={styles.cancelBtn} onClick={() => setConfirming(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.twoCol}>
        <div className={styles.leftCol}>
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Source Files</h2>
              <span className={styles.sectionCount}>{files.length} files</span>
            </div>
            <SourceFilesTable
              files={files}
              fileProgress={fileProgress}
              isReloading={isBusy}
            />
          </div>
        </div>

        <div className={styles.rightCol}>
          {(isLive || currentRun) && (
            <div className={styles.section} ref={currentRunRef}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>
                  {isLive ? 'Current Run' : 'Last Run'}
                </h2>
              </div>
              <CurrentRunPanel
                run={currentRun}
                logs={liveLogs}
                filesCompleted={currentRun?.filesLoaded ?? currentRun?.files_loaded}
              />
            </div>
          )}

          {history.length > 0 && (
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
          )}
        </div>
      </div>
    </div>
  );
}
