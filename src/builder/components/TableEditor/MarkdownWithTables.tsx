/**
 * MarkdownWithTables — render a body string by splitting it into
 * prose blocks and rendered HTML tables.
 *
 *   The body lives as a plain string (markdown). Any markdown
 *   pipe-table inside it is rendered as an actual `<table>` here so
 *   the author isn't staring at `| col_1 | col_2 |` text. Clicking a
 *   rendered table fires `onEditTable(sourceMd)` with the exact
 *   substring; the host swaps it for the edited MD on save.
 *
 *   Prose between tables renders as a `<pre>` so whitespace + line
 *   breaks survive — same way the body would render today.
 *
 *   This is read-only. Use the textarea edit mode (or the table
 *   modal) to make changes.
 */

import {
  csvToTable,
  jsonToTable,
  markdownToTable,
  type TableModel,
} from './tableMarkdown';

interface Props {
  text: string;
  /** Fires with the EXACT markdown substring of the clicked table.
   *  The host opens TableEditorModalV1 with this string, then
   *  replaces the same substring with the edited result on save. */
  onEditTable: (sourceMd: string, range: { start: number; end: number }) => void;
  className?: string;
  tableClassName?: string;
  proseClassName?: string;
}

interface TableMatch {
  /** Inclusive start (and exclusive end) of the table block inside `text`. */
  start: number;
  end: number;
  /** Slice ready to be re-opened by the modal. May be markdown
   *  pipe-table, JSON array of objects, or CSV — the modal auto-detects. */
  md: string;
  /** Pre-parsed table model so `RenderedTable` doesn't have to re-detect. */
  model: TableModel;
}

/** Find every table-shaped block in `text`. A block is one of:
 *    - a markdown pipe-table (header row + separator + body rows).
 *    - a JSON array of flat `{column: value}` objects.
 *    - a CSV table (≥ 2 lines, consistent comma-separated columns, no pipes).
 *
 *  We scan in a single line walk, peeling off pipe-table blocks first
 *  (their exact line shape is unambiguous) and then checking each
 *  remaining blank-line-separated paragraph for JSON / CSV shape. The
 *  modal auto-detects which form on open and emits the chosen form on
 *  save — the body literally is whichever string the user picked. */
function findTables(text: string): TableMatch[] {
  const out: TableMatch[] = [];
  const lines = text.split(/\r?\n/);
  // Pre-compute line offsets so we can map line indexes to byte
  // positions inside `text`.
  const lineStarts: number[] = [];
  {
    let acc = 0;
    for (const ln of lines) {
      lineStarts.push(acc);
      acc += ln.length + 1; // +1 for the \n (or final dangling — close enough)
    }
  }

  // Track which lines are already consumed by a pipe-table match so
  // the paragraph pass below doesn't re-claim them.
  const consumed = new Array<boolean>(lines.length).fill(false);

  let i = 0;
  while (i < lines.length) {
    if (!isPipeRow(lines[i])) { i += 1; continue; }
    // Need a separator on the next line for this to count as a table.
    if (!isSeparatorRow(lines[i + 1])) { i += 1; continue; }
    // Walk body rows.
    let j = i + 2;
    while (j < lines.length && isPipeRow(lines[j])) j += 1;
    // Look one line UP for a bold caption (and skip the blank between).
    let startLine = i;
    if (startLine - 1 >= 0 && /^\s*$/.test(lines[startLine - 1] ?? '')) {
      // blank above — could still be a caption two lines up
      if (startLine - 2 >= 0 && /^\*\*.+\*\*\s*$/.test(lines[startLine - 2] ?? '')) {
        startLine -= 2;
      }
    } else if (startLine - 1 >= 0 && /^\*\*.+\*\*\s*$/.test(lines[startLine - 1] ?? '')) {
      startLine -= 1;
    }
    const start = lineStarts[startLine];
    // Walk forward to the end of the last table line.
    const endLine = j - 1;
    const endLineEnd =
      lineStarts[endLine] + lines[endLine].length;
    const slice = text.slice(start, endLineEnd);
    const model = markdownToTable(slice);
    if (model) {
      out.push({ start, end: endLineEnd, md: slice, model });
      for (let k = startLine; k <= endLine; k += 1) consumed[k] = true;
    }
    i = j;
  }

  // Paragraph pass: any chunk of consecutive non-blank, non-consumed
  // lines is a candidate for JSON / CSV detection. We try JSON first
  // (cheap: only fires when the chunk starts with `[`) then CSV.
  let p = 0;
  while (p < lines.length) {
    if (consumed[p] || /^\s*$/.test(lines[p] ?? '')) { p += 1; continue; }
    let q = p;
    while (q < lines.length && !consumed[q] && !/^\s*$/.test(lines[q] ?? '')) q += 1;
    const startCh = lineStarts[p];
    const endCh   = lineStarts[q - 1] + lines[q - 1].length;
    const slice   = text.slice(startCh, endCh);
    const model =
      jsonToTable(slice) ??
      csvToTable(slice);
    if (model) {
      out.push({ start: startCh, end: endCh, md: slice, model });
    }
    p = q;
  }

  // Sort by start so render order tracks source order regardless of
  // which pass produced each match.
  out.sort((a, b) => a.start - b.start);
  return out;
}

