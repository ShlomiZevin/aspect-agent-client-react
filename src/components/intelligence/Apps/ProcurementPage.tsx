import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './ProcurementPage.module.css';
import { AppGlyph } from './AppIcon';
import { useRecalcStream } from './useRecalcStream';
import { useJobs } from '../jobs/JobsContext';
import { useLanguage } from '../../../context/LanguageContext';
import { replenishmentService } from '../../../services/replenishmentService';
import { getAgentConfig } from '../../../agents/agentRegistry';
import type { ModuleScope } from '../../../services/chatService';
import { formatDateOnly } from '../dateFormat';
import { Skeleton } from '../Insights/Skeleton';
import { PROCUREMENT_GROUPS } from '../../../types/replenishment';
import type { Recommendation, PlanResponse, PlanSupplier, ProcurementGroup } from '../../../types/replenishment';

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
  /**
   * Open the REAL chat widget on a module-scoped conversation (Smart Tune).
   * Provided by the shell; the button hides without it, the same way the
   * whole group bar hides without groupSummary.
   */
  onOpenScopedChat?: (scope: ModuleScope) => void;
}

/** How many item rows one supplier shows at a time. The mockup's number. */
const PAGE_SIZE = 10;

/**
 * The "discuss this row in Data Chat" button, switched off for now.
 *
 * Built and working — it opens the chat and sends a question carrying both the
 * SKU the replenishment tool keys on and the item code the buyer reads, which
 * is what makes the answer agree with the screen. Held back from the first
 * release rather than deleted: everything behind this flag is exercised by the
 * page's own code paths, so turning it on is one word, not a rebuild.
 */
const SHOW_ASK_IN_CHAT = false;

/** The server coalesces a missing supplier to this, and the page groups on it. */
const UNATTRIBUTED = '(unattributed)';

