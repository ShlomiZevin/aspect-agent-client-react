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
  markdownToTable,
  tableToMarkdown,
} from './tableMarkdown';
import styles from './TableEditorModalV1.module.css';

interface Props {
  open: boolean;
  /** Markdown pipe-table to open the editor on. Empty string starts
   *  a fresh 3×2 table. Anything else parses as MD; non-table input
   *  also lands on the empty starter so authoring can begin. */
  initialMarkdown?: string;
  onCancel: () => void;
  /** Fires with the freshly-emitted MD pipe-table string. */
  onSave: (markdown: string) => void;
}

/** Default starter table when there's nothing to parse. Same shape v1
 *  uses ("Column 1/2/3" + 1 blank row). */
const STARTER: TableData = {
  headers: ['Column 1', 'Column 2', 'Column 3'],
  rows: [['', '', '']],
  indexColumns: [],
};

/** Convert MD pipe-table to v1's TableData shape. Non-table input
 *  resolves to the starter. */
function mdToTableData(md: string | undefined): TableData {
  if (!md || !md.trim()) return STARTER;
  const parsed = markdownToTable(md);
  if (!parsed) return STARTER;
  return {
    headers: parsed.columns.map(c => c.name),
    rows:    parsed.rows,
    indexColumns: [],
  };
}

/** Convert v1's TableData back to a MD pipe-table. We drop captions
 *  and alignment because v1 doesn't model them — the user said "use
 *  v1 exactly", so feature parity wins over extra polish here. */
function tableDataToMd(td: TableData): string {
  const model: TableModel = {
    columns: td.headers.map(name => ({ name })),
    rows: td.rows,
  };
  return tableToMarkdown(model);
}

export function TableEditorModalV1({ open, initialMarkdown, onCancel, onSave }: Props) {
  const [data, setData] = useState<TableData>(() => mdToTableData(initialMarkdown));

  // Re-seat on every open so a re-open with different initial MD
  // shows the right table.
  useEffect(() => {
    if (open) setData(mdToTableData(initialMarkdown));
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
    onSave(tableDataToMd(data));
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
