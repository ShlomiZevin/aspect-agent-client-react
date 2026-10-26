/**
 * LoadTestsTab — Admin → Load tests (task #902).
 *
 * A load test releases several simulated conversations at once against
 * this agent — one alone first (the baseline), then all of them, every
 * turn through the public address — and shows them as one run:
 *
 *   left   the agent's runs, newest first, each with its one-line verdict
 *   right  the opened run: the verdict, baseline vs under load (median and
 *          slowest 5%), errors by kind, cost against the estimate and the
 *          $20 cap, this server's vitals during the run, the previous run
 *          with the same number of conversations, a chart of turn time over
 *          the run, the turn times side by side, and the picked
 *          conversation's messages
 *
 * "New load test" shows the cost estimate live and refuses over the cap.
 * While a run is going the screen re-reads every few seconds; nothing
 * animates or blinks, the verdict line and the chart keep their place
 * from the first second, and the grid has fixed column widths.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  estimateLoadTest,
  getLoadTest,
  listLoadTests,
  releaseLoadTest,
  stopLoadTest,
  type LoadTestEstimate,
  type LoadTestRun,
  type NewLoadTest,
  type SimulationJob,
} from '../../state/builderApi';
import { getProviders } from '../../registry/providerModels';
import { Modal } from '../Modal/Modal';
import { useConfirm } from '../Confirm/Confirm';
import { ConversationDetail } from './ConversationsTab';
import convStyles from './ConversationsTab.module.css';
import simStyles from './SimulationsTab.module.css';
import styles from './LoadTestsTab.module.css';

const POLL_MS = 3000;
const MAX_CONVERSATIONS = 20;
const MAX_TURNS = 10;
const BY_KEY = 'builder:simulationBy';
const DEFAULT_SCRIPT = [
  'Hi',
  'What can you help me with?',
  'Tell me a bit more about the first thing you mentioned',
  'How much does it cost?',
  'Thanks, that is all',
].join('\n');

const RUN_STATUS: Record<LoadTestRun['status'], { label: string; cls: string }> = {
  running: { label: 'Running', cls: 'status_running' },
  completed: { label: 'Finished', cls: 'status_completed' },
  failed: { label: 'Failed', cls: 'status_failed' },
  interrupted: { label: 'Interrupted', cls: 'status_interrupted' },
};
const JOB_STATUS: Record<SimulationJob['status'], string> = {
  pending: 'Waiting', running: 'Running', completed: 'Finished', failed: 'Failed', interrupted: 'Interrupted',
};
const KIND_LABEL: Record<string, string> = {
  model_no_credit: 'Out of credit', model_rate_limit: 'Rate limit', model_timeout: 'Timeout', model_refusal: 'Refusal',
  model_bad_answer: 'Bad answer', model_other: 'Model error', database: 'Database',
  external: 'External service', server_unavailable: 'Server unavailable', user_input: 'User input', code: 'Our code',
  other: 'Other',
};

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}
function secs(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}
function usd(n: number | null | undefined): string {
  if (n == null) return '—';
  return n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
}
function times(x: number | null | undefined): string {
  return x == null ? '' : ` (${x}×)`;
}
function phaseLine(r: LoadTestRun): string {
  if (r.status !== 'running') return r.verdict || r.stopped || r.error || 'Finished';
  if (r.phase === 'baseline') return 'Running one conversation alone first — the baseline';
  return `${r.counts.running} running · ${r.counts.finished} finished · ${r.counts.waiting} waiting${r.counts.failed ? ` · ${r.counts.failed} failed` : ''}`;
}

export function LoadTestsTab({ agentSlug }: { agentSlug: string }) {
  const [runs, setRuns] = useState<LoadTestRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listLoadTests({ agentSlug })
      .then(list => { if (!cancelled) { setRuns(list); setError(null); } })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [agentSlug, tick]);

  const anyLive = !!runs?.some(r => r.status === 'running');
  useEffect(() => {
    if (!anyLive) return;
    const t = setInterval(() => setTick(n => n + 1), POLL_MS);
    return () => clearInterval(t);
  }, [anyLive]);

  const selected = runs?.find(r => r.id === selectedId) ?? null;

  return (
    <div className={convStyles.wrap}>
      <aside className={convStyles.list}>
        <div className={convStyles.listHead}>
          <span className={convStyles.listTitle}>Load tests</span>
          <button type="button" className={convStyles.refresh} onClick={() => setTick(n => n + 1)} title="Refresh">↻</button>
        </div>
        <div className={simStyles.newRow}>
          <button type="button" className={simStyles.newBtn} onClick={() => setFormOpen(true)}>+ New load test</button>
        </div>
        {error && <div className={convStyles.error}>{error}</div>}
        {runs !== null && runs.length === 0 && !error && (
          <div className={simStyles.emptyList}>
            <b>No load tests yet.</b>
            <span>Several conversations at once, the same script each, to see how the agent holds up.</span>
          </div>
        )}
        <div className={convStyles.listScroll}>
          {(runs ?? []).map(r => (
            <button key={r.id} type="button"
              className={`${convStyles.row} ${r.id === selectedId ? convStyles.rowActive : ''}`}
              onClick={() => setSelectedId(r.id)}>
              <div className={convStyles.rowName}>{r.label || `Load test #${r.id}`}</div>
              <div className={styles.rowVerdict} title={phaseLine(r)}>{phaseLine(r)}</div>
              <div className={convStyles.rowFoot}>
                <span className={convStyles.rowTime}>{fmtDate(r.createdAt)}{r.by ? ` · ${r.by}` : ''}</span>
                <span className={`${simStyles.status} ${simStyles[RUN_STATUS[r.status].cls]}`}>{RUN_STATUS[r.status].label}</span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className={convStyles.detail}>
        {!selected ? (
          <div className={convStyles.detailEmpty}>
            {runs && runs.length > 0 ? 'Pick a load test to see how it went.' : 'Load tests appear here — start one with “New load test”.'}
          </div>
        ) : (
          <RunDetail key={selected.id} agentSlug={agentSlug} summary={selected} refreshKey={tick} onStopped={() => setTick(n => n + 1)} />
        )}
      </section>

      {formOpen && (
        <NewLoadTestModal
          agentSlug={agentSlug}
          onClose={() => setFormOpen(false)}
          onReleased={run => {
            setFormOpen(false);
            setRuns(prev => [run, ...(prev ?? []).filter(r => r.id !== run.id)]);
            setSelectedId(run.id);
            setTick(n => n + 1);
          }}
        />
      )}
    </div>
  );
}

/** The opened run. Reads the full run (with the vitals samples and the previous run) itself. */
function RunDetail({ agentSlug, summary, refreshKey, onStopped }: {
  agentSlug: string; summary: LoadTestRun; refreshKey: number; onStopped: () => void;
}) {
  const [full, setFull] = useState<LoadTestRun | null>(null);
  const [pickedJobId, setPickedJobId] = useState<number | null>(null);
  const confirm = useConfirm();

  useEffect(() => {
    let cancelled = false;
    getLoadTest(summary.id).then(r => { if (!cancelled) setFull(r); }).catch(() => { /* the summary still shows */ });
    return () => { cancelled = true; };
  }, [summary.id, refreshKey]);

  const run = full && full.id === summary.id ? full : summary;
  const baselineJob = run.baseline ? run.jobs.find(j => j.id === run.baseline?.jobId) ?? null : null;
  const loadJobs = run.jobs.filter(j => j.id !== baselineJob?.id);
  const rowsInGrid = baselineJob ? [baselineJob, ...loadJobs] : loadJobs;
  // The first conversation is open from the start — nothing appears on click.
  const picked = run.jobs.find(j => j.id === pickedJobId) ?? rowsInGrid[0] ?? null;
  const errors = Object.entries(run.errorsByKind);
  const turnCols = Array.from({ length: run.turnsEach }, (_, i) => i + 1);
  const v = run.vitals;
  const c = run.counts;

  const stop = async () => {
    const ok = await confirm({
      title: 'Stop this load test?',
      message: 'Every conversation finishes the turn it is in and takes no more. What ran so far is kept.',
      confirmLabel: 'Stop',
      danger: true,
    });
    if (!ok) return;
    let by = '';
    try { by = localStorage.getItem(BY_KEY) || ''; } catch { /* private mode */ }
    await stopLoadTest({ id: run.id, by: by || 'the Admin screen' }).catch(() => {});
    onStopped();
  };

  return (
    <>
      <div className={convStyles.detailHead}>
        <span className={convStyles.detailTitle}>{run.label || `Load test #${run.id}`}</span>
        <span className={`${simStyles.status} ${simStyles[RUN_STATUS[run.status].cls]}`}>{RUN_STATUS[run.status].label}</span>
        <span className={convStyles.detailSpacer} />
        <span className={simStyles.jobId}>#{run.id}</span>
        <button type="button" className={`${convStyles.exportBtn} ${styles.stopBtn}`} onClick={stop} disabled={run.status !== 'running'}
          title="Conversations finish their current turn and take no more">Stop</button>
      </div>

      <div className={`${styles.verdict} ${run.status === 'running' ? styles.verdictLive : run.errors ? styles.verdictBad : ''}`}>
        {phaseLine(run)}
      </div>

      <div className={simStyles.setup}>
        <Fact label="Baseline (one alone)" value={run.baseline?.timing ? `median ${secs(run.baseline.timing.medianMs)} · slowest 5% ${secs(run.baseline.timing.p95Ms)}` : (run.baseline ? null : 'No baseline — one conversation')} wide2 />
        <Fact label={`Under load (${run.conversations} at once)`} wide2
          value={run.timing ? `median ${secs(run.timing.medianMs)}${times(run.slowdown?.median)} · slowest 5% ${secs(run.timing.p95Ms)}${times(run.slowdown?.p95)}` : null} />
        <Fact label="Conversations" value={`${c.waiting} waiting · ${c.running} running · ${c.finished} finished · ${c.failed} failed`} wide2 />
        <Fact label="Turns" value={`${run.turnsDone} of ${run.turnsPlanned}`} />
        <Fact label="Turns per second" value={run.turnsPerSecond != null ? String(run.turnsPerSecond) : null} />
        <Fact label="Errors" danger={errors.length > 0}
          value={errors.length ? errors.map(([k, n]) => `${KIND_LABEL[k] ?? k} ${n}`).join(' · ') : 'None'} />
        <Fact label="Add-on failures" danger={run.addonFailures > 0} value={String(run.addonFailures)} title="Add-ons that failed inside turns that still answered" />
        <Fact label="Cost" value={`${usd(run.costUsd)} of ${usd(run.estimate?.usd)} estimated`}
          title={`Cap $${run.capUsd}. ${run.unpriced.length ? `Counted at the top known rate (no list price): ${run.unpriced.join(', ')}.` : ''}`} />
        <Fact label="Slowest turn" value={run.timing ? secs(run.timing.maxMs) : null} />
        <Fact label="This server" wide2
          value={v ? `CPU ≤${v.cpuPctMax}% · memory ≤${v.rssMbMax} MB · database ${v.dbInUseMax}/${v.dbPoolMax ?? '?'} in use, ${v.dbWaitingMax} waiting` : null}
          title="Sampled every 2 s on the server that drove the run. Other instances, if any, are not included."
          danger={!!v && v.dbWaitingMax > 0} />
        <Fact label="Previous run" wide2
          value={run.previous ? `#${run.previous.id} · median ${secs(run.previous.medianMs)} · slowest 5% ${secs(run.previous.p95Ms)}${run.previous.errors ? ` · ${run.previous.errors} errors` : ''}` : 'None with the same number of conversations'}
          title={run.previous?.verdict ?? undefined} />
        <Fact label="Released by" value={run.by} />
        <Fact label="Version" value={run.version === 'published' ? 'Published' : 'Active'} />
        <Fact label="Start" value={run.start === 'ramp' ? 'Over a minute' : 'All together'} />
        <Fact label="Started" value={fmtDate(run.createdAt)} />
        {run.kind === 'script'
          ? <Fact wide label="Script — every conversation" value={(run.lines ?? []).map((l, i) => `${i + 1}. ${l}`).join('\n')} />
          : <Fact wide label={`Persona · ${run.userModel ?? ''}`} value={`${run.persona ?? ''}${run.goal ? `\nWants: ${run.goal}` : ''}`} />}
        {(run.error || run.stopped) && <Fact wide danger={!!run.error} label={run.error ? 'Error' : 'Stopped'} value={run.error || run.stopped} />}
      </div>

      <TurnTimeChart run={run} baselineJobId={baselineJob?.id ?? null} />

      <div className={styles.gridBlock}>
        <div className={styles.gridHead}>Turn times (s), side by side</div>
        <div className={styles.gridScroll}>
          <table className={styles.grid}>
            <thead>
              <tr>
                <th className={styles.colConv}>Conversation</th>
                {turnCols.map(n => <th key={n} className={styles.colTurn}>{n}</th>)}
                <th className={styles.colStatus}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rowsInGrid.map(j => {
                const isBase = j.id === baselineJob?.id;
                return (
                  <tr key={j.id} className={`${styles.gridRow} ${picked?.id === j.id ? styles.gridRowOn : ''}`} onClick={() => setPickedJobId(j.id)}>
                    <td className={styles.colConv}>
                      {isBase ? 'Baseline' : `${loadJobs.indexOf(j) + 1}`}
                      {j.conversationId != null ? <span className={styles.convNo}> · #{j.conversationId}</span> : null}
                    </td>
                    {turnCols.map(n => {
                      const t = j.timings.find(x => x.turn === n);
                      return (
                        <td key={n} className={`${styles.colTurn} ${t && !t.ok ? styles.cellFailed : ''} ${t?.addonFailures ? styles.cellWarn : ''}`}
                          title={t ? (t.ok ? `${new Date(t.at).toLocaleTimeString()}${t.addonFailures ? ` · ${t.addonFailures} add-on(s) failed` : ''}` : KIND_LABEL[t.kind ?? ''] ?? 'Failed') : ''}>
                          {t ? (t.ok ? (t.ms / 1000).toFixed(1) : '✕') : ''}
                        </td>
                      );
                    })}
                    <td className={styles.colStatus}>
                      <span className={`${simStyles.status} ${simStyles[`status_${j.status}`]}`}>{JOB_STATUS[j.status]}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {picked?.conversationId != null && (
        <>
          <div className={styles.convHead}>
            {picked.id === baselineJob?.id ? 'Baseline' : `Conversation ${loadJobs.indexOf(picked) + 1}`} · #{picked.conversationId}
            {picked.stopped && <span className={styles.convNote}> — {picked.stopped}</span>}
            {picked.error && <span className={styles.convError}> — {picked.error}</span>}
          </div>
          <ConversationDetail
            agentSlug={agentSlug}
            conversationId={picked.conversationId}
            refreshKey={`${picked.turns}:${picked.status}`}
            emptyText={picked.status === 'pending' || picked.status === 'running' ? 'Starting — the first messages will appear here.' : 'No messages in this conversation.'}
          />
        </>
      )}
    </>
  );
}

// ─── Turn time over the run ─────────────────────────────────────────
//
// One dot per turn: x = when it started (seconds into the run), y = how
// long it took. Baseline turns orange, turns under load blue (categorical
// slots 1–2, validated together), a failed turn a red ✕ (status: critical,
// with its own shape and legend entry — never colour alone). Hover a dot
// for the turn. The side-by-side grid below is the table view.

const C_LOAD = '#2a78d6';
const C_BASE = '#eb6834';
const C_FAIL = '#d03b3b';
const CH = { w: 760, h: 220, l: 44, r: 12, t: 12, b: 30 };

interface Dot { x: number; y: number; conv: string; turn: number; ms: number; ok: boolean; base: boolean; kind?: string }

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function TurnTimeChart({ run, baselineJobId }: { run: LoadTestRun; baselineJobId: number | null }) {
  const [hover, setHover] = useState<Dot | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const start = new Date(run.createdAt).getTime();
  const loadJobs = run.jobs.filter(j => j.id !== baselineJobId);
  const dots: Dot[] = useMemo(() => run.jobs.flatMap(j => j.timings.map(t => ({
    x: Math.max(0, (new Date(t.at).getTime() - start) / 1000),
    y: t.ms / 1000,
    conv: j.id === baselineJobId ? 'Baseline' : `Conversation ${loadJobs.indexOf(j) + 1}`,
    turn: t.turn,
    ms: t.ms,
    ok: t.ok,
    base: j.id === baselineJobId,
    kind: t.kind,
  }))), [run.jobs, baselineJobId, start, loadJobs]);

  const xMax = niceMax(Math.max(30, ...dots.map(d => d.x + d.y)));
  const yMax = niceMax(Math.max(5, ...dots.map(d => d.y)));
  const px = (x: number) => CH.l + (x / xMax) * (CH.w - CH.l - CH.r);
  const py = (y: number) => CH.t + (1 - y / yMax) * (CH.h - CH.t - CH.b);
  const yTicks = [0, yMax / 2, yMax];
  // Round steps: quarters when they land on a multiple of 5 s, else fifths.
  const xParts = (xMax / 4) % 5 === 0 ? 4 : 5;
  const xTicks = Array.from({ length: xParts + 1 }, (_, i) => (i * xMax) / xParts);
  const hasFail = dots.some(d => !d.ok);
  const fmtT = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : `${Math.round(s)} s`);

  return (
    <div className={styles.chartBlock}>
      <div className={styles.chartHead}>
        <span className={styles.gridHeadText}>Turn time over the run</span>
        <span className={styles.legend}>
          {run.baseline && <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: C_BASE }} />Baseline</span>}
          <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: C_LOAD }} />Under load</span>
          {hasFail && <span className={styles.legendItem}><span className={styles.legendX} style={{ color: C_FAIL }}>✕</span>Failed turn</span>}
        </span>
      </div>
      <div className={styles.chartWrap} ref={wrap}>
        <svg viewBox={`0 0 ${CH.w} ${CH.h}`} className={styles.chart} role="img"
          aria-label={`Turn time over the run: ${dots.length} turns`} onMouseLeave={() => setHover(null)}>
          {yTicks.map(y => (
            <g key={`y${y}`}>
              <line x1={CH.l} x2={CH.w - CH.r} y1={py(y)} y2={py(y)} className={y === 0 ? styles.axisLine : styles.gridLine} />
              <text x={CH.l - 6} y={py(y) + 3.5} className={styles.tick} textAnchor="end">{`${Number(y.toFixed(1))} s`}</text>
            </g>
          ))}
          {xTicks.map(x => (
            <text key={`x${x}`} x={px(x)} y={CH.h - 10} className={styles.tick} textAnchor="middle">{fmtT(x)}</text>
          ))}
          {dots.map((d, i) => (
            <g key={i} onMouseEnter={() => setHover(d)}>
              <circle cx={px(d.x)} cy={py(d.y)} r={9} fill="transparent" />
              {d.ok
                ? <circle cx={px(d.x)} cy={py(d.y)} r={4} fill={d.base ? C_BASE : C_LOAD} stroke="#fff" strokeWidth={2} />
                : <text x={px(d.x)} y={py(d.y) + 4} textAnchor="middle" className={styles.failMark} fill={C_FAIL}>✕</text>}
            </g>
          ))}
          {dots.length === 0 && (
            <text x={CH.w / 2} y={CH.h / 2} textAnchor="middle" className={styles.tick}>Turn times appear here as they come in</text>
          )}
        </svg>
        {hover && (
          <div className={styles.tooltip} style={{ left: `${(px(hover.x) / CH.w) * 100}%`, top: `${(py(hover.y) / CH.h) * 100}%` }}>
            <b>{hover.conv} · turn {hover.turn}</b>
            <span>{hover.ok ? secs(hover.ms) : `failed — ${KIND_LABEL[hover.kind ?? ''] ?? 'error'}`} · at {fmtT(hover.x)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── New load test ──────────────────────────────────────────────────

/**
 * The run's setup, with its cost shown live in the footer. Script and
 * persona share one box of fixed height; persona-only settings are
 * disabled for a script rather than hidden, so nothing resizes.
 */
function NewLoadTestModal({ agentSlug, onClose, onReleased }: {
  agentSlug: string;
  onClose: () => void;
  onReleased: (run: LoadTestRun) => void;
}) {
  const [by, setBy] = useState(() => { try { return localStorage.getItem(BY_KEY) || ''; } catch { return ''; } });
  const [version, setVersion] = useState<'active' | 'published'>('active');
  const [conversations, setConversations] = useState(10);
  const [start, setStart] = useState<'together' | 'ramp'>('together');
  const [kind, setKind] = useState<'script' | 'persona'>('script');
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [persona, setPersona] = useState('');
  const [goal, setGoal] = useState('');
  const [turns, setTurns] = useState(5);
  const [model, setModel] = useState('');
  const [label, setLabel] = useState('');
  const [estimate, setEstimate] = useState<{ key: string; e: LoadTestEstimate | null; error: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const providers = getProviders();
  const lines = script.split('\n').map(l => l.trim()).filter(Boolean);

  const body: NewLoadTest | null = useMemo(() => {
    if (kind === 'script' && (lines.length === 0 || lines.length > MAX_TURNS)) return null;
    if (kind === 'persona' && !persona.trim()) return null;
    return {
      conversations, version, start,
      ...(kind === 'script'
        ? { lines }
        : { persona: persona.trim(), ...(goal.trim() ? { goal: goal.trim() } : {}), turns, ...(model ? { model } : {}) }),
      ...(label.trim() ? { label: label.trim() } : {}),
    };
  // lines is derived from script
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, version, start, kind, script, persona, goal, turns, model, label]);
  const bodyKey = body ? JSON.stringify({ ...body, label: undefined }) : '';

  // The estimate follows the setup, a moment after the last change.
  useEffect(() => {
    if (!body) return;
    let cancelled = false;
    const t = setTimeout(() => {
      estimateLoadTest({ agentSlug, loadTest: body })
        .then(e => { if (!cancelled) setEstimate({ key: bodyKey, e, error: '' }); })
        .catch(err => { if (!cancelled) setEstimate({ key: bodyKey, e: null, error: err instanceof Error ? err.message : String(err) }); });
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  // body is captured through bodyKey
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentSlug, bodyKey]);

  const est = estimate && estimate.key === bodyKey ? estimate : null;
  const ready = !!by.trim() && !!body && !!est?.e && !est.e.overCap;

  const submit = async () => {
    if (!ready || busy || !body) return;
    setBusy(true);
    setError('');
    try {
      try { localStorage.setItem(BY_KEY, by.trim()); } catch { /* private mode */ }
      onReleased(await releaseLoadTest({ agentSlug, by: by.trim(), loadTest: body }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const costLine = !body ? (kind === 'script' && lines.length > MAX_TURNS ? `At most ${MAX_TURNS} lines.` : '')
    : !est ? 'Working out the cost…'
      : est.error ? est.error
        : est.e!.overCap ? `About ${usd(est.e!.usd)} — over the $${est.e!.capUsd} cap`
          : `About ${usd(est.e!.usd)} · cap $${est.e!.capUsd}`;
  const costTitle = est?.e ? `${est.e.agentTurns} agent turns × ${usd(est.e.perTurnUsd)} — ${est.e.basis}.${est.e.baseline ? ' Includes the baseline conversation.' : ''}${est.e.unpriced.length ? ` No list price for ${est.e.unpriced.join(', ')} — counted at the top known rate, so this is an upper bound.` : ''}` : '';

  return (
    <Modal
      open
      onClose={onClose}
      title="⏱️ New load test"
      width={640}
      footer={
        <>
          <span className={`${styles.costLine} ${est?.e?.overCap || est?.error ? styles.costBad : ''}`} title={costTitle}>{error || costLine}</span>
          <button type="button" className={simStyles.formBtn} onClick={onClose}>Cancel</button>
          <button type="button" className={`${simStyles.formBtn} ${simStyles.formBtnPrimary}`} disabled={!ready || busy} onClick={submit}>
            {busy ? 'Starting…' : 'Start load test'}
          </button>
        </>
      }
    >
      <div className={simStyles.form}>
        <div className={simStyles.formRow}>
          <label className={simStyles.formField}>
            <span className={simStyles.formLabel}>Released by</span>
            <input className={simStyles.formInput} value={by} onChange={e => setBy(e.target.value)} placeholder="Your name" />
          </label>
          <div className={simStyles.formField}>
            <span className={simStyles.formLabel}>Agent version</span>
            <div className={simStyles.seg}>
              {(['active', 'published'] as const).map(v => (
                <button key={v} type="button" className={`${simStyles.segBtn} ${version === v ? simStyles.segOn : ''}`} onClick={() => setVersion(v)}
                  title={v === 'active' ? 'The latest saved version — the one the Builder opens' : 'What customers get'}>
                  {v === 'active' ? 'Active' : 'Published'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={simStyles.formRow}>
          <label className={`${simStyles.formField} ${styles.fieldNarrow}`}>
            <span className={simStyles.formLabel}>Conversations at once</span>
            <input className={simStyles.formInput} type="number" min={1} max={MAX_CONVERSATIONS} value={conversations}
              title={`1 to ${MAX_CONVERSATIONS}. With more than one, one conversation runs alone first as the baseline.`}
              onChange={e => setConversations(Math.max(1, Math.min(MAX_CONVERSATIONS, Number(e.target.value) || 1)))} />
          </label>
          <div className={simStyles.formField}>
            <span className={simStyles.formLabel}>Start</span>
            <div className={simStyles.seg}>
              <button type="button" className={`${simStyles.segBtn} ${start === 'together' ? simStyles.segOn : ''}`} onClick={() => setStart('together')}
                title="Every conversation starts at the same moment">All together</button>
              <button type="button" className={`${simStyles.segBtn} ${start === 'ramp' ? simStyles.segOn : ''}`} onClick={() => setStart('ramp')}
                title="Conversations start one after another, spread over a minute">Over a minute</button>
            </div>
          </div>
          <div className={simStyles.formField}>
            <span className={simStyles.formLabel}>The user is</span>
            <div className={simStyles.seg}>
              <button type="button" className={`${simStyles.segBtn} ${kind === 'script' ? simStyles.segOn : ''}`} onClick={() => setKind('script')}
                title="The same messages in every conversation — a slower turn means a slower server">A fixed script</button>
              <button type="button" className={`${simStyles.segBtn} ${kind === 'persona' ? simStyles.segOn : ''}`} onClick={() => setKind('persona')}
                title="A model plays the user — costs more, and conversations differ">A persona</button>
            </div>
          </div>
        </div>

        <div className={simStyles.scenario}>
          {kind === 'script' ? (
            <label className={simStyles.formField}>
              <span className={simStyles.formLabel}>The user's messages — one per line, up to {MAX_TURNS}</span>
              <textarea className={`${simStyles.formArea} ${simStyles.formAreaTall}`} dir="auto" value={script} onChange={e => setScript(e.target.value)} />
            </label>
          ) : (
            <>
              <label className={simStyles.formField}>
                <span className={simStyles.formLabel}>Who they are</span>
                <textarea className={simStyles.formArea} dir="auto" rows={3} value={persona} onChange={e => setPersona(e.target.value)}
                  placeholder="Dana, 19, student, opening her first bank account. Writes short messages." />
              </label>
              <label className={simStyles.formField}>
                <span className={simStyles.formLabel}>What they want <i>(optional)</i></span>
                <input className={simStyles.formInput} dir="auto" value={goal} onChange={e => setGoal(e.target.value)} placeholder="Find out the fees" />
              </label>
            </>
          )}
        </div>

        <div className={simStyles.formRow}>
          <label className={simStyles.formField}>
            <span className={simStyles.formLabel}>Model that plays the user</span>
            <select className={simStyles.formInput} value={model} disabled={kind === 'script'} onChange={e => setModel(e.target.value)}>
              <option value="">Default — the everyday model</option>
              {providers.map(p => (
                <optgroup key={p.id} label={p.label}>
                  {p.models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label className={`${simStyles.formField} ${simStyles.formFieldNarrow}`}>
            <span className={simStyles.formLabel}>Turns</span>
            <input className={simStyles.formInput} type="number" min={1} max={MAX_TURNS} disabled={kind === 'script'}
              value={kind === 'script' ? Math.min(lines.length, MAX_TURNS) : turns}
              onChange={e => setTurns(Math.max(1, Math.min(MAX_TURNS, Number(e.target.value) || 1)))} />
          </label>
        </div>

        <label className={simStyles.formField}>
          <span className={simStyles.formLabel}>Name for this load test <i>(optional)</i></span>
          <input className={simStyles.formInput} dir="auto" value={label} onChange={e => setLabel(e.target.value)} placeholder="10 at once after the prompt change" />
        </label>
      </div>
    </Modal>
  );
}

function Fact({ label, value, wide, wide2, danger, title }: {
  label: string; value: string | null | undefined; wide?: boolean; wide2?: boolean; danger?: boolean; title?: string;
}) {
  return (
    <div className={`${simStyles.fact} ${wide ? simStyles.factWide : ''} ${wide2 ? styles.factWide2 : ''}`} title={title}>
      <span className={simStyles.factLabel}>{label}</span>
      <span className={`${simStyles.factValue} ${danger ? simStyles.factDanger : ''}`} dir="auto">{value || '—'}</span>
    </div>
  );
}