/** The chip the page opens on — the buyer's working set. */
const DEFAULT_GROUP: ProcurementGroup = 'order_now';

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
export function ProcurementPage({ datasetId, baseURL, onAskInChat, onOpenScopedChat }: Props) {
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

  // ── Procurement Groups ──
  const [activeGroup, setActiveGroup] = useState<ProcurementGroup>(DEFAULT_GROUP);
  // The group-filtered ask failed but the plain plan works — a server mid-way
  // through the migration. The page then runs exactly as it did before groups.
  const [groupsBroken, setGroupsBroken] = useState(false);
  // sku → the group the buyer moved it to in THIS session. Drives the row's
  // "moved to … · Undo" state without refetching the page out from under them.
  const [movedMap, setMovedMap] = useState<Record<string, ProcurementGroup>>({});
  const [verdictError, setVerdictError] = useState(false);
  // Which row's "Move to…" menu is open — one at a time, page-wide.
  const [menuFor, setMenuFor] = useState<string | null>(null);

  // The buyer's row order. 'urgency' = soonest runout first (the default);
  // 'runout_desc' = the planning view they asked for — furthest-future
  // runouts first, already-run-out items last. Server-side, so it holds
  // across every page, not just the visible ten rows.
  const [sortMode, setSortMode] = useState<'urgency' | 'runout_desc'>('urgency');

  const loadedFor = useRef<string | null>(null);
  const locale = he ? 'he-IL' : 'en-GB';
  const nf = useCallback(
    (n: number | null | undefined, digits = 0) => fmt(n, locale, digits),
    [locale],
  );

  // Groups are ON only when the server answered with the chip counts — a
  // pre-migration server never sends groupSummary and the page renders
  // exactly as it always did.
  const groupsActive = !groupsBroken && Boolean(plan?.groupSummary);
  const groupLabel = useCallback((g: ProcurementGroup) => t(`procurement.groups.${g}`), [t]);

  const recalc = useRecalcStream(datasetId, baseURL, language, groupsActive ? activeGroup : undefined);
  // The Intelligence Center already has one way to say that something is taking
  // time: the header badges and the sidebar every report uses. An app must not
  // invent a second one, so this registers there like any other long job. The
  // panel on this page stays as the DETAIL for whoever is watching it; the
  // badge is what tells someone who navigated away that it is still running.
  const { startTask } = useJobs();

  const load = useCallback(async (group: ProcurementGroup | null) => {
    try {
      setPlan(await replenishmentService.plan(datasetId, language, baseURL, group ?? undefined));
      setError(null);
    } catch (e) {
      // The groups columns are DB-backed and land after a migration, so a
      // server can be mid-way: the group-filtered ask 4xx/5xxes while the
      // plain plan is fine. Fall back to the base screen without groups
      // rather than breaking the page.
      if (group) {
        try {
          setPlan(await replenishmentService.plan(datasetId, language, baseURL));
          setGroupsBroken(true);
          setError(null);
          return;
        } catch { /* the base plan is broken too — report that */ }
      }
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
    void load(groupsBroken ? null : activeGroup);
  }, [datasetId, language, load, groupsBroken, activeGroup]);

  /**
   * Fetch one page of one supplier's items.
   *
   * Server-side paging and search, not client-side slicing: the rows for a
   * supplier with five thousand items are not something to hold in a browser to
   * show ten of them. The summary above is unaffected — it is computed over
   * every row on the server, so searching never changes the tiles.
   */
  const loadRows = useCallback(async (supplier: string, page: number, search: string, sortOverride?: 'urgency' | 'runout_desc') => {
    const sort = sortOverride ?? sortMode;
    setOpen(o => ({ supplier, page, search, rows: o?.supplier === supplier ? o.rows : [], total: o?.supplier === supplier ? o.total : 0, loading: true }));
    try {
      const r = await replenishmentService.recommendations(datasetId, {
        supplier, onlyDue: true, limit: PAGE_SIZE, offset: page * PAGE_SIZE,
        search: search || undefined, lang: language,
        // The rows follow the active chip — the same filter the plan above used.
        group: groupsActive ? activeGroup : undefined,
        sort: sort === 'runout_desc' ? 'runout_desc' : undefined,
      }, baseURL);
      setOpen(o => (o && o.supplier === supplier && o.page === page && o.search === search
        ? { ...o, rows: r.recommendations, total: r.total, loading: false }
        : o));
    } catch {
      // The accordion row stays open and empty rather than the page erroring:
      // the rest of the screen is still correct and still useful.
      setOpen(o => (o && o.supplier === supplier ? { ...o, rows: [], loading: false } : o));
    }
  }, [datasetId, baseURL, language, groupsActive, activeGroup, sortMode]);

  // Closing the page mid-recalculation must not leave a stream open.
  useEffect(() => recalc.stop, [recalc.stop]);

  // One "Move to…" menu at a time, and any click elsewhere closes it. The
  // toggle itself stops propagation so opening is not instantly undone.
  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuFor]);

  // Smart Tune executed (or reverted) a bulk move inside the chat widget —
  // the chips and the open supplier's rows just went stale. The action card
  // posts from the widget's iframe; this page listens. Same-origin only.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as { type?: string; module?: string; datasetId?: string } | null;
      if (!d || d.type !== 'aspect:module-action' || d.module !== 'replenishment' || d.datasetId !== datasetId) return;
      void load(groupsActive ? activeGroup : null);
      setOpen(o => {
        if (o) void loadRows(o.supplier, o.page, o.search);
        return o;
      });
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [datasetId, load, loadRows, groupsActive, activeGroup]);

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

  if (loading) return <ProcurementSkeleton />;
  if (error) {
    // The server's message is English and this page is bilingual, so the raw
    // text goes to the console and the reader gets their own language.
    console.error('[procurement]', error);
    return <div className={styles.page}><div className={styles.errorBox}>{t('purchasing.loadFailed')}</div></div>;
  }

  const openEdit = (sp: PlanSupplier) => {
    setEditingSupplier(sp.supplier);
    // The EFFECTIVE days, default included — the buyer edits the number they
    // are looking at, not an empty box they must remember it into.
    setEditValue(sp.leadTimeDays !== null ? String(sp.leadTimeDays) : '');
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
    //
    // One run, two audiences: the job badge follows it for anyone who leaves
    // the page, and this promise resolves for the rows in front of us. The
    // badge's percentage is the panel's own, passed straight through, so the
    // two can never disagree about the same work.
    const fresh = await new Promise<Awaited<ReturnType<typeof recalc.recalculate>>>(resolve => {
      startTask(
        datasetId,
        t('procurement.jobLabel').replace('{supplier}', sp.supplier),
        async (report) => {
          const result = await recalc.recalculate(report);
          resolve(result);
          // Rejecting is what turns the badge red; the page shows its own
          // error separately.
          if (!result) throw new Error('recalculation failed');
        },
      );
    });
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

  /** Refetch the plan under the current chip — how the chip counts refresh. */
  const refreshPlan = () => void load(groupsActive ? activeGroup : null);

  const switchGroup = (g: ProcurementGroup) => {
    if (g === activeGroup) return;
    setActiveGroup(g);
    // The accordion's context just changed groups — the open supplier's rows
    // (and the session's moved-state) belong to the old one.
    setOpen(null);
    setOpenWhy(null);
    setMenuFor(null);
    setMovedMap({});
    void load(g);
  };

  /**
   * The buyer's verdict on one item — Move to…, Reject, or Undo (null clears
   * the verdict and the item follows the suggestion again). Optimistic: the
   * row flips to its moved state at once and flips back if the save fails;
   * the chips refresh from the server either way, never by client arithmetic.
   */
  const applyVerdict = async (rec: Recommendation, group: ProcurementGroup | null) => {
    setVerdictError(false);
    setMenuFor(null);
    const before = movedMap;
    setMovedMap(m => {
      const next = { ...m };
      if (group === null) delete next[rec.sku];
      else next[rec.sku] = group;
      return next;
    });
    try {
      await replenishmentService.saveVerdict(datasetId, rec.sku, {
        group,
        // What the screen showed when the buyer decided — recorded so a later
        // recompute that disagrees flags for review instead of silently winning.
        suggestedGroup: rec.suggestedGroup ?? null,
      }, baseURL);
      refreshPlan();
    } catch (e) {
      console.error('[procurement] verdict save failed:', e);
      setMovedMap(before);
      setVerdictError(true);
    }
  };

  const activeGroupInfo = plan?.groupSummary?.[activeGroup];

  return (
    <div className={styles.page} dir={he ? 'rtl' : 'ltr'}>
      {/* -- header ------------------------------------------------------- */}
      {/* The updated design's title row: the state pill sits beside the name
          and the export lives up here, not in a band of its own. */}
      <div className={styles.head}>
        <div className={styles.headMark}>
          <span className={styles.headIcon}><AppGlyph icon="procurement" size={19} /></span>
          <span className={styles.headTitle}>{t('procurement.title')}</span>
        </div>
        <span className={`${styles.attention} ${(summary?.orderNow ?? 0) === 0 ? styles.attentionOk : ''}`}>
          <span className={styles.dot} />
          {(summary?.orderNow ?? 0) > 0 ? t('procurement.attention') : t('procurement.allClear')}
        </span>
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
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 4v11M7 10l5 5 5-5M4 19h16" />
          </svg>
          {exporting ? t('procurement.preparing') : t('procurement.downloadCsv')}
        </button>
      </div>

      {/* Underlined section tabs — the later sections are announced, not
          disabled controls: a span, because there is nothing to press. */}
      <div className={styles.tabs}>
        <span className={`${styles.tab} ${styles.tabActive}`}>
          <TabGlyph kind="purchase" />
          {t('procurement.tab.purchase')}
        </span>
        <span className={styles.tab}>
          <TabGlyph kind="warehouse" />
          {t('procurement.tab.warehouse')}
          <span className={styles.laterPill}>{t('procurement.later')}</span>
        </span>
        <span className={styles.tab}>
          <TabGlyph kind="branches" />
          {t('procurement.tab.branches')}
          <span className={styles.laterPill}>{t('procurement.later')}</span>
        </span>
      </div>

      {/* -- group bar ----------------------------------------------------- */}
      {/* Only when the server sent chip counts. Counts are over the WHOLE due
          set, so a chip always says what is behind it regardless of which one
          is active. */}
      {groupsActive && (
        <div className={styles.groupBar}>
          <div className={styles.groupChips}>
            {PROCUREMENT_GROUPS.map(g => {
              const on = g === activeGroup;
              return (
                <button
                  key={g}
                  type="button"
                  className={`${styles.groupChip} ${on ? styles.groupChipOn : ''}`}
                  onClick={() => switchGroup(g)}
                  aria-pressed={on}
                >
                  {groupLabel(g)}
                  <span className={`${styles.groupCount} ${on ? styles.groupCountOn : ''}`}>
                    {nf(plan?.groupSummary?.[g]?.count ?? 0)}
                  </span>
                </button>
              );
            })}
          </div>
          <span className={styles.groupSummaryText}>
            {t('procurement.groups.summary')
              .replace('{group}', groupLabel(activeGroup))
              .replace('{value}', money(activeGroupInfo?.estimatedCostExVat ?? 0, locale))
              .replace('{n}', nf(plan?.supplierCount ?? 0))}
          </span>
          {onOpenScopedChat && (
          <button
            type="button"
            className={styles.tuneBtn}
            // Opens the REAL chat widget on a conversation scoped to this
            // module + the active group — the same chat, extended, never a
            // second chat implementation. The bilingual title matches the
            // scope's own declaration in the module descriptor; the label
            // says which concrete set the conversation is about.
            onClick={() => onOpenScopedChat({
              moduleId: 'replenishment',
              scopeId: 'tune',
              context: { group: activeGroup, datasetId },
              title: { en: 'Smart Tune', he: 'כוונון חכם' },
              contextLabel: `${groupLabel(activeGroup)} · ${nf(activeGroupInfo?.count ?? 0)}`,
              // The empty conversation opens with THIS instead of the agent's
              // generic welcome — composed here because this page knows the
              // counts and the user's current language.
              welcome: {
                intro: t('procurement.tune.intro')
                  .replace('{brand}', getAgentConfig(datasetId)?.displayName ?? datasetId)
                  .replace('{group}', groupLabel(activeGroup))
                  .replace('{n}', nf(activeGroupInfo?.count ?? 0))
                  .replace('{m}', nf(plan?.supplierCount ?? 0)),
                hints: [t('procurement.tune.chip1'), t('procurement.tune.chip2'), t('procurement.tune.chip3')],
              },
            })}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" opacity="0.45" />
              <circle cx="14" cy="6" r="2.6" fill="currentColor" stroke="none" />
              <circle cx="8" cy="12" r="2.6" fill="currentColor" stroke="none" />
              <circle cx="17" cy="18" r="2.6" fill="currentColor" stroke="none" />
            </svg>
            {t('procurement.tune.button')}
          </button>
          )}
        </div>
      )}

      {/* -- status band — the pre-groups fallback only ------------------- */}
      {/* With the chips on, the band's figures live in the chip counts and
          the summary text beside them; without them (a server mid-migration)
          the four tiles are still the only place these numbers appear. */}
      {!groupsActive && (
        <div className={styles.band}>
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
        </div>
      )}

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
      {verdictError && <div className={styles.errorBox}>{t('procurement.groups.moveFailed')}</div>}

      {/* Excluded suppliers are still disclosed — that is a data-honesty
          line, not decoration. The general delivery-time sentence is gone
          per the updated design; the per-supplier "default — set it" chips
          carry that story now. */}
      {excludedInfo.items > 0 && (
        <div className={styles.notice}>
          {t('purchasing.excludedNote')
            .replace('{n}', nf(excludedInfo.items))
            .replace('{suppliers}', excludedInfo.suppliers.join(', '))}
        </div>
      )}

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
                      <button type="button" className={styles.saveBtn}
                        onClick={() => void saveLeadTime(sp)}>
                        {t('procurement.saveRecalc')}
                      </button>
                      <button type="button" className={styles.cancelEditBtn}
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
                    {/* The buyer's ordering — server-side, holds across pages. */}
                    <label className={styles.sortWrap}>
                      <span className={styles.sortLabel}>{t('procurement.sortLabel')}</span>
                      <select
                        className={styles.sortSelect}
                        value={sortMode}
                        onChange={e => {
                          const v = e.target.value as 'urgency' | 'runout_desc';
                          setSortMode(v);
                          void loadRows(sp.supplier, 0, open?.search ?? '', v);
                        }}
                      >
                        <option value="urgency">{t('procurement.sort.urgency')}</option>
                        <option value="runout_desc">{t('procurement.sort.future')}</option>
                      </select>
                    </label>
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
                    <div className={`${styles.thead} ${groupsActive ? styles.rowGrouped : ''}`}>
                      <div>{t('procurement.col.item')}</div>
                      <div>{t('procurement.col.runsOut')}</div>
                      <div>{t('procurement.col.order')}</div>
                      <div>{t('procurement.col.cost')}</div>
                      <div>{t('procurement.col.placeOrder')}</div>
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
                        groupsActive={groupsActive}
                        activeGroup={activeGroup}
                        movedTo={movedMap[r.sku]}
                        groupLabel={groupLabel}
                        menuOpen={menuFor === r.sku}
                        onMenuToggle={() => setMenuFor(menuFor === r.sku ? null : r.sku)}
                        onVerdict={g => void applyVerdict(r, g)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Smart Tune lives in the REAL chat now: the button above opens the
          shell's chat widget on a module-scoped conversation, and executed
          moves come back to this page via the aspect:module-action message
          listener — no second chat implementation on this page. */}
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
          <Skeleton width={130} height={19} radius={6} />
        </div>
        <Skeleton width={140} height={30} radius={99} />
        <span className={styles.skelCsv}><Skeleton width={200} height={40} radius={11} /></span>
      </div>

      <div className={styles.tabs} style={{ paddingBottom: 10 }}>
        <Skeleton width={92} height={20} radius={6} />
        <Skeleton width={120} height={20} radius={6} />
        <Skeleton width={110} height={20} radius={6} />
      </div>

      {/* The chip bar's footprint, so the page does not jump when it lands. */}
      <Skeleton width="100%" height={46} radius={12} />

      <div className={styles.suppliers} style={{ marginTop: 14 }}>
        {[0, 1, 2, 3, 4].map(i => (
          <Skeleton key={i} width="100%" height={54} radius={16} />
        ))}
      </div>
    </div>
  );
}