function isPipeRow(line: string | undefined): boolean {
  if (!line) return false;
  const t = line.trim();
  return t.startsWith('|') && t.endsWith('|');
}

function isSeparatorRow(line: string | undefined): boolean {
  if (!isPipeRow(line)) return false;
  // Strip outer pipes + escape sequences, then check each cell.
  const t = line!.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells = t.split('|');
  return cells.every(c => /^\s*:?-{3,}:?\s*$/.test(c));
}

export function MarkdownWithTables({
  text, onEditTable, className, tableClassName, proseClassName,
}: Props) {
  const tables = findTables(text);
  if (tables.length === 0) {
    return (
      <pre className={proseClassName ?? className}>{text}</pre>
    );
  }
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  tables.forEach((t, idx) => {
    if (t.start > cursor) {
      const slice = text.slice(cursor, t.start).replace(/^\n+|\n+$/g, '');
      if (slice) {
        nodes.push(
          <pre key={`p-${idx}`} className={proseClassName ?? className}>{slice}</pre>,
        );
      }
    }
    nodes.push(
      <RenderedTable
        key={`t-${idx}`}
        caption={t.model.caption}
        columns={t.model.columns}
        rows={t.model.rows}
        className={tableClassName}
        onEdit={() => onEditTable(t.md, { start: t.start, end: t.end })}
      />,
    );
    cursor = t.end;
  });
  if (cursor < text.length) {
    const slice = text.slice(cursor).replace(/^\n+|\n+$/g, '');
    if (slice) nodes.push(
      <pre key="p-end" className={proseClassName ?? className}>{slice}</pre>,
    );
  }
  return <>{nodes}</>;
}

/* ─── RenderedTable ──────────────────────────────────────────────── */

interface RenderedTableProps {
  caption?: string;
  columns: Array<{ name: string; align?: 'left' | 'center' | 'right' }>;
  rows: string[][];
  className?: string;
  onEdit: () => void;
}

function RenderedTable({ caption, columns, rows, className, onEdit }: RenderedTableProps) {
  // Wrap the rendered table in a "card" that's visually distinct
  // from the surrounding prose so the author can tell at a glance
  // that this region opens a separate editor when clicked. Hover
  // surfaces an explicit "✎ Edit table" pill in the top-right.
  return (
    <div
      onClick={(e) => {
        // Stop the click from bubbling up to the prose-edit handler
        // on the surrounding body. "Edit table" is the ONLY action
        // for this region — we don't also want to slip into prose
        // edit mode behind the modal.
        e.stopPropagation();
        onEdit();
      }}
      title="Click anywhere on the table to open the table editor"
      style={{
        position: 'relative',
        cursor: 'pointer',
        margin: '14px 0',
        padding: '10px 12px 12px',
        border: '1px solid #c7d2fe',
        borderRadius: 8,
        background: 'rgba(99, 102, 241, 0.04)',
      }}
      onMouseEnter={(e) => {
        const badge = e.currentTarget.querySelector(
          '[data-table-edit-badge]',
        ) as HTMLElement | null;
        if (badge) badge.style.opacity = '1';
      }}
      onMouseLeave={(e) => {
        const badge = e.currentTarget.querySelector(
          '[data-table-edit-badge]',
        ) as HTMLElement | null;
        if (badge) badge.style.opacity = '0';
      }}
    >
      <span
        data-table-edit-badge
        style={{
          position: 'absolute',
          top: 8,
          right: 10,
          fontSize: 11,
          fontWeight: 700,
          color: '#4338ca',
          background: '#fff',
          border: '1px solid #c7d2fe',
          borderRadius: 999,
          padding: '2px 9px',
          opacity: 0,
          transition: 'opacity 100ms',
          pointerEvents: 'none',
        }}
      >
        ✎ Edit table
      </span>
      {caption && (
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{caption}</div>
      )}
      <table className={className} style={{ borderCollapse: 'collapse', minWidth: '60%' }}>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th
                key={i}
                style={{
                  textAlign: c.align ?? 'left',
                  padding: '6px 10px',
                  background: '#f3f4f6',
                  border: '1px solid #e5e7eb',
                  fontSize: 12.5,
                }}
              >
                {c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {columns.map((c, ci) => (
                <td
                  key={ci}
                  style={{
                    textAlign: c.align ?? 'left',
                    padding: '6px 10px',
                    border: '1px solid #e5e7eb',
                    fontSize: 12.5,
                    background: '#fff',
                  }}
                >
                  {r[ci] ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
