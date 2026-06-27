/**
 * tableMarkdown — round-trip helpers for the in-editor table model.
 *
 * The table editor stores rows + columns as plain strings; the
 * persisted form on disk is a standard Markdown pipe table embedded
 * in a body string. These helpers convert between the two so:
 *
 *   - Insert: the editor emits MD; the caller splices it into the body.
 *   - Edit:   the caller passes the MD slice; the editor parses it
 *             back into rows + columns. (v1 only does insert; this is
 *             written for parity with a future click-to-edit-table.)
 *   - Import: a CSV / TSV blob from the clipboard parses into rows.
 *
 * No third-party deps. Keeps the table feature scoped to what the
 * builder already ships without forcing SheetJS / Papaparse into the
 * bundle. CSV parsing handles the common cases (quoted fields with
 * commas / embedded quotes) but isn't RFC-4180-pedantic — the editor
 * is the source of truth, the importer is a starting point.
 */

export interface TableModel {
  caption?: string;
  columns: Array<{ name: string; align?: 'left' | 'center' | 'right' }>;
  rows: string[][];
}

/** Serialise to a Markdown pipe-table string. Empty `caption` is
 *  dropped so the resulting body doesn't carry a stray blank line. */
export function tableToMarkdown(t: TableModel): string {
  const colCount = t.columns.length;
  if (colCount === 0) return '';

  const head = '| ' + t.columns.map(c => escapeCell(c.name)).join(' | ') + ' |';
  const align = '| ' + t.columns.map(c => alignSep(c.align)).join(' | ') + ' |';
  const body = t.rows.map(r => {
    const cells: string[] = [];
    for (let i = 0; i < colCount; i++) {
      cells.push(escapeCell(r[i] ?? ''));
    }
    return '| ' + cells.join(' | ') + ' |';
  });
  const lines = [head, align, ...body];
  const md = lines.join('\n');
  const caption = t.caption?.trim();
  return caption ? `**${caption}**\n\n${md}` : md;
}

function escapeCell(text: string): string {
  // Replace literal pipes (would break the column boundary) with the
  // escape sequence MD readers respect. Newlines inside cells become
  // explicit `<br>` so the table stays single-line per row.
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function alignSep(align: 'left' | 'center' | 'right' | undefined): string {
  switch (align) {
    case 'center': return ':---:';
    case 'right':  return '---:';
    case 'left':   return ':---';
    default:       return '---';
  }
}

/**
 * Parse a Markdown pipe-table string back into a TableModel. Returns
 * null if the input doesn't look like a pipe table — the caller can
 * decide whether to treat that as "create new table" or "leave alone."
 *
 * Caption parsing: a `**caption**` line directly above the table (with
 * an optional blank line between) is recognised and stripped.
 */
export function markdownToTable(md: string): TableModel | null {
  const text = md.trim();
  if (!text) return null;
  const lines = text.split(/\r?\n/);

  // Detect caption.
  let caption: string | undefined;
  let i = 0;
  const captionMatch = lines[0]?.match(/^\*\*(.+)\*\*\s*$/);
  if (captionMatch) {
    caption = captionMatch[1].trim();
    i = 1;
    if (lines[i] === '' || /^\s*$/.test(lines[i] ?? '')) i += 1;
  }

  if (i + 1 >= lines.length) return null;
  const headLine = lines[i];
  const sepLine  = lines[i + 1];
  if (!isPipeRow(headLine) || !isSeparatorRow(sepLine)) return null;

  const columns = splitPipeRow(headLine).map((name, idx) => {
    const cell = splitPipeRow(sepLine)[idx] ?? '---';
    return { name, align: parseAlign(cell) };
  });
  const rows: string[][] = [];
  for (let j = i + 2; j < lines.length; j++) {
    if (!isPipeRow(lines[j])) break;
    rows.push(splitPipeRow(lines[j]));
  }
  return { caption, columns, rows };
}

function isPipeRow(line: string | undefined): boolean {
  if (!line) return false;
  const t = line.trim();
  return t.startsWith('|') && t.endsWith('|');
}

function isSeparatorRow(line: string | undefined): boolean {
  if (!isPipeRow(line)) return false;
  const cells = splitPipeRow(line!);
  return cells.every(c => /^:?-{3,}:?$/.test(c.trim()));
}

function splitPipeRow(line: string): string[] {
  const t = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  // Split on un-escaped pipes only.
  const out: string[] = [];
  let buf = '';
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (ch === '\\' && t[i + 1] === '|') { buf += '|'; i += 1; continue; }
    if (ch === '|') { out.push(buf.trim()); buf = ''; continue; }
    buf += ch;
  }
  out.push(buf.trim());
  return out.map(c => c.replace(/<br\s*\/?>/gi, '\n'));
}

function parseAlign(cell: string): 'left' | 'center' | 'right' | undefined {
  const t = cell.trim();
  if (/^:-+:$/.test(t)) return 'center';
  if (/^:-+$/.test(t))  return 'left';
  if (/^-+:$/.test(t))  return 'right';
  return undefined;
}

/**
 * Parse a clipboard CSV / TSV blob into rows of strings.
 *
 * Detection: if a sample line contains tabs, treat as TSV; otherwise
 * treat as CSV. Handles quoted fields (with embedded quotes and
 * commas).
 *
 * Returns null when the input has zero non-empty rows — the caller
 * can decide what to do (often: ignore the paste).
 */
