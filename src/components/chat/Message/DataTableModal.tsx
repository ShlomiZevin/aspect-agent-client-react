import { useEffect, useMemo, useState } from 'react';
import styles from './DataTableModal.module.css';

/**
 * Full-data table viewer for an agent query result. Shows the COMPLETE row set
 * (not the truncated preview the agent renders in chat) with per-column sort, a
 * free-text filter, pagination (100 rows/page — result sets can now run into
 * the thousands), and a one-click real .xlsx export (via the server, so the
 * file matches the same column labels/order/number-formatting as the chat
 * preview — see table-format.service.js).
 *
 * `rows` only arrives non-empty for the LIVE session (streamed over SSE right
 * when the step was created) — thinking_steps never persists a data_table
 * step's rows (see thinking.service.js), so reopening an OLDER conversation
 * gives `rows: []` plus `sql`/`schema`. In that case this component re-runs
 * the query itself via POST /api/data-query/rerun to fetch the complete set.
 */

export interface DisplayColumn {
  key: string;
  label: string;
  decimals: number | null; // null = plain text/identifier column
  isMoney: boolean;
  isPercent?: boolean;
}

const PAGE_SIZE = 100;

interface Props {
  rows: Record<string, unknown>[];
  columns?: unknown;
  displayColumns?: DisplayColumn[];
  sql?: string;
  schema?: string;
  title?: string;
  baseURL: string;
  exportLabel: string;
  filterPlaceholder: string;
  rowsLabel: (n: number) => string;
  closeLabel: string;
  loadingLabel: string;
  onClose: () => void;
}

function cellText(v: unknown): string {
  if (v == null) return '';
  return String(v);
}

function formatCell(value: unknown, col: DisplayColumn): string {
  if (value == null || value === '') return '';
  if (col.decimals != null) {
    const n = parseFloat(String(value));
    if (!isNaN(n)) {
      const formatted = n.toLocaleString('en-US', { minimumFractionDigits: col.decimals, maximumFractionDigits: col.decimals });
      if (col.isPercent) return formatted + '%';
      return col.isMoney ? '₪' + formatted : formatted;
    }
  }
  return String(value);
}

export function DataTableModal({
  rows, columns, displayColumns, sql, schema, title, baseURL,
  exportLabel, filterPlaceholder, rowsLabel, closeLabel, loadingLabel, onClose,
}: Props) {
  const [liveRows, setLiveRows] = useState(rows);
  const [liveColumns, setLiveColumns] = useState(columns);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Re-run the query ourselves when the step didn't come with rows attached
  // (a reopened historical conversation) but does have enough to redo it.
  // AbortController (not just an `cancelled` flag) so React 18 StrictMode's
  // deliberate dev-mode double-invoke of effects actually cancels the first
  // in-flight request instead of firing two real queries against the DB.
  useEffect(() => {
    if (rows.length > 0 || !sql || !schema) return;
    const controller = new AbortController();
    setLoading(true);
    setLoadError(null);
    fetch(`${baseURL}/api/data-query/rerun`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schema, sql }),
      signal: controller.signal,
    })
      .then(res => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(data => {
        setLiveRows(data.rows || []);
        setLiveColumns(data.columns);
        setLoading(false);
      })
      .catch(err => {
        // An aborted request (StrictMode's dev-mode double-invoke cancelling
        // the first of two calls) must NOT touch loading/error state — it
        // would otherwise flip loading back to false while the second,
        // real request is still in flight, showing an empty "0 rows" table
        // for however long that request takes instead of the spinner.
        if (err.name === 'AbortError') return;
        setLoadError(err.message);
        setLoading(false);
      });
    return () => controller.abort();
    // Only re-run once, on mount — sql/schema/rows are fixed for a given step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fall back to raw column keys (no label/format) when the step has no
  // displayColumns (e.g. markdown-table fallback for agents without a data tool).
  const cols = useMemo<DisplayColumn[]>(() => {
    if (displayColumns?.length) return displayColumns;
    const keys = (Array.isArray(liveColumns) && liveColumns.length && typeof liveColumns[0] === 'string')
      ? liveColumns as string[]
      : (liveRows.length ? Object.keys(liveRows[0]) : []);
    return keys.map(key => ({ key, label: key, decimals: null, isMoney: false }));
  }, [displayColumns, liveColumns, liveRows]);

  const [filter, setFilter] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);

  const view = useMemo(() => {
    let out = liveRows;
    const q = filter.trim().toLowerCase();
    if (q) out = out.filter(r => cols.some(c => cellText(r[c.key]).toLowerCase().includes(q)));
    if (sortCol) {
      out = [...out].sort((a, b) => {
        const as = cellText(a[sortCol]);
        const bs = cellText(b[sortCol]);
        const an = parseFloat(as.replace(/[^0-9.\-]/g, ''));
        const bn = parseFloat(bs.replace(/[^0-9.\-]/g, ''));
        const numeric = as !== '' && bs !== '' && !isNaN(an) && !isNaN(bn);
        const cmp = numeric ? an - bn : as.localeCompare(bs, undefined, { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return out;
  }, [liveRows, cols, filter, sortCol, sortDir]);

  // Filtering/sorting can change the row count under the current page — snap
  // back to page 0 whenever the view changes shape.
  useEffect(() => { setPage(0); }, [filter, sortCol, sortDir]);

  const pageCount = Math.max(1, Math.ceil(view.length / PAGE_SIZE));
  const pageRows = view.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const toggleSort = (h: string) => {
    if (sortCol !== h) { setSortCol(h); setSortDir('asc'); return; }
    if (sortDir === 'asc') { setSortDir('desc'); return; }
    setSortCol(null); // third click clears sorting
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch(`${baseURL}/api/data-query/export-excel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayColumns: cols, rows: view, title }),
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `table-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Excel export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.title} title={title}>{title}</div>
          <button type="button" className={styles.close} onClick={onClose} aria-label={closeLabel}>×</button>
        </div>
        <div className={styles.toolbar}>
          <input
            className={styles.filter}
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder={filterPlaceholder}
            disabled={loading}
          />
          <span className={styles.count}>{loading ? loadingLabel : rowsLabel(view.length)}</span>
          <button type="button" className={styles.exportBtn} onClick={handleExport} disabled={exporting || loading || view.length === 0}>
            ⬇ {exportLabel}
          </button>
        </div>
        {loading ? (
          <div className={styles.tableScroll}>
            <div className={styles.loadingState}>
              <div className={styles.spinner} />
              <span>{loadingLabel}</span>
            </div>
          </div>
        ) : loadError ? (
          <div className={styles.tableScroll}>
            <p style={{ padding: 16 }}>{loadError}</p>
          </div>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {cols.map(c => (
                    <th key={c.key} className={styles.th} onClick={() => toggleSort(c.key)}>
                      {c.label}{sortCol === c.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r, i) => (
                  <tr key={i}>
                    {cols.map(c => <td key={c.key} className={styles.td}>{formatCell(r[c.key], c)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pageCount > 1 && (
          <div className={styles.pagination}>
            <button type="button" className={styles.pageBtn} onClick={() => setPage(0)} disabled={page === 0}>«</button>
            <button type="button" className={styles.pageBtn} onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>‹</button>
            <span className={styles.pageInfo}>{page + 1} / {pageCount}</span>
            <button type="button" className={styles.pageBtn} onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1}>›</button>
            <button type="button" className={styles.pageBtn} onClick={() => setPage(pageCount - 1)} disabled={page >= pageCount - 1}>»</button>
          </div>
        )}
      </div>
    </div>
  );
}
