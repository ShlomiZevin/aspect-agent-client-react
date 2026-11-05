/** Dates here are 'YYYY-MM-DD' strings, as the server sends them. */
const parse = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export function todayInIsrael(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export function shiftDate(date: string, days: number): string {
  const d = parse(date);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const longDate = (date: string) =>
  new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(parse(date));

export const shortDate = (date: string) =>
  new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' }).format(parse(date));

export const hours = (n: number) => new Intl.NumberFormat('he-IL', { maximumFractionDigits: 2 }).format(n);

/** "1 שעות" is not Hebrew. */
export function hoursText(n: number): string {
  if (n === 1) return 'שעה אחת';
  if (n === 2) return 'שעתיים';
  return `${hours(n)} שעות`;
}

export const money = (n: number) => `₪${new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 }).format(n)}`;

export function daysText(n: number): string {
  if (n === 0) return 'היום';
  if (n === 1) return 'יום אחד';
  if (n === 2) return 'יומיים';
  return `${n} ימים`;
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0];
