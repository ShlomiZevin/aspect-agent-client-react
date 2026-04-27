import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import styles from './CloudRunLogsPage.module.css';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface RawEntry {
  insertId: string;
  timestamp: string;
  severity: string;
  message: string;
  type?: 'http' | 'app';
  httpStatus?: number;
}

interface GroupedEntry extends RawEntry {
  stackFrames: string[];
}

type SeverityFilter = 'all' | 'error';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function isErrorSev(sev: string) {
  return ['ERROR', 'CRITICAL', 'ALERT', 'EMERGENCY'].includes(sev.toUpperCase());
}

function isStackFrame(msg: string) {
  return /^\s+at\s/.test(msg) || /^\s*\.\.\.\s+\d+\s+more/.test(msg);
}

function groupEntries(raw: RawEntry[]): GroupedEntry[] {
  const out: GroupedEntry[] = [];
  for (const entry of raw) {
    const msg = entry.message || '';
    if (isStackFrame(msg) && out.length > 0 && isErrorSev(out[out.length - 1].severity)) {
      out[out.length - 1].stackFrames.push(msg.trim());
    } else {
      out.push({ ...entry, stackFrames: [] });
    }
  }
  return out;
}

function fmtTs(ts: string): string {
  try {
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} `
         + `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch { return ts; }
}

// ─── Log Row ───────────────────────────────────────────────────────────────────

function LogRow({ entry }: { entry: GroupedEntry }) {
  const [open, setOpen] = useState(false);
  const hasStack = entry.stackFrames.length > 0;

  const isErr = isErrorSev(entry.severity);
  const isHttpErr = entry.type === 'http' && (entry.httpStatus ?? 0) >= 400;
  const isWarn = ['WARNING', 'WARN'].includes(entry.severity.toUpperCase());

  const rowCls = isErr ? styles.rowError
    : isHttpErr ? styles.rowHttpError
    : isWarn ? styles.rowWarn
    : styles.row;

  return (
    <>
      <div
        className={rowCls}
        onClick={() => hasStack && setOpen(o => !o)}
        style={hasStack ? { cursor: 'pointer' } : undefined}
      >
        <span className={styles.ts}>{fmtTs(entry.timestamp)}</span>
        <span className={styles.sev}>{entry.severity}</span>
        <span className={styles.msg}>{entry.message || <em className={styles.noMsg}>—</em>}</span>
        {hasStack && <span className={styles.stackToggle}>{open ? '▲' : `▼ ${entry.stackFrames.length}`}</span>}
      </div>
      {open && hasStack && entry.stackFrames.map((f, i) => (
        <div key={i} className={styles.stackLine}>{f}</div>
      ))}
    </>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export function CloudRunLogsPage({ baseURL }: { baseURL: string }) {
  const [raw, setRaw] = useState<RawEntry[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [filter, setFilter] = useState<SeverityFilter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchLogs = useCallback(async (sev: SeverityFilter, pageToken?: string | null) => {
    const isMore = !!pageToken;
    if (!isMore) {
      abortRef.current?.abort();
      abortRef.current = new AbortController();
    }
    const signal = !isMore ? abortRef.current!.signal : undefined;
    if (isMore) setLoadingMore(true);
    else { setLoading(true); setRaw([]); }
    setFetchError(null);
    try {
      const params = new URLSearchParams({ severity: sev, limit: '200' });
      if (pageToken) params.set('pageToken', pageToken);
      const res = await fetch(`${baseURL}/api/admin/cloud-run-logs?${params}`, { signal });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch logs');
      if (isMore) setRaw(prev => [...prev, ...(data.entries || [])]);
      else setRaw(data.entries || []);
      setNextPageToken(data.nextPageToken || null);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setFetchError(err instanceof Error ? err.message : 'Failed to fetch logs');
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [baseURL]);

  useEffect(() => {
    fetchLogs(filter);
    return () => abortRef.current?.abort();
  }, [fetchLogs, filter]);

  const grouped = useMemo(() => groupEntries(raw), [raw]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return grouped;
    return grouped.filter(e =>
      e.message.toLowerCase().includes(q) ||
      e.stackFrames.some(f => f.toLowerCase().includes(q))
    );
  }, [grouped, search]);

  const errorCount = grouped.filter(e => isErrorSev(e.severity)).length;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Cloud Run Logs</h1>
          <p className={styles.pageSubtitle}>Production server — last 200 entries, newest first</p>
        </div>
        <button className={styles.refreshBtn} onClick={() => fetchLogs(filter)} disabled={loading}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${filter === 'all' ? styles.tabActive : ''}`}
            onClick={() => setFilter('all')}
          >
            All <span className={styles.cnt}>{visible.length}</span>
          </button>
          <button
            className={`${styles.tab} ${styles.tabErr} ${filter === 'error' ? styles.tabErrActive : ''}`}
            onClick={() => setFilter('error')}
          >
            Errors
            {filter === 'all' && errorCount > 0 && <span className={styles.cntErr}>{errorCount}</span>}
          </button>
        </div>
        <input
          className={styles.searchInput}
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {fetchError && <div className={styles.errBanner}>{fetchError}</div>}

      <div className={styles.logList}>
        {loading && <div className={styles.centerMsg}>Loading logs...</div>}
        {!loading && visible.length === 0 && <div className={styles.centerMsg}>No entries found.</div>}
        {visible.map((entry, i) => (
          <LogRow key={entry.insertId || i} entry={entry} />
        ))}
        {!loading && nextPageToken && (
          <div className={styles.loadMoreRow}>
            <button className={styles.loadMoreBtn} onClick={() => fetchLogs(filter, nextPageToken)} disabled={loadingMore}>
              {loadingMore ? 'Loading...' : 'Load 200 more'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
