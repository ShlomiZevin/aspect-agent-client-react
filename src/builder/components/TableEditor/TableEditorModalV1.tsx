/**
 * TableEditorModalV1 — modal wrapper around the v1 dynamic-KB
 * TableEditor component. The user's directive: "copy v1 exactly as
 * is — it is perfect." So we reuse the v1 component verbatim and
 * glue:
 *   - markdown → TableData on open (parse pipe-table from body)
 *   - TableData → markdown on save (emit pipe-table back)
 *   - CSV/XLS/XLSX import via the existing /api/dynamic-kb/import/spreadsheet
 *
 * The MD pipe-table is the canonical storage format inside the
 * Targeted KB body string — the user wanted "text saved" + "rendered
 * as a table" + "edited as a table". This modal is the editor side;
 * `MarkdownBody` does the read-render side.
 */

import { useEffect, useState } from 'react';
import { Modal } from '../Modal/Modal';
import { TableEditor } from '../../../components/dashboard/DynamicKBPage/TableEditor';
import { importSpreadsheet } from '../../../services/dynamicKBService';
import type { TableData } from '../../../types/dynamicKB';
import {
  type TableModel,
  csvToTable,
  jsonToTable,
  markdownToTable,
  tableToCsv,
  tableToJson,
  tableToMarkdown,
} from './tableMarkdown';
import styles from './TableEditorModalV1.module.css';

/** Chosen on-the-wire form for THIS table. The body string in storage
 *  literally is that form — no marker, no wrapper. The runtime ships
 *  the body verbatim into the prompt, and the doc/tree viewer detects
 *  the form by structure so it can keep rendering as a table.
 *
 *   - 'markdown' — pipe-table. Strong "this is a table" signal in mixed
 *                  prose. Saturated in LLM training data.
 *   - 'json'     — array of `{column: value}` objects. Robust for wide
 *                  tables; ~2× the token cost of markdown.
 *   - 'csv'      — header + comma rows. Cheapest tokens; relies on the
 *                  surrounding prose to signal "table." */
type TableFormat = 'markdown' | 'json' | 'csv';

/** Detect which form the body slice is in. Tries the cheapest test
 *  first (markdown's pipe shape) and falls back to JSON, then CSV.
 *  Empty / unparseable input opens as a fresh markdown table. */
function detectFormat(body: string | undefined): TableFormat {
  if (!body || !body.trim()) return 'markdown';
  if (markdownToTable(body)) return 'markdown';
  if (jsonToTable(body))     return 'json';
  if (csvToTable(body))      return 'csv';
  return 'markdown';
}

interface Props {
  open: boolean;
  /** Body slice to open the editor on. Auto-detects markdown pipe-table,
   *  JSON array of objects, or CSV. Empty / unparseable input starts a
   *  fresh 3×2 table. The prop name is retained for backwards-compat
   *  with the existing call sites — the content can be any of the three
   *  forms now, not just markdown. */
  initialMarkdown?: string;
  onCancel: () => void;
  /** Fires with the freshly-emitted body string. The form depends on
   *  the user's "Prompt format" choice in the modal — could be a
   *  markdown pipe-table, a JSON array of objects, or a CSV blob. */
  onSave: (body: string) => void;
}

/** Default starter table when there's nothing to parse. Same shape v1
 *  uses ("Column 1/2/3" + 1 blank row). */
const STARTER: TableData = {
  headers: ['Column 1', 'Column 2', 'Column 3'],
  rows: [['', '', '']],
  indexColumns: [],
};

/** Parse a body slice (in any of the three forms) into v1's TableData
 *  shape. Tries markdown first, then JSON, then CSV. Falls back to the
 *  starter table when nothing parses — covers fresh inserts and
 *  malformed input alike. */
function bodyToTableData(body: string | undefined): TableData {
  if (!body || !body.trim()) return STARTER;
  const parsed =
    markdownToTable(body) ??
    jsonToTable(body) ??
    csvToTable(body);
  if (!parsed) return STARTER;
  return {
    headers: parsed.columns.map(c => c.name),
    rows:    parsed.rows,
    indexColumns: [],
  };
}

/** Serialise v1's TableData to whichever form the user picked. The
 *  returned string is literally what gets stored in the body and
 *  shipped to the prompt — no wrapper, no marker. Captions and
 *  alignment are dropped because v1 doesn't model them; the user said
 *  "use v1 exactly", so feature parity wins over polish here. */
