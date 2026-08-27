import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { replenishmentService } from '../../../services/replenishmentService';
import type { Recommendation, SupplierRow, RecommendationSummary } from '../../../types/replenishment';
import styles from './PurchasingPage.module.css';

/**
 * The client's Purchasing situation page — what to order, how much, when.
 *
 * ONE ANATOMY, THREE TABS. Parent rows expand into child rows; every leaf
 * opens a "How we calculated this" panel. A user who learns one tab has
 * learned them all — which is why Warehouse and Branches are present from
 * day one even though only Purchasing carries live data.
 *
 * THE TRUST PANEL IS THE POINT. A buyer will not act on a number they cannot
 * check, and every figure here is an estimate built on a lead time somebody
 * typed. So each row shows its inputs, where each parameter came from, the
 * derivation in one sentence, and its caveats in words — all of which come
 * from the server's `notes[]` rather than being re-worded here, so the
 * screen, the chat and the report cannot say three slightly different things.
 *
 * Lives inside IntelligenceShell, which DOES provide a LanguageProvider — so
 * unlike the admin tab, useLanguage() is safe here. It must NOT call
 * useAgentContext(), which throws in this tree.
 */

interface Props {
  datasetId: string;
  baseURL?: string;
}

type Tab = 'purchasing' | 'warehouse' | 'branches';

const nf = (n: number | null | undefined, digits = 0) =>
  n === null || n === undefined ? '—' : Number(n).toLocaleString('en-GB', { maximumFractionDigits: digits });

/**
 * Sales pace needs more precision than a count does. Most of this catalogue
 * moves slowly — 4 units in 90 days is 0.044/day, which one decimal renders
 * as "0 / day" next to an order for 10 units. "It sells zero per day, order
 * ten" is not a sentence a buyer can trust, so small rates keep enough
 * digits to be a real number.
 */
const pace = (n: number) => {
  if (n === 0) return '0';
  if (n >= 10) return nf(n, 0);
  if (n >= 1) return nf(n, 1);
  return n.toLocaleString('en-GB', { maximumFractionDigits: 3, minimumFractionDigits: 2 });
};

