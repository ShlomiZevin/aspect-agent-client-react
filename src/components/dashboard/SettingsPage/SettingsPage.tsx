import { useState, useEffect, useCallback, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { ApiKeysPage } from '../ApiKeysPage';
import styles from './SettingsPage.module.css';

interface Props {
  baseURL?: string;
  agentName: string;
}

function NotificationsTab({ baseURL = '', agentName }: Props) {
  const [emails, setEmails] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${baseURL}/api/admin/agents/${agentName}/settings`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const raw: string = data.contactEmail || '';
      setEmails(raw ? raw.split(',').map((e: string) => e.trim()).filter(Boolean) : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [baseURL, agentName]);

  useEffect(() => { load(); }, [load]);

  const addEmail = (val: string) => {
    const trimmed = val.trim().toLowerCase();
    if (!trimmed || emails.includes(trimmed)) return;
    setEmails(prev => [...prev, trimmed]);
  };

  const removeEmail = (index: number) => {
    setEmails(prev => prev.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addEmail(inputValue);
      setInputValue('');
    } else if (e.key === 'Backspace' && !inputValue && emails.length > 0) {
      setEmails(prev => prev.slice(0, -1));
    }
  };

  const handleBlur = () => {
    setFocused(false);
    if (inputValue.trim()) {
      addEmail(inputValue);
      setInputValue('');
    }
  };

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch(`${baseURL}/api/admin/agents/${agentName}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactEmail: emails.join(',') }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.card}>
      <p className={styles.cardTitle}>Error notification recipients</p>
      <p className={styles.cardDesc}>
        When a chat error occurs, an email is sent to all addresses listed here.
        Leave empty to disable notifications for this agent.
      </p>

      <div
        className={`${styles.tagInput} ${focused ? styles.tagInputFocused : ''}`}
        onClick={() => inputRef.current?.focus()}
      >
        {emails.map((email, i) => (
          <span key={email} className={styles.tag}>
            {email}
            <button className={styles.tagRemove} onClick={() => removeEmail(i)} type="button">×</button>
          </span>
        ))}
        <input
          ref={inputRef}
          className={styles.tagTextInput}
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
          placeholder={emails.length === 0 ? 'Add email address…' : ''}
          type="email"
        />
      </div>
      <p className={styles.hint}>Press Enter or comma to add. Click × to remove.</p>

      <div className={styles.actions}>
        <button className={styles.saveBtn} onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span className={styles.savedMsg}>Saved</span>}
        {error && <span className={styles.errorMsg}>{error}</span>}
      </div>
    </div>
  );
}

interface ScheduleEntry {
  schemaName: string;
  jobType: 'import' | 'drive_sync';
  enabled: boolean;
  hour: number;
  minute: number;
}

interface LastCycle {
  importStartedAt: string | null;
  importCompletedAt: string | null;
  importStatus: string | null;
  totalRows: number | null;
  indexStartedAt: string | null;
  indexCompletedAt: string | null;
  indexStatus: string | null;
  durationMs: number | null;
}

const JOB_TYPE_LABELS: Record<ScheduleEntry['jobType'], string> = {
  import: 'Import',
  drive_sync: 'Drive Sync',
};

