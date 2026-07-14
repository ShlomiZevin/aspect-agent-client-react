import { useState, useEffect, useCallback } from 'react';
import styles from './SchedulerPage.module.css';
import { getSchedulerJobs, updateSchedulerJob, type SchedulerJob } from '../../../services/schedulerService';

interface SchedulerPageProps {
  baseURL: string;
}

// Job names are "<project>-<jobType>[-suffix]", e.g. "zer4u-ensure-loaded-7h".
function parseJobName(name: string): { project: string; jobType: string } {
  const m = name.match(/^([a-z0-9]+)-(drive-sync|ensure-loaded|ensure-indexed|reload)/);
  return m ? { project: m[1], jobType: m[2] } : { project: name, jobType: '' };
}

const JOB_TYPE_LABELS: Record<string, string> = {
  'drive-sync': 'Drive sync',
  'ensure-loaded': 'Import',
  'ensure-indexed': 'Index',
  reload: 'Reload',
};

// Sorts by time-of-day for a plain daily cron ("M H * * *"), so the table
// reads like a timeline and overlapping windows across projects are obvious
// at a glance. Anything else (e.g. "*/15 * * * *" sweeps) sorts last.
function dailyMinuteOfDay(cron: string): number | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [min, hour, dom, month, dow] = parts;
  if (dom !== '*' || month !== '*' || dow !== '*') return null;
  const m = parseInt(min, 10);
  const h = parseInt(hour, 10);
  if (Number.isNaN(m) || Number.isNaN(h) || /[,/*-]/.test(min) || /[,/*-]/.test(hour)) return null;
  return h * 60 + m;
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
}

export function SchedulerPage({ baseURL }: SchedulerPageProps) {
  const [jobs, setJobs] = useState<SchedulerJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingName, setSavingName] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    setError(null);
    try {
      const data = await getSchedulerJobs(baseURL);
      setJobs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scheduler jobs');
    } finally {
      setLoading(false);
    }
  }, [baseURL]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  const startEdit = (job: SchedulerJob) => {
    setEditingName(job.name);
    setEditValue(job.schedule);
  };

  const cancelEdit = () => {
    setEditingName(null);
    setEditValue('');
  };

  const saveEdit = async (name: string) => {
    setSavingName(name);
    try {
      const updated = await updateSchedulerJob(name, { schedule: editValue.trim() }, baseURL);
      setJobs(prev => prev.map(j => (j.name === name ? updated : j)));
      setEditingName(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update schedule');
    } finally {
      setSavingName(null);
    }
  };

  const togglePaused = async (job: SchedulerJob) => {
    setSavingName(job.name);
    try {
      const updated = await updateSchedulerJob(job.name, { paused: job.state === 'ENABLED' }, baseURL);
      setJobs(prev => prev.map(j => (j.name === job.name ? updated : j)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update job');
    } finally {
      setSavingName(null);
    }
  };

  const sorted = [...jobs].sort((a, b) => {
    const am = dailyMinuteOfDay(a.schedule);
    const bm = dailyMinuteOfDay(b.schedule);
    if (am !== null && bm !== null) return am - bm;
    if (am !== null) return -1;
    if (bm !== null) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Data-loader scheduler</h1>
          <p className={styles.pageSubtitle}>
            Sync / import / index cron jobs for every BI client, sorted as a timeline so overlapping windows are visible at a glance.
          </p>
        </div>
        <button className={styles.refreshBtn} onClick={loadJobs} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.section}>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Project</th>
                <th>Job</th>
                <th>Schedule (cron)</th>
                <th>Time zone</th>
                <th>Last run</th>
                <th>Next run</th>
                <th>State</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(job => {
                const { project, jobType } = parseJobName(job.name);
                const isEditing = editingName === job.name;
                const isSaving = savingName === job.name;
                return (
                  <tr key={job.name} className={job.state === 'PAUSED' ? styles.pausedRow : ''}>
                    <td className={styles.projectCell}>{project}</td>
                    <td>{JOB_TYPE_LABELS[jobType] || jobType}<div className={styles.jobName}>{job.name}</div></td>
                    <td>
                      {isEditing ? (
                        <div className={styles.editRow}>
                          <input
                            className={styles.cronInput}
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            disabled={isSaving}
                            autoFocus
                          />
                          <button className={styles.saveBtn} onClick={() => saveEdit(job.name)} disabled={isSaving}>
                            {isSaving ? '...' : 'Save'}
                          </button>
                          <button className={styles.cancelBtn} onClick={cancelEdit} disabled={isSaving}>Cancel</button>
                        </div>
                      ) : (
                        <code className={styles.cronCode} onClick={() => startEdit(job)} title="Click to edit">
                          {job.schedule}
                        </code>
                      )}
                    </td>
                    <td>{job.timeZone}</td>
                    <td>{formatTime(job.lastAttemptTime)}</td>
                    <td>{formatTime(job.scheduleTime)}</td>
                    <td>
                      <span className={job.state === 'ENABLED' ? styles.stateEnabled : styles.statePaused}>
                        {job.state === 'ENABLED' ? 'Enabled' : 'Paused'}
                      </span>
                    </td>
                    <td>
                      <button
                        className={styles.toggleBtn}
                        onClick={() => togglePaused(job)}
                        disabled={isSaving}
                      >
                        {job.state === 'ENABLED' ? 'Pause' : 'Resume'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!loading && sorted.length === 0 && (
                <tr><td colSpan={8} className={styles.emptyCell}>No scheduler jobs found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
