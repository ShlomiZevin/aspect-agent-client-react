/**
 * "Report history" page (design turn 12a) — every report ever asked for or
 * proposed, newest first, in one searchable/paginated table. Currently-
 * running jobs are merged in at the top (from JobsContext — the server has
 * no notion of "in progress", only finished reports, see JobsContext.tsx).
 */
import { useMemo, useState } from 'react';
import { useInsights } from '../useInsightsFeed';
import { useJobs } from '../jobs/JobsContext';
import { useLanguage } from '../../../context/LanguageContext';
import { formatRelativeDateTime } from '../dateFormat';
import styles from './ReportHistoryPage.module.css';

const PAGE_SIZE = 20;

interface Props {
  datasetId: string;
  onOpenInsight: (id: string) => void;
}

type Row =
  | { kind: 'job'; key: string; date: number; question: string; result: string; detail: string; status: 'running' | 'error'; onClick?: () => void }
  | { kind: 'insight'; key: string; date: number; question: string; result: string; detail: string; tracked: boolean; unviewed: boolean; onClick: () => void };

export function ReportHistoryPage({ datasetId, onOpenInsight }: Props) {
  const { t } = useLanguage();
  const { data: insights, loading } = useInsights(datasetId);
  const { jobs, restartJob } = useJobs();
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);

  const rows: Row[] = useMemo(() => {
    const jobRows: Row[] = jobs
      .filter(j => j.status !== 'completed')
      .map(j => j.status === 'running'
        ? { kind: 'job', key: j.id, date: j.startedAt, question: j.prompt || '…', result: '…', detail: `${t('intel.home.inProgress')} · ${j.progress}%`, status: 'running' }
        : { kind: 'job', key: j.id, date: j.startedAt, question: j.prompt || '—', result: '—', detail: t('intel.home.failed'), status: 'error', onClick: () => restartJob(datasetId, j.id) });

    const insightRows: Row[] = (insights || []).map(i => ({
      kind: 'insight',
      key: i.id,
      date: i.createdAt || 0,
      question: i.askedPrompt || i.headline,
      result: i.impactValue || i.headline,
      detail: i.origin === 'user' ? t('intel.history.myReport') : t('intel.history.proposed'),
      tracked: !!i.tracked,
      unviewed: !i.viewed,
      onClick: () => onOpenInsight(i.id),
    }));

    return [...jobRows, ...insightRows].sort((a, b) => b.date - a.date);
  }, [jobs, insights, datasetId, restartJob, onOpenInsight, t]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => r.question.toLowerCase().includes(q) || r.result.toLowerCase().includes(q));
  }, [rows, query]);

  const page = filtered.slice(0, visible);

  return (
    <div className={styles.page}>
      <div className={styles.headRow}>
        <div className={styles.title}>{t('intel.history.title')}</div>
        <div className={styles.count}>{rows.length} {t('intel.history.count')}</div>
        <div className={styles.search}>
          <SearchIcon />
          <input placeholder={t('intel.history.search')} value={query} onChange={e => { setQuery(e.target.value); setVisible(PAGE_SIZE); }} />
        </div>
      </div>

      <div className={styles.table}>
        <div className={styles.headerRow}>
          <span>{t('intel.history.date').toUpperCase()}</span>
          <span>{t('intel.history.asked').toUpperCase()}</span>
          <span>{t('intel.history.result').toUpperCase()}</span>
          <span>{t('intel.history.details').toUpperCase()}</span>
          <span />
        </div>

        {loading && <div className={styles.state}>…</div>}
        {!loading && page.length === 0 && <div className={styles.state}>{t('intel.history.noMatch')} "{query}"</div>}
        {!loading && page.map(row => {
          const clickable = row.kind === 'insight' || row.status === 'error';
          const highlight = row.kind === 'insight' && row.unviewed;
          return (
            <div
              key={row.key}
              className={`${styles.row} ${highlight ? styles.rowUnviewed : ''} ${clickable ? styles.rowClickable : ''}`}
              onClick={clickable ? row.onClick : undefined}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
            >
              <span className={styles.date} dir="ltr">{row.date ? formatRelativeDateTime(row.date) : '—'}</span>
              <span className={styles.question}>
                {row.question}
                {row.kind === 'insight' && row.tracked && <BookmarkIcon />}
              </span>
              <span className={styles.result}>{row.result}</span>
              <span className={styles.detail} data-status={row.kind === 'job' ? row.status : (highlight ? 'unviewed' : 'plain')}>
                {row.kind === 'job' && row.status === 'running' && <span className={styles.pulseDot} />}
                {row.kind === 'insight' && highlight && <span className={styles.readyDot} />}
                {highlight ? t('intel.history.readyUnviewed') : row.detail}
              </span>
              <span className={styles.action}>
                {row.kind === 'job'
                  ? (row.status === 'error' ? `${t('intel.history.restart')} ↻` : <span className={styles.actionDisabled}>{t('intel.history.open')}</span>)
                  : `${t('intel.history.open')} →`}
              </span>
            </div>
          );
        })}
      </div>

      {!loading && visible < filtered.length && (
        <button className={styles.loadMore} onClick={() => setVisible(v => v + PAGE_SIZE)}>
          {t('intel.history.loadMore')} ({t('intel.history.showing')} {Math.min(visible, filtered.length)} {t('intel.history.of')} {filtered.length})
        </button>
      )}
    </div>
  );
}

function BookmarkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--ai-accent-2)" style={{ flex: 'none', marginInlineStart: 8 }}>
      <path d="M6 3.5h12V21l-6-4.6L6 21z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ai-text-mute)" strokeWidth="2">
      <circle cx="11" cy="11" r="7" /><path d="M16.5 16.5L21 21" />
    </svg>
  );
}
