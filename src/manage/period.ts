/**
 * The period of the problems and conversations pages (#1001): today, this
 * week, or a from–to of Israel days. It lives in the address
 * (`?range=week` · `?from=2026-11-01&to=2026-11-15`; nothing = today), so a
 * tile can open the conversations page on the same period and a refresh
 * keeps it.
 */

import type { ProblemPeriod } from '../types/manage';
import { COPY } from './copy';

const TZ = 'Asia/Jerusalem';
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The longest from–to (days, inclusive) — mirrors the server's MAX_RANGE_DAYS (customerProblems.js), which refuses longer. */
export const MAX_RANGE_DAYS = 92;

/** Today's Israel day, "YYYY-MM-DD". */
export const israelToday = (now: Date = new Date()) => dayKey.format(now);

/** The page's period from the address. */
export function periodFromParams(sp: URLSearchParams): ProblemPeriod {
  const from = sp.get('from') || '';
  const to = sp.get('to') || '';
  if (DAY_RE.test(from) && DAY_RE.test(to)) return { range: 'custom', from, to };
  return { range: sp.get('range') === 'week' ? 'week' : 'today' };
}

/** The address params for a period — other params (a filter) kept. */
export function periodToParams(p: ProblemPeriod, base?: URLSearchParams): URLSearchParams {
  const sp = new URLSearchParams(base);
  sp.delete('range');
  sp.delete('from');
  sp.delete('to');
  if (p.range === 'custom') { sp.set('from', p.from); sp.set('to', p.to); }
  else if (p.range === 'week') sp.set('range', 'week');
  return sp;
}

/** A stable key for effects. */
export const periodKey = (p: ProblemPeriod) => (p.range === 'custom' ? `${p.from}~${p.to}` : p.range);

/** "15.11" (this year) · "15.11.25" (another year). */
function shortDay(d: string, now: Date): string {
  const [y, m, day] = d.split('-');
  const thisYear = israelToday(now).slice(0, 4);
  return `${Number(day)}.${Number(m)}${y === thisYear ? '' : `.${y.slice(2)}`}`;
}

/** "היום" · "השבוע" · "1.11–15.11" · "15.11" (one day). */
export function periodLabel(p: ProblemPeriod, now: Date = new Date()): string {
  if (p.range !== 'custom') return p.range === 'week' ? COPY.week : COPY.today;
  return p.from === p.to ? shortDay(p.from, now) : `${shortDay(p.from, now)}–${shortDay(p.to, now)}`;
}

/** Days in a from–to, inclusive (NaN when not two days). */
export function periodDays(from: string, to: string): number {
  if (!DAY_RE.test(from) || !DAY_RE.test(to)) return NaN;
  return (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 + 1;
}
