/**
 * ScreenRenderer — draws a custom screen from its spec + data payload.
 *
 * The catalog pattern is Insights' BlockRenderer, extended: the model chose
 * WHICH blocks and columns; these components own HOW anything looks and
 * behaves. A bug fixed here is fixed in every screen ever built,
 * retroactively — the reason specs replaced generated HTML.
 *
 * Filtering and sorting are client-side over the delivered rows (the only
 * data a screen has). KPI values are NOT recomputed here: the server
 * computed them over the FULL set via SQL and verified them with probes —
 * the cards state totals, the table shows rows, and a filter narrows the
 * table without quietly shrinking a verified headline.
 */
import { useMemo, useState } from 'react';
import styles from './ScreenRenderer.module.css';
import { formatValue } from './fmt';
import { useLanguage } from '../../../../context/LanguageContext';
import { InsightChart } from '../../Insights/InsightChart';
import type {
  CellValue, ColumnMeta, KpiCard, ResultSetData,
  ScreenBlock, ScreenDataPayload, ScreenSpec,
} from '../../../../types/otto';
import type { Localized } from '../../../../types/apps';

interface Props {
  spec: ScreenSpec;
  data: ScreenDataPayload;
}

type Lang = 'en' | 'he';
type Filters = Record<string, Record<string, string>>; // rsId -> column -> value

const CHART_COLORS = ['#7C3AED', '#C026D3', '#0EA5E9', '#F59E0B', '#10B981', '#EF4444'];

const pick = (l: Localized | undefined, lang: Lang) => (l ? l[lang] || l.en : '');

function applyFilters(set: ResultSetData, active: Record<string, string> | undefined) {
  if (!active) return set.rows;
  const entries = Object.entries(active).filter(([, v]) => v !== '');
  if (entries.length === 0) return set.rows;
  return set.rows.filter(r => entries.every(([col, v]) => String(r[col] ?? '') === v));
}

export function ScreenRenderer({ spec, data }: Props) {
  const { language } = useLanguage();
  const lang: Lang = language === 'he' ? 'he' : 'en';
  const locale = lang === 'he' ? 'he-IL' : 'en-GB';

  // One filter state for the whole screen: the filterBar writes it, the
  // table and CSV export read it — blocks over the same result set agree.
  const [filters, setFilters] = useState<Filters>({});

  return (
    <div className={styles.screen}>
      {spec.blocks.map((block, i) => (
        <Block
          key={i}
          block={block}
          data={data}
          lang={lang}
          locale={locale}
          filters={filters}
          setFilters={setFilters}
        />
      ))}
    </div>
  );
}

interface BlockProps {
  block: ScreenBlock;
  data: ScreenDataPayload;
  lang: Lang;
  locale: string;
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
}

function Block({ block, data, lang, locale, filters, setFilters }: BlockProps) {
  switch (block.kind) {
    case 'noteLine':
      return <NoteLine caveatIds={block.caveatIds} data={data} lang={lang} />;
    case 'kpiCards':
      return <KpiCards cards={block.cards} data={data} lang={lang} locale={locale} />;
    case 'filterBar':
      return (
        <FilterBar
          from={block.from} filterCols={block.filters} data={data} lang={lang}
          active={filters[block.from] || {}}
          onChange={(col, v) => setFilters(f => ({ ...f, [block.from]: { ...f[block.from], [col]: v } }))}
        />
      );
    case 'dataTable':
      return (
        <DataTable
          from={block.from} columnIds={block.columns} sortable={block.sortable !== false}
          pageSize={block.pageSize || 50} data={data} lang={lang} locale={locale}
          active={filters[block.from]}
        />
      );
    case 'chart':
      return <ChartView block={block} data={data} lang={lang} />;
    case 'actionsBar':
      return <ActionsBar block={block} data={data} lang={lang} filters={filters} />;
    default:
      // Unknown kinds render nothing — the ChatActionCard contract.
      return null;
  }
}

// ── noteLine ─────────────────────────────────────────────────────────────

