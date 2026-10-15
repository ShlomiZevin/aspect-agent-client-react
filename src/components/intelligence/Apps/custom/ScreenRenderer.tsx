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
import { Fragment, useMemo, useState } from 'react';
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
  /** Which client's screen this is. Only the Aspect demo's report tables fold
      their repeated headings into sections (task #116); every other client's
      screens render exactly as they did. */
  datasetId?: string;
}

type Lang = 'en' | 'he';
type Filters = Record<string, Record<string, string>>; // rsId -> column -> value

const CHART_COLORS = ['#7C3AED', '#C026D3', '#0EA5E9', '#F59E0B', '#10B981', '#EF4444'];

const pick = (l: Localized | undefined, lang: Lang) => (l ? l[lang] || l.en : '');

type Row = Record<string, CellValue>;

/**
 * Rows → statement blocks: every run of plain rows is closed by the first
 * total row after it, which is the order the finance views emit (detail lines,
 * then their "סה"כ" line; a profit row carries no lines of its own).
 */
/**
 * The leading text columns that repeat down the page — a heading printed on
 * every row (period, P&L line). At most two: enough to fold "this line, this
 * period", not so many that every row becomes its own section. A column with
 * one single value folds nothing, so it is skipped rather than used; a column
 * with a value for nearly every row (a branch name) stops the search.
 */
function repeatedLeadingCols(rows: Row[], metas: ColumnMeta[]) {
  const out: string[] = [];
  for (const m of metas) {
    if (m.type === 'number') break;
    const distinct = new Set(rows.map(r => String(r[m.id] ?? ''))).size;
    if (distinct === 1) continue;
    if (distinct < 2 || distinct > rows.length / 3) break;
    out.push(m.id);
    if (out.length === 2) break;
  }
  return out;
}

/** Consecutive rows sharing the same values in `cols` become one section. */
function groupRows(rows: Row[], cols: string[]) {
  const out: { key: string; values: string[]; lines: Row[] }[] = [];
  for (const r of rows) {
    const values = cols.map(c => String(r[c] ?? ''));
    const key = values.join(' § ');
    const last = out[out.length - 1];
    if (last && last.key === key) last.lines.push(r);
    else out.push({ key, values, lines: [r] });
  }
  return out;
}

function toStatementBlocks(rows: Row[], isTotal: (r: Row) => boolean) {
  const blocks: { total: Row | null; lines: Row[] }[] = [];
  let pending: Row[] = [];
  for (const r of rows) {
    if (isTotal(r)) { blocks.push({ total: r, lines: pending }); pending = []; }
    else pending.push(r);
  }
  if (pending.length) blocks.push({ total: null, lines: pending });
  return blocks;
}

function applyFilters(set: ResultSetData, active: Record<string, string> | undefined) {
  if (!active) return set.rows;
  const entries = Object.entries(active).filter(([, v]) => v !== '');
  if (entries.length === 0) return set.rows;
  return set.rows.filter(r => entries.every(([col, v]) => String(r[col] ?? '') === v));
}

export function ScreenRenderer({ spec, data, datasetId }: Props) {
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
          datasetId={datasetId}
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
  datasetId?: string;
  lang: Lang;
  locale: string;
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
}

