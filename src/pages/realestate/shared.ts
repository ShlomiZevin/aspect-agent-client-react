/**
 * Shared bits of the real-estate demo screens: their paths, the greeting and
 * ₪ formatting.
 */
export const BRIEF_PATH = '/aspect/realestate';
export const BOARD_PATH = '/aspect/realestate/board';
export const REPORTS_PATH = '/aspect/realestate/reports';
export const MARKET_PATH = '/aspect/realestate/market';

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'בוקר טוב';
  if (h < 17) return 'צהריים טובים';
  return 'ערב טוב';
}

export function shekels(n: number): string {
  if (n >= 1e6) return `₪${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M`;
  if (n >= 1e3) return `₪${Math.round(n / 1e3)}K`;
  return `₪${n}`;
}

/** Hebrew building letter: 1 -> א', 2 -> ב'. */
export const buildingLetter = (n: number) => `${'אבגדהוזחטי'[n - 1] || n}'`;

/** Board colour key of an apartment: sold / reserved / free / free over 180 days. */
export const unitKind = (u: { status: string; stuck: boolean }) => (u.status === 'נמכרה' ? 'sold' : u.status === 'שמורה' ? 'reserved' : u.stuck ? 'stuck' : 'free');
