/**
 * Agenda topic descriptions are markdown written by Claude sessions, in three
 * levels (topic → points → details), like presentation slides:
 *   מקור: …                      (hidden)
 *   - [ ] a point                (level 2, tickable)
 *     > החלטה (17.11): text      (decision under the point)
 *     > הערה: Shlomi's own note  (note under the point)
 *     - a detail                 (level 3: indented bullet, no box)
 * Older topics may still carry `**Group heading**` lines — kept as headings.
 *
 * Only `- [ ]` / `- [x]` lines are checklist lines; their order is the line
 * index the server's agenda-line endpoint uses. Indented `  - ` detail lines
 * are never counted.
 *
 * parseAgenda turns one description into display blocks. applyLineChange is
 * the client mirror of the server's applyAgendaLineChange (task.service.js),
 * used only for the optimistic update — the server's result always wins.
 */

export type AgendaBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'line'; index: number; text: string; checked: boolean; quotes: string[]; note: string | null; details: string[] }
  | { kind: 'text'; text: string };

const CHECK_RE = /^(\s*)[-*] \[( |x|X)\] ?(.*)$/;
const QUOTE_RE = /^\s*>\s?(.*)$/;
const NOTE_RE = /^\s*>\s*הערה:\s*(.*)$/;
const DETAIL_RE = /^\s+[-*•]\s+(.*)$/;          // indented bullet without a box
const INDENTED_RE = /^\s+\S/;                   // continuation of a detail
const BULLET_RE = /^[-*•]\s+(.*)$/;             // a plain top-level bullet
const HEADING_RE = /^\s*\*\*(.+?)\*\*\s*:?\s*$/;
const SOURCE_RE = /^\s*מקור:/;
const NOTE_PREFIX = '  > הערה: ';

export function parseAgenda(description: string | undefined | null): AgendaBlock[] {
  const lines = (description || '').split(/\r?\n/);
  const blocks: AgendaBlock[] = [];
  let index = 0;
  let current: Extract<AgendaBlock, { kind: 'line' }> | null = null;

  for (const raw of lines) {
    const check = raw.match(CHECK_RE);
    if (check) {
      current = { kind: 'line', index: index++, text: check[3].trim(), checked: check[2] !== ' ', quotes: [], note: null, details: [] };
      blocks.push(current);
      continue;
    }
    if (!raw.trim()) continue; // a blank line doesn't end a point's block
    const quote = raw.match(QUOTE_RE);
    if (quote && current) {
      const note = raw.match(NOTE_RE);
      if (note && current.note === null) current.note = note[1].trim();
      else if (quote[1].trim()) current.quotes.push(quote[1].trim());
      continue;
    }
    if (current) {
      const detail = raw.match(DETAIL_RE);
      if (detail) {
        if (detail[1].trim()) current.details.push(detail[1].trim());
        continue;
      }
      if (INDENTED_RE.test(raw)) {
        const last = current.details.length - 1;
        if (last >= 0) current.details[last] = `${current.details[last]} ${raw.trim()}`;
        else current.details.push(raw.trim());
        continue;
      }
    }
    current = null;
    if (SOURCE_RE.test(raw)) continue;
    const heading = raw.match(HEADING_RE);
    if (heading) { blocks.push({ kind: 'heading', text: heading[1].trim() }); continue; }
    const bullet = raw.trim().match(BULLET_RE);
    blocks.push({ kind: 'text', text: (bullet ? bullet[1] : quote ? quote[1] : raw).trim() });
  }
  return blocks;
}

/** Client mirror of the server change — returns null when the line can't be found. */
export function applyLineChange(
  description: string,
  change: { index: number; text: string; checked?: boolean; note?: string },
): string | null {
  const eol = description.includes('\r\n') ? '\r\n' : '\n';
  const lines = description.split(/\r?\n/);
  const items: { lineNo: number; text: string }[] = [];
  lines.forEach((line, lineNo) => {
    const m = line.match(CHECK_RE);
    if (m) items.push({ lineNo, text: m[3].trim() });
  });
  const want = change.text.trim();
  let target = items[change.index]?.text === want ? items[change.index] : null;
  if (!target) {
    const same = items.filter(it => it.text === want);
    if (same.length === 1) target = same[0];
  }
  if (!target) return null;

  const out = lines.slice();
  if (change.checked !== undefined) {
    out[target.lineNo] = out[target.lineNo].replace(/\[( |x|X)\]/, change.checked ? '[x]' : '[ ]');
  }
  if (change.note !== undefined) {
    // New notes go right after the quotes under the point (before its details);
    // an existing note is found anywhere in the point's own block.
    let quotesEnd = target.lineNo + 1;
    while (quotesEnd < out.length && /^\s*>/.test(out[quotesEnd])) quotesEnd++;
    let blockEnd = target.lineNo + 1;
    while (blockEnd < out.length && (/^\s*>/.test(out[blockEnd]) || (INDENTED_RE.test(out[blockEnd]) && !CHECK_RE.test(out[blockEnd])))) blockEnd++;
    let noteAt = -1;
    for (let i = target.lineNo + 1; i < blockEnd; i++) {
      if (NOTE_RE.test(out[i])) { noteAt = i; break; }
    }
    const clean = change.note.replace(/\s*\r?\n\s*/g, ' ').trim();
    if (clean) {
      if (noteAt >= 0) out[noteAt] = NOTE_PREFIX + clean;
      else out.splice(quotesEnd, 0, NOTE_PREFIX + clean);
    } else if (noteAt >= 0) {
      out.splice(noteAt, 1);
    }
  }
  return out.join(eol);
}

/** `**bold**` inside a line → alternating plain / bold parts. */
export function splitBold(text: string): { text: string; bold: boolean }[] {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => ({ text: part, bold: i % 2 === 1 })).filter(p => p.text);
}