function NoteLine({ caveatIds, data, lang }: { caveatIds: string[]; data: ScreenDataPayload; lang: Lang }) {
  const texts = caveatIds
    .map(id => data.caveats.find(c => c.id === id))
    .filter(Boolean)
    .map(c => pick(c!.text, lang));
  if (texts.length === 0) return null;
  return <p className={styles.note}>{texts.join(' · ')}</p>;
}

// ── kpiCards ─────────────────────────────────────────────────────────────

function KpiCards({ cards, data, lang, locale }: {
  cards: KpiCard[]; data: ScreenDataPayload; lang: Lang; locale: string;
}) {
  return (
    <div className={styles.kpiRow}>
      {cards.map(card => {
        const value = data.kpis[card.id];
        const toneClass = card.tone === 'alarm' ? styles.kpiAlarm
          : card.tone === 'warn' ? styles.kpiWarn
            : card.tone === 'good' ? styles.kpiGood : '';
        return (
          <div key={card.id} className={styles.kpiCard}>
            <div className={styles.kpiLabel}>{pick(card.label, lang)}</div>
            <div className={`${styles.kpiValue} ${toneClass}`}>
              {value === null || value === undefined ? '—' : formatValue(value, card.format || 'int', locale)}
            </div>
            {card.sub && <div className={styles.kpiSub}>{pick(card.sub, lang)}</div>}
          </div>
        );
      })}
    </div>
  );
}

// ── filterBar ────────────────────────────────────────────────────────────

