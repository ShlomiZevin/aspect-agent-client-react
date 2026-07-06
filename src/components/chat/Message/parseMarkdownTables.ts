/**
 * Parse GitHub-flavored markdown tables out of an assistant message.
 *
 * Used as a fallback so that ANY agent (including demo crews that have no data
 * tool and just render a table in text) gets the same "open full table + Excel
 * export" viewer. When a message carries a structured tool result (`data_table`
 * thinking step) we prefer that — this parser only runs when there is none.
 *
 * A table is a header row `| a | b |`, a separator `| --- | --- |`, then ≥1 body
 * rows. We pull the nearest non-table line above as the table's title.
 */

export interface ParsedTable {
  title?: string;
  columns: string[];
  rows: Record<string, string>[];
}

// Only surface the button for tables big enough to be worth a separate viewer.
const MIN_ROWS = 5;

function splitCells(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  // Split on unescaped pipes, then unescape.
  return s.split(/(?<!\\)\|/).map(c => c.replace(/\\\|/g, '|').trim());
}

function isTableRow(line: string): boolean {
  return line.includes('|') && line.trim() !== '';
}

function isSeparator(line: string): boolean {
  const cells = splitCells(line);
  return cells.length > 0 && cells.every(c => /^:?-{2,}:?$/.test(c));
}

function cleanTitle(line: string): string {
  return line
    .replace(/^#{1,6}\s*/, '')      // heading marks
    .replace(/\*\*/g, '')           // bold
    .replace(/[*_`>]/g, '')         // stray md
    .trim();
}

export function parseMarkdownTables(text: string): ParsedTable[] {
  if (!text || !text.includes('|')) return [];
  const lines = text.split(/\r?\n/);
  const tables: ParsedTable[] = [];
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;

    const next = lines[i + 1];
    if (isTableRow(line) && next != null && isSeparator(next)) {
      const columns = splitCells(line);
      const rows: Record<string, string>[] = [];
      let j = i + 2;
      while (j < lines.length && isTableRow(lines[j]) && !isSeparator(lines[j])) {
        const cells = splitCells(lines[j]);
        const row: Record<string, string> = {};
        columns.forEach((col, k) => { row[col || `col${k + 1}`] = cells[k] ?? ''; });
        rows.push(row);
        j++;
      }

      if (rows.length >= MIN_ROWS) {
        // Nearest non-empty, non-table line above becomes the title.
        let title: string | undefined;
        for (let k = i - 1; k >= 0; k--) {
          const t = lines[k].trim();
          if (t === '') continue;
          if (isTableRow(t)) break; // ran into another table
          const cleaned = cleanTitle(t);
          if (cleaned) title = cleaned.length > 90 ? cleaned.slice(0, 90) : cleaned;
          break;
        }
        tables.push({ title, columns: columns.map((c, k) => c || `col${k + 1}`), rows });
      }
      i = j - 1;
    }
  }

  return tables;
}
