import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './ProcurementPage.module.css';
import { AppGlyph } from './AppIcon';
import { useRecalcStream } from './useRecalcStream';
import { useLanguage } from '../../../context/LanguageContext';
import { replenishmentService } from '../../../services/replenishmentService';
import { formatDateOnly } from '../dateFormat';
import { Skeleton } from '../Insights/Skeleton';
import type { Recommendation, PlanResponse, PlanSupplier } from '../../../types/replenishment';

interface Props {
  datasetId: string;
  baseURL?: string;
  /**
   * Open Data Chat on this item and ask about it straight away.
   *
   * The same door Insights uses: it opens the widget expanded and SENDS the
   * question, rather than prefilling a box for the buyer to press enter on.
   * A row here is a decision — order 688 units, ship by the 1st — and the
   * question a buyer has next is rarely one this table can answer.
   */
  onAskInChat?: (question: string) => void;
}

/** How many item rows one supplier shows at a time. The mockup's number. */
const PAGE_SIZE = 10;

/** The server coalesces a missing supplier to this, and the page groups on it. */
const UNATTRIBUTED = '(unattributed)';

/**
 * Grouped digits in the reader's locale.
 *
 * The locale is threaded through rather than fixed to en-GB: Hebrew groups the
 * same way, but a page that hardcodes one locale is a page that will be wrong
 * the first time that stops being true.
 */
const fmt = (n: number | null | undefined, locale: string, digits = 0) =>
  n === null || n === undefined ? '—' : Number(n).toLocaleString(locale, { maximumFractionDigits: digits });