export function parseDelimited(text: string): string[][] | null {
  if (!text.trim()) return null;
  const sample = text.split(/\r?\n/, 1)[0] ?? '';
  const delim = sample.includes('\t') ? '\t' : ',';
  return parseWithDelimiter(text, delim);
}

function parseWithDelimiter(text: string, delim: string): string[][] | null {
  const rows: string[][] = [];
  let row: string[] = [];
  let buf = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { buf += '"'; i += 1; continue; }
        inQ = false;
        continue;
      }
      buf += ch;
      continue;
    }
    if (ch === '"' && buf === '') { inQ = true; continue; }
    if (ch === delim) { row.push(buf); buf = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { row.push(buf); rows.push(row); row = []; buf = ''; continue; }
    buf += ch;
  }
  // Trailing cell + row.
  if (buf !== '' || row.length > 0) {
    row.push(buf);
    rows.push(row);
  }
  // Trim trailing fully-empty rows that result from a trailing newline.
  while (rows.length > 0 && rows[rows.length - 1].every(c => c === '')) rows.pop();
  if (rows.length === 0) return null;
  return rows;
}

/** Convert rows[][] to TSV. Used for "copy as CSV" (we emit TSV
 *  because it's the lossless format for clipboard interop with most
 *  spreadsheet tools). */
export function rowsToTsv(rows: string[][]): string {
  return rows.map(r =>
    r.map(c =>
      // Cells that contain tabs or newlines round-trip cleaner when
      // surrounded by quotes. CSV-style escaping for safety.
      /[\t\n"]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c,
    ).join('\t'),
  ).join('\n');
}

/* ─── JSON / CSV round-trip ──────────────────────────────────────────
 *
 * The body of an enum-value section can store the same table in any of
 * three on-the-wire forms — markdown pipe-table, JSON array of objects,
 * or CSV. The form chosen in the modal IS what gets injected into the
 * prompt; no server transform happens. These helpers let us:
 *
 *   - emit a TableModel as JSON / CSV when the user saves with that
 *     format chosen (the body literally becomes that string), and
 *   - detect-and-parse any of the three forms back into a TableModel
 *     so the doc / tree viewer can still render-as-table AND the
 *     modal can open click-to-edit on a JSON/CSV block too.
 */

/** Emit a TableModel as a JSON array of `{column: value}` objects.
 *  Pretty-printed (two-space indent) so a saved body is readable when
 *  the section is opened in plain text mode. No fence, no marker —
 *  the body literally is the JSON string. */
export function tableToJson(t: TableModel): string {
  const colCount = t.columns.length;
  if (colCount === 0) return '[]';
  const arr = t.rows.map(r => {
    const obj: Record<string, string> = {};
    for (let i = 0; i < colCount; i++) {
      const name = t.columns[i]?.name ?? `col_${i + 1}`;
      obj[name] = r[i] ?? '';
    }
    return obj;
  });
  return JSON.stringify(arr, null, 2);
}

/** Emit a TableModel as CSV (header row + body). RFC-4180-ish: a cell
 *  is wrapped in `"…"` only if it contains a comma / quote / newline.
 *  Pure-token cells stay bare so the form reads as cheaply as possible
 *  when interpolated into a prompt. */
export function tableToCsv(t: TableModel): string {
  const colCount = t.columns.length;
  if (colCount === 0) return '';
  const header = t.columns.map(c => csvCell(c.name));
  const body   = t.rows.map(r => {
    const cells: string[] = [];
    for (let i = 0; i < colCount; i++) cells.push(csvCell(r[i] ?? ''));
    return cells.join(',');
  });
  return [header.join(','), ...body].join('\n');
}

function csvCell(text: string): string {
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** Parse a JSON-array-of-objects string into a TableModel. Returns
 *  null when the input isn't valid JSON, isn't an array, is empty, or
 *  the rows aren't flat objects of string-coercible values. Columns
 *  are taken from the FIRST row's keys (later rows fill missing keys
 *  with `''`) — same convention v1 uses. */
export function jsonToTable(text: string): TableModel | null {
  const t = text.trim();
  if (!t || t[0] !== '[') return null;
  let parsed: unknown;
  try { parsed = JSON.parse(t); }
  catch { return null; }
  if (!Array.isArray(parsed) || parsed.length === 0) return null;
  if (!parsed.every(r => r && typeof r === 'object' && !Array.isArray(r))) return null;

  const first = parsed[0] as Record<string, unknown>;
  const columns = Object.keys(first).map(name => ({ name }));
  if (columns.length === 0) return null;
  const rows = parsed.map(r => {
    const obj = r as Record<string, unknown>;
    return columns.map(c => {
      const v = obj[c.name];
      if (v === undefined || v === null) return '';
      return typeof v === 'string' ? v : String(v);
    });
  });
  return { columns, rows };
}

/** Parse a CSV string into a TableModel. Returns null when the input
 *  doesn't have at least two non-empty lines with consistent column
 *  counts of ≥ 2 — that heuristic keeps random prose with commas from
 *  matching. Also rejects any input with pipe characters (so a pipe
 *  table doesn't accidentally parse here). */
export function csvToTable(text: string): TableModel | null {
  const t = text.trim();
  if (!t) return null;
  if (t.includes('|')) return null;
  const rows = parseWithDelimiter(t, ',');
  if (!rows || rows.length < 2) return null;
  const colCount = rows[0].length;
  if (colCount < 2) return null;
  if (!rows.every(r => r.length === colCount)) return null;
  const columns = rows[0].map(name => ({ name }));
  const body    = rows.slice(1);
  return { columns, rows: body };
}
