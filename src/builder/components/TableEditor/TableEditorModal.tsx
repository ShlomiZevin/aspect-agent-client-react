/**
 * TableEditorModal — large modal for authoring a table that lives
 * inside a Targeted KB body (or any other prompt-text body in the
 * future). Storage is plain Markdown pipe-table text; this editor is
 * the structured front-end that round-trips to MD.
 *
 *  Features (v1)
 *   - Editable grid: per-cell text, click-to-edit
 *   - Add / delete / drag-reorder rows + columns
 *   - Column rename + alignment (left / center / right)
 *   - Caption field
 *   - Paste CSV / TSV directly into a cell — auto-splits into rows + cols
 *   - "Copy as TSV" so the table can round-trip back to Excel / Sheets
 *   - Save → emits the MD string to the caller; Cancel → no emit
 *
 *  Out of scope (deferred)
 *   - XLSX upload (no SheetJS dependency yet — clipboard paste from a
 *     spreadsheet works because Excel/Sheets put TSV on the clipboard)
 *   - Merged cells (not representable in MD pipe tables anyway)
 *
 *  The editor portals via Modal for stacking-context safety.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal } from '../Modal/Modal';
import {
  type TableModel,
  parseDelimited,
  rowsToTsv,
  tableToMarkdown,
} from './tableMarkdown';
import styles from './TableEditorModal.module.css';

interface Props {
  open: boolean;
  /** Optional initial model. When omitted, the editor opens with a
   *  3×2 starter so the author isn't staring at an empty grid. */
  initial?: TableModel;
  onCancel: () => void;
  /** Fires with the MD pipe-table string the author committed.
   *  Caller decides where to splice it (append to body, replace
   *  the source range it came from, etc). */
  onSave: (markdown: string) => void;
}

const DEFAULT_MODEL: TableModel = {
  caption: '',
  columns: [
    { name: 'col_1' },
    { name: 'col_2' },
    { name: 'col_3' },
  ],
  rows: [
    ['', '', ''],
    ['', '', ''],
  ],
};

