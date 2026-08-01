import type { Language } from '../../types';

/** Maps the UI language to a real Intl locale — Hebrew dates get Hebrew
 * month names and word order via the browser's own Intl formatting, rather
 * than English text force-isolated as an LTR island inside RTL flow. */
export function localeFor(language: Language): string {
  return language === 'he' ? 'he-IL' : 'en-GB';
}

/** Shared relative-date formatting for My Reports / Report history rows. */
export function formatRelativeDateTime(ts: number, language: Language = 'en'): string {
  const d = new Date(ts);
  const now = new Date();
  const locale = localeFor(language);
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) {
    return language === 'he' ? `היום, ${time}` : `Today, ${time}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return language === 'he' ? 'אתמול' : 'Yesterday';
  }
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'short' });
}

export function formatDateTime(iso: string, language: Language = 'en'): string {
  return new Date(iso).toLocaleString(localeFor(language), { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

/** `value` is a plain 'YYYY-MM-DD' (or 'YYYY-MM') string, not a full ISO timestamp. */
export function formatDateOnly(value: string, language: Language = 'en'): string {
  const [y, mo, d] = value.split('-').map(Number);
  return new Date(y, mo - 1, d || 1).toLocaleString(localeFor(language), { day: d ? '2-digit' : undefined, month: 'short', year: 'numeric' });
}