function tableDataToBody(td: TableData, format: TableFormat): string {
  const model: TableModel = {
    columns: td.headers.map(name => ({ name })),
    rows: td.rows,
  };
  if (format === 'json') return tableToJson(model);
  if (format === 'csv')  return tableToCsv(model);
  return tableToMarkdown(model);
}

export function TableEditorModalV1({ open, initialMarkdown, onCancel, onSave }: Props) {
  const [data, setData] = useState<TableData>(() => bodyToTableData(initialMarkdown));
  const [format, setFormat] = useState<TableFormat>(() => detectFormat(initialMarkdown));

  // Re-seat on every open so a re-open with different initial body
  // shows the right table AND the right detected format.
  useEffect(() => {
    if (open) {
      setData(bodyToTableData(initialMarkdown));
      setFormat(detectFormat(initialMarkdown));
    }
  }, [open, initialMarkdown]);

  /** Wire v1's onImport to the server endpoint and load the result
   *  into the editor. Same flow v1's DynamicKBPage uses. */
  const handleImport = async (file: File) => {
    try {
      const result = await importSpreadsheet(file);
      setData({
        headers: result.headers,
        rows: result.rows,
        indexColumns: [],
      });
    } catch (err) {
      // Surface the import error inline. v1 logs to a banner; here we
      // alert because the modal doesn't have a banner slot. Good enough.
      const msg = err instanceof Error ? err.message : 'Import failed';
      alert(`Import failed: ${msg}`);
    }
  };

  const handleSave = () => {
    onSave(tableDataToBody(data, format));
  };

  return (
    <Modal
      open={open}
      onClose={onCancel}
      // Compact header: pull Save / Cancel up into the title bar so
      // the body is "all table." The Modal frame keeps just a thin
      // strip on top + the resize handle at the bottom-right corner.
      title={
        <span style={{ fontSize: 13, fontWeight: 600, color: '#4b5563' }}>
          Table editor
        </span>
      }
      headerExtra={
        // Segmented switcher in the header — three options visible at
        // a glance, no click-to-reveal. Reads as "what this table IS"
        // (a property of the table) rather than another button in the
        // action bar. The chosen form IS the body string we'll write
        // on Save.
        <div
          className={styles.formatSwitcher}
          role="tablist"
          aria-label="Prompt format"
        >
          {(['markdown', 'json', 'csv'] as const).map(opt => (
            <button
              key={opt}
              type="button"
              role="tab"
              aria-selected={format === opt}
              className={
                format === opt
                  ? `${styles.switchBtn} ${styles.switchBtnActive}`
                  : styles.switchBtn
              }
              onClick={() => setFormat(opt)}
              title={
                opt === 'markdown'
                  ? 'Pipe-table form. Strong "this is a table" signal in mixed prose.'
                  : opt === 'json'
                    ? 'Array of {column: value} objects. Robust for wide tables.'
                    : 'Header + comma rows. Cheapest tokens.'
              }
            >
              {opt === 'markdown' ? 'Markdown' : opt === 'json' ? 'JSON' : 'CSV'}
            </button>
          ))}
        </div>
      }
      width={1100}
      compactHeader
      noBodyPadding
    >
      {/* Edge-to-edge wrap: the v1 TableEditor renders inside this
          flex column. The `rightActions` slot puts Save/Cancel
          INSIDE the same `.tableActions` flex row as v1's
          `+ Add Row` / `+ Add Column` / `Import` / `RTL →` buttons,
          so they all share the same baseline. The grid flex-grows
          so when the modal is enlarged the table area expands; the
          action bar stays the same height at the bottom.
          Resize lives on the modal frame itself via `resize: both`
          in Modal.tsx — drag from the bottom-right corner and the
          box grows symmetrically (the overlay's flex-center keeps
          it centered). */}
      <div className={styles.wrap}>
        <TableEditor
          value={data}
          onChange={setData}
          onImport={handleImport}
          rightActions={
            <>
              <button
                type="button"
                onClick={onCancel}
                className={styles.cancelBtn}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className={styles.saveBtn}
              >
                Save
              </button>
            </>
          }
        />
      </div>
    </Modal>
  );
}