export function PurchasingPage({ datasetId, baseURL }: Props) {
  const { t, language } = useLanguage();

  // Every hook above the early returns — adding one below changes the hook
  // count between renders, which React treats as fatal.
  const [tab, setTab] = useState<Tab>('purchasing');
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [summary, setSummary] = useState<RecommendationSummary | null>(null);
  const [dataThrough, setDataThrough] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openSupplier, setOpenSupplier] = useState<string | null>(null);
  const [openWhy, setOpenWhy] = useState<string | null>(null);
  const [editing, setEditing] = useState<SupplierRow | null>(null);
  const loadedFor = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([
        replenishmentService.suppliers(datasetId, baseURL),
        replenishmentService.recommendations(datasetId, {}, baseURL),
      ]);
      setSuppliers(s);
      setRecs(r.recommendations);
      setSummary(r.summary);
      setDataThrough(r.dataThrough);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [datasetId, baseURL]);

  useEffect(() => {
    // Dedupe by key, not a per-closure flag: React 19 StrictMode
    // double-invokes effects and the naive version sticks on a skeleton.
    if (loadedFor.current === datasetId) return;
    loadedFor.current = datasetId;
    void load();
  }, [datasetId, load]);

  if (loading) return <div className={styles.page}><div className={styles.muted}>{t('purchasing.loading')}</div></div>;
  if (error) return <div className={styles.page}><div className={styles.error}>{error}</div></div>;

  const bySupplier = new Map<string, Recommendation[]>();
  for (const r of recs) {
    const k = r.supplier || t('purchasing.noSupplier');
    if (!bySupplier.has(k)) bySupplier.set(k, []);
    bySupplier.get(k)!.push(r);
  }

  const setWithLeadTime = suppliers.filter(s => s.leadTimeSource === 'supplier').length;

  return (
    <div className={styles.page}>
      <div className={styles.topRow}>
        <div className={styles.tabs} role="tablist">
          <Tabs tab={tab} setTab={setTab} t={t} />
        </div>
        <button type="button" className={styles.csvBtn} onClick={() => downloadCsv(recs, datasetId)}>
          {t('purchasing.downloadCsv')}
        </button>
      </div>

      {/* The most important sentence on the page: how many of these numbers
          rest on an assumed delivery time rather than a real one. */}
      {tab === 'purchasing' && setWithLeadTime < suppliers.length && (
        <div className={styles.banner}>
          {t('purchasing.leadTimeBanner')
            .replace('{set}', String(setWithLeadTime))
            .replace('{total}', String(suppliers.length))}
        </div>
      )}

      {tab === 'purchasing' && (
        <>
          {summary && (
            <div className={styles.tiles}>
              <Tile n={summary.orderNow} label={t('purchasing.tile.orderNow')} tone="bad" />
              <Tile n={summary.dueSoon} label={t('purchasing.tile.dueSoon')} tone="warn" />
              <Tile n={summary.ok} label={t('purchasing.tile.ok')} tone="good" />
              <Tile n={summary.noDemand} label={t('purchasing.tile.noDemand')} tone="muted" />
            </div>
          )}

          <div className={styles.table}>
            <div className={styles.head}>
              <span>{t('purchasing.col.supplier')}</span>
              <span>{t('purchasing.col.leadTime')}</span>
              <span>{t('purchasing.col.toOrder')}</span>
              <span>{t('purchasing.col.estTotal')}</span>
            </div>

            {suppliers.map(s => {
              const items = (bySupplier.get(s.supplier) || [])
                .filter(r => r.status === 'overdue' || r.status === 'due_soon');
              const est = items.reduce((sum, r) => sum + (r.estimatedCostExVat || 0), 0);
              const isOpen = openSupplier === s.supplier;
              return (
                <div key={s.supplier} className={styles.group}>
                  <button
                    type="button"
                    className={styles.parentRow}
                    onClick={() => setOpenSupplier(isOpen ? null : s.supplier)}
                    aria-expanded={isOpen}
                  >
                    <span className={styles.supplierCell}>
                      <span className={styles.caret}>{isOpen ? '▾' : '▸'}</span>
                      <span className={styles.supplierName}>{s.supplier}</span>
                    </span>
                    <span className={styles.leadCell}>
                      <b>{t('purchasing.days').replace('{n}', String(s.leadTimeDays ?? '—'))}</b>
                      {/* The badge a buyer needs to judge everything below. */}
                      <span className={s.leadTimeSource === 'supplier' ? styles.badgeSet : styles.badgeDefault}>
                        {s.leadTimeSource === 'supplier'
                          ? t('purchasing.youSetThis')
                          : t('purchasing.defaultSetIt')}
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        className={styles.editLink}
                        onClick={e => { e.stopPropagation(); setEditing(s); }}
                        onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); setEditing(s); } }}
                      >{t('purchasing.edit')}</span>
                    </span>
                    <span className={styles.countCell}>
                      {items.length ? t('purchasing.items').replace('{n}', String(items.length)) : '—'}
                    </span>
                    <span className={styles.totalCell}>{est ? `≈ ₪${nf(est)}` : '—'}</span>
                  </button>

                  {isOpen && items.length === 0 && (
                    <div className={styles.emptyChild}>{t('purchasing.nothingToOrder')}</div>
                  )}

                  {isOpen && items.map(r => (
                    <ItemRow
                      key={r.sku}
                      rec={r}
                      open={openWhy === r.sku}
                      onToggle={() => setOpenWhy(openWhy === r.sku ? null : r.sku)}
                      t={t}
                    />
                  ))}
                </div>
              );
            })}
          </div>

          <div className={styles.foot}>
            {t('purchasing.foot')
              .replace('{suppliers}', String(suppliers.length))
              .replace('{items}', String(recs.length))}
            {dataThrough ? ` · ${t('purchasing.dataThrough')} ${dataThrough}` : ''}
          </div>
        </>
      )}

      {tab !== 'purchasing' && <PhaseGated tab={tab} t={t} />}

      {editing && (
        <LeadTimeModal
          supplier={editing}
          datasetId={datasetId}
          baseURL={baseURL}
          t={t}
          language={language}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            // Re-fetch rather than patch locally: changing a lead time moves
            // every date and status for that supplier, and recomputing here
            // would be a second implementation of the engine.
            loadedFor.current = null;
            setLoading(true);
            loadedFor.current = datasetId;
            await load();
          }}
        />
      )}
    </div>
  );
}

