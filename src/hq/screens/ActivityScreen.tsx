/**
 * HQ — Activity. What HQ is doing, and what it has done.
 *
 * This exists as a page rather than a panel because a run outlives the screen
 * that started it. Bringing 300 pages in takes 20 minutes; the person who
 * started it will close the tab, and someone else may want to know whether it's
 * still going. A modal can't answer that — a page you can navigate to can.
 *
 * Everything here is read back from the server's own run records, so it is
 * equally correct after a reload, in a second tab, or on someone else's
 * machine. When scheduled syncs land they write to the same records and appear
 * here with no changes.
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { IconBack, IconRefresh } from '../icons';
import { cancelRun, listRunItems, listRuns } from '../services/hqApi';
import type { SyncItem, SyncRun } from '../types';
import styles from './ActivityScreen.module.css';

function whenText(value: string): string {
  const date = new Date(value);
  const mins = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h ago`;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function durationText(from: string, to: string | null): string {
  const secs = Math.max(0, Math.round((new Date(to || Date.now()).getTime() - new Date(from).getTime()) / 1000));
  if (secs < 60) return `${secs} seconds`;
  const mins = Math.floor(secs / 60);
  return `${mins} min ${secs % 60}s`;
}

const STATE: Record<string, { label: string; cls: string }> = {
  running:   { label: 'running now', cls: styles.stateRunning },
  done:      { label: 'finished',    cls: styles.stateDone },
  cancelled: { label: 'stopped',     cls: styles.stateStopped },
  failed:    { label: "didn't work", cls: styles.stateFailed },
};

/** Plain description of what a run was actually doing. */
function describe(run: SyncRun): string {
  if (run.kind === 'discover') return 'Checked Notion for new and changed pages';
  const n = run.total || 0;
  return `Brought ${n} ${n === 1 ? 'page' : 'pages'} into HQ`;
}

