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

// A schedule entry is just { enabled, hour, minute } - no cron syntax
// anywhere on the client. See services/schedule-config.service.js /
// services/scheduler-tick.service.js on the server: one Cloud Scheduler job
// ticks every minute and reads these directly.
interface ScheduleEntry {
  enabled: boolean;
  hour: number;
  minute: number;
}

function scheduleToTimeString(s: ScheduleEntry): string {
  return `${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')}`;
}

function timeStringToParts(time: string): { hour: number; minute: number } | null {
  const m = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

function formatJerusalemTime(d: Date): string {
  return d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' });
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
  const [confirming, setConfirming] = useState<'import' | 'index' | 'index-full' | 'cancel' | 'drive-sync' | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [importMonths, setImportMonths] = useState<string>('');
  const [importMonthsSource, setImportMonthsSource] = useState<'db' | 'env' | 'default'>('default');
  const [importMonthsSupported, setImportMonthsSupported] = useState(false);
  const [savingMonths, setSavingMonths] = useState(false);
  const [monthsSaved, setMonthsSaved] = useState(false);
  const [gcsFolder, setGcsFolder] = useState('');
  const [gcsFolderSource, setGcsFolderSource] = useState<'db' | 'env' | 'default'>('default');
  const [savingFolders, setSavingFolders] = useState(false);
  const [foldersSaved, setFoldersSaved] = useState(false);
  const [foldersError, setFoldersError] = useState<string | null>(null);
  const [driveFolderId, setDriveFolderId] = useState('');
  const [savingDriveFolderId, setSavingDriveFolderId] = useState(false);
  const [driveFolderIdSaved, setDriveFolderIdSaved] = useState(false);
  const [driveFolderIdError, setDriveFolderIdError] = useState<string | null>(null);
  const [driveSyncSchedule, setDriveSyncSchedule] = useState<ScheduleEntry | null>(null);
  const [driveSyncTime, setDriveSyncTime] = useState('');
  const [savingDriveSync, setSavingDriveSync] = useState(false);
  const [driveSyncSaved, setDriveSyncSaved] = useState(false);
  const [driveSyncError, setDriveSyncError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'loader' | 'configuration'>('loader');
  const [importSchedule, setImportSchedule] = useState<ScheduleEntry | null>(null);
  const [scheduleStartTime, setScheduleStartTime] = useState('');
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleSaved, setScheduleSaved] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(() => formatJerusalemTime(new Date()));
  const eventSourceRef = useRef<EventSource | null>(null);
  const currentRunRef = useRef<HTMLDivElement>(null);

  const apiBase = `${baseURL}/api/admin/data-loader/${schemaName}`;

  const runStatus = currentRun?.status;
  const isBusy = runStatus === 'running' && isLive;
  // The manual Drive-sync button shows whenever this schema has a Drive folder
  // configured (coded default in drive-to-gcs.service.js's CLIENTS map, or a
  // DB override set from Configuration → Drive Sync). `driveFolderId` is loaded
  // from /settings on mount, so this is '' for the first render then resolves.
  const supportsDriveSync = !!driveFolderId;

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

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/settings`);
      if (!res.ok) return;
      const data = await res.json();
      setImportMonthsSupported(!!data.supported);
      setImportMonthsSource(data.source ?? 'default');
      setImportMonths(data.importMonths != null ? String(data.importMonths) : '0');
      setGcsFolder(data.gcsFolder ?? '');
      setGcsFolderSource(data.gcsFolderSource ?? 'default');
      setDriveFolderId(data.driveFolderId ?? '');
    } catch {
      // settings are optional — ignore failures
    }
  }, [apiBase]);

  async function saveFolders() {
    setSavingFolders(true);
    setFoldersError(null);
    setFoldersSaved(false);
    try {
      const res = await fetch(`${apiBase}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gcsFolder }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setGcsFolder(data.gcsFolder ?? '');
      setGcsFolderSource(data.gcsFolderSource ?? 'default');
      setFoldersSaved(true);
      setTimeout(() => setFoldersSaved(false), 3000);
    } catch (e: unknown) {
      setFoldersError(e instanceof Error ? e.message : 'Failed to save folders');
    } finally {
      setSavingFolders(false);
    }
  }

  async function saveDriveFolderId() {
    setSavingDriveFolderId(true);
    setDriveFolderIdError(null);
    setDriveFolderIdSaved(false);
    try {
      const res = await fetch(`${apiBase}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driveFolderId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setDriveFolderId(data.driveFolderId ?? '');
      setDriveFolderIdSaved(true);
      setTimeout(() => setDriveFolderIdSaved(false), 3000);
    } catch (e: unknown) {
      setDriveFolderIdError(e instanceof Error ? e.message : 'Failed to save Drive folder ID');
    } finally {
      setSavingDriveFolderId(false);
    }
  }

  async function putSchedule(jobType: 'import' | 'drive_sync', patch: Partial<ScheduleEntry>): Promise<ScheduleEntry> {
    const base = jobType === 'import' ? importSchedule : driveSyncSchedule;
    const parts = timeStringToParts(jobType === 'import' ? scheduleStartTime : driveSyncTime);
    const body = {
      jobType,
      enabled: patch.enabled ?? base?.enabled ?? false,
      hour: patch.hour ?? parts?.hour ?? base?.hour ?? 1,
      minute: patch.minute ?? parts?.minute ?? base?.minute ?? 0,
    };
    const res = await fetch(`${baseURL}/api/admin/data-loader/${schemaName}/schedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return (await res.json()).schedule as ScheduleEntry;
  }

  async function toggleDriveSync() {
    setSavingDriveSync(true);
    setDriveSyncError(null);
    try {
      const schedule = await putSchedule('drive_sync', { enabled: !driveSyncSchedule?.enabled });
      setDriveSyncSchedule(schedule);
      setDriveSyncTime(scheduleToTimeString(schedule));
    } catch (e: unknown) {
      setDriveSyncError(e instanceof Error ? e.message : 'Failed to update Drive sync');
    } finally {
      setSavingDriveSync(false);
    }
  }

  async function saveDriveSyncTime() {
    const parts = timeStringToParts(driveSyncTime);
    if (!parts) {
      setDriveSyncError('Enter a valid time (HH:MM)');
      return;
    }
    setSavingDriveSync(true);
    setDriveSyncError(null);
    try {
      const schedule = await putSchedule('drive_sync', parts);
      setDriveSyncSchedule(schedule);
      setDriveSyncSaved(true);
      setTimeout(() => setDriveSyncSaved(false), 3000);
    } catch (e: unknown) {
      setDriveSyncError(e instanceof Error ? e.message : 'Failed to save Drive sync time');
    } finally {
      setSavingDriveSync(false);
    }
  }

  async function saveImportMonths() {
    setSavingMonths(true);
    setMonthsSaved(false);
    try {
      const res = await fetch(`${apiBase}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importMonths: importMonths === '' ? null : Number(importMonths) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setImportMonthsSource(data.source ?? 'default');
      setImportMonths(data.importMonths != null ? String(data.importMonths) : '0');
      setMonthsSaved(true);
      setTimeout(() => setMonthsSaved(false), 3000);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to save import window');
    } finally {
      setSavingMonths(false);
    }
  }

  const loadSchedule = useCallback(async () => {
    try {
      const res = await fetch(`${baseURL}/api/admin/data-loader/${schemaName}/schedule`);
      if (!res.ok) return;
      const data = await res.json();
      const importSched = data.importSchedule as ScheduleEntry;
      const driveSched = data.driveSyncSchedule as ScheduleEntry;
      setImportSchedule(importSched);
      setScheduleStartTime(scheduleToTimeString(importSched));
      setDriveSyncSchedule(driveSched);
      setDriveSyncTime(scheduleToTimeString(driveSched));
    } catch {
      // schedule is optional — ignore failures
    }
  }, [baseURL, schemaName]);

  async function saveSchedule() {
    const parts = timeStringToParts(scheduleStartTime);
    if (!parts) {
      setScheduleError('Enter a valid time (HH:MM)');
      return;
    }
    setSavingSchedule(true);
    setScheduleError(null);
    setScheduleSaved(false);
    try {
      const schedule = await putSchedule('import', parts);
      setImportSchedule(schedule);
      setScheduleSaved(true);
      setTimeout(() => setScheduleSaved(false), 3000);
    } catch (e: unknown) {
      setScheduleError(e instanceof Error ? e.message : 'Failed to save schedule');
    } finally {
      setSavingSchedule(false);
    }
  }

  async function toggleSchedulePaused() {
    setSavingSchedule(true);
    setScheduleError(null);
    try {
      const schedule = await putSchedule('import', { enabled: !importSchedule?.enabled });
      setImportSchedule(schedule);
      setScheduleStartTime(scheduleToTimeString(schedule));
    } catch (e: unknown) {
      setScheduleError(e instanceof Error ? e.message : 'Failed to update schedule');
    } finally {
      setSavingSchedule(false);
    }
  }

  useEffect(() => {
    loadData();
    loadSettings();
    loadSchedule();
  }, [loadData, loadSettings, loadSchedule]);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(formatJerusalemTime(new Date())), 30_000);
    return () => clearInterval(interval);
  }, []);

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

  async function handleDriveSyncConfirm() {
    setConfirming(null);
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch(`${apiBase}/drive-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start Drive sync');
      }
      setSyncMsg('Drive sync started. New/changed files are streamed to GCS in the background — refresh Source Files in a few minutes.');
      // Refresh the source-file list once the small files have landed.
      setTimeout(() => loadData(), 8000);
    } catch (e: unknown) {
      setSyncMsg(null);
      alert(e instanceof Error ? e.message : 'Failed to start Drive sync');
    } finally {
      setSyncing(false);
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
          {supportsDriveSync && (
            <button
              className={`${styles.indexBtn} ${(isBusy || syncing) ? styles.reloadBtnDisabled : ''}`}
              onClick={() => setConfirming('drive-sync')}
              disabled={isBusy || syncing}
              title="Mirror the client's Google Drive folder into GCS"
            >
              {syncing ? '● Syncing...' : '⟳ Sync from Drive'}
            </button>
          )}
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

      {confirming === 'drive-sync' && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmDialog}>
            <p>Sync <strong>{schemaName}</strong> from Google Drive?</p>
            <p className={styles.confirmNote}>Mirrors the client's Drive folder into GCS: only new/changed files (by md5) are uploaded, names are mapped to the canonical loader names. This does not import into the database — run Import afterwards.</p>
            <div className={styles.confirmActions}>
              <button className={styles.confirmBtn} onClick={handleDriveSyncConfirm}>Start Sync</button>
              <button className={styles.cancelBtn} onClick={() => setConfirming(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {syncMsg && (
        <div className={styles.savedMsg} style={{ margin: '0 0 12px' }}>
          {syncMsg}
          <button
            className={styles.cancelBtn}
            style={{ marginLeft: 12 }}
            onClick={() => setSyncMsg(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className={styles.tabBar}>
        <button
          className={activeTab === 'loader' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('loader')}
        >
          Loader
        </button>
        <button
          className={activeTab === 'configuration' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('configuration')}
        >
          Configuration
        </button>
      </div>

      {activeTab === 'loader' && (
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
      )}

      {activeTab === 'configuration' && (
        <div className={styles.twoCol}>
          <div className={styles.leftCol}>
            {importSchedule && (
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Scheduled Reload</h2>
                  <span className={`${styles.sourceBadge} ${importSchedule.enabled ? styles.sourceDb : styles.sourceDefault}`}>
                    {importSchedule.enabled ? 'On' : 'Off'}
                  </span>
                </div>
                <div className={styles.settingsBody}>
                  <p className={styles.settingsDesc}>
                    When on, import runs automatically every night at the time below. This is independent from
                    Drive Sync's own timing (below) - indexing isn't scheduled at all, it always runs on its
                    own as soon as an import finishes.
                  </p>
                  <div className={styles.settingsRow}>
                    <button className={styles.confirmBtn} onClick={toggleSchedulePaused} disabled={savingSchedule}>
                      {savingSchedule ? 'Saving…' : importSchedule.enabled ? 'Turn off' : 'Turn on'}
                    </button>
                  </div>
                  {importSchedule.enabled && (
                    <>
                      <div className={styles.settingsRow} style={{ marginTop: 10 }}>
                        <input
                          className={`${styles.settingsInput} ${styles.settingsInputTime}`}
                          type="time"
                          value={scheduleStartTime}
                          onChange={e => setScheduleStartTime(e.target.value)}
                          disabled={savingSchedule}
                        />
                        <button className={styles.confirmBtn} onClick={saveSchedule} disabled={savingSchedule}>
                          {savingSchedule ? 'Saving…' : 'Save'}
                        </button>
                        {scheduleSaved && <span className={styles.savedMsg}>Saved</span>}
                      </div>
                      <p className={styles.settingsHint}>Current time: {currentTime} (Asia/Jerusalem)</p>
                    </>
                  )}
                  {scheduleError && <p className={styles.errorMsg}>{scheduleError}</p>}
                </div>
              </div>
            )}

            {importMonthsSupported && (
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Import Window</h2>
                  <span className={`${styles.sourceBadge} ${
                    importMonthsSource === 'db' ? styles.sourceDb
                    : importMonthsSource === 'env' ? styles.sourceEnv
                    : styles.sourceDefault
                  }`}>
                    {importMonthsSource === 'db' ? 'DB override' : importMonthsSource === 'env' ? 'env default' : 'default'}
                  </span>
                </div>
                <div className={styles.settingsBody}>
                  <p className={styles.settingsDesc}>
                    Limit how much history is imported. Only the last N months of sales
                    (relative to the latest sale date in the data) are loaded; <code>0</code> loads everything.
                  </p>
                  <div className={styles.settingsRow}>
                    <input
                      className={styles.settingsInput}
                      type="number"
                      min={0}
                      value={importMonths}
                      onChange={e => setImportMonths(e.target.value)}
                      disabled={savingMonths}
                    />
                    <span className={styles.settingsUnit}>months</span>
                    <button
                      className={styles.confirmBtn}
                      onClick={saveImportMonths}
                      disabled={savingMonths}
                    >
                      {savingMonths ? 'Saving…' : 'Save'}
                    </button>
                    {monthsSaved && <span className={styles.savedMsg}>Saved</span>}
                  </div>
                  <p className={styles.settingsHint}>
                    Applies on the next import. Clear the field and save to fall back to the env default.
                  </p>
                </div>
              </div>
            )}

            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Import Folder</h2>
                <span className={`${styles.sourceBadge} ${gcsFolderSource === 'db' ? styles.sourceDb : styles.sourceDefault}`}>
                  {gcsFolderSource === 'db' ? 'set here' : 'default'}
                </span>
              </div>
              <div className={styles.settingsBody}>
                <p className={styles.settingsDesc}>
                  The GCS folder this schema's import reads CSV files from. If Drive Sync (below) is on, this is
                  also where it writes files - keep them matched or files won't reach the loader.
                </p>
                <div className={styles.settingsRow}>
                  <label className={styles.settingsUnit} style={{ minWidth: 110 }}>GCS folder</label>
                  <input
                    className={styles.settingsInput}
                    style={{ width: 320 }}
                    type="text"
                    value={gcsFolder}
                    onChange={e => setGcsFolder(e.target.value)}
                    disabled={savingFolders}
                  />
                  <button className={styles.confirmBtn} onClick={saveFolders} disabled={savingFolders}>
                    {savingFolders ? 'Saving…' : 'Save'}
                  </button>
                  {foldersSaved && <span className={styles.savedMsg}>Saved</span>}
                </div>
                {foldersError && <p className={styles.errorMsg}>{foldersError}</p>}
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Drive Sync</h2>
                {driveSyncSchedule && (
                  <span className={`${styles.sourceBadge} ${driveSyncSchedule.enabled ? styles.sourceDb : styles.sourceDefault}`}>
                    {driveSyncSchedule.enabled ? 'On' : 'Off'}
                  </span>
                )}
              </div>
              <div className={styles.settingsBody}>
                <p className={styles.settingsDesc}>
                  Optional - mirrors a Google Drive folder into the Import Folder above, on its own schedule
                  (independent from Scheduled Reload). Only useful if this client delivers files via a shared
                  Drive folder rather than uploading to GCS directly.
                </p>
                <div className={styles.settingsRow}>
                  <label className={styles.settingsUnit} style={{ minWidth: 110 }}>Drive folder ID</label>
                  <input
                    className={styles.settingsInput}
                    style={{ width: 320 }}
                    type="text"
                    value={driveFolderId}
                    onChange={e => setDriveFolderId(e.target.value)}
                    disabled={savingDriveFolderId}
                  />
                  <button className={styles.confirmBtn} onClick={saveDriveFolderId} disabled={savingDriveFolderId}>
                    {savingDriveFolderId ? 'Saving…' : 'Save'}
                  </button>
                  {driveFolderIdSaved && <span className={styles.savedMsg}>Saved</span>}
                </div>
                {driveFolderIdError && <p className={styles.errorMsg}>{driveFolderIdError}</p>}

                {driveFolderId ? (
                  <>
                    <div className={styles.settingsRow} style={{ marginTop: 10 }}>
                      <button className={styles.confirmBtn} onClick={toggleDriveSync} disabled={savingDriveSync}>
                        {savingDriveSync ? 'Saving…' : driveSyncSchedule?.enabled ? 'Turn off' : 'Turn on'}
                      </button>
                    </div>
                    {driveSyncSchedule?.enabled && (
                      <div className={styles.settingsRow} style={{ marginTop: 10 }}>
                        <input
                          className={`${styles.settingsInput} ${styles.settingsInputTime}`}
                          type="time"
                          value={driveSyncTime}
                          onChange={e => setDriveSyncTime(e.target.value)}
                          disabled={savingDriveSync}
                        />
                        <button className={styles.confirmBtn} onClick={saveDriveSyncTime} disabled={savingDriveSync}>
                          {savingDriveSync ? 'Saving…' : 'Save'}
                        </button>
                        {driveSyncSaved && <span className={styles.savedMsg}>Saved</span>}
                      </div>
                    )}
                  </>
                ) : (
                  <p className={styles.settingsHint} style={{ marginTop: 10 }}>
                    Set a Drive folder ID above to enable sync.
                  </p>
                )}
                {driveSyncError && <p className={styles.errorMsg}>{driveSyncError}</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