function FilterBar({ from, filterCols, data, lang, active, onChange }: {
  from: string; filterCols: string[]; data: ScreenDataPayload; lang: Lang;
  active: Record<string, string>; onChange: (col: string, value: string) => void;
}) {
  const set = data.resultSets[from];
  const { t } = useLanguage();
  const options = useMemo(() => {
    const out: Record<string, string[]> = {};
    if (!set) return out;
    for (const col of filterCols) {
      const values = new Set<string>();
      for (const r of set.rows) {
        const v = r[col];
        if (v !== null && v !== undefined && v !== '') values.add(String(v));
      }
      out[col] = [...values].sort((a, b) => a.localeCompare(b));
    }
    return out;
  }, [set, filterCols]);

  if (!set) return null;
  const meta = (col: string) => set.columns.find(c => c.id === col);

  return (
    <div className={styles.filterBar}>
      {filterCols.map(col => (
        <label key={col} className={styles.filterField}>
          <span className={styles.filterLabel}>{pick(meta(col)?.label, lang)}</span>
          <select
            className={styles.filterSelect}
            value={active[col] || ''}
            onChange={e => onChange(col, e.target.value)}
          >
            <option value="">{t('otto.filter.all')}</option>
            {(options[col] || []).map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      ))}
    </div>
  );
}

// ── dataTable ────────────────────────────────────────────────────────────

function DataTable({ from, columnIds, sortable, pageSize, data, lang, locale, active }: {
  from: string; columnIds: string[]; sortable: boolean; pageSize: number;
  data: ScreenDataPayload; lang: Lang; locale: string;
  active?: Record<string, string>;
}) {
  const { t } = useLanguage();
  const set = data.resultSets[from];
  const [sort, setSort] = useState<{ col: string; dir: 'asc' | 'desc' } | null>(null);
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    if (!set) return [];
    const filtered = applyFilters(set, active);
    if (!sort) return filtered;
    const meta = set.columns.find(c => c.id === sort.col);
    const numeric = meta?.type === 'number';
    const sorted = [...filtered].sort((a, b) => {
      const av = a[sort.col];
      const bv = b[sort.col];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      const cmp = numeric ? Number(av) - Number(bv) : String(av).localeCompare(String(bv), locale);
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [set, active, sort, locale]);

  if (!set) return null;
  const metas = columnIds
    .map(id => set.columns.find(c => c.id === id))
    .filter((m): m is ColumnMeta => Boolean(m));

  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pg = Math.min(page, pages - 1);
  const visible = rows.slice(pg * pageSize, (pg + 1) * pageSize);

  const clickSort = (col: string) => {
    if (!sortable) return;
    setPage(0);
    setSort(s => (s?.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' }));
  };

  return (
    <div className={styles.tableCard}>
      {/* Wide tables scroll inside their own container — the page never
          scrolls sideways. */}
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              {metas.map(m => (
                <th key={m.id}
                  className={`${sortable ? styles.thSortable : ''} ${m.type === 'number' ? styles.thNum : ''}`}
                  onClick={() => clickSort(m.id)}
                  aria-sort={sort?.col === m.id ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {pick(m.label, lang)}
                  {sort?.col === m.id && <span className={styles.sortMark}>{sort.dir === 'asc' ? '▲' : '▼'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => (
              <tr key={i}>
                {metas.map(m => (
                  <td key={m.id} className={m.type === 'number' ? styles.tdNum : undefined}>
                    {formatValue(r[m.id] as CellValue, m.format, locale)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.tableFoot}>
        <span>
          {t('otto.table.count').replace('{shown}', String(visible.length)).replace('{total}', String(rows.length))}
          {set.truncated ? ` · ${t('otto.table.truncated')}` : ''}
        </span>
        {pages > 1 && (
          <span className={styles.pager}>
            <button type="button" className={styles.pagerBtn} disabled={pg === 0} onClick={() => setPage(pg - 1)}>‹</button>
            <span>{pg + 1} / {pages}</span>
            <button type="button" className={styles.pagerBtn} disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)}>›</button>
          </span>
        )}
      </div>
    </div>
  );
}

// ── chart ────────────────────────────────────────────────────────────────

function ChartView({ block, data, lang }: {
  block: Extract<ScreenBlock, { kind: 'chart' }>; data: ScreenDataPayload; lang: Lang;
}) {
  const set = data.resultSets[block.from];
  const chart = useMemo(() => {
    if (!set) return null;
    // A chart over 500 categories is noise; a pie must stay within the
    // slice count its eligibility check allows.
    const rows = set.rows.slice(0, block.variant === 'pie' ? 10 : 30);
    return {
      title: pick(block.title, lang),
      unit: '',
      categories: rows.map(r => String(r[block.category] ?? '')),
      series: block.series.map((colId, i) => ({
        key: colId,
        label: pick(set.columns.find(c => c.id === colId)?.label, lang),
        color: CHART_COLORS[i % CHART_COLORS.length],
        points: rows.map(r => Number(r[colId]) || 0),
      })),
    };
  }, [set, block, lang]);
  if (!chart) return null;
  // The spec's variant picks the opening tab; the switcher stays available.
  return <InsightChart chart={chart} initialView={block.variant} />;
}

// ── actionsBar ───────────────────────────────────────────────────────────

function ActionsBar({ block, data, lang, filters }: {
  block: Extract<ScreenBlock, { kind: 'actionsBar' }>; data: ScreenDataPayload; lang: Lang;
  filters: Filters;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const { t } = useLanguage();

  const exportCsv = (from: string | undefined) => {
    if (!from) return;
    const set = data.resultSets[from];
    if (!set) return;
    const rows = applyFilters(set, filters[from]);
    const header = set.columns.map(c => `"${pick(c.label, lang).replace(/"/g, '""')}"`).join(',');
    const body = rows.map(r =>
      set.columns.map(c => {
        const v = r[c.id];
        return v === null || v === undefined ? '' : `"${String(v).replace(/"/g, '""')}"`;
      }).join(',')).join('\n');
    // BOM so Excel opens Hebrew text correctly.
    const blob = new Blob(['\uFEFF' + header + '\n' + body], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'screen-export.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className={styles.actions}>
      {block.actions.map(action => (
        <button
          key={action.id}
          type="button"
          className={action.type === 'exportCsv' ? styles.actionBtn : `${styles.actionBtn} ${styles.actionPrimary}`}
          onClick={() => {
            if (action.type === 'exportCsv') exportCsv(action.from);
            // A stub never alerts — it says, inline, what will happen when
            // it is wired (v1's rule 8, kept).
            else setNotice(action.notice ? pick(action.notice, lang) : t('otto.action.stubNotice'));
          }}
        >
          {pick(action.label, lang)}
        </button>
      ))}
      {notice && (
        <span className={styles.actionNotice}>
          {notice}
          <button type="button" className={styles.noticeClose} onClick={() => setNotice(null)} aria-label="close">×</button>
        </span>
      )}
    </div>
  );
}
