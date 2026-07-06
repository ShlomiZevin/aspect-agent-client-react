import { useMemo, useState } from 'react';
import styles from './DataTableModal.module.css';

/**
 * Full-data table viewer for an agent query result. Shows the COMPLETE row set
 * (not the truncated preview the agent renders in chat) with per-column sort, a
 * free-text filter, and a one-click Excel (UTF-8 CSV, BOM-prefixed for Hebrew)
 * export of the current filtered/sorted view.
 */

interface Props {
  rows: Record<string, unknown>[];
  columns?: unknown;
  title?: string;
  exportLabel: string;
  filterPlaceholder: string;
  rowsLabel: (n: number) => string;
  closeLabel: string;
  onClose: () => void;
}

function cellText(v: unknown): string {
  if (v == null) return '';
  return String(v);
}

function downloadCSV(headers: string[], rows: Record<string, unknown>[]) {
  const esc = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines = [headers.map(esc).join(',')];
  for (const r of rows) lines.push(headers.map(h => esc(cellText(r[h]))).join(','));
  const csv = '﻿' + lines.join('\r\n'); // BOM → Excel reads UTF-8 (Hebrew)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `table-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function DataTableModal({
  rows, columns, title, exportLabel, filterPlaceholder, rowsLabel, closeLabel, onClose,
}: Props) {
  const headers = useMemo<string[]>(() => {
    if (Array.isArray(columns) && columns.length && typeof columns[0] === 'string') {
      return columns as string[];
    }
    return rows.length ? Object.keys(rows[0]) : [];
  }, [columns, rows]);

  const [filter, setFilter] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const view = useMemo(() => {
    let out = rows;
    const q = filter.trim().toLowerCase();
    if (q) out = out.filter(r => headers.some(h => cellText(r[h]).toLowerCase().includes(q)));
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
  }, [rows, headers, filter, sortCol, sortDir]);

  const toggleSort = (h: string) => {
    if (sortCol !== h) { setSortCol(h); setSortDir('asc'); return; }
    if (sortDir === 'asc') { setSortDir('desc'); return; }
    setSortCol(null); // third click clears sorting
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
          />
          <span className={styles.count}>{rowsLabel(view.length)}</span>
          <button type="button" className={styles.exportBtn} onClick={() => downloadCSV(headers, view)}>
            ⬇ {exportLabel}
          </button>
        </div>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                {headers.map(h => (
                  <th key={h} className={styles.th} onClick={() => toggleSort(h)}>
                    {h}{sortCol === h ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.map((r, i) => (
                <tr key={i}>
                  {headers.map(h => <td key={h} className={styles.td}>{cellText(r[h])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
