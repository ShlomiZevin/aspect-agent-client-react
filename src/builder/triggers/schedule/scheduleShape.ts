/**
 * The Schedule trigger's config shape, its one-line summary and the
 * small date/time helpers its form and card need.
 *
 * DISPLAY ONLY. Which instant a slot is, whether it is due, DST — all of
 * that is the server's (`builder/triggers/schedule/scheduleSlots.js`),
 * and the card's "next:" comes from the server too. Nothing here decides
 * whether anything fires.
 *
 * Split from the component because React Fast Refresh requires a .tsx to
 * export components only.
 */

import type { ScheduleTriggerConfig } from '../../types';
import type { NextFire } from '../registry';

export type ScheduleConfig = ScheduleTriggerConfig;

export const DEFAULT_TZ = 'Asia/Jerusalem';
export const MAX_TIMES = 8;
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** One click each. Sun–Thu first: it is the Israeli working week. */
export const QUICK_PICKS: { label: string; days: number[] }[] = [
  { label: 'Every day', days: [0, 1, 2, 3, 4, 5, 6] },
  { label: 'Sun–Thu', days: [0, 1, 2, 3, 4] },
  { label: 'Mon–Fri', days: [1, 2, 3, 4, 5] },
];

export const sameDays = (a: number[], b: number[]) =>
  a.length === b.length && [...a].sort().every((d, i) => d === [...b].sort()[i]);

/** "Sun–Thu" / "every day" / "Sun, Tue, Thu". */
export function daysLabel(days: number[] | undefined): string {
  const set = Array.from(new Set(days ?? [])).sort((a, b) => a - b);
  if (set.length === 7) return 'Every day';
  if (set.length === 0) return 'No days';
  const contiguous = set.every((d, i) => i === 0 || d === set[i - 1] + 1);
  if (contiguous && set.length >= 3) return `${DAY_SHORT[set[0]]}–${DAY_SHORT[set[set.length - 1]]}`;
  return set.map(d => DAY_SHORT[d]).join(', ');
}

export function sortedTimes(times: string[] | undefined): string[] {
  return Array.from(new Set((times ?? []).filter(t => /^\d{2}:\d{2}$/.test(t)))).sort();
}

/** "15 Dec 09:00" from "2026-12-15T09:00". */
export function onceLabel(onceAt: string | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})$/.exec(onceAt ?? '');
  if (!m) return 'no date set';
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[4]}`;
}

/** The card's first line: "Sun–Thu 09:00, 17:00" / "Once · 15 Dec 09:00". */
export function summarizeSchedule(config: ScheduleConfig): string {
  if (config?.repeat === 'once') return `Once · ${onceLabel(config.onceAt)}`;
  const times = sortedTimes(config?.times);
  return `${daysLabel(config?.days)} ${times.length ? times.join(', ') : '— no time'}`;
}

/** The editor's Result line: "Sun–Thu at 09:00, 17:00". */
export function describeSchedule(config: ScheduleConfig): string {
  if (config?.repeat === 'once') return `Once · ${onceLabel(config.onceAt)}`;
  const times = sortedTimes(config?.times);
  return `${daysLabel(config?.days)} at ${times.length ? times.join(', ') : '—'}`;
}

// ── local dates in the schedule's zone ──

interface Parts { y: number; mo: number; d: number; h: number; mi: number; dow: number }

function partsIn(date: Date, tz: string): Parts | null {
  try {
    const f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', weekday: 'short',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
    const p = f.formatToParts(date);
    const get = (t: string) => p.find(x => x.type === t)?.value ?? '';
    const h = Number(get('hour'));
    return {
      y: Number(get('year')), mo: Number(get('month')), d: Number(get('day')),
      h: h === 24 ? 0 : h, mi: Number(get('minute')), dow: DAY_SHORT.indexOf(get('weekday')),
    };
  } catch {
    return null;
  }
}

const pad = (n: number) => String(n).padStart(2, '0');
const dayIndex = (p: Parts) => Math.round(Date.UTC(p.y, p.mo - 1, p.d) / 86400000);

/** Today's local date in `tz`, "YYYY-MM-DD" — for the date inputs' defaults. */
export function todayIn(tz: string, plusDays = 0): string {
  const p = partsIn(new Date(Date.now() + plusDays * 86400000), tz) ?? partsIn(new Date(), 'UTC')!;
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}`;
}

/**
 * "today 17:00" / "tomorrow 09:00" / "Sun 09:00" / "15 Dec 09:00" — a
 * server instant in the schedule's own zone, relative to now.
 */
export function relativeLocal(iso: string, tz: string): string {
  const at = partsIn(new Date(iso), tz);
  const now = partsIn(new Date(), tz);
  if (!at || !now) return new Date(iso).toLocaleString();
  const diff = dayIndex(at) - dayIndex(now);
  const hm = `${pad(at.h)}:${pad(at.mi)}`;
  if (diff === 0) return `today ${hm}`;
  if (diff === 1) return `tomorrow ${hm}`;
  if (diff > 1 && diff < 7) return `${DAY_SHORT[at.dow]} ${hm}`;
  return `${at.d} ${MONTHS[at.mo - 1]} ${hm}`;
}

/** "in 36 days" / "in 3 hours" / "in 12 minutes". */
export function untilLabel(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return 'now';
  const m = Math.round(ms / 60000);
  if (m < 90) return `in ${m} minute${m === 1 ? '' : 's'}`;
  const h = Math.round(m / 60);
  if (h < 36) return `in ${h} hours`;
  return `in ${Math.round(h / 24)} days`;
}

/** The card's second line. */
export function formatNextSchedule(next: NextFire | null | undefined, config: ScheduleConfig): string {
  if (next === undefined) return 'next: …';
  if (next === null) return 'next: —';
  if (!next.at) return config?.repeat === 'once' ? 'already sent' : 'no more sends';
  return `next: ${relativeLocal(next.at, config?.timezone || DEFAULT_TZ)}`;
}

/** Is "HH:MM" inside a quiet-hours window? Same rule as the server's. */
export function insideQuietHours(time: string, qh: { from: string; to: string } | undefined): boolean {
  if (!qh?.from || !qh?.to) return false;
  const toMin = (s: string) => { const [h, m] = s.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  const t = toMin(time), from = toMin(qh.from), to = toMin(qh.to);
  return from <= to ? (t >= from && t < to) : (t >= from || t < to);
}
