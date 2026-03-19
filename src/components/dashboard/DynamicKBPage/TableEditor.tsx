import { useRef, useCallback } from 'react';
import type { TableData } from '../../../types';
import styles from './DynamicKBPage.module.css';

interface Props {
  value: TableData;
  onChange: (value: TableData) => void;
  onImport: (file: File) => void;
  isImporting?: boolean;
}

export function TableEditor({ value, onChange, onImport, isImporting }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { headers, rows } = value;

  const setHeaders = useCallback((newHeaders: string[]) => {
    onChange({ headers: newHeaders, rows });
  }, [onChange, rows]);

  const setRows = useCallback((newRows: string[][]) => {
    onChange({ headers, rows: newRows });
  }, [onChange, headers]);

  const updateHeader = (colIdx: number, val: string) => {
    const newHeaders = [...headers];
    newHeaders[colIdx] = val;
    setHeaders(newHeaders);
  };

  const updateCell = (rowIdx: number, colIdx: number, val: string) => {
    const newRows = rows.map(r => [...r]);
    newRows[rowIdx][colIdx] = val;
    setRows(newRows);
  };

  const addRow = () => {
    setRows([...rows, headers.map(() => '')]);
  };

  const deleteRow = (rowIdx: number) => {
    setRows(rows.filter((_, i) => i !== rowIdx));
  };

  const addColumn = () => {
    setHeaders([...headers, `Column ${headers.length + 1}`]);
    setRows(rows.map(r => [...r, '']));
  };

  const deleteColumn = (colIdx: number) => {
    onChange({
      headers: headers.filter((_, i) => i !== colIdx),
      rows: rows.map(r => r.filter((_, i) => i !== colIdx)),
    });
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIdx: number,
    colIdx: number
  ) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const nextCol = colIdx + 1;
      const nextRow = rowIdx + 1;
      if (nextCol < headers.length) {
        const cell = document.querySelector<HTMLInputElement>(
          `[data-row="${rowIdx}"][data-col="${nextCol}"]`
        );
        cell?.focus();
      } else if (nextRow < rows.length) {
        const cell = document.querySelector<HTMLInputElement>(
          `[data-row="${nextRow}"][data-col="0"]`
        );
        cell?.focus();
      } else {
        addRow();
        // Focus after render
        setTimeout(() => {
          const cell = document.querySelector<HTMLInputElement>(
            `[data-row="${nextRow}"][data-col="0"]`
          );
          cell?.focus();
        }, 0);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
      e.target.value = '';
    }
  };

  return (
    <div className={styles.tableEditorContainer}>
      <div className={styles.editorToolbar}>
        <button
          className={styles.importBtn}
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
          title="Import from .csv, .xls, or .xlsx"
        >
          {isImporting ? 'Importing...' : 'Import .csv/.xls/.xlsx'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xls,.xlsx"
          className={styles.hiddenInput}
          onChange={handleFileChange}
        />
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.editableTable}>
          <thead>
            <tr>
              <th className={styles.rowNumCell} />
              {headers.map((h, colIdx) => (
                <th key={colIdx} className={styles.headerCell}>
                  <div className={styles.headerCellInner}>
                    <input
                      className={styles.headerInput}
                      value={h}
                      onChange={e => updateHeader(colIdx, e.target.value)}
                      placeholder={`Col ${colIdx + 1}`}
                    />
                    <button
                      className={styles.deleteColBtn}
                      onClick={() => deleteColumn(colIdx)}
                      title="Delete column"
                    >
                      ×
                    </button>
                  </div>
                </th>
              ))}
              <th className={styles.addColCell}>
                <button className={styles.addColBtn} onClick={addColumn} title="Add column">+</button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx} className={styles.dataRow}>
                <td className={styles.rowNumCell}>{rowIdx + 1}</td>
                {headers.map((_, colIdx) => (
                  <td key={colIdx} className={styles.dataCell}>
                    <input
                      className={styles.cellInput}
                      value={row[colIdx] ?? ''}
                      onChange={e => updateCell(rowIdx, colIdx, e.target.value)}
                      onKeyDown={e => handleKeyDown(e, rowIdx, colIdx)}
                      data-row={rowIdx}
                      data-col={colIdx}
                    />
                  </td>
                ))}
                <td className={styles.deleteRowCell}>
                  <button
                    className={styles.deleteRowBtn}
                    onClick={() => deleteRow(rowIdx)}
                    title="Delete row"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button className={styles.addRowBtn} onClick={addRow}>+ Add Row</button>
    </div>
  );
}
