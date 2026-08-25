import { useEffect, useState } from 'react';
import styles from './DataHealthModal.module.css';
import { useLanguage } from '../../../context/LanguageContext';
import { dataHealthService, type DataHealth } from '../../../services/dataHealthService';

interface Props {
  baseURL: string;
  schema: string;
  onClose: () => void;
}

function formatDay(value: string | null, locale: string): string | null {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(p => parseInt(p, 10));
  if (!year || !month) return value;
  const d = new Date(year, month - 1, day || 1);
  return d.toLocaleString(locale, day ? { day: '2-digit', month: 'short', year: 'numeric' }
                                      : { month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString(locale, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

/**
 * What data the assistant is actually working with, opened from the Last sync
 * label. The point is to make the scope legible BEFORE a question is typed —
 * someone who can see that stock carries no dates, or that sales stop on the
 * 17th, stops reading an empty answer as a fault.
 */
export function DataHealthModal({ baseURL, schema, onClose }: Props) {
  const { t, language } = useLanguage();
  const locale = language === 'he' ? 'he-IL' : 'en-GB';
  const [data, setData] = useState<DataHealth | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    dataHealthService.get(baseURL, schema)
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [baseURL, schema]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const nf = new Intl.NumberFormat(locale);
  const coverageFrom = formatDay(data?.coverage.from ?? null, locale);
  const coverageThrough = formatDay(data?.coverage.through ?? null, locale);

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.modal}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('dataHealth.title')}
      >
        <div className={styles.header}>
          <div>
            <h3>{t('dataHealth.title')}</h3>
            <p className={styles.subtitle}>{t('dataHealth.subtitle')}</p>
          </div>
          <button className={styles.close} onClick={onClose} aria-label={t('common.close')}>×</button>
        </div>

        <div className={styles.body}>
          {/* The panel is opened most often when something looks wrong with the
              data, so a failure here has to explain itself rather than render
              an empty box. */}
          {error && (
            <div className={styles.state}>
              <div>{t('dataHealth.error')}</div>
              <div className={styles.errorDetail}>{error}</div>
            </div>
          )}
          {!error && !data && <div className={styles.state}>{t('dataHealth.loading')}</div>}

          {data && (
            <>
              <div className={styles.summary}>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>{t('dataStatusBar.lastSync')}</span>
                  <span className={styles.statValue}>
                    {formatDateTime(data.lastSync?.at ?? null, locale) || t('dataStatusBar.na')}
                  </span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>{t('dataHealth.range')}</span>
                  <span className={styles.statValue}>
                    {coverageFrom && coverageThrough
                      ? `${coverageFrom} – ${coverageThrough}`
                      : (coverageThrough || t('dataStatusBar.na'))}
                  </span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>{t('dataHealth.filesLoaded')}</span>
                  <span className={styles.statValue}>{data.files.length}</span>
                </div>
              </div>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">{t('dataHealth.file')}</th>
                      <th scope="col" className={styles.num}>{t('dataHealth.rows')}</th>
                      <th scope="col">{t('dataHealth.covers')}</th>
                      <th scope="col" className={styles.num}>{t('dataHealth.size')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.files.map(f => {
                      const from = formatDay(f.from, locale);
                      const through = formatDay(f.through, locale);
                      return (
                        <tr key={f.file}>
                          <td>
                            <div className={styles.fileName} title={f.file}>{f.file}</div>
                            {f.table && <span className={styles.tableHint}>{f.table}</span>}
                          </td>
                          <td className={styles.num} data-label={t('dataHealth.rows')}>
                            {f.rows == null ? '—' : (
                              <>
                                {nf.format(f.rows)}
                                {!f.exactRows && <span className={styles.approx}> ≈</span>}
                              </>
                            )}
                          </td>
                          <td data-label={t('dataHealth.covers')}>
                            {from && through
                              ? <span dir="ltr">{from} – {through}</span>
                              : <span className={styles.noDates}>{t('dataHealth.noDates')}</span>}
                          </td>
                          <td className={styles.num} data-label={t('dataHealth.size')}>{f.size || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Stage 3: EVERY table + materialized view in the live schema,
                  each with the period it stores — not only file-mapped tables. */}
              {data.tables && data.tables.length > 0 && (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th scope="col">{t('dataHealth.allTables')}</th>
                        <th scope="col" className={styles.num}>{t('dataHealth.rows')}</th>
                        <th scope="col">{t('dataHealth.storedPeriod')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.tables.map(tb => {
                        const from = formatDay(tb.from, locale);
                        const through = formatDay(tb.through, locale);
                        return (
                          <tr key={`${tb.kind}:${tb.name}`}>
                            <td>
                              <div className={styles.fileName} title={tb.name}>{tb.name}</div>
                              <span className={styles.tableHint}>
                                {tb.kind === 'view' ? t('dataHealth.kindView') : t('dataHealth.kindTable')}
                              </span>
                            </td>
                            <td className={styles.num} data-label={t('dataHealth.rows')}>
                              {tb.rows == null ? '—' : nf.format(tb.rows)}
                            </td>
                            <td data-label={t('dataHealth.storedPeriod')}>
                              {from && through
                                ? <span dir="ltr">{from} – {through}</span>
                                : <span className={styles.noDates}>{t('dataHealth.noDates')}</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {data.freshness && (
                <p className={data.freshness.ok ? styles.freshOk : styles.freshBad}>
                  {data.freshness.ok
                    ? t('dataHealth.freshOk').replace('{date}', formatDay(data.freshness.baseMax, locale) || data.freshness.baseMax)
                    : t('dataHealth.freshBad')}
                </p>
              )}

            </>
          )}
        </div>
      </div>
    </div>
  );
}
