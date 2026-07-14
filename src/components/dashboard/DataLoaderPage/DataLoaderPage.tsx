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

// Schemas whose source folder is mirrored from Google Drive (CLIENTS in
// server/services/drive-to-gcs.service.js). Only these show the Sync button.
const DRIVE_SYNC_SCHEMAS = ['zer4u', 'hypertoy'];

interface SchedulerJob {
  name: string;
  schedule: string;
  state: 'ENABLED' | 'PAUSED';
}

// "HH:MM" -> "M H * * *". Only handles single daily-time crons (what
// drive-sync always uses) - not meant for arbitrary cron strings.
function parseCronTime(cron: string): string | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const min = parseInt(parts[0], 10);
  const hour = parseInt(parts[1], 10);
  if (Number.isNaN(min) || Number.isNaN(hour)) return null;
  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function addMinutes(h: number, m: number, deltaMin: number): { h: number; m: number } {
  const total = (((h * 60 + m + deltaMin) % 1440) + 1440) % 1440;
  return { h: Math.floor(total / 60), m: total % 60 };
}

// Derives drive-sync + ensure-loaded (import retry window) crons from a
// single "start reload at" time. Indexing is intentionally not part of this -
// it always runs on its own continuous check for "import done, not yet indexed".
function buildScheduleCrons(startTime: string): { driveSync: string; ensureLoaded: string } | null {
  const m = startTime.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  const driveSync = `${min} ${h} * * *`;
  // Import retries start 30 min after sync (time to finish syncing files),
  // then poll every 15 min for a 5-hour safety window.
  const retryStart = addMinutes(h, min, 30);
  const retryEnd = addMinutes(h, min, 30 + 5 * 60);
  const endHour = retryEnd.h >= retryStart.h ? retryEnd.h : 23;
  const ensureLoaded = `*/15 ${retryStart.h}-${endHour} * * *`;
  return { driveSync, ensureLoaded };
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
  const [scheduleJobs, setScheduleJobs] = useState<{ driveSync: SchedulerJob; ensureLoaded: SchedulerJob } | null>(null);
  const [scheduleStartTime, setScheduleStartTime] = useState('');
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleSaved, setScheduleSaved] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const currentRunRef = useRef<HTMLDivElement>(null);

  const apiBase = `${baseURL}/api/admin/data-loader/${schemaName}`;

  const runStatus = currentRun?.status;
  const isBusy = runStatus === 'running' && isLive;
  const supportsDriveSync = DRIVE_SYNC_SCHEMAS.includes(schemaName);

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
    } catch {
      // settings are optional — ignore failures
    }
  }, [apiBase]);

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
    if (!supportsDriveSync) return;
    try {
      const res = await fetch(`${baseURL}/api/admin/scheduler/jobs`);
      if (!res.ok) return;
      const data = await res.json();
      const jobs: SchedulerJob[] = data.jobs || [];
      const driveSync = jobs.find(j => j.name === `${schemaName}-drive-sync`);
      const ensureLoaded = jobs.find(j => j.name === `${schemaName}-ensure-loaded`);
      if (driveSync && ensureLoaded) {
        setScheduleJobs({ driveSync, ensureLoaded });
        setScheduleStartTime(parseCronTime(driveSync.schedule) || '');
      }
    } catch {
      // schedule is optional — ignore failures
    }
  }, [baseURL, schemaName, supportsDriveSync]);

  async function saveSchedule() {
    const crons = buildScheduleCrons(scheduleStartTime);
    if (!crons || !scheduleJobs) {
      setScheduleError('Enter a valid time (HH:MM)');
      return;
    }
    setSavingSchedule(true);
    setScheduleError(null);
    setScheduleSaved(false);
    try {
      const patch = async (name: string, body: object) => {
        const res = await fetch(`${baseURL}/api/admin/scheduler/jobs/${encodeURIComponent(name)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        return (await res.json()).job as SchedulerJob;
      };
      const [driveSync, ensureLoaded] = await Promise.all([
        patch(scheduleJobs.driveSync.name, { schedule: crons.driveSync }),
        patch(scheduleJobs.ensureLoaded.name, { schedule: crons.ensureLoaded }),
      ]);
      setScheduleJobs({ driveSync, ensureLoaded });
      setScheduleSaved(true);
      setTimeout(() => setScheduleSaved(false), 3000);
    } catch (e: unknown) {
      setScheduleError(e instanceof Error ? e.message : 'Failed to save schedule');
    } finally {
      setSavingSchedule(false);
    }
  }

  async function toggleSchedulePaused() {
    if (!scheduleJobs) return;
    const paused = scheduleJobs.driveSync.state === 'ENABLED';
    setSavingSchedule(true);
    setScheduleError(null);
    try {
      const patch = async (name: string) => {
        const res = await fetch(`${baseURL}/api/admin/scheduler/jobs/${encodeURIComponent(name)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paused }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()).job as SchedulerJob;
      };
      const [driveSync, ensureLoaded] = await Promise.all([
        patch(scheduleJobs.driveSync.name),
        patch(scheduleJobs.ensureLoaded.name),
      ]);
      setScheduleJobs({ driveSync, ensureLoaded });
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

      <div className={styles.twoCol}>
        <div className={styles.leftCol}>
          {scheduleJobs && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Schedule</h2>
                <span className={scheduleJobs.driveSync.state === 'ENABLED' ? styles.sourceDb : styles.sourceDefault}>
                  {scheduleJobs.driveSync.state === 'ENABLED' ? 'Enabled' : 'Paused'}
                </span>
              </div>
              <div className={styles.settingsBody}>
                <p className={styles.settingsDesc}>
                  Nightly sync + import starts at this time. Indexing isn't scheduled here - it always runs on
                  its own as soon as an import finishes.
                </p>
                <div className={styles.settingsRow}>
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
                  <button className={styles.cancelBtn} onClick={toggleSchedulePaused} disabled={savingSchedule}>
                    {scheduleJobs.driveSync.state === 'ENABLED' ? 'Pause' : 'Resume'}
                  </button>
                  {scheduleSaved && <span className={styles.savedMsg}>Saved</span>}
                </div>
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