/* -- the section-tab icons ------------------------------------------------ */

function TabGlyph({ kind }: { kind: 'purchase' | 'warehouse' | 'branches' }) {
  const path = kind === 'purchase'
    // a cart
    ? 'M3 4h2l2.4 10.2a1.4 1.4 0 0 0 1.37 1.08h7.9a1.4 1.4 0 0 0 1.36-1.05L20 8H6.2M9.5 19.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm8.5 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z'
    // a warehouse roofline / a row of branch buildings
    : kind === 'warehouse'
      ? 'M3 9.5 12 4l9 5.5V20h-4v-6H7v6H3V9.5M7 20h10'
      : 'M3 20h18M5 20V8h6v12M13 20V4h6v16M8 11.5h.01M8 15h.01M16 8h.01M16 11.5h.01M16 15h.01';
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
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
  const bg = state === 'done' ? '#169e4d' : state === 'active' ? 'var(--ai-accent, #7c3aed)' : '#e8e9f2';
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

function ItemRow({
  rec, leadSetByUser, open, onToggle, t, nf, language, onAsk,
  groupsActive, activeGroup, movedTo, groupLabel, menuOpen, onMenuToggle, onVerdict,
}: {
  rec: Recommendation;
  leadSetByUser: boolean;
  open: boolean;
  onToggle: () => void;
  t: (k: string) => string;
  /** The page's own formatter, so every number on screen groups the same way. */
  nf: (n: number | null | undefined, digits?: number) => string;
  language: 'en' | 'he';
  onAsk?: (question: string) => void;
  groupsActive: boolean;
  activeGroup: ProcurementGroup;
  /** The group the buyer moved this row to in this session, if any. */
  movedTo?: ProcurementGroup;
  groupLabel: (g: ProcurementGroup) => string;
  menuOpen: boolean;
  onMenuToggle: () => void;
  /** null = Undo: clear the verdict, follow the suggestion again. */
  onVerdict: (group: ProcurementGroup | null) => void;
}) {
  const late = rec.daysLate ?? 0;
  const cartons = rec.unitsPerCarton && rec.unitsPerCarton > 0
    ? Math.round(rec.orderQty / rec.unitsPerCarton) : null;

  // The group this row is IN right now, as far as this screen knows: the
  // session's optimistic move wins over what the server sent.
  const rowGroup = movedTo ?? rec.group;
  // A row whose group differs from the chip it is listed under says so.
  const showBadge = groupsActive && rowGroup !== undefined && rowGroup !== activeGroup;

  return (
    <div className={styles.itemWrap}>
      {/* The row is a div with the disclosure laid over it, the same pattern
          as the supplier row above: Move to…/Reject are real buttons and a
          button cannot nest inside another one. */}
      <div className={`${styles.trow} ${groupsActive ? styles.rowGrouped : ''} ${open ? styles.trowOpen : ''}`}>
        <button
          type="button"
          className={styles.rowToggle}
          onClick={onToggle}
          aria-expanded={open}
          aria-label={`${rec.itemName ?? rec.sku} — ${t(open ? 'procurement.hide' : 'procurement.why')}`}
        />
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
            {showBadge && rowGroup && (
              <span className={styles.groupBadge}>{groupLabel(rowGroup)}</span>
            )}
            {/* A recompute moved the suggestion under a standing verdict —
                flagged for review, never silently reverted. */}
            {groupsActive && rec.suggestionChanged && rec.suggestedGroup && (
              <span
                className={styles.reviewDot}
                title={t('procurement.groups.reviewDot').replace('{group}', groupLabel(rec.suggestedGroup))}
              />
            )}
          </span>
          <span className={styles.itemCode} style={{ display: 'block' }}>{rec.itemNumber ?? rec.sku}</span>
        </span>
        {/* RUNS OUT — the client's asked-for picture: a projected runout
            date for living items, a plain red "Run out" for the dead ones.
            The lateness diagnosis moved to the Why panel. */}
        <span>
          {rec.alreadyOut || !rec.runoutDate ? (
            <span className={`${styles.pill} ${styles.pillLate}`}>{t('procurement.runOut')}</span>
          ) : (
            <>
              <span className={styles.qtyMain} style={{ display: 'block' }}>
                {formatDateOnly(rec.runoutDate, language)}
              </span>
              <span className={styles.qtySub} style={{ display: 'block' }}>
                {t('procurement.inDays').replace('{n}', String(Math.max(0,
                  Math.ceil((new Date(rec.runoutDate).getTime() - Date.now()) / 86400000))))}
              </span>
            </>
          )}
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
        {/* The INSTRUCTION date — today at the earliest, never a date in the
            past (the diagnosis date and its lateness live in the Why panel).
            Real month names and word order in Hebrew, rather than an ISO
            string that RTL renders back to front. */}
        <span className={styles.cell}>
          {rec.placeOrderBy
            ? (rec.placeOrderBy <= new Date().toISOString().slice(0, 10)
              ? <span className={styles.cellToday}>{t('procurement.today')}</span>
              : formatDateOnly(rec.placeOrderBy, language))
            : '—'}
        </span>

        {!groupsActive ? (
          <span className={styles.whyCell}>{open ? t('procurement.hide') : t('procurement.why')}</span>
        ) : movedTo ? (
          <span className={`${styles.actionsCell} ${styles.rowInteractive}`}>
            <span className={styles.movedText}>
              {t('procurement.groups.movedTo').replace('{group}', groupLabel(movedTo))}
            </span>
            <button type="button" className={styles.rowLink} onClick={() => onVerdict(null)}>
              {t('procurement.groups.undo')}
            </button>
            <button type="button" className={styles.rowLink} onClick={onToggle}>
              {open ? t('procurement.hide') : t('procurement.why')}
            </button>
          </span>
        ) : (
          <span className={`${styles.actionsCell} ${styles.rowInteractive}`}>
            <span className={styles.moveWrap}>
              <button
                type="button"
                className={styles.moveBtn}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={e => { e.stopPropagation(); onMenuToggle(); }}
              >
                {t('procurement.groups.moveTo')} <span aria-hidden="true">▾</span>
              </button>
              {menuOpen && (
                <span className={styles.moveMenu} role="menu">
                  {PROCUREMENT_GROUPS.map(g => (
                    <button
                      key={g}
                      type="button"
                      role="menuitem"
                      className={styles.moveMenuItem}
                      onClick={() => { if (g !== rowGroup) onVerdict(g); }}
                    >
                      <span className={styles.moveCheck} aria-hidden="true">{g === rowGroup ? '✓' : ''}</span>
                      {groupLabel(g)}
                    </button>
                  ))}
                </span>
              )}
            </span>
            {/* The shortcut for "this number smells wrong": park it in
                Needs checking. */}
            <button type="button" className={styles.rejectBtn} onClick={() => onVerdict('suspicious')}>
              {t('procurement.groups.reject')}
            </button>
            <button type="button" className={styles.rowLink} onClick={onToggle}>
              {open ? t('procurement.hide') : t('procurement.why')}
            </button>
          </span>
        )}
      </div>

      {open && (
        <div className={styles.why}>
          <div className={styles.facts}>
            <Fact label={t('procurement.f.pace')} value={nf(rec.velocityDaily, 2)}
              // The engine's own description of how it measured the pace -
              // never a claim about weighting or seasonality it does not do.
              sub={rec.velocityBasis} />
            {/* Stock honesty: false = the warehouse file does not carry this
                item, and the tile says so instead of asserting a zero it
                cannot verify. null = the signals view is not built yet —
                exactly the old behavior. */}
            {rec.stockTracked === false ? (
              <Fact
                label={t('procurement.f.inStock')}
                value="—"
                sub={t('procurement.groups.notInStockFile')}
                title={t('procurement.groups.notInStockTip')}
              />
            ) : (
              <Fact label={t('procurement.f.inStock')} value={nf(rec.warehouseQty)} sub={t('procurement.f.warehouse')} />
            )}
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
            {/* The forward-looking calendar — the client's "I see no picture"
                feedback: when stock dies, and whether ordering today still
                beats it. */}
            <Fact
              label={t('procurement.f.runsOut')}
              value={rec.runoutDate ? formatDateOnly(rec.runoutDate, language) : '—'}
              sub={rec.stockoutGapDays != null && rec.stockoutGapDays > 0
                ? t('procurement.f.gapDays').replace('{n}', nf(rec.stockoutGapDays))
                : t('procurement.f.noGap')}
              subClass={rec.stockoutGapDays ? styles.factSubDefault : styles.factSubSet}
            />
            <Fact
              label={t('procurement.f.arrives')}
              value={rec.arrivesIfOrderedToday ? formatDateOnly(rec.arrivesIfOrderedToday, language) : '—'}
              sub={t('procurement.f.ifOrderedToday')}
            />
            {/* The diagnosis the old STATUS pill carried — kept honest, in
                the panel where explanations live. */}
            <Fact
              label={t('procurement.f.ideal')}
              value={rec.orderByDate ? formatDateOnly(rec.orderByDate, language) : '—'}
              sub={late > 0 ? t('procurement.daysLate').replace('{n}', String(late)) : t('procurement.f.onTime')}
              subClass={late > 0 ? styles.factSubDefault : styles.factSubSet}
            />
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
          {SHOW_ASK_IN_CHAT && onAsk && (
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

function Fact({ label, value, sub, subClass, title }: {
  label: string;
  value: string;
  sub: string;
  subClass?: string;
  /** A hover explanation — the "not in stock file" tile carries one. */
  title?: string;
}) {
  return (
    <div title={title}>
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
    'placeOrderBy', 'runoutDate', 'arrivesIfOrderedToday', 'stockoutGapDays',
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
