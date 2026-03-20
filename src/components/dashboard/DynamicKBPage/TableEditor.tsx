import { useRef, useState, useCallback, useEffect, type KeyboardEvent } from 'react';
import type { TableData } from '../../../types/dynamicKB';
import styles from './TableEditor.module.css';

interface TableEditorProps {
  value: TableData;
  onChange: (value: TableData) => void;
  onImport: (file: File) => void;
}

export function TableEditor({ value, onChange, onImport }: TableEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tableWrapRef = useRef<HTMLDivElement>(null);
  const [isRTL, setIsRTL] = useState(false);
  const { headers, rows } = value;

  useEffect(() => {
    if (tableWrapRef.current) {
      tableWrapRef.current.scrollLeft = isRTL ? tableWrapRef.current.scrollWidth : 0;
    }
  }, [isRTL]);

  const updateHeader = useCallback((colIdx: number, val: string) => {
    const newHeaders = [...headers];
    newHeaders[colIdx] = val;
    onChange({ headers: newHeaders, rows });
  }, [headers, rows, onChange]);

  const updateCell = useCallback((rowIdx: number, colIdx: number, val: string) => {
    const newRows = rows.map((r, i) => i === rowIdx ? r.map((c, j) => j === colIdx ? val : c) : [...r]);
    onChange({ headers, rows: newRows });
  }, [headers, rows, onChange]);

  const addRow = useCallback(() => {
    const newRow = headers.map(() => '');
    onChange({ headers, rows: [...rows, newRow] });
  }, [headers, rows, onChange]);

  const addColumn = useCallback(() => {
    const newHeaders = [...headers, `Column ${headers.length + 1}`];
    const newRows = rows.map(r => [...r, '']);
    onChange({ headers: newHeaders, rows: newRows });
  }, [headers, rows, onChange]);

  const deleteRow = useCallback((rowIdx: number) => {
    onChange({ headers, rows: rows.filter((_, i) => i !== rowIdx) });
  }, [headers, rows, onChange]);

  const deleteColumn = useCallback((colIdx: number) => {
    const newHeaders = headers.filter((_, i) => i !== colIdx);
    const newRows = rows.map(r => r.filter((_, i) => i !== colIdx));
    onChange({ headers: newHeaders, rows: newRows });
  }, [headers, rows, onChange]);

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
                    className={styles.deleteColBtn}
                    onClick={() => deleteColumn(colIdx)}
                    title="Delete column"
                  >
                    ×
                  </button>
                </th>
              ))}
              <th className={styles.addColHeader}>
                <button className={styles.addColBtn} onClick={addColumn} title="Add column">+</button>
              </th>
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
                  <td key={colIdx} className={styles.cell}>
                    <input
                      id={`cell-${rowIdx}-${colIdx}`}
                      className={styles.cellInput}
                      value={cell}
                      size={Math.max(cell.length + 1, 6)}
                      onChange={e => updateCell(rowIdx, colIdx, e.target.value)}
                      onKeyDown={e => handleKeyDown(e, rowIdx, colIdx)}
                    />
                  </td>
                ))}
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.tableActions}>
        <button className={styles.addBtn} onClick={addRow}>+ Add Row</button>
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
