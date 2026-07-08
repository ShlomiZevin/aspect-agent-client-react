import { useRef, useState, useCallback, useEffect, type KeyboardEvent, type ReactNode } from 'react';
import type { TableData } from '../../../types/dynamicKB';
import styles from './TableEditor.module.css';

interface TableEditorProps {
  value: TableData;
  onChange: (value: TableData) => void;
  onImport: (file: File) => void;
  /** Optional content rendered RIGHT-aligned inside the action bar
   *  (after `+ Add Row` / `+ Add Column` / `Import` / `RTL →`).
   *  Used by the modal wrapper to slot Save / Cancel into the same
   *  flex row so all buttons share the same baseline. */
  rightActions?: ReactNode;
  /** Opt-in: render "long-form" columns (any cell longer than
   *  `MULTILINE_THRESHOLD`) as wrapping, auto-growing textareas instead
   *  of single-line inputs, and top-align every cell. Off by default so
   *  existing callers (the DynamicKB dashboard) keep the exact grid
   *  behavior; the prompt-table modal turns it on so an essay column is
   *  readable at a glance. */
  multilineLongCells?: boolean;
}

/** A column is "long-form" when any of its cells exceeds this. */
const MULTILINE_THRESHOLD = 80;

export function TableEditor({ value, onChange, onImport, rightActions, multilineLongCells = false }: TableEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tableWrapRef = useRef<HTMLDivElement>(null);
  const [isRTL, setIsRTL] = useState(false);
  const { headers, rows, indexColumns = [] } = value;

  // Per-column long-form classification (only when opted in). Consistent
  // across every row so an essay column is a textarea throughout, not
  // just in the rows that already hold long text.
  const longCols = multilineLongCells
    ? headers.map((_, c) => rows.some(r => (r[c] ?? '').length > MULTILINE_THRESHOLD))
    : [];

  useEffect(() => {
    if (tableWrapRef.current) {
      tableWrapRef.current.scrollLeft = isRTL ? tableWrapRef.current.scrollWidth : 0;
    }
  }, [isRTL]);

  const updateHeader = useCallback((colIdx: number, val: string) => {
    const newHeaders = [...headers];
    newHeaders[colIdx] = val;
    onChange({ headers: newHeaders, rows, indexColumns });
  }, [headers, rows, indexColumns, onChange]);

  const updateCell = useCallback((rowIdx: number, colIdx: number, val: string) => {
    const newRows = rows.map((r, i) => i === rowIdx ? r.map((c, j) => j === colIdx ? val : c) : [...r]);
    onChange({ headers, rows: newRows, indexColumns });
  }, [headers, rows, indexColumns, onChange]);

  const addRow = useCallback(() => {
    const newRow = headers.map(() => '');
    onChange({ headers, rows: [...rows, newRow], indexColumns });
  }, [headers, rows, indexColumns, onChange]);

  const addColumn = useCallback(() => {
    const newHeaders = [...headers, `Column ${headers.length + 1}`];
    const newRows = rows.map(r => [...r, '']);
    onChange({ headers: newHeaders, rows: newRows, indexColumns });
  }, [headers, rows, indexColumns, onChange]);

  const deleteRow = useCallback((rowIdx: number) => {
    onChange({ headers, rows: rows.filter((_, i) => i !== rowIdx), indexColumns });
  }, [headers, rows, indexColumns, onChange]);

  const deleteColumn = useCallback((colIdx: number) => {
    const newHeaders = headers.filter((_, i) => i !== colIdx);
    const newRows = rows.map(r => r.filter((_, i) => i !== colIdx));
    // Adjust index columns: remove if deleted, shift down indices above
    const newIndexColumns = indexColumns
      .filter(i => i !== colIdx)
      .map(i => i > colIdx ? i - 1 : i);
    onChange({ headers: newHeaders, rows: newRows, indexColumns: newIndexColumns });
  }, [headers, rows, indexColumns, onChange]);

  const toggleIndex = useCallback((colIdx: number) => {
    const newIndexColumns = indexColumns.includes(colIdx)
      ? indexColumns.filter(i => i !== colIdx)
      : [...indexColumns, colIdx].sort((a, b) => a - b);
    onChange({ headers, rows, indexColumns: newIndexColumns });
  }, [headers, rows, indexColumns, onChange]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const isHeader = rowIdx === -1;
      const nextCol = colIdx + (e.shiftKey ? -1 : 1);
      if (nextCol >= 0 && nextCol < headers.length) {
        const id = isHeader ? `header-${nextCol}` : `cell-${rowIdx}-${nextCol}`;
        document.getElementById(id)?.focus();
      } else if (!e.shiftKey && !isHeader && nextCol >= headers.length && rowIdx + 1 < rows.length) {
        document.getElementById(`cell-${rowIdx + 1}-0`)?.focus();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (rowIdx === -1) {
        document.getElementById(`cell-0-${colIdx}`)?.focus();
      } else if (rowIdx + 1 < rows.length) {
        document.getElementById(`cell-${rowIdx + 1}-${colIdx}`)?.focus();
      }
    }
  }, [headers.length, rows.length]);

  // Empty state: no headers yet
  if (headers.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No table data yet. Add columns to get started, or import a file.</p>
        <div className={styles.emptyActions}>
          <button className={styles.addBtn} onClick={addColumn}>+ Add Column</button>
          <button className={styles.importBtnInline} onClick={() => fileInputRef.current?.click()}>
            Import .csv / .xls / .xlsx
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xls,.xlsx"
          style={{ display: 'none' }}
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) onImport(file);
            e.target.value = '';
          }}
        />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.tableWrap} ref={tableWrapRef}>
        <table className={styles.table} dir={isRTL ? 'rtl' : 'ltr'}>
          <thead>
            <tr>
              <th className={styles.rowNumHeader}>#</th>
              {headers.map((h, colIdx) => (
                <th key={colIdx} className={styles.headerCell}>
                  <input
                    id={`header-${colIdx}`}
                    className={styles.headerInput}
                    value={h}
                    size={Math.max(h.length + 2, 8)}
                    onChange={e => updateHeader(colIdx, e.target.value)}
                    onKeyDown={e => handleKeyDown(e, -1, colIdx)}
                  />
                  <button
                    className={`${styles.indexColBtn} ${indexColumns.includes(colIdx) ? styles.indexColBtnActive : ''}`}
                    onClick={() => toggleIndex(colIdx)}
                    title={indexColumns.includes(colIdx) ? 'Remove from index' : 'Mark as index (used as heading in KB)'}
                  >
                    ⚷
                  </button>
                  <button
                    className={styles.deleteColBtn}
                    onClick={() => deleteColumn(colIdx)}
                    title="Delete column"
                  >
                    ×
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx} className={styles.row}>
                <td className={styles.rowNum}>
                  {rowIdx + 1}
                  <button
                    className={styles.deleteRowBtn}
                    onClick={() => deleteRow(rowIdx)}
                    title="Delete row"
                  >
                    ×
                  </button>
                </td>
                {row.map((cell, colIdx) => (
                  <td
                    key={colIdx}
                    className={`${styles.cell} ${multilineLongCells ? styles.cellTop : ''}`}
                  >
                    {multilineLongCells && longCols[colIdx] ? (
                      // Long-form column → wrapping, auto-growing textarea
                      // so the full multi-line value is visible/editable.
                      // No cell-navigation key handler (arrows move within
                      // the text); the shared id keeps focus-by-id working.
                      <textarea
                        id={`cell-${rowIdx}-${colIdx}`}
                        className={styles.cellTextarea}
                        dir="auto"
                        value={cell}
                        onChange={e => updateCell(rowIdx, colIdx, e.target.value)}
                      />
                    ) : (
                      <input
                        id={`cell-${rowIdx}-${colIdx}`}
                        className={styles.cellInput}
                        value={cell}
                        size={Math.max(cell.length + 1, 6)}
                        onChange={e => updateCell(rowIdx, colIdx, e.target.value)}
                        onKeyDown={e => handleKeyDown(e, rowIdx, colIdx)}
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.tableActions}>
        <button className={styles.addBtn} onClick={addRow}>+ Add Row</button>
        <button className={styles.addBtn} onClick={addColumn}>+ Add Column</button>
        <button className={styles.importBtnInline} onClick={() => fileInputRef.current?.click()}>
          Import .csv / .xls / .xlsx
        </button>
        <button
          className={`${styles.addBtn} ${isRTL ? styles.dirToggleActive : ''}`}
          onClick={() => setIsRTL(!isRTL)}
          title={isRTL ? 'Switch to LTR' : 'Switch to RTL'}
        >
          {isRTL ? '← LTR' : 'RTL →'}
        </button>
        {rightActions && (
          <>
            <span style={{ flex: 1 }} />
            {rightActions}
          </>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xls,.xlsx"
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) onImport(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
