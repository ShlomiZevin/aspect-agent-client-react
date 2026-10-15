/**
 * A financial statement as its own screen (task #116).
 *
 * The Apps shelf carries one tile per statement — P&L, balance sheet, cash
 * flow — and each opens here: the report header (what it is, which periods it
 * compares, how far the books are closed), a period picker, and the statement
 * itself, drawn by the same component the chat uses so the two never drift.
 *
 * Demo-only: the route behind it is hardcoded to the Aspect demo's books.
 */

import { useEffect, useState } from 'react';
import styles from './FinanceReportPage.module.css';
import { StatementTable } from '../../finance/StatementTable';
import { financeService } from '../../../services/financeService';
import type { FinanceCatalog, FinanceStatement } from '../../../services/financeService';
import { useLanguage } from '../../../context/LanguageContext';
import { Skeleton } from '../Insights/Skeleton';

const WORDS = {
  he: { period: 'תקופה', closedThrough: 'הספרים סגורים עד', vs: 'מול', failed: 'לא הצלחנו להפיק את הדוח', other: 'דוחות נוספים' },
  en: { period: 'Period', closedThrough: 'Books closed through', vs: 'vs', failed: 'The report could not be produced', other: 'Other statements' },
};

export function FinanceReportPage({ report, baseURL, onCrumb, onOpenReport }: {
  report: string;
  baseURL?: string;
  /** Lets the shell show the statement's own name in the breadcrumb. */
  onCrumb?: (label: string) => void;
  /** Switching statements goes through the shell, so the URL follows. */
  onOpenReport?: (appId: string) => void;
}) {
  const { language } = useLanguage();
  const lang = language === 'he' ? 'he' : 'en';
  const w = WORDS[lang];

  const [catalog, setCatalog] = useState<FinanceCatalog | null>(null);
  const [preset, setPreset] = useState('last_month_vs_last_year');
  const [statement, setStatement] = useState<FinanceStatement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    financeService.catalog(baseURL)
      .then(c => { if (alive) setCatalog(c); })
      .catch(() => { /* the picker is a convenience; the report still loads */ });
    return () => { alive = false; };
  }, [baseURL]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    financeService.report({ report, preset }, baseURL)
      .then(r => { if (alive) { setStatement(r); setLoading(false); } })
      .catch((e: Error) => { if (alive) { setError(e.message); setLoading(false); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [report, preset, baseURL]);

  const name = catalog?.reports.find(r => r.id === report)?.name;
  useEffect(() => {
    if (name) onCrumb?.(name[lang]);
  }, [name, lang, onCrumb]);

  const periods = statement?.periods;
  const subtitle = [
    periods?.a && periods?.b ? `${periods.a} ${w.vs} ${periods.b}` : null,
    periods?.data_closed_through ? `${w.closedThrough} ${periods.data_closed_through}` : null,
  ].filter(Boolean).join(' · ');

  // The other statements, as plain links — a reader who opened the P&L often
  // wants the balance sheet next, and going back to the shelf for it is a
  // detour. Only the three that have their own tile.
  const siblings = [
    { id: 'pnl', appId: 'finance-pnl' },
    { id: 'balance_sheet', appId: 'finance-balance' },
    { id: 'cash_flow', appId: 'finance-cash' },
  ].filter(s => s.id !== report);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{statement?.title || (name ? name[lang] : '')}</h1>
          {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
        </div>
        {catalog?.periods?.length ? (
          <label className={styles.periodPick}>
            <span className={styles.periodLabel}>{w.period}</span>
            <select value={preset} onChange={e => setPreset(e.target.value)} className={styles.select}>
              {catalog.periods.map(p => <option key={p.id} value={p.id}>{p.name[lang]}</option>)}
            </select>
          </label>
        ) : null}
      </div>

      {statement?.notice && <div className={styles.notice}>{statement.notice}</div>}

      <div className={styles.sheet}>
        {loading && <Skeleton width="100%" height={320} />}
        {!loading && error && <div className={styles.error}>{w.failed} — {error}</div>}
        {!loading && !error && statement && (
          <StatementTable columns={statement.columns} blocks={statement.blocks} />
        )}
      </div>

      {onOpenReport && siblings.length > 0 && catalog && (
        <div className={styles.siblings}>
          <span className={styles.siblingsLabel}>{w.other}</span>
          {siblings.map(s => {
            const label = catalog.reports.find(r => r.id === s.id)?.name[lang];
            if (!label) return null;
            return (
              <button key={s.id} type="button" className={styles.siblingBtn} onClick={() => onOpenReport(s.appId)}>
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