function timeLabel(hour: number, minute: number) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function formatDuration(ms: number) {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

/** Minutes since local midnight, in a given IANA zone — matches the "Time
 *  (Asia/Jerusalem)" column, which is what a schedule hour/minute means. */
function minutesSinceMidnight(iso: string, tz = 'Asia/Jerusalem') {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(iso));
  const h = Number(parts.find(p => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find(p => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

function nowMinutesSinceMidnight(tz = 'Asia/Jerusalem') {
  return minutesSinceMidnight(new Date().toISOString(), tz);
}

const HOUR_TICKS = [0, 4, 8, 12, 16, 20, 24];

interface ProjectRow {
  schemaName: string;
  driveSync?: ScheduleEntry;
  import?: ScheduleEntry;
  cycle?: LastCycle;
}

/** One project's last-cycle health, boiled down to what the reference tab
 *  actually needs to answer at a glance: did it run, did it finish, how long
 *  did it take. */
function lastRunSummary(cycle: LastCycle | undefined): { text: string; tone: 'ok' | 'warn' | 'bad' | 'muted' } {
  if (!cycle || !cycle.importStartedAt) return { text: 'No runs recorded yet', tone: 'muted' };
  if (cycle.importStatus === 'failed') return { text: 'Last import failed', tone: 'bad' };
  if (cycle.durationMs == null) return { text: 'Import done, indexing not caught up', tone: 'warn' };
  return { text: `Last full run: ${formatDuration(cycle.durationMs)}`, tone: 'ok' };
}

/**
 * A shared 24h timeline, one lane per project, so overlapping schedules (two
 * projects' imports contending for the same DB around the same time) are
 * visible at a glance instead of read out of a table row by row.
 *
 * Encodes two independent things per bar, since conflating them into one
 * color would lose information:
 *   - fill color = whether that project's OWN last cycle finished cleanly
 *     (green) or not (red/gray)
 *   - amber outline = this bar's time window overlaps another project's,
 *     regardless of either one's health — the actual "will these two fight
 *     over the DB" signal.
 * Bars longer than the gap to the next midnight are clipped at 24:00 with a
 * small overflow mark rather than wrapping, since every duration seen so far
 * is well under a day.
 */
function ScheduleTimeline({ rows }: { rows: ProjectRow[] }) {
  const nowMin = nowMinutesSinceMidnight();

  const bars = rows.map(r => {
    if (!r.import?.enabled || !r.cycle?.durationMs) return null;
    const startMin = r.import.hour * 60 + r.import.minute;
    const durationMin = r.cycle.durationMs / 60000;
    const endMin = Math.min(1440, startMin + durationMin);
    const overflowed = startMin + durationMin > 1440;
    return { schemaName: r.schemaName, startMin, endMin, overflowed };
  });

  const overlapping = new Set<string>();
  for (let i = 0; i < bars.length; i++) {
    const a = bars[i];
    if (!a) continue;
    for (let j = i + 1; j < bars.length; j++) {
      const b = bars[j];
      if (!b) continue;
      if (a.startMin < b.endMin && b.startMin < a.endMin) {
        overlapping.add(a.schemaName);
        overlapping.add(b.schemaName);
      }
    }
  }

  const pct = (min: number) => `${(min / 1440) * 100}%`;

  return (
    <div className={styles.timelineWrap}>
      <div className={styles.timelineLegend}>
        <span><i className={`${styles.legendDot} ${styles.legendOk}`} /> finished cleanly</span>
        <span><i className={`${styles.legendDot} ${styles.legendBad}`} /> failed / not caught up</span>
        <span><i className={`${styles.legendOutline}`} /> overlaps another project</span>
        <span><i className={styles.legendMarkerDrive} /> Drive Sync</span>
        <span><i className={styles.legendMarkerImport} /> Import</span>
      </div>

      <div className={styles.timelineAxis}>
        {HOUR_TICKS.map(h => (
          <span key={h} className={styles.timelineTick} style={{ insetInlineStart: pct(h * 60) }}>
            {String(h).padStart(2, '0')}:00
          </span>
        ))}
      </div>

      {rows.map(r => {
        const bar = bars.find(b => b?.schemaName === r.schemaName);
        const summary = lastRunSummary(r.cycle);
        const barTone = summary.tone === 'ok' ? styles.timelineBarOk : summary.tone === 'bad' ? styles.timelineBarBad : styles.timelineBarWarn;
        return (
          <div className={styles.timelineRow} key={r.schemaName}>
            <span className={styles.timelineLabel}>{r.schemaName}</span>
            <div className={styles.timelineTrack}>
              <span className={styles.timelineNow} style={{ insetInlineStart: pct(nowMin) }} title="Now" />
              {r.driveSync?.enabled && (
                <span
                  className={styles.timelineMarkerDrive}
                  style={{ insetInlineStart: pct(r.driveSync.hour * 60 + r.driveSync.minute) }}
                  title={`Drive Sync ${timeLabel(r.driveSync.hour, r.driveSync.minute)}`}
                />
              )}
              {r.import?.enabled && (
                <span
                  className={styles.timelineMarkerImport}
                  style={{ insetInlineStart: pct(r.import.hour * 60 + r.import.minute) }}
                  title={`Import ${timeLabel(r.import.hour, r.import.minute)}`}
                />
              )}
              {bar && (
                <span
                  className={`${styles.timelineBar} ${barTone} ${overlapping.has(r.schemaName) ? styles.timelineBarOverlap : ''}`}
                  style={{ insetInlineStart: pct(bar.startMin), width: `calc(${pct(bar.endMin - bar.startMin)})` }}
                  title={`${r.schemaName}: ${summary.text}${bar.overflowed ? ' (runs past midnight)' : ''}`}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProjectScheduleCard({ row }: { row: ProjectRow }) {
  const summary = lastRunSummary(row.cycle);
  return (
    <div className={styles.projectCard}>
      <div className={styles.projectName}>{row.schemaName}</div>
      {(['driveSync', 'import'] as const).map(key => {
        const entry = key === 'driveSync' ? row.driveSync : row.import;
        if (!entry) return null;
        return (
          <div className={styles.jobRow} key={key}>
            <span className={styles.jobLabel}>{JOB_TYPE_LABELS[entry.jobType]}</span>
            <span className={entry.enabled ? styles.scheduleOn : styles.scheduleOff}>{entry.enabled ? 'On' : 'Off'}</span>
            <span className={styles.jobTime}>{timeLabel(entry.hour, entry.minute)}</span>
          </div>
        );
      })}
      <div className={`${styles.lastRunLine} ${styles[`tone${summary.tone[0].toUpperCase()}${summary.tone.slice(1)}`]}`}>
        {summary.text}
        {row.cycle?.totalRows != null && row.cycle.totalRows > 0 && (
          <span className={styles.lastRunRows}> · {Number(row.cycle.totalRows).toLocaleString()} rows</span>
        )}
      </div>
    </div>
  );
}

function ScheduleTab({ baseURL = '' }: Props) {
  const [schedules, setSchedules] = useState<ScheduleEntry[] | null>(null);
  const [lastRuns, setLastRuns] = useState<Record<string, LastCycle> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [schedulesRes, lastRunsRes] = await Promise.all([
        fetch(`${baseURL}/api/admin/scheduler/schedules`),
        fetch(`${baseURL}/api/admin/scheduler/last-runs`),
      ]);
      if (!schedulesRes.ok) throw new Error(`HTTP ${schedulesRes.status}`);
      const schedulesData = await schedulesRes.json();
      setSchedules(schedulesData.schedules || []);
      // Last-run info is a nice-to-have on top of the schedule itself — a
      // failure here shouldn't blank out the schedule the tab exists for.
      if (lastRunsRes.ok) {
        const lastRunsData = await lastRunsRes.json();
        setLastRuns(lastRunsData.lastRuns || {});
      } else {
        setLastRuns({});
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [baseURL]);

  useEffect(() => { load(); }, [load]);

  // Group the flat {schemaName, jobType}[] list into one row per project —
  // Kosta asked for this explicitly: the old flat table repeated the project
  // name on every line and read as one long list, not seven projects.
  const rows: ProjectRow[] = [];
  if (schedules) {
    const bySchema = new Map<string, ProjectRow>();
    for (const s of schedules) {
      let row = bySchema.get(s.schemaName);
      if (!row) {
        row = { schemaName: s.schemaName };
        bySchema.set(s.schemaName, row);
        rows.push(row);
      }
      if (s.jobType === 'drive_sync') row.driveSync = s;
      else row.import = s;
      row.cycle = lastRuns?.[s.schemaName];
    }
  }

  return (
    <div className={styles.card}>
      <p className={styles.cardTitle}>Data-loader schedule (reference)</p>
      <p className={styles.cardDesc}>
        Read-only overview of every project's import/sync schedule. One Cloud Scheduler job checks this every
        minute - to change a time or turn something on/off, use that project's Data Loader &gt; Configuration
        tab.
      </p>
      {error && <p className={styles.errorMsg}>{error}</p>}
      {rows.length > 0 && <ScheduleTimeline rows={rows} />}
      {rows.length > 0 && (
        <div className={styles.projectGrid}>
          {rows.map(row => <ProjectScheduleCard row={row} key={row.schemaName} />)}
        </div>
      )}
    </div>
  );
}

type Tab = 'api-keys' | 'notifications' | 'schedule';

export function SettingsPage({ baseURL = '', agentName }: Props) {
  const [tab, setTab] = useState<Tab>('api-keys');

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.subtitle}>Agent configuration and notification settings.</p>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'api-keys' ? styles.tabActive : ''}`}
          onClick={() => setTab('api-keys')}
        >
          API Keys
        </button>
        <button
          className={`${styles.tab} ${tab === 'notifications' ? styles.tabActive : ''}`}
          onClick={() => setTab('notifications')}
        >
          Notifications
        </button>
        <button
          className={`${styles.tab} ${tab === 'schedule' ? styles.tabActive : ''}`}
          onClick={() => setTab('schedule')}
        >
          Schedule
        </button>
      </div>

      {tab === 'api-keys' && <ApiKeysPage baseURL={baseURL} embedded />}
      {tab === 'notifications' && <NotificationsTab baseURL={baseURL} agentName={agentName} />}
      {tab === 'schedule' && <ScheduleTab baseURL={baseURL} agentName={agentName} />}
    </div>
  );
}
