/**
 * TableCardsEditor — a record-oriented EDITOR over the same `TableData`
 * the v1 grid edits. Built for the "one long essay column + many short
 * columns" shape, where a grid is unreadable and cramped.
 *
 * Each row renders as a card. Fields are classified by CONTENT LENGTH,
 * never by column name — so it's language- and schema-agnostic and
 * survives renames:
 *   - a column whose longest cell exceeds LONG_THRESHOLD chars renders
 *     as a full-width, auto-growing textarea (readable AND comfortable
 *     to edit) — shown first, stacked.
 *   - shorter columns render as a compact label+input grid below.
 *
 * Edits write straight back to the same `TableData` via `onChange`, so
 * Save / Markdown / JSON / CSV behave identically to the grid — this is
 * a second editor over one model, not a separate data path.
 */

import type { TableData } from '../../../types/dynamicKB';
import styles from './TableCardsEditor.module.css';

/** A column counts as "long-form" when any of its cells is longer than
 *  this. ~80 chars ≈ one comfortable line of prose. */
const LONG_THRESHOLD = 80;

interface Props {
  value: TableData;
  onChange: (next: TableData) => void;
}

export function TableCardsEditor({ value, onChange }: Props) {
  const { headers, rows } = value;

  // Per-column long-form classification — consistent across every card
  // so an essay column reads as a textarea in all rows, not just the
  // ones that happen to be long already.
  const longCol = headers.map((_, c) =>
    rows.some(r => (r[c] ?? '').length > LONG_THRESHOLD),
  );
  const hasShort = headers.some((_, c) => !longCol[c]);

  const setCell = (r: number, c: number, text: string) => {
    onChange({
      ...value,
      rows: rows.map((row, ri) => {
        if (ri !== r) return row;
        // Pad jagged rows so a column past the row's current length is
        // still editable.
        const next = [...row];
        while (next.length <= c) next.push('');
        next[c] = text;
        return next;
      }),
    });
  };

  const addRow = () => {
    onChange({ ...value, rows: [...rows, headers.map(() => '')] });
  };

  const removeRow = (r: number) => {
    onChange({ ...value, rows: rows.filter((_, ri) => ri !== r) });
  };

  return (
    <div className={styles.scroll}>
      <div className={styles.list}>
        {rows.length === 0 && <div className={styles.empty}>No rows yet.</div>}

        {rows.map((row, r) => (
          <div key={r} className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.rowBadge}>{r + 1}</span>
              <span className={styles.spacer} />
              <button
                type="button"
                className={styles.deleteBtn}
                onClick={() => removeRow(r)}
                title="Delete this row"
                aria-label={`Delete row ${r + 1}`}
              >
                ✕
              </button>
            </div>

            {/* Long-form fields — full-width, auto-growing textareas. */}
            {headers.map((h, c) =>
              longCol[c] ? (
                <div key={c} className={styles.longField}>
                  <label className={styles.label}>{h || `Column ${c + 1}`}</label>
                  <textarea
                    dir="auto"
                    className={styles.textarea}
                    value={row[c] ?? ''}
                    onChange={e => setCell(r, c, e.target.value)}
                    placeholder="—"
                  />
                </div>
              ) : null,
            )}

            {/* Short fields — compact label+input grid. */}
            {hasShort && (
              <div className={styles.shortGrid}>
                {headers.map((h, c) =>
                  !longCol[c] ? (
                    <div key={c} className={styles.shortField}>
                      <label className={styles.label}>{h || `Column ${c + 1}`}</label>
                      <input
                        dir="auto"
                        className={styles.input}
                        value={row[c] ?? ''}
                        onChange={e => setCell(r, c, e.target.value)}
                        placeholder="—"
                      />
                    </div>
                  ) : null,
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <button type="button" className={styles.addRow} onClick={addRow}>
        + Add row
      </button>
    </div>
  );
}
