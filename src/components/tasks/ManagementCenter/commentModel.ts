import type { AgendaComment } from '../../../services/agendaCommentsService';
import type { LineBlock, Topic } from './topics';
import styles from './ManagementCenter.module.css';

/**
 * Comments on a meeting's action items — the shapes and the pure helpers
 * (who, when, which line a comment belongs to). The hook is
 * useActionComments.tsx, the thread rows CommentThread.tsx.
 *
 * A comment points at its line's stable id (`line.key`, stamped at the end of
 * the line on the first comment — server: services/agendaLines.js), falling
 * back to the line's text when the id was lost; a comment whose line is gone
 * shows under the topic ("על שורה שהשתנתה") — never lost. An action line's
 * old note (`> הערה:`, written only from Shlomi's center) is folded into the
 * thread as Shlomi's remark: no anonymous rows.
 */

/** The action items are Shlomi's: he may remove anyone's comment (board name, lower-cased). */
export const OWNER = 'shlomi';

const NAME_HE: Record<string, string> = { shlomi: 'שלומי', noa: 'נועה', hila: 'הילה', kosta: 'קוסטה' };

export const sameName = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/** A board name in Hebrew when we know it (Noa → נועה); anything else as written. */
export function personName(name: string): string {
  return NAME_HE[name.trim().toLowerCase()] ?? name;
}

export function personTone(name: string): string {
  const k = name.trim().toLowerCase();
  if (k === 'shlomi') return styles.avShlomi;
  if (k === 'noa') return styles.avNoa;
  if (k === 'hila') return styles.avHila;
  return styles.avOther;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** "היום 14:05" · "אתמול 09:12" · "18.11 14:05" */
export function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return `היום ${time}`;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `אתמול ${time}`;
  return `${d.getDate()}.${d.getMonth() + 1} ${time}`;
}

export function fullWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export type ThreadEntry =
  | { kind: 'comment'; key: string; author: string; body: string; when: string; edited: boolean; comment: AgendaComment }
  /** An action line's old `> הערה:` — Shlomi's remark, no time recorded. */
  | { kind: 'note'; key: string; author: string; body: string };

/** How a line is addressed on the server: index among the `- [ ]` lines AND its text. */
export type LineRef = { taskId: number; index: number; text: string };

export type TopicThreads = {
  byIndex: Map<number, ThreadEntry[]>;
  /** Comments whose line is gone (its id and its text both): shown under the topic. */
  orphans: { lineText: string; entries: ThreadEntry[] }[];
};

export function lineRefOf(topic: Topic, line: LineBlock): LineRef {
  return { taskId: topic.task.id, index: line.index, text: line.text };
}

function toEntry(c: AgendaComment): ThreadEntry {
  return { kind: 'comment', key: `c${c.id}`, author: c.author, body: c.body, when: c.createdAt, edited: !!c.updatedAt, comment: c };
}

/** Each line's thread (its old note first, then comments oldest first), and the comments whose line is gone. */
export function buildThreads(topic: Topic, comments: AgendaComment[]): TopicThreads {
  const lines = topic.blocks.filter((b): b is LineBlock => b.kind === 'line');
  const byKey = new Map(lines.filter(l => l.key).map(l => [l.key as string, l]));
  const byIndex = new Map<number, ThreadEntry[]>();
  const push = (index: number, entry: ThreadEntry) => {
    const list = byIndex.get(index);
    if (list) list.push(entry);
    else byIndex.set(index, [entry]);
  };
  lines.forEach(l => {
    if (l.note) push(l.index, { kind: 'note', key: `n${l.index}`, author: 'Shlomi', body: l.note });
  });
  const orphans = new Map<string, ThreadEntry[]>();
  comments
    .filter(c => c.taskId === topic.task.id)
    .forEach(c => {
      let line = byKey.get(c.lineKey);
      if (!line) {
        const sameText = lines.filter(l => l.text === c.lineText);
        if (sameText.length === 1) line = sameText[0];
      }
      if (line) push(line.index, toEntry(c));
      else orphans.set(c.lineText, [...(orphans.get(c.lineText) || []), toEntry(c)]);
    });
  return { byIndex, orphans: [...orphans].map(([lineText, entries]) => ({ lineText, entries })) };
}

/** A server error, said in Hebrew where we know it. */
export function sayError(err: unknown): string {
  const msg = err instanceof Error ? err.message : '';
  if (/moved or changed|keeps changing/i.test(msg)) return 'השורה השתנתה בינתיים. אפשר לנסות שוב בעוד רגע.';
  if (/only the author/i.test(msg)) return 'אפשר לשנות רק תגובות שלך.';
  return msg ? `לא נשמר: ${msg}` : 'לא נשמר. אפשר לנסות שוב.';
}
