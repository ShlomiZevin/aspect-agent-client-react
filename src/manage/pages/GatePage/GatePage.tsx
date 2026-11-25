/**
 * Lybi Gate (beta) — the management center page. One page for the whole
 * environment (one environment = one bank), the same under every scope.
 * Server: aspect-agent-server/gate/ (/api/gate). Not connected to the
 * agents yet — the banner says so.
 *
 * Top to bottom: what is happening now (numbers) · the connections between
 * the bank and Lybi (file, the bank's API key, the bank's APIs Lybi calls)
 * · the field policy (sign, versions) · recent records (ask the bank / hand
 * off) · try a record · the live log. Every change opens a window.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  gateApi, gateRoot, GateApiError,
  type GateConnection, type GateDryRun, type GateField, type GateLogRow, type GateOverview, type GatePolicy, type GateRecord,
} from './gateApi';
import { ACTION_HE, ACTION_MEANING, BY_HE, G, TYPE_HE } from './gateCopy';
import { fmtTime, logDetails, storedText } from './gateFormat';
import { ConnectionModal, FieldModal, KeysModal, RecordModal, UploadModal, VersionsModal } from './GateModals';
import { ConfirmModal } from '../../components/ConfirmModal/ConfirmModal';
import { IconRefresh } from '../../icons';
import g from './GatePage.module.css';

const POLL_MS = 5000;

type Win =
  | { kind: 'field'; field: GateField } | { kind: 'versions' } | { kind: 'keys' } | { kind: 'upload' }
  | { kind: 'connection'; conn: GateConnection | null } | { kind: 'record'; id: string } | { kind: 'sign' } | null;

/** Registered with ManagePageProps but reads none: Gate is the same in every scope. */
export function GatePage() {
  const [overview, setOverview] = useState<GateOverview | null>(null);
  const [policy, setPolicy] = useState<{ signed: GatePolicy | null; draft: GatePolicy | null } | null>(null);
  const [connections, setConnections] = useState<GateConnection[]>([]);
  const [records, setRecords] = useState<GateRecord[]>([]);
  const [log, setLog] = useState<GateLogRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [win, setWin] = useState<Win>(null);
  const [tests, setTests] = useState<Record<string, { busy?: boolean; text?: string; ok?: boolean }>>({});
  const [setupBusy, setSetupBusy] = useState(false);

  // Fetch first, set state in the promise's callbacks (never synchronously in an effect).
  const loadLive = useCallback(() => Promise.all([gateApi.overview(), gateApi.log(), gateApi.records()])
    .then(([o, l, r]) => { setOverview(o); setLog(l.log); setRecords(r.records); setUpdatedAt(new Date()); }), []);
  const loadAll = useCallback(() => Promise.all([gateApi.policy(), gateApi.connections()])
    .then(([p, c]) => { setPolicy(p); setConnections(c.connections); return loadLive(); })
    .then(() => setError(null))
    .catch(err => setError(err instanceof GateApiError && err.code === 'gate_not_configured' ? G.notConfigured : G.loadFailed))
    .finally(() => setLoading(false)), [loadLive]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => {
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') loadLive().catch(() => { /* next tick */ }); }, POLL_MS);
    return () => window.clearInterval(t);
  }, [loadLive]);

  const refreshAfter = () => { setWin(null); loadAll(); };
  const endpoint = `${gateRoot()}/v1/records`;

  const testConn = async (c: GateConnection) => {
    setTests(t => ({ ...t, [c.id]: { busy: true } }));
    try {
      const r = await gateApi.testConnection(c.id);
      setTests(t => ({ ...t, [c.id]: { ok: r.ok, text: r.ok ? G.testOk(r.ms) : `${G.testFail}${r.error ? ` · ${r.error}` : ''}` } }));
    } catch { setTests(t => ({ ...t, [c.id]: { ok: false, text: G.failed } })); }
    loadLive().catch(() => {});
  };
  const connectMock = async () => {
    setSetupBusy(true);
    try { await gateApi.setupMockBank(); await loadAll(); } catch { setError(G.failed); }
    setSetupBusy(false);
  };

  return (
    <div className={g.page}>
      <div className={g.head}>
        <div className={g.titleBlock}>
          <h1 className={g.title}>{G.title}</h1>
          <span className={g.betaPill}>{G.beta}</span>
          <span className={g.scopeNote}>{G.scopeNote}</span>
        </div>
        <button type="button" className={g.refresh} onClick={() => { setLoading(true); loadAll(); }} disabled={loading}>
          <IconRefresh size={14} className={loading ? g.spin : undefined} />
          <span>{updatedAt ? `${G.updated} ${fmtTime(updatedAt.toISOString())}` : G.refresh}</span>
        </button>
      </div>

      <div className={g.banner} role="note">
        <b>{G.bannerTitle}</b>
        <span>{G.bannerText}</span>
      </div>

      {error && <div className={g.errorBox}>{error}</div>}

      <Kpis overview={overview} />

      <section className={g.card}>
        <header className={g.cardHead}><h2>{G.connTitle}</h2>
          <button type="button" className={g.linkBtn} onClick={() => setWin({ kind: 'connection', conn: null })}>+ {G.newConnection}</button>
        </header>
        <div className={g.conns}>
          <div className={g.conn}>
            <div className={g.connTop}><span className={g.connDir}>הבנק ← Lybi</span><h3>{G.connFile}</h3></div>
            <p className={g.muted}>{G.connFileSub}</p>
            <p className={g.connStat}>{G.connRecords(overview?.records.file || 0)}</p>
            <div className={g.connBtns}><button type="button" className={g.primaryBtn} onClick={() => setWin({ kind: 'upload' })}>{G.upload}</button></div>
          </div>
          <div className={g.conn}>
            <div className={g.connTop}><span className={g.connDir}>הבנק ← Lybi</span><h3>{G.connApi}</h3></div>
            <p className={g.muted}>{G.connApiSub}</p>
            <p className={g.connStat}>{G.connKeys(overview?.keys.active || 0)} · {G.connRecords(overview?.records.api || 0)}</p>
            <div className={g.connBtns}><button type="button" className={g.primaryBtn} onClick={() => setWin({ kind: 'keys' })}>{G.manageKeys}</button></div>
          </div>
          {connections.map(c => {
            const t = tests[c.id];
            return (
              <div key={c.id} className={g.conn}>
                <div className={g.connTop}><span className={g.connDir}>{c.kind === 'lookup' ? 'Lybi → הבנק → Lybi' : 'Lybi → הבנק'}</span><h3>{c.name}</h3></div>
                <p className={g.muted}>{c.kind === 'lookup' ? G.kindLookup : G.kindHandoff}</p>
                <p className={`${g.connStat} ${t ? (t.ok ? g.okText : g.badText) : ''}`}>
                  {t?.busy ? G.testing : t?.text || (c.lastStatus ? `${G.lastCall}: ${fmtTime(c.lastCalledAt)} · ${c.lastStatus}` : G.never)}
                </p>
                <div className={g.connBtns}>
                  <button type="button" className={g.secondaryBtn} onClick={() => testConn(c)} disabled={t?.busy}>{G.test}</button>
                  <button type="button" className={g.linkBtn} onClick={() => setWin({ kind: 'connection', conn: c })}>{G.edit}</button>
                </div>
              </div>
            );
          })}
          {connections.length === 0 && (
            <div className={`${g.conn} ${g.connEmpty}`}>
              <div className={g.connTop}><span className={g.connDir}>Lybi → הבנק</span><h3>{G.noBank}</h3></div>
              <p className={g.muted}>{G.noBankSub}</p>
              <div className={g.connBtns}><button type="button" className={g.primaryBtn} onClick={connectMock} disabled={setupBusy}>{setupBusy ? G.working : G.connectMock}</button></div>
            </div>
          )}
        </div>
        {overview?.bankKey && <p className={g.footNote}>{G.bankKey}: {overview.bankKey.name} · <code dir="ltr">{overview.bankKey.fingerprint}</code></p>}
      </section>

      <PolicySection policy={policy} onField={f => setWin({ kind: 'field', field: f })} onSign={() => setWin({ kind: 'sign' })} onVersions={() => setWin({ kind: 'versions' })} />

      <div className={g.twoCol}>
        <section className={g.card}>
          <header className={g.cardHead}><h2>{G.recTitle}</h2></header>
          <div className={g.scrollBox}>
            <table className={g.table}>
              <thead><tr><th className={g.cTime}>{G.colTime}</th><th className={g.cNarrow}>{G.colSource}</th><th>{G.colRef}</th><th>{G.colModel}</th><th className={g.cAction} /></tr></thead>
              <tbody>
                {records.length === 0 && <tr><td colSpan={5} className={g.muted}>{G.recEmpty}</td></tr>}
                {records.map(r => (
                  <tr key={r.id} className={g.rowClick} onClick={() => setWin({ kind: 'record', id: r.id })}>
                    <td className={g.muted}>{fmtTime(r.createdAt)}</td>
                    <td><span className={`${g.pill} ${g.grey}`}>{G.src[r.source]}</span></td>
                    <td dir="ltr" className={g.ref}>{r.externalRef || r.id.slice(0, 8)}</td>
                    <td className={g.val}>{G.recModelCount(Object.keys(r.modelView).length, Object.keys(r.data).length)}</td>
                    <td className={g.cAction}><span className={g.linkBtn}>{G.view}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <TrySection />
      </div>

      <section className={g.card}>
        <header className={g.cardHead}><h2><span className={g.liveDot} aria-hidden />{G.logTitle}</h2><span className={g.muted}>{G.logSub}</span></header>
        <div className={g.scrollBox}>
          <table className={g.table}>
            <thead><tr><th className={g.cTime}>{G.colTime}</th><th className={g.cNarrow}>{G.colDir}</th><th className={g.cKind}>{G.colKind}</th><th className={g.cNarrow}>{G.colStatus}</th><th>{G.colDetails}</th></tr></thead>
            <tbody>
              {log.length === 0 && <tr><td colSpan={5} className={g.muted}>{G.logEmpty}</td></tr>}
              {log.map(l => (
                <tr key={l.id}>
                  <td className={g.muted}>{fmtTime(l.at)}</td>
                  <td><span className={`${g.dir} ${g[`dir_${l.direction}`]}`}>{G.dir[l.direction]}</span></td>
                  <td>{G.kind[l.kind] || l.kind}</td>
                  <td><span className={`${g.pill} ${l.status === 'ok' ? g.ok : l.status === 'rejected' ? g.warn : g.bad}`}>{G.status[l.status]}{l.httpStatus ? ` · ${l.httpStatus}` : ''}</span></td>
                  <td className={g.details} title={logDetails(l)}>{logDetails(l)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {win?.kind === 'field' && <FieldModal field={win.field} onSaved={refreshAfter} onClose={() => setWin(null)} />}
      {win?.kind === 'versions' && <VersionsModal onClose={() => setWin(null)} />}
      {win?.kind === 'keys' && <KeysModal endpoint={endpoint} onChanged={() => loadLive().catch(() => {})} onClose={() => setWin(null)} />}
      {win?.kind === 'upload' && <UploadModal onDone={() => loadAll()} onClose={() => setWin(null)} />}
      {win?.kind === 'connection' && <ConnectionModal conn={win.conn} onSaved={refreshAfter} onClose={() => setWin(null)} />}
      {win?.kind === 'record' && <RecordModal recordId={win.id} connections={connections} onChanged={() => loadAll()} onClose={() => setWin(null)} />}
      {win?.kind === 'sign' && (() => {
        const undecided = policy?.draft?.fields.filter(f => f.isNew).length || 0;
        return (
          <ConfirmModal title={G.signTitle}
            body={`${G.signBody}${undecided ? ` ${G.signBodyNew(undecided)}` : ''}`}
            confirmLabel={undecided ? G.signConfirmNew : G.signConfirm}
            onConfirm={async () => { await gateApi.sign(undecided > 0); refreshAfter(); }}
            onClose={() => setWin(null)} />
        );
      })()}
    </div>
  );
}

/* ── Numbers ──────────────────────────────────────────────────────── */

function Kpis({ overview }: { overview: GateOverview | null }) {
  const today = (kinds: string[], status?: string) => (overview?.today || []).filter(t => kinds.includes(t.kind) && (!status || t.status === status)).reduce((s, t) => s + t.n, 0);
  const s = overview?.policy.signed;
  const pending = overview?.policy.draft?.newFields || 0;
  return (
    <div className={g.kpis}>
      <div className={`${g.kpi} ${s ? g.kpiGood : ''}`}>
        <span className={g.kpiLabel}>{G.kPolicy}</span>
        <span className={g.kpiValue}>{s ? G.kVersion(s.version) : G.kPolicyNone}</span>
        <span className={g.kpiSub}>{s ? `${G.kSignedBy} ${s.signedBy || '—'}` : ' '}</span>
      </div>
      <div className={`${g.kpi} ${pending ? g.kpiWarn : ''}`}>
        <span className={g.kpiLabel}>{G.kPending}</span>
        <span className={g.kpiValue}>{pending}</span>
        <span className={g.kpiSub}>{G.kPendingUnit}</span>
      </div>
      <div className={g.kpi}>
        <span className={g.kpiLabel}>{G.kKeys}</span>
        <span className={g.kpiValue}>{overview?.keys.active ?? 0}</span>
        <span className={g.kpiSub}>{G.kKeysUnit}</span>
      </div>
      <div className={g.kpi}>
        <span className={g.kpiLabel}>{G.kIn}</span>
        <span className={g.kpiValue}>{today(['inbound', 'file'], 'ok')}</span>
        <span className={g.kpiSub}>{G.kCalls}</span>
      </div>
      <div className={g.kpi}>
        <span className={g.kpiLabel}>{G.kOut}</span>
        <span className={g.kpiValue}>{today(['bank_call', 'handoff'])}</span>
        <span className={g.kpiSub}>{G.kCalls}</span>
      </div>
      <div className={`${g.kpi} ${today(['inbound'], 'rejected') ? g.kpiBad : ''}`}>
        <span className={g.kpiLabel}>{G.kRejected}</span>
        <span className={g.kpiValue}>{today(['inbound', 'file', 'bank_answer'], 'rejected')}</span>
        <span className={g.kpiSub}>{G.kCalls}</span>
      </div>
    </div>
  );
}

/* ── The policy ───────────────────────────────────────────────────── */

function PolicySection({ policy, onField, onSign, onVersions }: {
  policy: { signed: GatePolicy | null; draft: GatePolicy | null } | null;
  onField: (f: GateField) => void; onSign: () => void; onVersions: () => void;
}) {
  const shown = policy?.draft || policy?.signed || null;
  const signedBy = useMemo(() => new Map((policy?.signed?.fields || []).map(f => [f.field, f.action])), [policy]);
  const changes = policy?.draft ? policy.draft.fields.filter(f => !f.isNew && signedBy.get(f.field) !== f.action).length : 0;
  const newCount = policy?.draft ? policy.draft.fields.filter(f => f.isNew).length : 0;

  return (
    <section className={g.card}>
      <header className={g.cardHead}>
        <h2>{G.polTitle}</h2>
        <div className={g.polStatus}>
          {policy?.signed && <span className={`${g.pill} ${g.ok}`}>✓ {G.polSigned(policy.signed.version)} · {fmtTime(policy.signed.signedAt)}</span>}
          {policy?.draft && <span className={`${g.pill} ${g.warn}`}>{G.polDraft(policy.draft.version)} · {changes ? G.polChanges(changes) : G.polNoChanges}{newCount ? ` · ${G.polNew(newCount)}` : ''}</span>}
          <button type="button" className={g.linkBtn} onClick={onVersions}>{G.versions}</button>
          <button type="button" className={g.primaryBtn} onClick={onSign} disabled={!policy?.draft}>{G.sign}</button>
        </div>
      </header>
      {!shown && <p className={g.emptyText}>{G.polEmpty}</p>}
      {shown && (
        <div className={g.scrollBoxTall}>
          <table className={g.table}>
            <thead><tr><th className={g.cField}>{G.colField}</th><th className={g.cWhat}>{G.colWhat}</th><th className={g.cActionCol}>{G.colAction}</th><th>{G.colMeaning}</th><th className={g.cAction} /></tr></thead>
            <tbody>
              {shown.fields.map(f => {
                const changed = policy?.draft && !f.isNew && signedBy.get(f.field) !== f.action;
                return (
                  <tr key={f.field} className={f.isNew ? g.rowNew : changed ? g.rowChanged : ''}>
                    <td><b dir="ltr">{f.field}</b>{f.isNew && <span className={`${g.pill} ${g.warn} ${g.tagGap}`}>{G.newTag}</span>}</td>
                    <td>
                      <span>{TYPE_HE[f.detected] || f.detected}</span>
                      {f.by !== 'none' && <span className={`${g.byTag} ${f.by === 'detector' ? g.byReal : g.byName}`} title={f.by === 'detector' ? G.byDetectorTip : G.byNameTip}>{BY_HE[f.by]}</span>}
                    </td>
                    <td><span className={`${g.pill} ${g[`a_${f.action}`]}`}>{ACTION_HE[f.action]}</span></td>
                    <td className={g.muted}>{ACTION_MEANING[f.action]}</td>
                    <td className={g.cAction}><button type="button" className={g.linkBtn} onClick={() => onField(f)}>{G.change}</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ── Try a record ─────────────────────────────────────────────────── */

function TrySection() {
  const [text, setText] = useState('');
  const [useDraft, setUseDraft] = useState(false);
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<GateDryRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    gateApi.sample().then(r => setText(JSON.stringify(r.records[1] || r.records[0], null, 2))).catch(() => { /* empty box */ });
  }, []);

  const run = async () => {
    let rec: unknown;
    try { rec = JSON.parse(text); } catch { setError(G.tryBadJson); return; }
    if (!rec || typeof rec !== 'object' || Array.isArray(rec)) { setError(G.tryBadJson); return; }
    setBusy(true); setError(null);
    try { setOut(await gateApi.test(rec as Record<string, unknown>, useDraft)); } catch (err) { setError(err instanceof GateApiError && err.code === 'no_bank_key' ? G.uploadNoBank : G.failed); }
    setBusy(false);
  };

  return (
    <section className={g.card}>
      <header className={g.cardHead}><h2>{G.tryTitle}</h2><span className={g.muted}>{G.trySub}</span></header>
      <div className={g.tryBody}>
        <textarea className={g.tryInput} dir="ltr" value={text} onChange={e => setText(e.target.value)} spellCheck={false} aria-label={G.tryTitle} />
        <div className={g.tryBar}>
          <div className={g.seg} role="radiogroup">
            <button type="button" className={!useDraft ? g.segOn : ''} onClick={() => setUseDraft(false)}>{G.tryUseSigned}</button>
            <button type="button" className={useDraft ? g.segOn : ''} onClick={() => setUseDraft(true)}>{G.tryUseDraft}</button>
          </div>
          <button type="button" className={g.primaryBtn} onClick={run} disabled={busy}>{busy ? G.working : G.tryRun}</button>
        </div>
        <p className={g.errorLine} role="status">{error || (out && out.unknown.length ? G.tryUnknown(out.unknown.length) : ' ')}</p>
        <div className={g.tryOut}>
          {out && (
            <table className={g.table}>
              <thead><tr><th>{G.colField}</th><th>{G.recStored}</th><th>{G.recModel}</th></tr></thead>
              <tbody>
                {Object.entries(out.stored).map(([k, x]) => (
                  <tr key={k}>
                    <td dir="ltr"><b>{k}</b></td>
                    <td className={g.val} dir="auto">{storedText(x)}</td>
                    <td className={`${g.val} ${k in out.modelView ? '' : g.absent}`} dir="auto">{k in out.modelView ? out.modelView[k] : G.absent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