export function TableEditorModal({ open, initial, onCancel, onSave }: Props) {
  const [model, setModel] = useState<TableModel>(() => initial ?? DEFAULT_MODEL);
  // Seed in/out: re-seat the editor whenever the modal flips open
  // (so a re-open with a different `initial` always shows that table).
  useEffect(() => {
    if (open) setModel(initial ?? DEFAULT_MODEL);
  }, [open, initial]);

  // ── Cell / column / row ops ─────────────────────────────────────
  const setCell = useCallback((rowIdx: number, colIdx: number, value: string) => {
    setModel(m => {
      const nextRows = m.rows.map((r, ri) => {
        if (ri !== rowIdx) return r;
        const nextRow = [...r];
        while (nextRow.length < m.columns.length) nextRow.push('');
        nextRow[colIdx] = value;
        return nextRow;
      });
      return { ...m, rows: nextRows };
    });
  }, []);

  const setColumnName = useCallback((colIdx: number, value: string) => {
    setModel(m => ({
      ...m,
      columns: m.columns.map((c, i) => i === colIdx ? { ...c, name: value } : c),
    }));
  }, []);

  const setColumnAlign = useCallback((colIdx: number, align: TableModel['columns'][number]['align']) => {
    setModel(m => ({
      ...m,
      columns: m.columns.map((c, i) => i === colIdx ? { ...c, align } : c),
    }));
  }, []);

  const addColumn = useCallback(() => {
    setModel(m => {
      const name = uniqueColumnName('col', m.columns.map(c => c.name));
      return {
        ...m,
        columns: [...m.columns, { name }],
        rows: m.rows.map(r => [...r, '']),
      };
    });
  }, []);

  const deleteColumn = useCallback((colIdx: number) => {
    setModel(m => ({
      ...m,
      columns: m.columns.filter((_, i) => i !== colIdx),
      rows: m.rows.map(r => r.filter((_, i) => i !== colIdx)),
    }));
  }, []);

  const moveColumn = useCallback((colIdx: number, dir: -1 | 1) => {
    setModel(m => {
      const j = colIdx + dir;
      if (j < 0 || j >= m.columns.length) return m;
      const cols = [...m.columns];
      [cols[colIdx], cols[j]] = [cols[j], cols[colIdx]];
      const rows = m.rows.map(r => {
        const next = [...r];
        [next[colIdx], next[j]] = [next[j], next[colIdx]];
        return next;
      });
      return { ...m, columns: cols, rows };
    });
  }, []);

  const addRow = useCallback(() => {
    setModel(m => ({
      ...m,
      rows: [...m.rows, m.columns.map(() => '')],
    }));
  }, []);

  const deleteRow = useCallback((rowIdx: number) => {
    setModel(m => ({
      ...m,
      rows: m.rows.filter((_, i) => i !== rowIdx),
    }));
  }, []);

  const moveRow = useCallback((rowIdx: number, dir: -1 | 1) => {
    setModel(m => {
      const j = rowIdx + dir;
      if (j < 0 || j >= m.rows.length) return m;
      const rows = [...m.rows];
      [rows[rowIdx], rows[j]] = [rows[j], rows[rowIdx]];
      return { ...m, rows };
    });
  }, []);

  // ── Paste detection: turn a multi-row / multi-col paste into a
  //    bulk insertion starting at the focused cell. Single-cell
  //    pastes pass through normally. ────────────────────────────────
  const handleCellPaste = useCallback((rowIdx: number, colIdx: number) =>
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const text = e.clipboardData?.getData('text');
      if (!text || (!text.includes('\n') && !text.includes('\t'))) return; // single cell
      const grid = parseDelimited(text);
      if (!grid || grid.length === 0) return;
      e.preventDefault();
      setModel(m => {
        // Grow columns / rows as needed so the paste fits without
        // truncating data.
        const needCols = colIdx + Math.max(...grid.map(r => r.length));
        const needRows = rowIdx + grid.length;
        let nextCols = m.columns.slice();
        while (nextCols.length < needCols) {
          nextCols = [...nextCols, { name: uniqueColumnName('col', nextCols.map(c => c.name)) }];
        }
        let nextRows = m.rows.map(r => {
          const padded = [...r];
          while (padded.length < nextCols.length) padded.push('');
          return padded;
        });
        while (nextRows.length < needRows) nextRows.push(nextCols.map(() => ''));

        for (let ri = 0; ri < grid.length; ri++) {
          for (let ci = 0; ci < grid[ri].length; ci++) {
            nextRows[rowIdx + ri][colIdx + ci] = grid[ri][ci];
          }
        }
        return { ...m, columns: nextCols, rows: nextRows };
      });
    }, []);

  // ── Caption ─────────────────────────────────────────────────────
  const setCaption = useCallback((next: string) => {
    setModel(m => ({ ...m, caption: next }));
  }, []);

  // ── Quick actions ───────────────────────────────────────────────
  const handleCopyAsTsv = useCallback(async () => {
    const tsv = rowsToTsv([model.columns.map(c => c.name), ...model.rows]);
    try {
      await navigator.clipboard.writeText(tsv);
    } catch {
      // Clipboard API blocked — drop a fallback prompt so the user
      // can still grab the text.
      window.prompt('Copy this TSV:', tsv);
    }
  }, [model]);

  const canSave = useMemo(
    () => model.columns.length > 0 && model.columns.every(c => c.name.trim() !== ''),
    [model.columns],
  );

  const handleSave = () => {
    if (!canSave) return;
    onSave(tableToMarkdown(model));
  };

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Table editor"
      width={920}
      footer={
        <>
          <button type="button" className={styles.btnGhost} onClick={handleCopyAsTsv}>
            Copy as TSV
          </button>
          <span className={styles.footerSpacer} />
          <button type="button" className={styles.btnGhost} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            disabled={!canSave}
            onClick={handleSave}
          >
            Save table
          </button>
        </>
      }
    >
      <div className={styles.wrap}>
        <div className={styles.captionRow}>
          <label className={styles.captionLabel}>Caption</label>
          <input
            type="text"
            className={styles.captionInput}
            value={model.caption ?? ''}
            onChange={e => setCaption(e.target.value)}
            placeholder="Optional title (renders as bold above the table)"
            spellCheck={false}
          />
        </div>

        <div className={styles.gridScroll}>
          <table className={styles.grid}>
            <thead>
              <tr>
                <th className={styles.cornerCell} aria-hidden />
                {model.columns.map((c, ci) => (
                  <th key={ci} className={styles.headerCell}>
                    <div className={styles.headerCellInner}>
                      <input
                        className={styles.headerName}
                        value={c.name}
                        onChange={e => setColumnName(ci, e.target.value)}
                        placeholder="column"
                        spellCheck={false}
                      />
                      <div className={styles.headerCtrls}>
                        <select
                          className={styles.alignSelect}
                          value={c.align ?? ''}
                          onChange={e => setColumnAlign(
                            ci,
                            (e.target.value || undefined) as TableModel['columns'][number]['align'],
                          )}
                          title="Column alignment"
                        >
                          <option value="">↔ default</option>
                          <option value="left">← left</option>
                          <option value="center">↔ center</option>
                          <option value="right">→ right</option>
                        </select>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          onClick={() => moveColumn(ci, -1)}
                          title="Move column left"
                          disabled={ci === 0}
                        >‹</button>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          onClick={() => moveColumn(ci, 1)}
                          title="Move column right"
                          disabled={ci === model.columns.length - 1}
                        >›</button>
                        <button
                          type="button"
                          className={styles.iconBtnDanger}
                          onClick={() => deleteColumn(ci)}
                          title="Delete column"
                        >×</button>
                      </div>
                    </div>
                  </th>
                ))}
                <th className={styles.addColCell}>
                  <button type="button" className={styles.addBtn} onClick={addColumn}>
                    + col
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {model.rows.map((r, ri) => (
                <tr key={ri}>
                  <th className={styles.rowHeader}>
                    <div className={styles.rowHeaderCtrls}>
                      <span className={styles.rowIndex}>{ri + 1}</span>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => moveRow(ri, -1)}
                        title="Move row up"
                        disabled={ri === 0}
                      >▲</button>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => moveRow(ri, 1)}
                        title="Move row down"
                        disabled={ri === model.rows.length - 1}
                      >▼</button>
                      <button
                        type="button"
                        className={styles.iconBtnDanger}
                        onClick={() => deleteRow(ri)}
                        title="Delete row"
                      >×</button>
                    </div>
                  </th>
                  {model.columns.map((_, ci) => (
                    <td key={ci} className={styles.bodyCell}>
                      <textarea
                        className={styles.cellInput}
                        value={r[ci] ?? ''}
                        rows={1}
                        onChange={e => setCell(ri, ci, e.target.value)}
                        onPaste={handleCellPaste(ri, ci)}
                        spellCheck={false}
                      />
                    </td>
                  ))}
                  <td className={styles.bodyCellTrailing} />
                </tr>
              ))}
              <tr>
                <th className={styles.rowHeader}>
                  <button type="button" className={styles.addBtn} onClick={addRow}>
                    + row
                  </button>
                </th>
                <td
                  className={styles.bodyCellTrailing}
                  colSpan={model.columns.length + 1}
                />
              </tr>
            </tbody>
          </table>
        </div>

        <div className={styles.hint}>
          Tip: paste a multi-row CSV / TSV from Excel or Google Sheets directly
          into any cell — the editor splits it into rows and columns
          automatically. Use <strong>Copy as TSV</strong> to round-trip back.
        </div>
      </div>
    </Modal>
  );
}

function uniqueColumnName(base: string, existing: ReadonlyArray<string>): string {
  let i = 1;
  // eslint-disable-next-line @typescript-eslint/prefer-for-of
  while (existing.includes(`${base}_${i}`)) i += 1;
  return `${base}_${i}`;
}
