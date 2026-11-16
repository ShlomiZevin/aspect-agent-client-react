import { useLanguage } from '../context/LanguageContext';
import { translations } from '../i18n/translations';
import { ManagementError } from './api';
import type { Alert, BillingType, TaskType } from './types';

/**
 * Words and formats. The words are the `management.*` keys in
 * i18n/translations.ts: Hebrew, the tool's language, and English, a hidden view
 * for the Aspect team that Ctrl+Shift+E switches (see ManagementRoute).
 */

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

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0];

export const TASK_TYPES: TaskType[] = ['development', 'maintenance'];
export const BILLING_TYPES: BillingType[] = ['retainer', 'hourly', 'fixed'];

/** A client's services keep their Hebrew status as saved; these are the ones the dialog offers. */
export const SERVICE_STATUSES: Record<string, string> = { 'פעיל': 'active', 'בהטמעה': 'onboarding', 'מושהה': 'paused' };

const ACTION_BY_KIND: Record<Alert['kind'], string> = {
  late: 'handle', over: 'handle', blocker: 'handle', near: 'follow', no_followup: 'follow', no_report: 'remind',
};

export type Text = ReturnType<typeof useText>;

/** The current language's words and formats for one screen. */
export function useText() {
  const { t: translate, language } = useLanguage();
  const locale = language === 'he' ? 'he-IL' : 'en-GB';

  /** `values` fill the key's {placeholders}. */
  const t = (key: string, values: Record<string, string | number> = {}) =>
    Object.entries(values).reduce(
      (text, [name, value]) => text.replace(`{${name}}`, String(value)),
      translate(`management.${key}`),
    );

  const hours = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n);
  const daysText = (n: number) =>
    n === 0 ? t('unit.today') : n === 1 ? t('unit.oneDay') : n === 2 ? t('unit.twoDays') : t('unit.days', { n });

  return {
    t,
    language,
    hours,
    /** "1 שעות" is not Hebrew. */
    hoursText: (n: number) => (n === 1 ? t('unit.oneHour') : n === 2 ? t('unit.twoHours') : t('unit.hours', { n: hours(n) })),
    daysText,
    money: (n: number) => `₪${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n)}`,
    longDate: (date: string) =>
      new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(parse(date)),
    shortDate: (date: string) =>
      new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'numeric', year: 'numeric' }).format(parse(date)),
    /** 'YYYY-MM' as "נובמבר 2026". */
    monthName: (month: string) =>
      new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(parse(`${month}-01`)),
    clock: (when: Date) =>
      new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' }).format(when),
    taskType: (code: TaskType) => t(`taskType.${code}`),
    billingType: (code: BillingType) => t(`billingType.${code}`),
    serviceStatus: (status: string) => (status in SERVICE_STATUSES ? t(`serviceStatus.${SERVICE_STATUSES[status]}`) : status),

    /** A morning alert's line, from what the server measured. */
    alertLine: (alert: Alert) => {
      // A server from before these fields sends only its Hebrew line.
      if (!['days', 'pct', 'body', 'weekday'].some(field => field in alert)) return alert.line;
      switch (alert.kind) {
        case 'late': return t('alert.late', { days: daysText(alert.days ?? 0) });
        case 'over': return t('alert.over', { pct: alert.pct ?? 0 });
        case 'near': return t('alert.near', { pct: alert.pct ?? 0 });
        case 'blocker': return t('alert.blocker', { body: alert.body ?? '' });
        case 'no_followup': return t('alert.noFollowup', { days: daysText(alert.days ?? 0) });
        case 'no_report': return alert.weekday === null || alert.weekday === undefined
          ? t('alert.noReportYesterday')
          : t('alert.noReportOn', { weekday: t(`weekday.${alert.weekday}`) });
      }
    },
    alertAction: (alert: Alert) => t(`alert.${ACTION_BY_KIND[alert.kind]}`),

    /** Why something failed, in the current language when the server said which refusal it was. */
    error: (err: unknown) => {
      if (!(err instanceof ManagementError) || !(`management.error.${err.code}` in translations[language])) {
        return err instanceof Error ? err.message : String(err);
      }
      const { field, ...rest } = err.params;
      return t(`error.${err.code}`, field ? { ...rest, field: t(`field.${field}`) } : rest);
    },
  };
}