/** "₪11.77M" - the band has room for a shape, not for nine digits. */
const money = (n: number, locale: string) => {
  if (n >= 1e6) return `₪${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `₪${(n / 1e3).toFixed(1)}K`;
  return `₪${fmt(n, locale)}`;
};

/** The item rows for the ONE supplier that is open, and where they came from. */
interface OpenRows {
  supplier: string;
  page: number;
  search: string;
  rows: Recommendation[];
  total: number;
  loading: boolean;
}

/**
 * Procurement - the Purchase section.
 *
 * The unit of action is a SUPPLIER, not an item: a buyer raises one order per
 * supplier, and the delivery time that drives every date on the screen is a
 * supplier-level number. So suppliers are the rows, items are inside them, and
 * the delivery time is edited where it belongs - on the supplier's own row,
 * with the plan rebuilding immediately after.
 *
 * EVERY NUMBER SHOWS ITS WORKING. Each item opens a panel with the inputs that
 * produced it, where each parameter came from, the derivation in one sentence,
 * and the engine's own caveats. Those caveats are quoted from the server's
 * `notes[]`, never re-worded here: a buyer will not act on a figure they cannot
 * check, and a screen that paraphrases its own warnings has stopped being
 * checkable.
 */
export function ProcurementPage({ datasetId, baseURL, onAskInChat }: Props) {
  const { t, language } = useLanguage();
  const he = language === 'he';

  // Every hook above the early returns - adding one below changes the hook
  // count between renders, which React treats as fatal.
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Only the expanded supplier's rows are ever in memory. Fetching every
  // recommendation to build this screen was a 14 MB response for ten lines.
  const [open, setOpen] = useState<OpenRows | null>(null);
  const [openWhy, setOpenWhy] = useState<string | null>(null);

  const [editingSupplier, setEditingSupplier] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);

  // What the last recalculation was ABOUT, kept as values rather than a
  // sentence so the banner is worded fresh on every render and follows the
  // language toggle like everything else on the page.
  const [lastRecalc, setLastRecalc] = useState<{ days: string; supplier: string; items: number } | null>(null);

  const loadedFor = useRef<string | null>(null);
  const locale = he ? 'he-IL' : 'en-GB';
  const nf = useCallback(
    (n: number | null | undefined, digits = 0) => fmt(n, locale, digits),
    [locale],
  );
  const recalc = useRecalcStream(datasetId, baseURL, language);

  const load = useCallback(async () => {
    try {
      setPlan(await replenishmentService.plan(datasetId, language, baseURL));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [datasetId, baseURL, language]);

  useEffect(() => {
    // Keyed on the language too: the caveats are rendered server-side, so
    // switching language has to ask again or the page keeps the sentences it
    // was given. Deduped by key rather than a per-closure flag, because React
    // 19 StrictMode double-invokes effects and the naive version sticks on a
    // skeleton.
    const key = `${datasetId}/${language}`;
    if (loadedFor.current === key) return;
    loadedFor.current = key;
    void load();
  }, [datasetId, language, load]);

  /**
   * Fetch one page of one supplier's items.
   *
   * Server-side paging and search, not client-side slicing: the rows for a
   * supplier with five thousand items are not something to hold in a browser to
   * show ten of them. The summary above is unaffected — it is computed over
   * every row on the server, so searching never changes the tiles.
   */
  const loadRows = useCallback(async (supplier: string, page: number, search: string) => {
    setOpen(o => ({ supplier, page, search, rows: o?.supplier === supplier ? o.rows : [], total: o?.supplier === supplier ? o.total : 0, loading: true }));
    try {
      const r = await replenishmentService.recommendations(datasetId, {
        supplier, onlyDue: true, limit: PAGE_SIZE, offset: page * PAGE_SIZE,
        search: search || undefined, lang: language,
      }, baseURL);
      setOpen(o => (o && o.supplier === supplier && o.page === page && o.search === search
        ? { ...o, rows: r.recommendations, total: r.total, loading: false }
        : o));
    } catch {
      // The accordion row stays open and empty rather than the page erroring:
      // the rest of the screen is still correct and still useful.
      setOpen(o => (o && o.supplier === supplier ? { ...o, rows: [], loading: false } : o));
    }
  }, [datasetId, baseURL, language]);

  // Closing the page mid-recalculation must not leave a stream open.
  useEffect(() => recalc.stop, [recalc.stop]);

  /**
   * Switching language has to re-ask for the open supplier's rows.
   *
   * The caveats under an item are rendered by the SERVER, in the language the
   * request asked for — that is what stops the same warning being worded three
   * different ways by the screen, the chat and the export. The consequence is
   * that rows already on screen are frozen in the language they arrived in:
   * switch to Hebrew with a supplier open and the page turned Hebrew around a
   * panel still explaining itself in English.
   *
   * The plan reloads on its own (its effect is keyed on the language). This is
   * the rows.
   */
  const rowsLanguage = useRef(language);
  useEffect(() => {
    if (rowsLanguage.current === language) return;
    rowsLanguage.current = language;
    if (open) void loadRows(open.supplier, open.page, open.search);
  }, [language, open, loadRows]);

  const suppliers = plan?.suppliers ?? [];
  const summary = plan?.summary ?? null;
  const excludedInfo = plan?.excluded ?? { items: 0, suppliers: [] };

  const setCount = suppliers.filter(sp => sp.leadTimeSource === 'supplier').length;

  if (loading) return <ProcurementSkeleton />;
  if (error) {
    // The server's message is English and this page is bilingual, so the raw
    // text goes to the console and the reader gets their own language.
    console.error('[procurement]', error);
    return <div className={styles.page}><div className={styles.errorBox}>{t('purchasing.loadFailed')}</div></div>;
  }

  const openEdit = (sp: PlanSupplier) => {
    setEditingSupplier(sp.supplier);
    setEditValue(sp.leadTimeSource === 'supplier' && sp.leadTimeDays !== null
      ? String(sp.leadTimeDays) : '');
    setSaveError(null);
  };

  const saveLeadTime = async (sp: PlanSupplier) => {
    const days = editValue.trim() === '' ? null : Number(editValue);
    if (days !== null && (!Number.isFinite(days) || days <= 0)) return;
    setEditingSupplier(null);
    setSaveError(null);
    try {
      await replenishmentService.saveSupplier(datasetId, sp.supplier, {
        leadTimeDays: days,
        supplierLabel: sp.supplier,
      }, baseURL);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
      return;
    }

    setLastRecalc({
      days: String(days ?? sp.leadTimeDays ?? ''),
      supplier: sp.supplier,
      items: sp.items,
    });

    // The save landed; now rebuild the plan it changed. The stream carries the
    // whole screen back — tiles, totals and every supplier row, including this
    // one's new delivery time — so there is nothing else to re-read.
    const fresh = await recalc.recalculate();
    if (fresh) setPlan(fresh);
    // The rows on screen were computed with the OLD delivery time; their send-by
    // dates have just moved.
    if (open) void loadRows(open.supplier, open.page, open.search);
  };

  const pages = open ? Math.max(1, Math.ceil(open.total / PAGE_SIZE)) : 1;
  const pg = open ? Math.min(open.page, pages - 1) : 0;

  const toggleSupplier = (name: string) => {
    setOpenWhy(null);
    if (open?.supplier === name) { setOpen(null); return; }
    void loadRows(name, 0, '');
  };

  return (
    <div className={styles.page} dir={he ? 'rtl' : 'ltr'}>
      {/* -- header ------------------------------------------------------- */}
      <div className={styles.head}>
        <div className={styles.headMark}>
          <span className={styles.headIcon}><AppGlyph icon="procurement" size={19} /></span>
          <span className={styles.headTitle}>{t('procurement.title')}</span>
        </div>
        <span className={styles.tabOn}>{t('procurement.tab.purchase')}</span>
        <span className={styles.tabLater}>
          {t('procurement.tab.warehouse')}
          <span className={styles.laterPill}>{t('procurement.later')}</span>
        </span>
        <span className={styles.tabLater}>
          {t('procurement.tab.branches')}
          <span className={styles.laterPill}>{t('procurement.later')}</span>
        </span>
      </div>

      {/* -- status band -------------------------------------------------- */}
      <div className={styles.band}>
        <span className={`${styles.attention} ${(summary?.orderNow ?? 0) === 0 ? styles.attentionOk : ''}`}>
          <span className={styles.dot} />
          {(summary?.orderNow ?? 0) > 0 ? t('procurement.attention') : t('procurement.allClear')}
        </span>
        <div className={styles.stats}>
          <div>
            <div className={`${styles.statN} ${styles.statAlarm}`}>{nf(summary?.orderNow)}</div>
            <div className={styles.statLabel}>{t('procurement.stat.orderNow')}</div>
          </div>
          <div>
            <div className={styles.statN}>{money(summary?.estimatedTotalExVat ?? 0, locale)}</div>
            <div className={styles.statLabel}>{t('procurement.stat.value')}</div>
          </div>
          <div>
            <div className={styles.statN}>{nf(plan?.supplierCount ?? 0)}</div>
            <div className={styles.statLabel}>{t('procurement.stat.suppliers')}</div>
          </div>
          <div>
            <div className={`${styles.statN} ${styles.statWarn}`}>{nf(summary?.dueSoon)}</div>
            <div className={styles.statLabel}>{t('procurement.stat.dueSoon')}</div>
          </div>
        </div>
        {/* Fetched on demand. The page holds ten rows; the export is the
            whole list, which is what a buyer taking this into a purchase order
            wants — and which is exactly why it is not kept in memory. */}
        <button
          type="button"
          className={styles.csvBtn}
          disabled={exporting}
          onClick={() => {
            setExporting(true);
            setExportFailed(false);
            replenishmentService.recommendations(datasetId, { onlyDue: true, lang: language }, baseURL)
              .then(r => downloadCsv(r.recommendations, datasetId))
              .catch(() => setExportFailed(true))
              .finally(() => setExporting(false));
          }}
        >
          {exporting ? t('procurement.preparing') : t('procurement.downloadCsv')}
        </button>
      </div>

      {/* -- recalculation ------------------------------------------------ */}
      {recalc.running && (
        <div className={styles.recalc}>
          <div className={styles.recalcHead}>
            <span className={styles.recalcKicker}>{t('procurement.recalcKicker')}</span>
            <span className={styles.recalcPct}>{recalc.pct}%</span>
          </div>
          <div className={styles.bar}><div className={styles.barFill} style={{ width: `${recalc.pct}%` }} /></div>
          {/* One quarter of the bar each, so the steps light up in turn as it
              fills. The bar is paced for reading but can never run ahead of the
              engine (see useRecalcStream), so a step marked done is a step the
              work has actually passed. */}
          <div className={styles.steps}>
            {[1, 2, 3, 4].map(n => (
              <Step
                key={n}
                n={n}
                state={recalc.pct >= n * 25 ? 'done' : recalc.pct >= (n - 1) * 25 ? 'active' : 'todo'}
                title={t(`procurement.step${n}`)}
                sub={n === 1 && recalc.total
                  ? t('procurement.step1subN').replace('{n}', nf(recalc.total))
                  : t(`procurement.step${n}sub`)}
              />
            ))}
          </div>
        </div>
      )}

      {recalc.finished && !recalc.running && lastRecalc && (
        <div className={styles.doneBanner}>
          ✓ {t('procurement.recalcDone')
            .replace('{days}', lastRecalc.days)
            .replace('{supplier}', lastRecalc.supplier)
            .replace('{n}', nf(lastRecalc.items))}
        </div>
      )}
      {(recalc.error || saveError) && (
        <div className={styles.errorBox}>{t('procurement.recalcFailed')}</div>
      )}
      {exportFailed && <div className={styles.errorBox}>{t('procurement.exportFailed')}</div>}

      {/* -- the delivery-time notice ------------------------------------- */}
      <div className={styles.notice}>
        {t('procurement.leadNotice')
          .replace('{set}', nf(setCount))
          .replace('{total}', nf(suppliers.length))}
        {excludedInfo.items > 0 && (
          <> {t('purchasing.excludedNote')
            .replace('{n}', nf(excludedInfo.items))
            .replace('{suppliers}', excludedInfo.suppliers.join(', '))}</>
        )}
      </div>

      {/* -- suppliers ---------------------------------------------------- */}
      <div className={styles.suppliers}>
        {suppliers.length === 0 && <div className={styles.muted}>{t('purchasing.nothingToOrder')}</div>}

        {suppliers.map(sp => {
          const isOpen = open?.supplier === sp.supplier;
          const editing = editingSupplier === sp.supplier;
          const isSet = sp.leadTimeSource === 'supplier';
          return (
            <div key={sp.supplier} className={styles.group}>
              {/* The row is a div with the disclosure laid over it; a button
                  inside a button is invalid, and the Edit control is real. */}
              <div className={styles.supRow}>
                <button
                  type="button"
                  className={styles.supToggle}
                  onClick={() => toggleSupplier(sp.supplier)}
                  aria-expanded={isOpen}
                  aria-label={`${sp.supplier} — ${t(isOpen ? 'purchasing.collapse' : 'purchasing.expand')}`}
                />
                <span className={styles.chev} aria-hidden="true">{isOpen ? '▼' : '▶'}</span>
                <span className={styles.supName}>
                  {/* The server COALESCEs a missing supplier to this literal so
                      the rows are never dropped; it is a bucket, not a company,
                      and it should read as one in either language. */}
                  <bdi>{sp.supplier === UNATTRIBUTED ? t('procurement.unattributed') : sp.supplier}</bdi>
                </span>

                <span className={`${styles.lead} ${styles.interactive}`}>
                  {editing ? (
                    <>
                      <input
                        className={styles.leadInput}
                        value={editValue}
                        inputMode="numeric"
                        autoFocus
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') void saveLeadTime(sp);
                          if (e.key === 'Escape') setEditingSupplier(null);
                        }}
                        aria-label={t('purchasing.modal.label')}
                      />
                      <span className={styles.statLabel}>{t('procurement.days')}</span>
                      <button type="button" className={`${styles.linkBtn} ${styles.linkStrong}`}
                        onClick={() => void saveLeadTime(sp)}>
                        {t('procurement.saveRecalc')}
                      </button>
                      <button type="button" className={`${styles.linkBtn} ${styles.linkMuted}`}
                        onClick={() => setEditingSupplier(null)}>
                        {t('purchasing.cancel')}
                      </button>
                    </>
                  ) : (
                    <>
                      <span className={styles.leadDays}>
                        {t('purchasing.days').replace('{n}', String(sp.leadTimeDays ?? '—'))}
                      </span>
                      <span className={isSet ? styles.chipSet : styles.chipDefault}>
                        {isSet ? t('purchasing.youSetThis') : t('procurement.defaultSetIt')}
                      </span>
                      <button type="button" className={styles.linkBtn} onClick={() => openEdit(sp)}>
                        {t('purchasing.edit')}
                      </button>
                    </>
                  )}
                </span>

                <span className={styles.supCount}>
                  {t('purchasing.items').replace('{n}', nf(sp.items))}
                </span>
                <span className={styles.supTotal}>≈ ₪{nf(sp.estimatedTotalExVat)}</span>
              </div>

              {isOpen && (
                <div className={styles.child}>
                  <div className={styles.childTools}>
                    <input
                      className={styles.search}
                      type="search"
                      value={open?.search ?? ''}
                      placeholder={t('procurement.searchPlaceholder')}
                      onChange={e => void loadRows(sp.supplier, 0, e.target.value)}
                    />
                    {/* Always present, so nothing is ever silently truncated. */}
                    <span className={styles.shown}>
                      {open && open.total > 0
                        ? t('procurement.showing')
                          .replace('{from}', nf(pg * PAGE_SIZE + 1))
                          .replace('{to}', nf(Math.min(open.total, (pg + 1) * PAGE_SIZE)))
                          .replace('{total}', nf(open.total))
                        : open?.loading ? '…' : t('purchasing.noMatches')}
                    </span>
                    {open && open.total > PAGE_SIZE && (
                      <span className={styles.pager}>
                        <button type="button" className={styles.pagerBtn} disabled={pg === 0}
                          onClick={() => void loadRows(sp.supplier, pg - 1, open.search)}
                          aria-label={t('purchasing.prev')}>←</button>
                        <span className={styles.shown}>
                          {t('procurement.pageXofY').replace('{x}', String(pg + 1)).replace('{y}', nf(pages))}
                        </span>
                        <button type="button" className={styles.pagerBtn} disabled={pg >= pages - 1}
                          onClick={() => void loadRows(sp.supplier, pg + 1, open.search)}
                          aria-label={t('purchasing.next')}>→</button>
                      </span>
                    )}
                  </div>

                  <div className={styles.table}>
                    <div className={styles.thead}>
                      <div>{t('procurement.col.item')}</div>
                      <div>{t('procurement.col.status')}</div>
                      <div>{t('procurement.col.order')}</div>
                      <div>{t('procurement.col.cost')}</div>
                      <div>{t('procurement.col.sendBy')}</div>
                      <div />
                    </div>
                    {open?.loading && open.rows.length === 0 && (
                      <div className={styles.emptyRows}>
                        <Skeleton width="100%" height={44} radius={0} />
                        <Skeleton width="100%" height={44} radius={0} />
                        <Skeleton width="100%" height={44} radius={0} />
                      </div>
                    )}
                    {(open?.rows ?? []).map(r => (
                      <ItemRow
                        key={r.sku}
                        rec={r}
                        leadSetByUser={isSet}
                        open={openWhy === r.sku}
                        onToggle={() => setOpenWhy(openWhy === r.sku ? null : r.sku)}
                        t={t}
                        nf={nf}
                        language={he ? 'he' : 'en'}
                        onAsk={onAskInChat}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The page's own shape while it loads.
 *
 * Built from the real layout - the header row, the status band with its four
 * figures, the notice, and a stack of supplier rows - so the page does not jump
 * when the data lands. A centred spinner would be less work and would tell the
 * reader nothing about what is arriving; the word "Loading" tells them even
 * less.
 */
function ProcurementSkeleton() {
  return (
    <div className={styles.page} aria-busy="true">
      <div className={styles.head}>
        <div className={styles.headMark}>
          <Skeleton width={34} height={34} radius={10} />
          <Skeleton width={120} height={17} radius={6} />
        </div>
        <Skeleton width={96} height={34} radius={99} />
        <Skeleton width={130} height={34} radius={99} />
        <Skeleton width={120} height={34} radius={99} />
      </div>

      <div className={styles.band}>
        <Skeleton width={150} height={32} radius={99} />
        <div className={styles.stats}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={styles.skelStat}>
              <Skeleton width={70} height={17} radius={5} />
              <Skeleton width={54} height={10} radius={4} />
            </div>
          ))}
        </div>
        <span className={styles.skelCsv}><Skeleton width={190} height={40} radius={11} /></span>
      </div>

      <Skeleton width="100%" height={44} radius={14} />

      <div className={styles.suppliers} style={{ marginTop: 14 }}>
        {[0, 1, 2, 3, 4].map(i => (
          <Skeleton key={i} width="100%" height={54} radius={16} />
        ))}
      </div>
    </div>
  );
}

/* -- one step in the recalculation panel ---------------------------------- */

function Step({ n, state, title, sub }: {
  n: number;
  state: 'todo' | 'active' | 'done';
  title: string;
  sub: string;
}) {
  const mark = state === 'done' ? '✓' : state === 'active' ? '●' : String(n);
  const bg = state === 'done' ? '#169e4d' : state === 'active' ? '#7c3aed' : '#e8e9f2';
  const fg = state === 'todo' ? '#8a90a3' : '#ffffff';
  return (
    <div className={styles.step} style={{ opacity: state === 'todo' ? 0.55 : 1 }}>
      <span className={styles.stepMark} style={{ background: bg, color: fg }}>{mark}</span>
      <span>
        <span className={styles.stepTitle} style={{ display: 'block' }}>{title}</span>
        <span className={styles.stepSub} style={{ display: 'block' }}>{sub}</span>
      </span>
    </div>
  );
}

/**
 * The question the chat is asked about one row.
 *
 * Grounded in the figures on screen rather than a bare "tell me about this
 * item": the agent has the replenishment tool and can look the SKU up itself,
 * and quoting the numbers the buyer is looking at means the answer either
 * agrees with the screen or explains why it does not — which is the useful
 * outcome either way.
 *
 * Composed at click time, so it is in whatever language the page is in.
 */
function chatQuestion(rec: Recommendation, t: (k: string) => string, nf: (n: number | null | undefined, d?: number) => string) {
  return t('procurement.askTemplate')
    .replace('{name}', rec.itemName ?? rec.sku)
    // The key the replenishment tool accepts. Different from the code on the
    // row - see the note beside the template.
    .replace('{sku}', rec.sku)
    .replace('{code}', rec.itemNumber ?? rec.sku)
    .replace('{supplier}', rec.supplier ?? '')
    .replace('{qty}', nf(rec.orderQty))
    .replace('{date}', rec.orderByDate ?? '')
    .replace('{cost}', nf(rec.estimatedCostExVat));
}

/* -- one item, and its working ------------------------------------------- */

function ItemRow({ rec, leadSetByUser, open, onToggle, t, nf, language, onAsk }: {
  rec: Recommendation;
  leadSetByUser: boolean;
  open: boolean;
  onToggle: () => void;
  t: (k: string) => string;
  /** The page's own formatter, so every number on screen groups the same way. */
  nf: (n: number | null | undefined, digits?: number) => string;
  language: 'en' | 'he';
  onAsk?: (question: string) => void;
}) {
  const late = rec.daysLate ?? 0;
  const pillClass = late > 60 ? styles.pillLate : late > 0 ? styles.pillDue : styles.pillOk;
  const cartons = rec.unitsPerCarton && rec.unitsPerCarton > 0
    ? Math.round(rec.orderQty / rec.unitsPerCarton) : null;

  return (
    <div className={styles.itemWrap}>
      <button
        type="button"
        className={`${styles.trow} ${open ? styles.trowOpen : ''}`}
        onClick={onToggle}
        aria-expanded={open}
      >
        <span style={{ minWidth: 0 }}>
          {/* <bdi>, not dir="auto" on the cell.
              dir="auto" makes the ELEMENT right-to-left when its text is
              Hebrew, so `text-align: start` inside it resolves to the right —
              and on an English page the name floated to the far edge of the
              column while the code under it stayed left, with a hand's width of
              nothing between them. <bdi> isolates the text for correct bidi
              rendering without touching the block's direction, so the name and
              the code line up under the ITEM heading in either language. */}
          <span className={styles.itemName} style={{ display: 'block' }}>
            <bdi>{rec.itemName ?? rec.sku}</bdi>
          </span>
          <span className={styles.itemCode} style={{ display: 'block' }}>{rec.itemNumber ?? rec.sku}</span>
        </span>
        <span>
          <span className={`${styles.pill} ${pillClass}`}>
            {late > 0
              ? t('procurement.daysLate').replace('{n}', String(late))
              : t('procurement.dueSoonPill')}
          </span>
        </span>
        <span>
          <span className={styles.qtyMain} style={{ display: 'block' }}>
            {t('procurement.units').replace('{n}', nf(rec.orderQty))}
          </span>
          {cartons !== null && (
            <span className={styles.qtySub} style={{ display: 'block' }}>
              {t('procurement.cartons')
                .replace('{n}', nf(cartons))
                .replace('{size}', nf(rec.unitsPerCarton))}
            </span>
          )}
        </span>
        <span className={styles.cell}>≈ ₪{nf(rec.estimatedCostExVat)}</span>
        {/* Real month names and word order in Hebrew, rather than an ISO
            string that RTL renders back to front. */}
        <span className={styles.cell}>
          {rec.orderByDate ? formatDateOnly(rec.orderByDate, language) : '—'}
        </span>
        <span className={styles.whyCell}>{open ? t('procurement.hide') : t('procurement.why')}</span>
      </button>

      {open && (
        <div className={styles.why}>
          <div className={styles.facts}>
            <Fact label={t('procurement.f.pace')} value={nf(rec.velocityDaily, 2)}
              // The engine's own description of how it measured the pace -
              // never a claim about weighting or seasonality it does not do.
              sub={rec.velocityBasis} />
            <Fact label={t('procurement.f.inStock')} value={nf(rec.warehouseQty)} sub={t('procurement.f.warehouse')} />
            <Fact label={t('procurement.f.onWay')} value={nf(rec.onOrderQty)}
              sub={rec.onOrderIsUnverified && rec.onOrderQty > 0
                ? t('procurement.f.onWayUnverified') : t('procurement.f.openOrders')} />
            <Fact label={t('procurement.f.reserved')} value={nf(rec.committedQty)} sub={t('procurement.f.customerOrders')} />
            <Fact
              label={t('procurement.f.delivery')}
              value={t('purchasing.days').replace('{n}', String(rec.leadTimeDays))}
              sub={leadSetByUser ? t('procurement.f.setByYou') : t('procurement.f.assumedDefault')}
              subClass={leadSetByUser ? styles.factSubSet : styles.factSubDefault}
            />
            <Fact label={t('procurement.f.buffer')} value={nf(rec.safetyStock)}
              sub={rec.safetyStockSource === 'configured'
                ? t('procurement.f.bufferSet') : t('procurement.f.bufferComputed')} />
          </div>

          {/* The derivation, from the engine's own intermediate values rather
              than re-computed here - so it cannot drift from the number above. */}
          <p className={styles.para}>
            {/* Two shapes, because "order 688, no rounding applied -> 688
                units" is a clause that should not be there. The code says which
                case this is; the prose is the server's either way. */}
            {(rec.orderQtyRoundingCode === 'none'
              ? t('procurement.derivationPlain')
              : t('procurement.derivation').replace('{rounding}', rec.orderQtyRounding))
              .replace('{target}', nf(rec.targetStock))
              .replace('{available}', nf(rec.netAvailable))
              .replace('{raw}', nf(rec.rawQty))
              .replace('{final}', nf(rec.orderQty))}
          </p>

          {/* Quoted, never re-worded: these are the engine's caveats and the
              screen is not entitled to soften them. */}
          {rec.notes.length > 0 && (
            <ul className={styles.reasons}>
              {rec.notes.map((note, i) => <li key={i}>{note}</li>)}
            </ul>
          )}

          {/* At the END of the explanation, which is where the next question
              actually forms: the buyer has read what the number is built on and
              now wants to argue with it. */}
          {onAsk && (
            <div className={styles.askRow}>
              <button
                type="button"
                className={styles.askBtn}
                onClick={() => onAsk(chatQuestion(rec, t, nf))}
              >
                <span aria-hidden="true">✦</span>
                {t('procurement.askInChat')}
              </button>
              <span className={styles.askHint}>{t('procurement.askHint')}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Fact({ label, value, sub, subClass }: {
  label: string;
  value: string;
  sub: string;
  subClass?: string;
}) {
  return (
    <div>
      <div className={styles.factLabel}>{label}</div>
      <div className={styles.factValue}>{value}</div>
      <div className={`${styles.factSub} ${subClass ?? ''}`}>{sub}</div>
    </div>
  );
}

/**
 * CSV of every recommendation the page is holding, with its sources and
 * caveats - a buyer takes this into a purchase order, and a number without its
 * basis is not usable there.
 *
 * Deliberately not "what is on screen": the table pages and filters, and a
 * buyer who exports after paging to row 40 wants the list, not page 4 of it.
 */
function downloadCsv(recs: Recommendation[], datasetId: string) {
  const cols = [
    'supplier', 'sku', 'itemName', 'status', 'orderQty', 'estimatedCostExVat',
    'orderByDate', 'daysLate', 'daysOfCover', 'velocityDaily', 'velocityBasis',
    'warehouseQty', 'onOrderQty', 'onOrderIsUnverified', 'committedQty', 'netAvailable',
    'leadTimeDays', 'leadTimeSource', 'safetyStock', 'safetyStockSource',
    'unitsPerCarton', 'orderQtyRounding', 'dataThrough', 'notes',
  ];
  const esc = (v: unknown) => {
    const s = Array.isArray(v) ? v.join(' | ') : v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = recs.map(r => cols.map(c => esc((r as unknown as Record<string, unknown>)[c])).join(',')).join('\n');
  // A BOM so Excel opens the Hebrew item names correctly instead of mojibake.
  const blob = new Blob(['﻿' + cols.join(',') + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${datasetId}-procurement-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
