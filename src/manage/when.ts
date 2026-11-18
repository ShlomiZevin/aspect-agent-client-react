/** Times on the management pages, in Israel time and plain Hebrew (task #985). */

import { COPY } from './copy';

const TZ = 'Asia/Jerusalem';
const hm = new Intl.DateTimeFormat('he-IL', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const weekday = new Intl.DateTimeFormat('he-IL', { timeZone: TZ, weekday: 'long' });
const dateShort = new Intl.DateTimeFormat('he-IL', { timeZone: TZ, day: 'numeric', month: 'numeric' });
const fullDate = new Intl.DateTimeFormat('he-IL', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** For a table cell: "10:54" today · "אתמול, 17:26" · "יום שני 14:30" · "12.11 14:30". */
export function shortWhen(iso: string | null, now: Date = new Date()): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const t = hm.format(d);
  const k = dayKey.format(d);
  if (k === dayKey.format(now)) return t;
  if (k === dayKey.format(new Date(now.getTime() - 24 * 3600 * 1000))) return COPY.yesterdayAt(t);
  if (now.getTime() - d.getTime() < 7 * 24 * 3600 * 1000) return `${weekday.format(d)} ${t}`;
  return `${dateShort.format(d)} ${t}`;
}

/** "ממש עכשיו" · "לפני 12 דקות" · then like shortWhen — for "עודכן …". */
export function agoText(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const min = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (min < 1) return COPY.justNow;
  if (min < 60) return COPY.minutesAgo(min);
  return shortWhen(iso, now);
}

/** "יום שלישי, 17 בנובמבר 2026". */
export function dateLine(now: Date = new Date()): string {
  return fullDate.format(now);
}
