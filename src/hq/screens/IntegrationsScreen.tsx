/**
 * HQ — Integrations.
 *
 * Nothing happens invisibly here: you see every page a connector can reach,
 * choose what comes in, watch it run page by page, and stop it at any point.
 *
 * Layout is a fixed tool rail on the left and the page list on the right, so
 * filtering never pushes the list around. Actions float over the list instead
 * of stacking above it — picking 40 pages shouldn't move the 40 pages.
 *
 * Runs are NOT owned by this screen. Starting a sync returns a run id and the
 * server keeps going on its own; this component polls for progress. Close the
 * tab mid-run and it carries on — come back and it's still there.
 *
 * No LLM is involved. Bringing a page in is read → split → index. The Scribe
 * (the only thing here that costs real money) stays opt-in, per item.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { IconCheck, IconExternal, IconRefresh, IconSearch } from '../icons';
import {
  cancelRun, discoverSource, listProviders, listRuns, listSources, listSyncItems,
  setItemsStatus, startSourceSync,
} from '../services/hqApi';
import type {
  ItemFilters, Provider, Source, SyncItem, SyncItemStatus, SyncProgress, SyncRun, SyncStats,
} from '../types';
import styles from './IntegrationsScreen.module.css';

/** Plain words for each state. Nobody should need the schema to read this. */
const STATUS: { key: string; label: string }[] = [
  { key: '',        label: 'Everything' },
  { key: 'pending', label: 'Not brought in' },
  { key: 'done',    label: 'In HQ' },
  { key: 'stale',   label: 'Changed since' },
  { key: 'failed',  label: "Didn't work" },
  { key: 'skipped', label: 'Ignored' },
];

/**
 * What "kind" means depends on the source: Notion splits pages from table rows,
 * Drive splits documents from spreadsheets from files it can't read. Rather
 * than hard-code either, the labels are looked up and anything unknown falls
 * back to its raw name — a new source shows up without a code change.
 */
/** Which kind a source opens on. Anything unlisted opens on everything. */
const DEFAULT_KIND: Record<string, string> = { notion: 'page' };

const KIND_LABELS: Record<string, string> = {
  page:          'Documents',
  database_row:  'Table rows',
  document:      'Documents',
  spreadsheet:   'Spreadsheets',
  presentation:  'Slides',
  pdf:           'PDFs',
  text:          'Text files',
  unreadable:    "Can't be read",
};

const DATES: { key: string; label: string; days: number | null }[] = [
  { key: '',      label: 'Any time',      days: null },
  { key: 'week',  label: 'Past week',     days: 7 },
  { key: 'month', label: 'Past month',    days: 30 },
  { key: 'q',     label: 'Past 3 months', days: 90 },
  { key: 'year',  label: 'Past year',     days: 365 },
];

const CHIP: Record<SyncItemStatus, { label: string; cls: string }> = {
  pending:  { label: 'not in hq',   cls: styles.chipPending },
  selected: { label: 'picked',      cls: styles.chipPending },
  syncing:  { label: 'reading…',    cls: styles.chipSyncing },
  done:     { label: 'in hq',       cls: styles.chipDone },
  stale:    { label: 'changed',     cls: styles.chipStale },
  skipped:  { label: 'ignored',     cls: styles.chipSkipped },
  failed:   { label: "didn't work", cls: styles.chipFailed },
};

