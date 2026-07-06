import { useState, useEffect } from 'react';
import styles from './DataStatusBar.module.css';
import { useLanguage } from '../../../context/LanguageContext';

interface DataInfo {
  lastRun: {
    id: number;
    status: string;
    triggered_by: string;
    started_at: string;
    completed_at: string;
    total_rows: string;
  } | null;
  firstDataDate?: string | null; // "YYYY-MM-DD" (exact day), or "YYYY-MM" fallback — start of coverage
  lastDataDate: string | null; // "YYYY-MM-DD" (exact day), or "YYYY-MM" fallback
}

interface DataStatusBarProps {
  baseURL: string;
  schema: string;
}

function formatDateTime(iso: string, locale: string): string {
  const d = new Date(iso);
  return d.toLocaleString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

// Formats the "data through" value. Accepts an exact day ("YYYY-MM-DD" → e.g.
// "30 Apr 2026") or a month-only fallback ("YYYY-MM" → "Apr 2026"). The exact day
// lets the customer know precisely which date the data is current through; the
// underlying sale_date is a DATE column, so there is no hour to show here (the
// "last sync" value above already carries the refresh time).
function formatDataThrough(value: string, locale: string): string {
  const parts = value.split('-').map(p => parseInt(p, 10));
  const [year, month, day] = parts;
  if (parts.length >= 3 && day) {
    const d = new Date(year, month - 1, day);
    return d.toLocaleString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
  }
  const d = new Date(year, month - 1, 1);
  return d.toLocaleString(locale, { month: 'short', year: 'numeric' });
}

export function DataStatusBar({ baseURL, schema }: DataStatusBarProps) {
  const [info, setInfo] = useState<DataInfo | null>(null);
  const { t, language } = useLanguage();
  const locale = language === 'he' ? 'he-IL' : 'en-GB';
  const naLabel = t('dataStatusBar.na');

  useEffect(() => {
    let cancelled = false;
    fetch(`${baseURL}/api/admin/data-loader/${schema}/data-info`)
      .then(r => r.json())
      .then(data => { if (!cancelled) setInfo(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [baseURL, schema]);

  if (!info) return null;

  return (
    <div className={styles.bar}>
      <span className={styles.item}>
        <span className={styles.label}>{t('dataStatusBar.lastSync')}:</span>
        <span className={styles.value}>
          {info.lastRun ? formatDateTime(info.lastRun.completed_at, locale) : naLabel}
        </span>
      </span>
      {info.firstDataDate && (
        <>
          <span className={styles.dot} aria-hidden="true">·</span>
          <span className={styles.item}>
            <span className={styles.label}>{t('dataStatusBar.dataFrom')}:</span>
            <span className={styles.value}>
              {formatDataThrough(info.firstDataDate, locale)}
            </span>
          </span>
        </>
      )}
      <span className={styles.dot} aria-hidden="true">·</span>
      <span className={styles.item}>
        <span className={styles.label}>{t('dataStatusBar.dataThrough')}:</span>
        <span className={styles.value}>
          {info.lastDataDate ? formatDataThrough(info.lastDataDate, locale) : naLabel}
        </span>
      </span>
    </div>
  );
}