function Block({ block, data, datasetId, lang, locale, filters, setFilters }: BlockProps) {
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
          datasetId={datasetId}
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

function DataTable({ from, columnIds, sortable, pageSize, data, datasetId, lang, locale, active }: {
  from: string; columnIds: string[]; sortable: boolean; pageSize: number;
  data: ScreenDataPayload; datasetId?: string; lang: Lang; locale: string;
  active?: Record<string, string>;
}) {
  const { t } = useLanguage();
  const set = data.resultSets[from];
  const [sort, setSort] = useState<{ col: string; dir: 'asc' | 'desc' } | null>(null);
  const [page, setPage] = useState(0);
  // Which statement sections are open (see the statement branch below).
  const [openGroups, setOpenGroups] = useState<Record<number, boolean>>({});

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
  const allMetas = columnIds
    .map(id => set.columns.find(c => c.id === id))
    .filter((m): m is ColumnMeta => Boolean(m));

  // Only the Aspect demo's screens fold; every other client's tables render
  // exactly as they did before (ZolStock and HyperToy have Otto too).
  const foldable = datasetId === 'aspect' && !sort;

  // A FINANCIAL STATEMENT, not a list. The finance views carry their own
  // `is_total` flag per row — it does not have to be one of the DISPLAYED
  // columns — so the table renders the way a statement is read: totals, with
  // their lines behind a disclosure, like the chat's finance card (task #116).
  // Sorting would scramble a statement's order, so it turns folding off.
  const hasTotalFlag = set.columns.some(c => c.id === 'is_total');
  const labelMeta = allMetas.find(m => m.type !== 'number' && m.id !== 'is_total');
  const asStatement = Boolean(foldable && hasTotalFlag && labelMeta && rows.length <= 400);
  const metas = allMetas.filter(m => m.id !== 'is_total');

  // Not a statement, but still a report that prints the same heading down the
  // page — one P&L line repeated for 29 branches, period after period. Those
  // fold under their own leading columns instead of repeating the heading on
  // every single row.
  const groupCols = !asStatement && foldable ? repeatedLeadingCols(rows, metas) : [];
  const groups = groupCols.length ? groupRows(rows, groupCols) : [];
  const asGrouped = groups.length > 1 && groups.length < rows.length;
  const folded = asStatement || asGrouped;

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
            {asStatement
              ? toStatementBlocks(rows, r => Boolean(r.is_total)).map((block, i) => {
                const cells = (r: Record<string, unknown>) => metas.map(m => (
                  <td key={m.id} className={m.type === 'number' ? styles.tdNum : undefined}>
                    {formatValue(r[m.id] as CellValue, m.format, locale)}
                  </td>
                ));
                if (!block.total) {
                  return block.lines.map((r, j) => <tr key={`${i}-${j}`}>{cells(r)}</tr>);
                }
                const isOpen = Boolean(openGroups[i]) && block.lines.length > 0;
                const totalCells = cells(block.total);
                return (
                  <Fragment key={i}>
                    <tr className={styles.statementTotal}>
                      {totalCells.map((cell, ci) => (ci === 0 && block.lines.length > 0
                        ? (
                          <td key={metas[ci].id}>
                            <button
                              type="button"
                              className={styles.statementToggle}
                              aria-expanded={isOpen}
                              onClick={() => setOpenGroups(o => ({ ...o, [i]: !o[i] }))}
                            >
                              <span className={`${styles.statementChevron} ${isOpen ? styles.statementChevronOpen : ''}`} aria-hidden="true">▾</span>
                              <span>{formatValue(block.total![metas[ci].id] as CellValue, metas[ci].format, locale)}</span>
                            </button>
                          </td>
                        )
                        : cell))}
                    </tr>
                    {isOpen && block.lines.map((r, j) => (
                      <tr key={`${i}-${j}`} className={styles.statementLine}>{cells(r)}</tr>
                    ))}
                  </Fragment>
                );
              })
              : asGrouped
                ? groups.map((g, i) => {
                  // The first section starts open: a band carries no numbers
                  // of its own, so an all-closed table would open on a screen
                  // with nothing on it.
                  const isOpen = openGroups[i] ?? i === 0;
                  return (
                    <Fragment key={g.key}>
                      <tr className={styles.sectionRow}>
                        <td colSpan={metas.length}>
                          <button
                            type="button"
                            className={styles.statementToggle}
                            aria-expanded={isOpen}
                            onClick={() => setOpenGroups(o => ({ ...o, [i]: !o[i] }))}
                          >
                            <span className={`${styles.statementChevron} ${isOpen ? styles.statementChevronOpen : ''}`} aria-hidden="true">▾</span>
                            <span>{g.values.filter(Boolean).join(' · ')}</span>
                            <span className={styles.sectionCount}>{g.lines.length}</span>
                          </button>
                        </td>
                      </tr>
                      {isOpen && g.lines.map((r, j) => (
                        <tr key={j}>
                          {metas.map(m => (
                            <td key={m.id} className={m.type === 'number' ? styles.tdNum : undefined}>
                              {/* The heading columns live in the section band
                                  above — printing them again on every row is
                                  exactly what made these tables unreadable. */}
                              {groupCols.includes(m.id) ? '' : formatValue(r[m.id] as CellValue, m.format, locale)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </Fragment>
                  );
                })
                : visible.map((r, i) => (
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
          {t('otto.table.count')
            .replace('{shown}', String(folded ? rows.length : visible.length))
            .replace('{total}', String(rows.length))}
          {set.truncated ? ` · ${t('otto.table.truncated')}` : ''}
        </span>
        {/* A folded table reads top to bottom — paging it would cut a section
            off from its own heading or its own total. */}
        {!folded && pages > 1 && (
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
    let rows = set.rows.slice(0, block.variant === 'pie' ? 10 : 30);
    // Time runs left to right. "The last 30 days" arrives date-DESC (that is
    // how the result set keeps the newest 30), and drawn in row order the
    // line ran backwards — caught by the AI-builder door test (task #96).
    // Slice first, so the newest rows are the ones kept; then sort ascending.
    const catType = set.columns.find(c => c.id === block.category)?.type;
    if (block.variant === 'line' && catType === 'date') {
      rows = [...rows].sort((a, b) => String(a[block.category] ?? '').localeCompare(String(b[block.category] ?? '')));
    }
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
