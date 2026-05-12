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
  lastDataDate: string | null; // "YYYY-MM"
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

function formatYearMonth(ym: string, locale: string): string {
  const [year, month] = ym.split('-');
  const d = new Date(parseInt(year), parseInt(month) - 1, 1);
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
      <span className={styles.dot} aria-hidden="true">·</span>
      <span className={styles.item}>
        <span className={styles.label}>{t('dataStatusBar.dataThrough')}:</span>
        <span className={styles.value}>
          {info.lastDataDate ? formatYearMonth(info.lastDataDate, locale) : naLabel}
        </span>
      </span>
    </div>
  );
}