export function ActivityScreen() {
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [stopping, setStopping] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openRun, setOpenRun] = useState<number | null>(null);
  const [runItems, setRunItems] = useState<Record<number, SyncItem[]>>({});
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      setRuns(await listRuns(40));
      setError(null);
    } catch (err) {
      // An empty list here would claim HQ has done nothing, when the truth is
      // we couldn't ask. Two very different things, and the silent version sent
      // someone hunting for a run that had actually completed fine.
      setError(err instanceof Error ? err.message : 'Could not load activity');
    } finally {
      setLoading(false);
    }
  }, []);

  async function toggleRun(run: SyncRun) {
    if (openRun === run.id) { setOpenRun(null); return; }
    setOpenRun(run.id);
    if (runItems[run.id]) return;
    try {
      const items = await listRunItems(run.id);
      setRunItems(prev => ({ ...prev, [run.id]: items }));
    } catch {
      setRunItems(prev => ({ ...prev, [run.id]: [] }));
    }
  }

  useEffect(() => { load(); }, [load]);

  const live = runs.filter(r => r.status === 'running');
  const past = runs.filter(r => r.status !== 'running');

  // Poll only while something is actually moving.
  useEffect(() => {
    if (!live.length) return;
    const timer = setInterval(load, 1200);
    return () => clearInterval(timer);
  }, [live.length, load]);

  async function handleStop(run: SyncRun) {
    setStopping(run.id);
    await cancelRun(run.id).catch(() => {});
    await load();
    setStopping(null);
  }

  return (
    <div className={styles.screen}>
      <div className={styles.head}>
        <div className={styles.headInner}>
          <button className={styles.back} onClick={() => navigate('../integrations')}>
            <IconBack /> Integrations
          </button>
          <h1 className={styles.title}>Activity</h1>
          <p className={styles.subtitle}>
            Everything HQ is doing and has done. Runs carry on by themselves — you can close this
            page and come back to it.
          </p>
        </div>
      </div>

      <div className={styles.scroll}>
        <div className={styles.inner}>
          {error && (
            <div className={styles.errorBox}>
              {error}
              <div className={styles.errorHint}>
                If the server restarted recently, give it a moment and refresh.
              </div>
            </div>
          )}

          {loading && <div className={styles.loading}>Loading…</div>}

          {!loading && live.length === 0 && (
            <div className={styles.idle}>
              <span className={styles.idleDot} />
              <div>
                <div className={styles.idleTitle}>Nothing running right now</div>
                <div className={styles.idleHint}>
                  Pick pages in Integrations and press “Bring into HQ” to start something.
                </div>
              </div>
              <button className="hqMini" onClick={load}><IconRefresh /> Refresh</button>
            </div>
          )}

          {live.map(run => {
            const pct = run.total ? Math.round((run.processed / run.total) * 100) : 0;
            return (
              <div key={run.id} className={styles.liveCard}>
                <div className={styles.liveTop}>
                  <span className={`${styles.state} ${styles.stateRunning}`}>running now</span>
                  <span className={styles.liveWhat}>{describe(run)}</span>
                  <span className={styles.spacer} />
                  <button
                    className="hqMini hqMiniDanger"
                    onClick={() => handleStop(run)}
                    disabled={stopping === run.id}
                  >
                    {stopping === run.id ? 'Stopping…' : 'Stop'}
                  </button>
                </div>

                <div className={styles.liveNow} dir="auto">
                  {run.current_title || 'Getting started…'}
                </div>

                <div className={styles.bar}>
                  <div className={styles.barFill} style={{ width: `${pct || 3}%` }} />
                </div>

                <div className={styles.liveStats}>
                  <span><b>{run.processed}</b> of {run.total} done</span>
                  <span>{run.succeeded} brought in</span>
                  {run.failed > 0 && <span className={styles.bad}>{run.failed} didn't work</span>}
                  <span className={styles.spacer} />
                  <span>{run.trigger === 'auto' ? 'started automatically' : 'started by hand'}</span>
                  <span>· running for {durationText(run.started_at, null)}</span>
                </div>

                <div className={styles.liveHint}>
                  Stopping finishes the page it's on, then halts. Anything not reached stays exactly
                  as it was.
                </div>
              </div>
            );
          })}

          {past.length > 0 && (
            <>
              <div className={styles.sectionLabel}>Earlier</div>
              <div className={styles.list}>
                {past.map(run => {
                  const state = STATE[run.status] || STATE.failed;
                  const expandable = run.kind === 'sync';
                  const open = openRun === run.id;
                  const items = runItems[run.id];

                  return (
                    <div key={run.id} className={styles.rowWrap}>
                      <div
                        className={`${styles.row} ${expandable ? styles.rowClickable : ''}`}
                        onClick={expandable ? () => toggleRun(run) : undefined}
                      >
                        <span className={`${styles.state} ${state.cls}`}>{state.label}</span>

                        <div className={styles.rowBody}>
                          <div className={styles.rowTitle}>
                            {describe(run)}
                            {expandable && (
                              <span className={`${styles.expand} ${open ? styles.expandOpen : ''}`}>▾</span>
                            )}
                          </div>
                          <div className={styles.rowMeta}>
                            {run.source_label || 'Notion'}
                            {' · '}{run.trigger === 'auto' ? 'automatic' : 'started by hand'}
                            {run.kind === 'sync' && ` · ${run.succeeded} brought in`}
                            {run.kind === 'sync' && run.failed > 0 && `, ${run.failed} failed`}
                            {run.status === 'cancelled' && ` · stopped at ${run.processed} of ${run.total}`}
                          </div>
                          {run.error && <div className={styles.rowError}>{run.error}</div>}
                        </div>

                        {/* Time gets its own column. Scanning "when did that
                            happen" shouldn't mean reading a sentence. */}
                        <div className={styles.rowWhen}>
                          <span className={styles.rowWhenMain}>{whenText(run.started_at)}</span>
                          <span className={styles.rowWhenSub}>
                            {new Date(run.started_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                            {' · '}{durationText(run.started_at, run.finished_at)}
                          </span>
                        </div>
                      </div>

                      {open && (
                        <div className={styles.docs}>
                          {!items && <div className={styles.docsNote}>Loading pages…</div>}
                          {items && items.length === 0 && (
                            <div className={styles.docsNote}>No pages recorded for this run.</div>
                          )}
                          {items?.map(item => (
                            <div key={item.id} className={styles.doc}>
                              <span className={`${styles.docDot} ${item.status === 'failed' ? styles.docDotBad : ''}`} />
                              <span className={styles.docTitle} dir="auto">{item.title}</span>
                              {item.parent_title && (
                                <span className={styles.docParent} dir="auto">{item.parent_title}</span>
                              )}
                              {item.url && (
                                <a
                                  className={styles.docLink}
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={e => e.stopPropagation()}
                                >
                                  open
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {!loading && runs.length === 0 && (
            <div className={styles.empty}>
              <div className={styles.emptyTitle}>HQ hasn't done anything yet</div>
              <div className={styles.emptyHint}>
                Once you bring pages in, every run shows up here — what it was, who started it, how
                long it took.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