function Tabs({ tab, setTab, t }: { tab: Tab; setTab: (v: Tab) => void; t: (k: string) => string }) {
  const items: { id: Tab; label: string; later: boolean }[] = [
    { id: 'purchasing', label: t('purchasing.tab.purchasing'), later: false },
    { id: 'warehouse', label: t('purchasing.tab.warehouse'), later: true },
    { id: 'branches', label: t('purchasing.tab.branches'), later: true },
  ];
  return (
    <>
      {items.map(i => (
        <button
          key={i.id}
          type="button"
          role="tab"
          aria-selected={tab === i.id}
          className={`${styles.tab} ${tab === i.id ? styles.tabActive : ''}`}
          onClick={() => setTab(i.id)}
        >
          {i.label}
          {i.later && <span className={styles.laterChip}>{t('purchasing.later')}</span>}
        </button>
      ))}
    </>
  );
}

function Tile({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div className={styles.tile}>
      <div className={`${styles.tileN} ${styles[`tone_${tone}`]}`}>{nf(n)}</div>
      <div className={styles.tileLabel}>{label}</div>
    </div>
  );
}

/** One item recommendation: a plain sentence, a status chip, and its working. */
function ItemRow({ rec, open, onToggle, t }: {
  rec: Recommendation; open: boolean; onToggle: () => void; t: (k: string) => string;
}) {
  const late = rec.daysLate !== null && rec.daysLate > 0;
  return (
    <div className={styles.child}>
      <div className={styles.childHead}>
        <div className={styles.childTitle}>
          <span className={styles.itemName}>{rec.itemName || t('purchasing.unnamedItem')}</span>
          <span className={styles.sku}>{rec.sku}</span>
        </div>
        <span className={late ? styles.chipLate : styles.chipDue}>
          {late
            ? t('purchasing.daysLate').replace('{n}', String(rec.daysLate))
            : t('purchasing.orderBy').replace('{d}', rec.orderByDate || '—')}
        </span>
      </div>

      {/* One sentence, in words, before any table of numbers. */}
      <div className={styles.sentence}>
        {t('purchasing.sentence')
          .replace('{qty}', nf(rec.orderQty))
          .replace('{cost}', rec.estimatedCostExVat ? `≈ ₪${nf(rec.estimatedCostExVat)}` : '—')
          .replace('{cover}', rec.daysOfCover === null ? '—' : nf(rec.daysOfCover))
          .replace('{lead}', String(rec.leadTimeDays))
          .replace('{date}', rec.orderByDate || '—')}
      </div>

      <button type="button" className={styles.whyBtn} onClick={onToggle} aria-expanded={open}>
        {open ? t('purchasing.whyHide') : t('purchasing.why')}
      </button>

      {open && (
        <div className={styles.trust}>
          <div className={styles.trustGrid}>
            <Fact label={t('purchasing.f.pace')} value={`${pace(rec.velocityDaily)} / ${t('purchasing.perDay')}`} note={rec.velocityBasis} />
            <Fact label={t('purchasing.f.inStock')} value={nf(rec.warehouseQty)} note={t('purchasing.warehouse')} />
            <Fact
              label={t('purchasing.f.onTheWay')}
              value={nf(rec.onOrderQty)}
              note={rec.onOrderIsUnverified ? `⚠ ${t('purchasing.mayHaveArrived')}` : undefined}
              warn={rec.onOrderIsUnverified}
            />
            <Fact label={t('purchasing.f.reserved')} value={nf(rec.committedQty)} note={t('purchasing.customerOrders')} />
            <Fact
              label={t('purchasing.f.leadTime')}
              value={t('purchasing.days').replace('{n}', String(rec.leadTimeDays))}
              note={rec.leadTimeSource === 'supplier' ? t('purchasing.yourSetting') : t('purchasing.assumedDefault')}
              warn={rec.leadTimeSource !== 'supplier'}
            />
            <Fact
              label={t('purchasing.f.safety')}
              value={nf(rec.safetyStock)}
              note={rec.safetyStockSource === 'computed' ? t('purchasing.computedBuffer') : t('purchasing.fromCatalogue')}
            />
          </div>

          <div className={styles.derivation}>
            {t('purchasing.derivation')
              .replace('{target}', nf(rec.targetStock))
              .replace('{available}', nf(rec.netAvailable))
              .replace('{raw}', nf(rec.rawQty))
              .replace('{qty}', nf(rec.orderQty))
              .replace('{rounding}', rec.orderQtyRounding)}
          </div>

          {/* Caveats are the SERVER's wording, quoted — the screen, the chat
              and the report must not phrase the same caveat three ways. */}
          {rec.notes.length > 0 && (
            <ul className={styles.notes}>
              {rec.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Fact({ label, value, note, warn }: { label: string; value: string; note?: string; warn?: boolean }) {
  return (
    <div className={styles.fact}>
      <div className={styles.factLabel}>{label}</div>
      <div className={styles.factValue}>{value}</div>
      {note && <div className={warn ? styles.factNoteWarn : styles.factNote}>{note}</div>}
    </div>
  );
}

/**
 * Warehouse and Branches: present from day one so the anatomy is learned
 * once, honest about carrying no live data yet rather than showing invented
 * numbers.
 */
function PhaseGated({ tab, t }: { tab: Tab; t: (k: string) => string }) {
  return (
    <div className={styles.gated}>
      <div className={styles.gatedTitle}>
        {tab === 'warehouse' ? t('purchasing.tab.warehouse') : t('purchasing.tab.branches')}
      </div>
      <p className={styles.gatedText}>
        {tab === 'warehouse' ? t('purchasing.warehouseGated') : t('purchasing.branchesGated')}
      </p>
    </div>
  );
}

/** House rule: editing happens in a modal, never inline. */
function LeadTimeModal({ supplier, datasetId, baseURL, t, language, onClose, onSaved }: {
  supplier: SupplierRow;
  datasetId: string;
  baseURL?: string;
  t: (k: string) => string;
  language: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [value, setValue] = useState<string>(
    supplier.leadTimeSource === 'supplier' && supplier.leadTimeDays !== null
      ? String(supplier.leadTimeDays) : '');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    try {
      // Empty CLEARS the override and falls back to the dataset default —
      // that is how a buyer un-sets a delivery time, and why this sends null
      // rather than 0.
      await replenishmentService.saveSupplier(datasetId, supplier.supplier, {
        leadTimeDays: value.trim() === '' ? null : Number(value),
        supplierLabel: supplier.supplier,
      }, baseURL);
      onSaved();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" dir={language === 'he' ? 'rtl' : 'ltr'}>
      <div className={styles.modal}>
        <div className={styles.modalTitle}>{t('purchasing.modal.title')}</div>
        <div className={styles.modalSupplier}>{supplier.supplier}</div>

        <label className={styles.modalField}>
          <span>{t('purchasing.modal.label')}</span>
          <input
            className={styles.modalInput}
            type="number"
            min={0}
            value={value}
            placeholder={String(supplier.leadTimeDays ?? '')}
            onChange={e => setValue(e.target.value)}
          />
        </label>

        {/* Fixed-height slot so the modal never resizes when a message appears. */}
        <div className={styles.modalNoticeSlot}>
          {notice
            ? <div className={styles.modalError}>{notice}</div>
            : <div className={styles.modalHint}>{t('purchasing.modal.hint')}</div>}
        </div>

        <div className={styles.modalActions}>
          <button type="button" className={styles.btnGhost} onClick={onClose}>{t('purchasing.cancel')}</button>
          <button type="button" className={styles.btnPrimary} disabled={saving} onClick={() => void save()}>
            {saving ? t('purchasing.saving') : t('purchasing.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * CSV of exactly what is on screen, including the sources and caveats — a
 * buyer takes this into a purchase order, and a number without its basis is
 * not usable there.
 */
function downloadCsv(recs: Recommendation[], datasetId: string) {
  const cols = [
    'supplier', 'sku', 'itemName', 'status', 'orderQty', 'estimatedCostExVat',
    'orderByDate', 'daysLate', 'daysOfCover', 'velocityDaily', 'warehouseQty',
    'onOrderQty', 'onOrderIsUnverified', 'committedQty', 'netAvailable',
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
  a.download = `${datasetId}-replenishment-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