function whenText(value: string | null): string {
  if (!value) return '';
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Roughly 5.5 characters per word — close enough in both English and Hebrew.
 * Nobody cares about the exact figure, only whether a page is a paragraph or a
 * transcript, which is why this never shows chunks or characters.
 */
function wordsText(chars: number): string {
  const words = Math.round(chars / 5.5);
  if (words < 1000) return `${words} words`;
  return `${(words / 1000).toFixed(1).replace('.0', '')}k words`;
}


export function IntegrationsScreen({ onChanged }: { onChanged?: () => void }) {
  const navigate = useNavigate();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [items, setItems] = useState<SyncItem[]>([]);
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [runs, setRuns] = useState<SyncRun[]>([]);

  // Which source is on screen. Everything below is source-agnostic — the id is
  // just passed through to the API, which routes on /:provider/.
  const [provider, setProvider] = useState('notion');

  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  // Notion opens on Documents because two thirds of a workspace are table rows
  // — but NOT all of them are noise ("Meeting Notes" is a table), so the hidden
  // count is always stated. Other sources have no such split, so they open on
  // everything.
  const [type, setType] = useState(DEFAULT_KIND.notion);
  const [parent, setParent] = useState('');
  const [dateKey, setDateKey] = useState('');

  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState<SyncProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickingSource, setPickingSource] = useState(false);

  const liveRun = useMemo(() => runs.find(r => r.status === 'running') || null, [runs]);
  const busy = discovering || !!liveRun;

  const activeFilters: ItemFilters = useMemo(() => {
    const days = DATES.find(d => d.key === dateKey)?.days ?? null;
    return {
      status: status || undefined,
      search: search || undefined,
      type: type || undefined,
      parent: parent || undefined,
      since: days ? new Date(Date.now() - days * 86_400_000).toISOString() : undefined,
    };
  }, [status, search, type, parent, dateKey]);

  const refresh = useCallback(async () => {
    try {
      const [provs, res, srcs, rs] = await Promise.all([
        listProviders(),
        listSyncItems(activeFilters, provider),
        listSources().catch(() => [] as Source[]),
        listRuns(20).catch(() => [] as SyncRun[]),
      ]);
      setProviders(provs);
      setItems(res.items);
      setStats(res.stats);
      setSources(srcs);
      setRuns(rs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load integrations');
    } finally {
      setLoading(false);
    }
  }, [activeFilters, provider]);

  useEffect(() => {
    const timer = setTimeout(refresh, search ? 320 : 0);
    return () => clearTimeout(timer);
  }, [refresh, search]);

  useEffect(() => {
    if (!pickingSource) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPickingSource(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pickingSource]);

  /**
   * While something is running, poll. The run lives on the server, so this is
   * just a window onto it — and it keeps working after a reload, which an SSE
   * stream tied to the original request never could.
   */
  const wasRunning = useRef(false);
  useEffect(() => {
    if (!liveRun) {
      if (wasRunning.current) { wasRunning.current = false; refresh(); onChanged?.(); }
      return;
    }
    wasRunning.current = true;
    const timer = setInterval(() => { listRuns(20).then(setRuns).catch(() => {}); }, 1200);
    return () => clearInterval(timer);
  }, [liveRun, refresh, onChanged]);

  const current = providers.find(p => p.id === provider);
  const sourceName = current?.name || 'this source';
  const visibleIds = useMemo(() => items.map(i => i.id), [items]);
  const allVisiblePicked = visibleIds.length > 0 && visibleIds.every(id => picked.has(id));
  const defaultKind = DEFAULT_KIND[provider] || '';
  const filtersOn = !!(parent || type !== defaultKind || status || search || dateKey);

  /**
   * Shift-click selects the range from the last click to this one, the way
   * every file list does. `lastClicked` is the anchor; without it, ticking 40
   * consecutive pages means 40 clicks.
   */
  const lastClicked = useRef<number | null>(null);

  function toggle(id: number, shift = false) {
    if (shift && lastClicked.current !== null) {
      const from = visibleIds.indexOf(lastClicked.current);
      const to = visibleIds.indexOf(id);
      if (from !== -1 && to !== -1) {
        const [lo, hi] = from < to ? [from, to] : [to, from];
        // The anchor's state decides the whole range, so shift-clicking can
        // deselect a block too, not only select one.
        const selecting = picked.has(lastClicked.current);
        setPicked(prev => {
          const next = new Set(prev);
          for (const rangeId of visibleIds.slice(lo, hi + 1)) {
            if (selecting) next.add(rangeId); else next.delete(rangeId);
          }
          return next;
        });
        lastClicked.current = id;
        return;
      }
    }

    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    lastClicked.current = id;
  }

  function pickAllVisible() {
    setPicked(prev => {
      const next = new Set(prev);
      visibleIds.forEach(id => (allVisiblePicked ? next.delete(id) : next.add(id)));
      return next;
    });
    lastClicked.current = null;
  }

  function switchTo(id: string) {
    setProvider(id);
    setPickingSource(false);
    setPicked(new Set());
    setParent(''); setStatus(''); setSearch(''); setDateKey('');
    setType(DEFAULT_KIND[id] || '');
  }

  function clearFilters() {
    setParent(''); setType(defaultKind); setStatus(''); setSearch(''); setDateKey('');
  }

  async function handleDiscover(full = false) {
    setError(null); setNotice(null); setDiscovered(null);
    setDiscovering(true);
    try {
      await discoverSource(p => setDiscovered(p), full, provider);
      await refresh();
      setNotice(full
        ? `Re-checked everything in ${sourceName}.`
        : 'Checked for anything new or changed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : `Couldn't reach ${sourceName}`);
    } finally {
      setDiscovering(false);
      setDiscovered(null);
    }
  }

  async function handleBringIn() {
    const ids = [...picked];
    if (!ids.length) return;
    setError(null); setNotice(null);
    try {
      await startSourceSync({ itemIds: ids, label: `${ids.length} item${ids.length === 1 ? '' : 's'}` }, provider);
      setPicked(new Set());
      // The run outlives this screen, so send them to the page that tracks it.
      navigate('../activity');
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start");
    }
  }

  async function handleStop() {
    if (!liveRun) return;
    await cancelRun(liveRun.id).catch(() => {});
    setNotice('Stopping after the current page…');
  }

  /** No ids means "everything the filters currently show" — one call, not 500. */
  async function handleIgnore(next: 'pending' | 'skipped', wholeFilter = false) {
    const ids = wholeFilter ? [] : [...picked];
    if (!wholeFilter && !ids.length) return;
    setError(null);
    try {
      const r = await setItemsStatus(next, wholeFilter ? { filters: activeFilters } : { itemIds: ids }, provider);
      setPicked(new Set());
      setNotice(`${r.changed} ${r.changed === 1 ? 'page' : 'pages'} ${next === 'skipped' ? 'ignored' : 'un-ignored'}.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update those pages");
    }
  }

  const runPct = liveRun && liveRun.total ? Math.round((liveRun.processed / liveRun.total) * 100) : 0;

  return (
    <div className={styles.screen}>
      {/* ── Tool rail ─────────────────────────────────────────────────────── */}
      <aside className={styles.rail}>
        {/* One row instead of three cards. The connector list is a picker, not
            a dashboard — it was eating the space the filters actually need. */}
        <div className={styles.railGroup}>
          <div className={styles.railLabel}>Reading from</div>
          {/* The menu floats over the rail rather than expanding inside it —
              opening a picker shouldn't shove the filters down the page. */}
          <div className={styles.sourceWrap}>
          <button
            className={styles.sourcePick}
            onClick={() => setPickingSource(v => !v)}
            aria-expanded={pickingSource}
          >
            <span className={styles.providerIcon}>
              {provider === 'notion' ? '🗂' : provider === 'google_drive' ? '📁' : '🎥'}
            </span>
            <span className={styles.sourcePickBody}>
              <b>{current?.name || 'Notion'}</b>
              <small>{current?.stats?.byStatus.done ?? 0} of {current?.stats?.total ?? 0} in HQ</small>
            </span>
            <span className={`${styles.caret} ${pickingSource ? styles.caretOpen : ''}`}>▾</span>
          </button>

          {pickingSource && (
            <>
              <div className={styles.sourceScrim} onClick={() => setPickingSource(false)} />
              <div className={styles.sourceMenu}>
                {providers.filter(p => p.id !== provider).map(p => (
                  <button
                    key={p.id}
                    className={styles.sourceOption}
                    disabled={!p.connected}
                    onClick={() => p.connected && switchTo(p.id)}
                  >
                    <span className={styles.providerIcon}>
                      {p.id === 'notion' ? '🗂' : p.id === 'google_drive' ? '📁' : '🎥'}
                    </span>
                    <span className={styles.sourcePickBody}>
                      <b>{p.name}</b>
                      <small>
                        {p.comingSoon ? 'not built yet'
                          : !p.connected ? 'needs credentials'
                          : `${p.stats?.byStatus.done ?? 0} of ${p.stats?.total ?? 0} in HQ`}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
          </div>
        </div>

        {current?.connected && (
          <>
            {/* Where a page sits in Notion — the biggest lever on this list,
                so it goes first rather than buried under three filter groups. */}
            {!!stats?.parents.length && (
              <div className={styles.railGroup}>
                <div className={styles.railLabel}>
                  {provider === 'google_drive' ? 'Folder' : 'Notion section'}
                </div>
                {/* `appearance: none` in hq.css strips the native arrow, so the
                    field read as a text input. The caret has to be drawn back. */}
                <div className={styles.selectWrap}>
                  <select className={styles.select} value={parent} onChange={e => setParent(e.target.value)}>
                    <option value="">
                    {provider === 'google_drive' ? 'Every folder' : 'Every section'}
                  </option>
                    {stats.parents.map(p => (
                      <option key={p.title} value={p.title}>{p.title} ({p.done}/{p.count})</option>
                    ))}
                  </select>
                  <span className={styles.selectCaret} aria-hidden="true">▾</span>
                </div>
                <div className={styles.railHint}>
                  {provider === 'google_drive'
                    ? 'The folder it sits in'
                    : 'The page or table it sits inside'}
                </div>
              </div>
            )}

            {/* Counts are faceted: each group is counted with the OTHER filters
                applied, so picking "Documents" narrows the Show numbers. The
                unfiltered option shows that dimension's own total. */}
            <FilterGroup
              label="Show" options={STATUS} value={status} onChange={setStatus}
              counts={k => (k ? stats?.byStatus[k as SyncItemStatus] ?? 0 : stats?.statusTotal ?? 0)}
            />

            <FilterGroup
              label="Kind"
              options={[
                { key: '', label: 'Everything' },
                ...Object.keys(stats?.byType ?? {}).map(k => ({
                  key: k, label: KIND_LABELS[k] || k.replace(/_/g, ' '),
                })),
              ]}
              value={type} onChange={setType}
              counts={k => (k ? stats?.byType[k] ?? 0 : stats?.typeTotal ?? 0)}
            />

            <FilterGroup label="When it changed" options={DATES} value={dateKey} onChange={setDateKey} />

            {filtersOn && (
              <button className={styles.railLink} onClick={clearFilters}>Clear all filters</button>
            )}
          </>
        )}
      </aside>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className={styles.content}>
        <div className={styles.contentHead}>
          <div>
            <h1 className={styles.title}>Integrations</h1>
            <p className={styles.subtitle}>Everything HQ can reach, and exactly what's come in.</p>
          </div>
          <div className={styles.headActions}>
            {/* Two different jobs, so both say what they do. The quick one only
                looks at pages edited since last time; the slow one re-reads the
                whole workspace, which is the only way a page DELETED in Notion
                stops showing up here. */}
            {current?.connected && (
              <>
                <button className={styles.checkBtn} onClick={() => handleDiscover(false)} disabled={busy}>
                  <IconRefresh />
                  <span>
                    <b>{discovering ? `Checking ${sourceName}…` : `Check ${sourceName}`}</b>
                    <small>anything new or edited</small>
                  </span>
                </button>
                <button
                  className={styles.checkBtnGhost}
                  onClick={() => handleDiscover(true)}
                  disabled={busy}
                  title="Re-reads all 800+ pages. Slower, but it's how deleted pages disappear from this list."
                >
                  <span>
                    <b>Re-read everything</b>
                    <small>slower · catches deletions</small>
                  </span>
                </button>
              </>
            )}
            <div className={styles.searchWrap}>
              <IconSearch />
              <input
                className={styles.search}
                value={search}
                dir="auto"
                placeholder="Find a page…"
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className={styles.scroll}>
          {error && <div className={styles.errorBox}>{error}</div>}
          {notice && !error && (
            <div className={styles.noticeBox} onClick={() => setNotice(null)}>{notice}</div>
          )}

          {loading && <div className={styles.empty}><div className={styles.emptyTitle}>Loading…</div></div>}

          {!loading && !current?.connected && (
            <div className={styles.empty}>
              <div className={styles.emptyMark}><img src="/img/lybi-spiral.png" alt="" /></div>
              <div className={styles.emptyTitle}>{sourceName} isn't connected</div>
              <div className={styles.emptyHint}>
                Add its credentials on the server and restart it, then make sure the content is
                shared with the integration.
              </div>
            </div>
          )}

          {!loading && current?.connected && items.length === 0 && (
            <div className={styles.empty}>
              <div className={styles.emptyMark}><img src="/img/lybi-spiral.png" alt="" /></div>
              <div className={styles.emptyTitle}>
                {filtersOn ? 'Nothing matches those filters' : `Nothing from ${sourceName} yet`}
              </div>
              <div className={styles.emptyHint}>
                {filtersOn
                  ? 'Widen the filters on the left, or clear them.'
                  : `Press “Check ${sourceName}” to see what it's sharing with HQ. It only reads names, so it's quick and free.`}
              </div>
            </div>
          )}

          {items.length > 0 && (
            <div className={styles.listHead}>
              <span
                className={`${styles.check} ${allVisiblePicked ? styles.checkOn : ''}`}
                onClick={pickAllVisible}
                role="checkbox"
                aria-checked={allVisiblePicked}
              >
                {allVisiblePicked && <IconCheck />}
              </span>
              <button className={styles.selectAll} onClick={pickAllVisible}>
                {allVisiblePicked ? 'Clear' : `Select all ${items.length}`} shown
              </button>
              <span className={styles.headHint}>
                shift-click to select a range
              </span>
              <span className={styles.spacer} />
              {filtersOn && !busy && (
                <button className={styles.railLink} onClick={() => handleIgnore('skipped', true)}>
                  Ignore all {items.length}
                </button>
              )}
            </div>
          )}

          <div className={styles.list}>
            {items.map(item => {
              const chip = CHIP[item.status] ?? CHIP.pending;
              const isPicked = picked.has(item.id);
              const isCurrent = !!liveRun && liveRun.current_title === item.title;

              return (
                <div
                  key={item.id}
                  className={`${styles.row} ${isPicked ? styles.rowPicked : ''} ${isCurrent ? styles.rowSyncing : ''}`}
                  onClick={e => {
                    // Let the "open in Notion" link do its own thing.
                    if ((e.target as HTMLElement).closest('a')) return;
                    toggle(item.id, e.shiftKey);
                  }}
                >
                  {/* No handler of its own — the whole row is the click
                      target, and a nested one would toggle twice. */}
                  <span
                    className={`${styles.check} ${isPicked ? styles.checkOn : ''}`}
                    role="checkbox"
                    aria-checked={isPicked}
                  >
                    {isPicked && <IconCheck />}
                  </span>

                  <div className={styles.rowBody}>
                    <div className={styles.rowTitle} dir="auto">{item.title || '(untitled)'}</div>
                    <div className={styles.rowMeta}>
                      {item.parent_title && (
                        <span className={styles.parentTag} dir="auto">{item.parent_title}</span>
                      )}
                      {item.remote_edited_at && <span>changed {whenText(item.remote_edited_at)}</span>}
                      {item.chars ? <span>· about {wordsText(item.chars)}</span> : null}
                    </div>
                    {item.error && <div className={styles.rowError}>{item.error}</div>}
                  </div>

                  <span className={`${styles.chip} ${isCurrent ? styles.chipSyncing : chip.cls}`}>
                    {isCurrent ? 'reading…' : chip.label}
                  </span>

                  {item.url && (
                    <a className={styles.link} href={item.url} target="_blank" rel="noopener noreferrer" title="Open in Notion">
                      <IconExternal />
                    </a>
                  )}
                </div>
              );
            })}
          </div>

          {/* Explanations sit under the list, not above it — you read them once. */}
          {current?.connected && !loading && (
            <div className={styles.footNotes}>
              {provider === 'notion' && type === 'page' && !!stats?.byType.database_row && (
                <p>
                  {stats.byType.database_row} table rows are hidden right now — mostly config and
                  registry tables, though your meeting notes live in one.{' '}
                  <button className={styles.inlineLink} onClick={() => setType('database_row')}>
                    Show them
                  </button>
                </p>
              )}
              <p>
                Bringing pages in uses no AI. HQ reads each page, splits it up and files it so it can
                be searched — about 2–4 seconds a page, and a few cents for the whole workspace.
              </p>
              {sources.length > 0 && (
                <p>
                  What HQ has read came from:{' '}
                  {sources.map((s, i) => (
                    <span key={s.id}>
                      {i > 0 && ' · '}
                      <span dir="auto">{s.label}</span> ({s.atom_count})
                    </span>
                  ))}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Floating: what's selected ─────────────────────────────────────── */}
      {picked.size > 0 && !liveRun && (
        <div className={styles.floatBar}>
          <span className={styles.floatCount}>{picked.size}</span>
          <span className={styles.floatText}>{picked.size === 1 ? 'item selected' : 'items selected'}</span>
          <span className={styles.spacer} />
          <button className="hqMini" onClick={() => setPicked(new Set())}>Clear</button>
          <button className="hqMini" onClick={() => handleIgnore('skipped')}>Ignore</button>
          <button className="hqPill" onClick={handleBringIn}>Bring into HQ</button>
        </div>
      )}

      {/* ── Floating: what's running ──────────────────────────────────────── */}
      {(liveRun || discovering) && (
        <div className={`${styles.floatBar} ${styles.floatRun}`}>
          <div className={styles.runBody}>
            <div className={styles.runTop}>
              <span className={styles.runNow} dir="auto">
                {discovering
                  ? `Looking through Notion — ${discovered?.found ?? 0} found`
                  : liveRun?.current_title || 'Starting…'}
              </span>
              {liveRun && (
                <span className={styles.runCount}>
                  {liveRun.processed} / {liveRun.total}
                  {liveRun.failed > 0 && ` · ${liveRun.failed} failed`}
                </span>
              )}
            </div>
            <div className={styles.bar}>
              <div
                className={`${styles.barFill} ${discovering ? styles.barIndeterminate : ''}`}
                style={{ width: discovering ? '100%' : `${runPct || 3}%` }}
              />
            </div>
            <div className={styles.runHint}>You can leave this page — it keeps going.</div>
          </div>
          {liveRun && <button className="hqMini hqMiniDanger" onClick={handleStop}>Stop</button>}
        </div>
      )}

    </div>
  );
}

function FilterGroup({ label, options, value, onChange, counts }: {
  label: string;
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
  counts?: (key: string) => number;
}) {
  return (
    <div className={styles.railGroup}>
      <div className={styles.railLabel}>{label}</div>
      <div className={styles.railOptions}>
        {options.map(o => {
          const n = counts?.(o.key);
          if (counts && o.key && !n) return null;
          return (
            <button
              key={o.key || 'all'}
              className={`${styles.railOption} ${value === o.key ? styles.railOptionOn : ''}`}
              onClick={() => onChange(o.key)}
            >
              <span>{o.label}</span>
              {n !== undefined && <span className={styles.railCount}>{n}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
